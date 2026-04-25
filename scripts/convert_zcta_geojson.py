#!/usr/bin/env python3
"""
Convert the US-wide ZCTA shapefile to an AZ-only GeoJSON.

The ZCTA shapefile (781MB) is too large to serve to a browser. This script:
1. Reads the full US shapefile
2. Extracts AZ ZIP codes from the LODES crosswalk (az_xwalk.csv)
3. Filters to only AZ ZCTAs
4. Exports as simplified GeoJSON (~200KB–1MB)

Output: data/zcta-boundaries/az_zcta_boundaries.geojson
"""
import os
import time

import geopandas as gpd
import pandas as pd

SHAPEFILE = "data/zcta-boundaries/tl_2020_us_zcta520.shp"
CROSSWALK = "data/lodes-arizona/az_xwalk.csv"
OUTPUT = "data/zcta-boundaries/az_zcta_boundaries.geojson"


def get_az_zctas():
    """Get the set of ZCTAs that belong to Arizona from the LODES crosswalk."""
    print("Reading AZ crosswalk to find AZ ZIP codes...")
    xwalk = pd.read_csv(CROSSWALK, dtype=str, usecols=["zcta"])
    zctas = set(xwalk["zcta"].dropna().unique())
    print(f"  Found {len(zctas)} unique AZ ZCTAs")
    return zctas


def main():
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    start = time.time()

    az_zctas = get_az_zctas()

    print(f"Reading US shapefile ({SHAPEFILE})...")
    t0 = time.time()
    gdf = gpd.read_file(SHAPEFILE)
    print(f"  Loaded {len(gdf)} ZCTAs in {time.time() - t0:.1f}s")
    print(f"  Columns: {list(gdf.columns)}")

    zcta_col = [c for c in gdf.columns if "ZCTA" in c.upper()][0]
    print(f"  ZCTA column: {zcta_col}")

    az_gdf = gdf[gdf[zcta_col].isin(az_zctas)].copy()
    print(f"  Filtered to {len(az_gdf)} AZ ZCTAs")

    print("Simplifying geometries for web rendering...")
    az_gdf["geometry"] = az_gdf["geometry"].simplify(tolerance=0.001, preserve_topology=True)

    if az_gdf.crs and az_gdf.crs.to_epsg() != 4326:
        print(f"  Reprojecting from {az_gdf.crs} to EPSG:4326 (WGS84)...")
        az_gdf = az_gdf.to_crs(epsg=4326)

    print(f"Writing GeoJSON to {OUTPUT}...")
    az_gdf.to_file(OUTPUT, driver="GeoJSON")

    size = os.path.getsize(OUTPUT)
    total = time.time() - start
    print(f"\nDone! {len(az_gdf)} AZ ZCTA boundaries saved")
    print(f"File size: {size:,} bytes ({size/1024/1024:.1f} MB)")
    print(f"Total time: {total:.1f}s")

    print("\nSample ZCTAs:")
    for _, row in az_gdf.head(5).iterrows():
        print(f"  {row[zcta_col]}")


if __name__ == "__main__":
    main()
