"""
Convert large CSV data files to Parquet for faster Lambda loading.
Parquet gives 5-10x faster reads and smaller file sizes.
"""
import os
import sys
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def convert_lodes():
    print("Converting LODES OD CSV → Parquet...")
    src = os.path.join(DATA_DIR, "lodes-arizona", "az_od_main_JT00_2023.csv")
    dst = os.path.join(DATA_DIR, "lodes-arizona", "az_od_main_JT00_2023.parquet")

    df = pd.read_csv(
        src,
        dtype={"w_geocode": str, "h_geocode": str},
        usecols=["w_geocode", "h_geocode", "S000", "SI01", "SI02", "SI03"],
    )
    print(f"  → {len(df):,} rows, {df.memory_usage(deep=True).sum() / 1e6:.1f} MB in memory")
    df.to_parquet(dst, index=False, engine="pyarrow")
    csv_size = os.path.getsize(src) / 1e6
    pq_size = os.path.getsize(dst) / 1e6
    print(f"  → CSV: {csv_size:.1f} MB → Parquet: {pq_size:.1f} MB ({csv_size/pq_size:.1f}x smaller)")


def convert_xwalk():
    print("Converting XWALK CSV → Parquet...")
    src = os.path.join(DATA_DIR, "lodes-arizona", "az_xwalk.csv")
    dst = os.path.join(DATA_DIR, "lodes-arizona", "az_xwalk.parquet")

    df = pd.read_csv(
        src,
        dtype=str,
        usecols=[
            "tabblk2020", "st", "cty", "ctyname", "zcta",
            "stplcname", "blklatdd", "blklondd",
        ],
    )
    print(f"  → {len(df):,} rows")
    df.to_parquet(dst, index=False, engine="pyarrow")
    csv_size = os.path.getsize(src) / 1e6
    pq_size = os.path.getsize(dst) / 1e6
    print(f"  → CSV: {csv_size:.1f} MB → Parquet: {pq_size:.1f} MB ({csv_size/pq_size:.1f}x smaller)")


def convert_cbp():
    print("Converting CBP ZIP detail TXT → Parquet...")
    src = os.path.join(DATA_DIR, "cbp-business-patterns", "zbp22detail.txt")
    dst = os.path.join(DATA_DIR, "cbp-business-patterns", "zbp22detail.parquet")

    df = pd.read_csv(src, dtype=str)
    if "est" in df.columns:
        df["est"] = pd.to_numeric(df["est"], errors="coerce")
    print(f"  → {len(df):,} rows")
    df.to_parquet(dst, index=False, engine="pyarrow")
    csv_size = os.path.getsize(src) / 1e6
    pq_size = os.path.getsize(dst) / 1e6
    print(f"  → TXT: {csv_size:.1f} MB → Parquet: {pq_size:.1f} MB ({csv_size/pq_size:.1f}x smaller)")


if __name__ == "__main__":
    convert_lodes()
    convert_xwalk()
    convert_cbp()
    print("\nAll conversions complete.")
