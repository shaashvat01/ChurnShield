"""
Event parser: extracts structured employer event data from natural language text.
Uses regex patterns to identify employer, city, state, event type, and magnitude.
Resolves location to county FIPS and ZIP codes using the LODES crosswalk.
"""
import re
from typing import Optional
import pandas as pd

from .models import ParsedEvent, EventType, MagnitudeType


class ParseError(Exception):
    def __init__(self, message: str, field: str):
        super().__init__(message)
        self.field = field


LAYOFF_KEYWORDS = [
    r"layoff", r"lay off", r"laid off", r"laying off",
    r"workforce reduction", r"job cuts?", r"cutting.*jobs",
    r"eliminat\w+.*positions?", r"downsiz\w+", r"restructur\w+",
    r"rif\b", r"reduction in force"
]

CLOSURE_KEYWORDS = [
    r"clos\w+.*plant", r"plant.*clos\w+", r"shut\w*\s*down",
    r"clos\w+.*facilit", r"facilit\w+.*clos\w+"
]

ACQUISITION_KEYWORDS = [
    r"acqui\w+", r"merg\w+", r"take\s*over", r"buyout", r"buy\s*out"
]

US_STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia"
}
STATE_NAME_TO_ABBR = {v.lower(): k for k, v in US_STATES.items()}


def _detect_event_type(text: str) -> EventType:
    text_lower = text.lower()

    for pattern in CLOSURE_KEYWORDS:
        if re.search(pattern, text_lower):
            return EventType.PLANT_CLOSURE

    for pattern in ACQUISITION_KEYWORDS:
        if re.search(pattern, text_lower):
            return EventType.ACQUISITION

    for pattern in LAYOFF_KEYWORDS:
        if re.search(pattern, text_lower):
            return EventType.LAYOFF

    return EventType.LAYOFF


def _extract_magnitude(text: str) -> tuple[MagnitudeType, float]:
    text_clean = text.replace(",", "")

    pct_match = re.search(r"(\d+(?:\.\d+)?)\s*%", text_clean)
    if pct_match:
        return MagnitudeType.PERCENTAGE, float(pct_match.group(1))

    headcount_patterns = [
        r"(\d+)\s*(?:layoffs?|job cuts?|jobs?|workers?|employees?|positions?|people|staff)",
        r"(?:lay\w*\s+off|cut\w*|eliminat\w+|reduc\w+|fir\w+|let\w*\s+go)\s+(\d+)",
        r"(\d+)\s+(?:will\s+(?:lose|be\s+(?:laid|let|cut)))",
        r"announces?\s+(\d+)",
    ]
    for pattern in headcount_patterns:
        match = re.search(pattern, text_clean, re.IGNORECASE)
        if match:
            val = float(match.group(1))
            if val > 0:
                return MagnitudeType.HEADCOUNT, val

    num_match = re.search(r"\b(\d{2,6})\b", text_clean)
    if num_match:
        val = float(num_match.group(1))
        if 10 <= val <= 500000:
            return MagnitudeType.HEADCOUNT, val

    raise ParseError("Could not extract job loss magnitude from event text", "magnitude")


def _extract_location(text: str) -> tuple[str, str]:
    """Extract city and state abbreviation from text."""
    city_state = re.search(
        r"(?:in|at|from|near)\s+([A-Z][a-zA-Z\s]+?),\s*([A-Z]{2})\b",
        text
    )
    if city_state:
        return city_state.group(1).strip(), city_state.group(2).upper()

    for abbr in US_STATES:
        pattern = r"([A-Z][a-zA-Z\s]+?),\s*" + abbr + r"\b"
        match = re.search(pattern, text)
        if match:
            return match.group(1).strip(), abbr

    for name, abbr in STATE_NAME_TO_ABBR.items():
        if name in text.lower():
            city_match = re.search(
                r"(?:in|at|from|near)\s+([A-Z][a-zA-Z\s]+?)(?:,|\s+" + re.escape(name) + r")",
                text, re.IGNORECASE
            )
            if city_match:
                return city_match.group(1).strip(), abbr

    raise ParseError("Could not extract city and state from event text", "location")


def _extract_employer(text: str) -> str:
    """Extract employer name from the beginning of the text or common patterns."""
    patterns = [
        r"^([A-Z][A-Za-z&\.\'\-\s]+?)(?:\s+(?:announces?|plans?|to\s+|will\s+|is\s+|has\s+))",
        r"^([A-Z][A-Za-z&\.\'\-\s]+?)(?:\s+(?:lay|cut|eliminat|clos|shut|restructur|downsiz))",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            name = match.group(1).strip()
            if len(name) >= 2:
                return name

    words = text.split()
    name_parts = []
    for w in words:
        if w[0].isupper() or w in ("&", "Inc.", "Corp.", "LLC", "Co."):
            name_parts.append(w)
        else:
            break
    if name_parts:
        return " ".join(name_parts)

    raise ParseError("Could not extract employer name from event text", "employer_name")


def _detect_industry(text: str) -> Optional[str]:
    """Detect industry from keywords in the text."""
    text_lower = text.lower()
    industry_map = {
        "semiconductor": "semiconductor",
        "chip": "semiconductor",
        "fab": "semiconductor",
        "tech": "high-tech",
        "software": "high-tech",
        "manufactur": "manufacturing",
        "auto": "manufacturing",
        "retail": "retail",
        "restaurant": "food-service",
        "hospital": "healthcare",
        "health": "healthcare",
        "bank": "finance",
        "financial": "finance",
        "mine": "mining",
        "mining": "mining",
        "construct": "construction",
    }
    for keyword, industry in industry_map.items():
        if keyword in text_lower:
            return industry
    return None


def resolve_location(
    city: str, state: str, xwalk_df: pd.DataFrame
) -> tuple[str, list[str], list[str]]:
    """Resolve city+state to county FIPS, ZIP codes, and census blocks using XWALK.

    Returns (county_fips, zip_codes, census_blocks).
    """
    state_rows = xwalk_df[xwalk_df["st"] == _state_to_fips(state)]
    if state_rows.empty:
        raise ParseError(f"No XWALK data for state {state}", "location")

    city_lower = city.lower().strip()
    city_matches = state_rows[
        state_rows["stplcname"].str.lower().str.strip() == city_lower
    ]

    if city_matches.empty:
        city_matches = state_rows[
            state_rows["stplcname"].str.lower().str.contains(city_lower, na=False)
        ]

    if city_matches.empty:
        city_matches = state_rows[
            state_rows["ctyname"].str.lower().str.contains(city_lower, na=False)
        ]

    if city_matches.empty:
        raise ParseError(f"Could not find {city}, {state} in XWALK data", "location")

    county_fips = city_matches["cty"].mode().iloc[0]
    zip_codes = city_matches["zcta"].dropna().unique().tolist()
    census_blocks = city_matches["tabblk2020"].unique().tolist()

    return county_fips, zip_codes, census_blocks


def _state_to_fips(state_abbr: str) -> str:
    """Convert state abbreviation to 2-digit FIPS code."""
    fips_map = {
        "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06",
        "CO": "08", "CT": "09", "DE": "10", "DC": "11", "FL": "12",
        "GA": "13", "HI": "15", "ID": "16", "IL": "17", "IN": "18",
        "IA": "19", "KS": "20", "KY": "21", "LA": "22", "ME": "23",
        "MD": "24", "MA": "25", "MI": "26", "MN": "27", "MS": "28",
        "MO": "29", "MT": "30", "NE": "31", "NV": "32", "NH": "33",
        "NJ": "34", "NM": "35", "NY": "36", "NC": "37", "ND": "38",
        "OH": "39", "OK": "40", "OR": "41", "PA": "42", "RI": "44",
        "SC": "45", "SD": "46", "TN": "47", "TX": "48", "UT": "49",
        "VT": "50", "VA": "51", "WA": "53", "WV": "54", "WI": "55",
        "WY": "56"
    }
    return fips_map.get(state_abbr.upper(), "00")


def parse_event(text: str, xwalk_df: Optional[pd.DataFrame] = None) -> ParsedEvent:
    """Parse a natural-language event description into a structured ParsedEvent."""
    if not text or not text.strip():
        raise ParseError("Event text is empty", "event_text")

    employer_name = _extract_employer(text)
    city, state = _extract_location(text)
    event_type = _detect_event_type(text)
    magnitude_type, magnitude_value = _extract_magnitude(text)
    industry = _detect_industry(text)

    county_fips = None
    work_zip_codes = []
    work_census_blocks = []

    if xwalk_df is not None:
        try:
            county_fips, work_zip_codes, work_census_blocks = resolve_location(
                city, state, xwalk_df
            )
        except ParseError:
            pass

    return ParsedEvent(
        employer_name=employer_name,
        city=city,
        state=state,
        event_type=event_type,
        magnitude_type=magnitude_type,
        magnitude_value=magnitude_value,
        county_fips=county_fips,
        work_zip_codes=work_zip_codes,
        work_census_blocks=work_census_blocks,
        naics_industry=industry,
    )
