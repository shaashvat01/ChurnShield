"""
Commute mapper: distributes economic impact across ZIP codes using
LODES Origin-Destination commute flow data.

Uses actual Census commuting patterns to determine where workers at
the employer's location live, then proportionally distributes job losses
and dollar impacts to those residential ZIP codes.
"""
import math
import pandas as pd
from typing import Optional

from .models import ZIPImpact


def distribute_impact(
    work_census_blocks: list[str],
    total_jobs_lost: int,
    total_dollar_impact: float,
    lodes_df: pd.DataFrame,
    xwalk_df: pd.DataFrame,
    employer_lat: Optional[float] = None,
    employer_lon: Optional[float] = None,
    radius_miles: float = 50.0,
) -> list[ZIPImpact]:
    """Distribute job losses across residential ZIP codes using LODES commute flows.

    1. Filter LODES OD rows where w_geocode (workplace) is in the employer's census blocks
    2. Map h_geocode (home) to ZIP codes via XWALK
    3. Compute each ZIP's commuter share
    4. Distribute total_jobs_lost and total_dollar_impact proportionally
    """
    if not work_census_blocks:
        return []

    work_flows = lodes_df[lodes_df["w_geocode"].isin(set(work_census_blocks))]

    if work_flows.empty:
        return _fallback_uniform(
            work_census_blocks, total_jobs_lost, total_dollar_impact, xwalk_df
        )

    block_to_zip = dict(zip(xwalk_df["tabblk2020"], xwalk_df["zcta"]))

    work_flows = work_flows.copy()
    work_flows["home_zip"] = work_flows["h_geocode"].map(block_to_zip)
    work_flows = work_flows.dropna(subset=["home_zip"])

    zip_flows = work_flows.groupby("home_zip")["S000"].sum().reset_index()
    zip_flows.columns = ["zip_code", "flow"]

    total_flow = zip_flows["flow"].sum()
    if total_flow == 0:
        return []

    zip_flows["share"] = zip_flows["flow"] / total_flow

    if employer_lat is not None and employer_lon is not None:
        block_coords = xwalk_df[["zcta", "blklatdd", "blklondd"]].copy()
        block_coords["blklatdd"] = pd.to_numeric(block_coords["blklatdd"], errors="coerce")
        block_coords["blklondd"] = pd.to_numeric(block_coords["blklondd"], errors="coerce")
        zip_centroids = block_coords.groupby("zcta").agg(
            lat=("blklatdd", "mean"),
            lon=("blklondd", "mean")
        ).reset_index()

        zip_flows = zip_flows.merge(
            zip_centroids, left_on="zip_code", right_on="zcta", how="left"
        )
        zip_flows["distance_miles"] = zip_flows.apply(
            lambda r: _haversine(employer_lat, employer_lon, r["lat"], r["lon"])
            if pd.notna(r.get("lat")) and pd.notna(r.get("lon")) else None,
            axis=1
        )
        zip_flows = zip_flows[
            (zip_flows["distance_miles"].isna()) |
            (zip_flows["distance_miles"] <= radius_miles)
        ]

        remaining_share = zip_flows["share"].sum()
        if remaining_share > 0:
            zip_flows["share"] = zip_flows["share"] / remaining_share

    results = []
    for _, row in zip_flows.iterrows():
        results.append(ZIPImpact(
            zip_code=str(row["zip_code"]),
            commuter_share=round(float(row["share"]), 6),
            estimated_jobs_lost=round(total_jobs_lost * float(row["share"]), 1),
            estimated_dollar_impact=round(total_dollar_impact * float(row["share"]), 2),
            distance_miles=round(float(row["distance_miles"]), 1) if pd.notna(row.get("distance_miles")) else None,
        ))

    results.sort(key=lambda z: z.commuter_share, reverse=True)
    return results


def get_top_zips(zip_impacts: list[ZIPImpact], n: int = 10) -> list[ZIPImpact]:
    return sorted(zip_impacts, key=lambda z: z.commuter_share, reverse=True)[:n]


def get_employer_coords(
    city: str, state_fips: str, xwalk_df: pd.DataFrame
) -> tuple[Optional[float], Optional[float]]:
    """Get approximate lat/lon for an employer's city from XWALK block centroids."""
    city_blocks = xwalk_df[
        xwalk_df["stplcname"].str.lower().str.strip() == city.lower().strip()
    ]
    if city_blocks.empty:
        city_blocks = xwalk_df[
            xwalk_df["stplcname"].str.lower().str.contains(city.lower().strip(), na=False)
        ]
    if city_blocks.empty:
        return None, None

    lats = pd.to_numeric(city_blocks["blklatdd"], errors="coerce")
    lons = pd.to_numeric(city_blocks["blklondd"], errors="coerce")
    return float(lats.mean()), float(lons.mean())


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in miles between two lat/lon points."""
    R = 3959
    lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _fallback_uniform(
    work_blocks: list[str],
    total_jobs: int,
    total_dollars: float,
    xwalk_df: pd.DataFrame,
) -> list[ZIPImpact]:
    """When LODES data has no matches, distribute uniformly across nearby ZIPs."""
    block_zips = xwalk_df[xwalk_df["tabblk2020"].isin(set(work_blocks))]
    unique_zips = block_zips["zcta"].dropna().unique()

    if len(unique_zips) == 0:
        return []

    share = 1.0 / len(unique_zips)
    return [
        ZIPImpact(
            zip_code=str(z),
            commuter_share=round(share, 6),
            estimated_jobs_lost=round(total_jobs * share, 1),
            estimated_dollar_impact=round(total_dollars * share, 2),
        )
        for z in unique_zips
    ]
