"""
Data pipeline for loading Census LODES, XWALK, WARN, QCEW, CBP, and ZCTA data.
Supports both local file paths and S3 bucket access with /tmp/ caching for Lambda.
Prefers Parquet files for speed; falls back to CSV if Parquet not found.
"""
import os
import io
import json
import pandas as pd
import boto3
from typing import Optional

S3_BUCKET = os.environ.get("DATA_BUCKET", "blast-radius-data-us-west-2")
LOCAL_DATA_DIR = os.environ.get("LOCAL_DATA_DIR", "")

_s3_client = None
_cache = {}


def _get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client("s3")
    return _s3_client


def _resolve_path(s3_key: str, local_path: str) -> str:
    """Return a local file path: LOCAL_DATA_DIR first, then /tmp/ cache, then download from S3."""
    if LOCAL_DATA_DIR:
        full_local = os.path.join(LOCAL_DATA_DIR, local_path)
        if os.path.exists(full_local):
            return full_local

    tmp_path = os.path.join("/tmp", local_path.replace("/", "_"))
    if os.path.exists(tmp_path):
        return tmp_path

    s3 = _get_s3_client()
    resp = s3.get_object(Bucket=S3_BUCKET, Key=s3_key)
    data = resp["Body"].read()

    os.makedirs(os.path.dirname(tmp_path) if os.path.dirname(tmp_path) else "/tmp", exist_ok=True)
    with open(tmp_path, "wb") as f:
        f.write(data)

    return tmp_path


def _load_bytes(s3_key: str, local_path: str) -> bytes:
    path = _resolve_path(s3_key, local_path)
    with open(path, "rb") as f:
        return f.read()


def load_lodes_od() -> pd.DataFrame:
    """Load LODES Origin-Destination data for Arizona (Parquet preferred)."""
    cache_key = "lodes_od"
    if cache_key in _cache:
        return _cache[cache_key]

    try:
        path = _resolve_path(
            "data/lodes-arizona/az_od_main_JT00_2023.parquet",
            "lodes-arizona/az_od_main_JT00_2023.parquet"
        )
        df = pd.read_parquet(path, columns=["w_geocode", "h_geocode", "S000", "SI01", "SI02", "SI03"])
        df["w_geocode"] = df["w_geocode"].astype(str)
        df["h_geocode"] = df["h_geocode"].astype(str)
    except Exception:
        raw = _load_bytes(
            "data/lodes-arizona/az_od_main_JT00_2023.csv",
            "lodes-arizona/az_od_main_JT00_2023.csv"
        )
        df = pd.read_csv(
            io.BytesIO(raw),
            dtype={"w_geocode": str, "h_geocode": str},
            usecols=["w_geocode", "h_geocode", "S000", "SI01", "SI02", "SI03"]
        )

    _cache[cache_key] = df
    return df


def load_xwalk() -> pd.DataFrame:
    """Load LODES geographic crosswalk for Arizona (Parquet preferred)."""
    cache_key = "xwalk"
    if cache_key in _cache:
        return _cache[cache_key]

    cols = ["tabblk2020", "st", "cty", "ctyname", "zcta", "stplcname", "blklatdd", "blklondd"]

    try:
        path = _resolve_path(
            "data/lodes-arizona/az_xwalk.parquet",
            "lodes-arizona/az_xwalk.parquet"
        )
        df = pd.read_parquet(path, columns=cols)
        for c in df.columns:
            df[c] = df[c].astype(str)
    except Exception:
        raw = _load_bytes(
            "data/lodes-arizona/az_xwalk.csv",
            "lodes-arizona/az_xwalk.csv"
        )
        df = pd.read_csv(io.BytesIO(raw), dtype=str, usecols=cols)

    _cache[cache_key] = df
    return df


def load_warn_data() -> pd.DataFrame:
    """Load Arizona WARN Act notices."""
    cache_key = "warn"
    if cache_key in _cache:
        return _cache[cache_key]

    raw = _load_bytes(
        "data/warn-notices/az_warn_notices.csv",
        "warn-notices/az_warn_notices.csv"
    )
    df = pd.read_csv(io.BytesIO(raw), dtype=str)
    _cache[cache_key] = df
    return df


def load_qcew(county_fips: str = "04013") -> pd.DataFrame:
    """Load QCEW wage data for a county. Defaults to Maricopa County (04013)."""
    cache_key = f"qcew_{county_fips}"
    if cache_key in _cache:
        return _cache[cache_key]

    raw = _load_bytes(
        "data/qcew-wages/maricopa_county_2024_q2.csv",
        "qcew-wages/maricopa_county_2024_q2.csv"
    )
    df = pd.read_csv(io.BytesIO(raw), dtype=str)
    numeric_cols = [
        "qtrly_estabs", "month1_emplvl", "month2_emplvl", "month3_emplvl",
        "total_qtrly_wages", "avg_wkly_wage"
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    _cache[cache_key] = df
    return df


def load_cbp() -> pd.DataFrame:
    """Load Census ZIP Code Business Patterns data (Parquet preferred)."""
    cache_key = "cbp"
    if cache_key in _cache:
        return _cache[cache_key]

    try:
        path = _resolve_path(
            "data/cbp-business-patterns/zbp22detail.parquet",
            "cbp-business-patterns/zbp22detail.parquet"
        )
        df = pd.read_parquet(path)
    except Exception:
        raw = _load_bytes(
            "data/cbp-business-patterns/zbp22detail.txt",
            "cbp-business-patterns/zbp22detail.txt"
        )
        df = pd.read_csv(io.BytesIO(raw), dtype=str)
        if "est" in df.columns:
            df["est"] = pd.to_numeric(df["est"], errors="coerce")

    _cache[cache_key] = df
    return df


def load_zcta_geojson() -> dict:
    """Load AZ ZCTA boundary GeoJSON."""
    cache_key = "zcta_geojson"
    if cache_key in _cache:
        return _cache[cache_key]

    raw = _load_bytes(
        "data/zcta-boundaries/az_zcta_boundaries.geojson",
        "zcta-boundaries/az_zcta_boundaries.geojson"
    )
    geojson = json.loads(raw)
    _cache[cache_key] = geojson
    return geojson


def get_naics_label(naics_code: str) -> str:
    """Map 2-digit NAICS code to human-readable label."""
    labels = {
        "11": "Agriculture",
        "21": "Mining & Extraction",
        "22": "Utilities",
        "23": "Construction",
        "31": "Manufacturing",
        "32": "Manufacturing",
        "33": "Manufacturing",
        "42": "Wholesale Trade",
        "44": "Retail Trade",
        "45": "Retail Trade",
        "48": "Transportation",
        "49": "Warehousing",
        "51": "Information & Tech",
        "52": "Finance & Insurance",
        "53": "Real Estate",
        "54": "Professional Services",
        "55": "Management",
        "56": "Admin & Waste Services",
        "61": "Education",
        "62": "Health Care",
        "71": "Arts & Entertainment",
        "72": "Accommodation & Food",
        "81": "Other Services",
        "92": "Public Administration",
    }
    return labels.get(naics_code[:2], f"NAICS {naics_code}")


def clear_cache():
    """Clear in-memory cache (useful for testing)."""
    global _cache
    _cache = {}
