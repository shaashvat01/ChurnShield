"""
One-shot script to scrape real businesses around Microchip Technology
Tempe (33.4255, -111.9400) from OpenStreetMap via the Overpass API,
and emit a Python dict literal that can be pasted into business_mapper.py.

Run:
    python backend/scripts/fetch_tempe_businesses.py > /tmp/tempe.py
"""

from __future__ import annotations

import json
import math
import sys
import time
from typing import Dict, List, Tuple

import requests


EPICENTER_LAT = 33.4255
EPICENTER_LON = -111.9400
RADIUS_METERS = 4800  # ~3 miles
KEEP_PER_CATEGORY = 12

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
]


# OSM tag -> our internal category
CATEGORY_QUERIES: Dict[str, List[str]] = {
    "restaurant": [
        'node["amenity"="restaurant"]',
        'node["amenity"="fast_food"]',
        'node["amenity"="food_court"]',
    ],
    "cafe": [
        'node["amenity"="cafe"]',
        'node["amenity"="ice_cream"]',
    ],
    "childcare": [
        'node["amenity"="childcare"]',
        'node["amenity"="kindergarten"]',
    ],
    "personal_services": [
        'node["shop"="hairdresser"]',
        'node["shop"="beauty"]',
        'node["shop"="massage"]',
        'node["shop"="dry_cleaning"]',
        'node["shop"="laundry"]',
    ],
    "retail": [
        'node["shop"="convenience"]',
        'node["shop"="supermarket"]',
        'node["shop"="grocery"]',
        'node["shop"="bakery"]',
        'node["shop"="butcher"]',
    ],
    "fitness": [
        'node["leisure"="fitness_centre"]',
        'node["leisure"="sports_centre"]',
        'node["sport"="fitness"]',
    ],
}


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 3959.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


def estimate_revenue_impact_pct(distance_miles: float, category: str) -> float:
    distance_factor = max(0.05, 0.40 - (distance_miles * 0.07))
    multipliers = {
        "restaurant": 1.0,
        "cafe": 0.9,
        "fitness": 0.85,
        "personal_services": 0.8,
        "childcare": 0.75,
        "retail": 0.6,
    }
    return round(distance_factor * multipliers.get(category, 0.7) * 100, 1)


def build_query(category_filters: List[str]) -> str:
    inner = "\n".join(
        f"  {f}(around:{RADIUS_METERS},{EPICENTER_LAT},{EPICENTER_LON});"
        for f in category_filters
    )
    return f"""[out:json][timeout:30];
(
{inner}
);
out body;
"""


def call_overpass(query: str) -> dict:
    last_err = None
    for url in OVERPASS_ENDPOINTS:
        try:
            r = requests.post(
                url,
                data={"data": query},
                headers={"User-Agent": "ChurnShield/0.1 (demo)"},
                timeout=45,
            )
            if r.status_code == 200:
                return r.json()
            last_err = f"HTTP {r.status_code}: {r.text[:200]}"
        except Exception as e:  # noqa: BLE001
            last_err = str(e)
            time.sleep(1)
    raise RuntimeError(f"All Overpass endpoints failed: {last_err}")


def fetch_category(category: str, filters: List[str]) -> List[Tuple[str, float, float, float]]:
    """Returns list of (name, lat, lon, distance_miles)."""
    print(f"  -> querying {category}...", file=sys.stderr)
    data = call_overpass(build_query(filters))
    seen: set[Tuple[str, float, float]] = set()
    out: List[Tuple[str, float, float, float]] = []
    for el in data.get("elements", []):
        if el.get("type") != "node":
            continue
        tags = el.get("tags", {}) or {}
        name = tags.get("name") or tags.get("brand") or tags.get("operator")
        if not name:
            continue
        lat = el.get("lat")
        lon = el.get("lon")
        if lat is None or lon is None:
            continue
        key = (name.strip().lower(), round(lat, 4), round(lon, 4))
        if key in seen:
            continue
        seen.add(key)
        dist = haversine_miles(EPICENTER_LAT, EPICENTER_LON, lat, lon)
        out.append((name.strip(), float(lat), float(lon), round(dist, 2)))
    out.sort(key=lambda t: t[3])
    return out[:KEEP_PER_CATEGORY]


def main() -> None:
    print(f"# Microchip Tempe businesses scraped from OSM Overpass", file=sys.stderr)
    print(f"# Epicenter: {EPICENTER_LAT}, {EPICENTER_LON}", file=sys.stderr)

    all_data: Dict[str, List[Tuple[str, float, float, float]]] = {}
    for category, filters in CATEGORY_QUERIES.items():
        try:
            all_data[category] = fetch_category(category, filters)
        except Exception as e:  # noqa: BLE001
            print(f"  !! {category} failed: {e}", file=sys.stderr)
            all_data[category] = []
        time.sleep(1.5)  # be polite to overpass

    # Emit a Python dict literal usable in business_mapper.py
    print("MICROCHIP_TEMPE_BUSINESSES: Dict[str, List[Business]] = {")
    for category, items in all_data.items():
        print(f'    "{category}": [')
        for name, lat, lon, dist in items:
            impact = estimate_revenue_impact_pct(dist, category)
            safe_name = name.replace('"', '\\"').replace("'", "\\'")
            print(
                f'        Business("{safe_name}", "{category}", {lat}, {lon}, {dist}, {impact}),'
            )
        print("    ],")
    print("}")

    counts = {k: len(v) for k, v in all_data.items()}
    print(f"\n# counts: {json.dumps(counts)}", file=sys.stderr)
    total = sum(counts.values())
    print(f"# total: {total}", file=sys.stderr)


if __name__ == "__main__":
    main()
