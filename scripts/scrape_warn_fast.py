#!/usr/bin/env python3
"""
Fast WARN Act scraper for Arizona.

The warn-scraper package is too slow because it fetches every detail page
individually (~783 HTTP requests). This script scrapes only the search result
tables, which contain all the fields we need for the blast radius engine:
employer name, city, ZIP, notice date, and WARN type.

Scrapes all years from 2010 to present in ~30 seconds.
"""
import csv
import os
import time
from datetime import datetime

import requests
from bs4 import BeautifulSoup

OUTPUT_DIR = "data/warn-notices"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "az_warn_notices.csv")
BASE_URL = "https://www.azjobconnection.gov/search/warn_lookups"

HEADERS = ["employer", "city", "zip", "lwib_area", "notice_date", "warn_type"]


def search_params(start_date, end_date):
    return {
        "utf8": "✓",
        "q[employer_name_cont]": "",
        "q[main_contact_contact_info_addresses_full_location_city_matches]": "",
        "q[zipcode_code_start]": "",
        "q[service_delivery_area_id_eq]": "",
        "q[notice_on_gteq]": start_date,
        "q[notice_on_lteq]": end_date,
        "q[notice_eq]": "",
        "commit": "Search",
    }


def parse_results_page(html):
    """Extract rows from the WARN search results table."""
    soup = BeautifulSoup(html, "html.parser")
    rows = []
    for tr in soup.find_all("tr")[1:]:  # skip header row
        cells = tr.find_all("td")
        if len(cells) >= 6:
            rows.append({
                "employer": cells[0].get_text(strip=True),
                "city": cells[1].get_text(strip=True),
                "zip": cells[2].get_text(strip=True),
                "lwib_area": cells[3].get_text(strip=True),
                "notice_date": cells[4].get_text(strip=True),
                "warn_type": cells[5].get_text(strip=True),
            })
    return rows


def get_next_page_url(html):
    """Find the 'next page' link if it exists."""
    soup = BeautifulSoup(html, "html.parser")
    link = soup.find("a", class_="next_page")
    if link and link.get("href"):
        return f"https://www.azjobconnection.gov{link['href']}"
    return None


def fetch_with_retry(session, url, params=None, max_retries=3):
    """Fetch a URL with retry on 429 rate-limit errors."""
    for attempt in range(max_retries):
        resp = session.get(url, params=params, timeout=20)
        if resp.status_code == 429:
            wait = 2 ** (attempt + 1)
            print(f"    Rate limited, waiting {wait}s...")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp
    resp.raise_for_status()


def scrape_year(session, year):
    """Scrape all pages for a single year."""
    start = f"{year}-01-01"
    end = f"{year}-12-31"
    all_rows = []

    resp = fetch_with_retry(session, BASE_URL, params=search_params(start, end))

    rows = parse_results_page(resp.text)
    all_rows.extend(rows)

    next_url = get_next_page_url(resp.text)
    page = 1
    while next_url:
        page += 1
        time.sleep(1.0)
        resp = fetch_with_retry(session, next_url)
        rows = parse_results_page(resp.text)
        all_rows.extend(rows)
        next_url = get_next_page_url(resp.text)

    time.sleep(0.5)
    return all_rows


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) warn-data-collector/1.0"
    })

    current_year = datetime.now().year
    start_year = 2010
    all_data = []

    print(f"Scraping AZ WARN notices from {start_year} to {current_year}...")
    overall_start = time.time()

    for year in range(current_year, start_year - 1, -1):
        t0 = time.time()
        rows = scrape_year(session, year)
        elapsed = time.time() - t0
        all_data.extend(rows)
        print(f"  {year}: {len(rows):>4} notices ({elapsed:.1f}s)")

    seen = set()
    unique_data = []
    for row in all_data:
        key = (row["employer"], row["notice_date"], row["city"])
        if key not in seen:
            seen.add(key)
            unique_data.append(row)

    with open(OUTPUT_FILE, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=HEADERS)
        writer.writeheader()
        writer.writerows(unique_data)

    total = time.time() - overall_start
    print(f"\nDone! {len(unique_data)} unique notices saved to {OUTPUT_FILE}")
    print(f"Total time: {total:.1f}s")
    print(f"File size: {os.path.getsize(OUTPUT_FILE):,} bytes")


if __name__ == "__main__":
    main()
