"""
Formatting utilities for dollar amounts and headline generation.
"""


def format_dollars(amount: float) -> str:
    """Format dollar amount: $X.XB for billions, $XM for millions, $X,XXX for less."""
    if amount < 0:
        return "-" + format_dollars(abs(amount))

    if amount >= 1_000_000_000:
        return f"${amount / 1_000_000_000:.1f}B"
    elif amount >= 1_000_000:
        return f"${amount / 1_000_000:.0f}M"
    else:
        return f"${amount:,.0f}"


def format_number(n: int) -> str:
    return f"{n:,}"


def format_headline(
    indirect_jobs: int,
    total_businesses: int,
    total_dollar_impact: float,
    affected_zips: int,
    employer_name: str,
    city: str,
) -> str:
    """Generate a headline string summarizing the blast radius."""
    return (
        f"{employer_name} event in {city} projected to put "
        f"{format_number(indirect_jobs)} indirect jobs at risk across "
        f"{affected_zips} ZIP codes, threatening {format_number(total_businesses)} "
        f"local businesses with {format_dollars(total_dollar_impact)} in "
        f"annual economic impact"
    )
