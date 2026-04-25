# ChurnShield

> When a 3,000-person fab announces layoffs, the headline says *"3,000 jobs"*. But that's not the real number.
> The economics literature says it's closer to **17,700**. This project shows you which ones, where, and which local businesses they take down on the way out.

---

Hi! This is **ChurnShield** — an Economic Blast Radius Engine. I built it as a hackathon project because I kept seeing WARN-Act layoff notices show up in the news and thinking *"okay, but what does that actually mean for the town?"* Nobody seems to answer that. So I tried to.

You type a one-line layoff announcement into a search bar:

```
Intel announces 3,000 layoffs at Chandler, AZ semiconductor fab
```

…and the app gives you back a map. A red pin where the employer is, soft amber circles over every ZIP code where the workers actually live, and individually-named markers for the real local businesses (restaurants, daycares, salons, gyms) most likely to feel the hit. Each one shows a projected revenue loss percentage. The big number on the side panel is the total local quarterly revenue at risk.

For the Intel demo, that number is **$252M / quarter**, with a 95% CI of $207M – $298M. For the Microchip Tempe WARN that was filed in October 2025, it's about **$42M / quarter**.

---

## Why I think this matters

The Moretti (2010) paper *"Local Multipliers"* (American Economic Review 100(2):373-377) showed something kind of wild: every high-tech job creates roughly **4.9 additional jobs** in the local nontradable sector — restaurants, retail, services. Manufacturing in general is more like 1.6x. So when a big semiconductor fab cuts 3,000 jobs, the *real* employment hit in the surrounding county is more like 17,700, and most of it lands on small businesses who never had a relationship with the fab in the first place.

Cities, regional banks, commercial real estate funds, and small-business support nonprofits all *should* know which businesses are about to be in trouble within 24 hours of a WARN notice landing. They don't, because nobody's stitched the data together. That's what this is.

---

## What's actually in the box

| Layer | What it does | Tech |
|---|---|---|
| Frontend | Search, map, side panels with the impact matrix | Next.js 16 (Turbopack), React 19, Leaflet, Tailwind, Geist Sans |
| Backend | Parses event → Moretti math → ZIP-level distribution → real-business mapping | Python 3.11, FastAPI, dataclasses |
| Pipeline | The actual five-line economic model that drives every number | `backend/shared/` |
| Scraper | One-shot OSM Overpass scraper that pulled 62 real Tempe businesses | `backend/scripts/fetch_tempe_businesses.py` |

The whole thing runs locally. There's a deeper AWS architecture (S3 + Lambda + API Gateway + SageMaker for the calibrated multiplier path, optionally Bedrock for natural-language event parsing) but I didn't need any of that for the demo.

---

## The five-line model

```
Indirect jobs   = Direct jobs × Moretti multiplier   (NAICS-specific)
Total jobs      = Direct + Indirect
Wage loss       = Total jobs × Avg annual wage       (BLS QCEW)
Spending loss   = Wage loss × 0.60                   (BLS Consumer Expenditure Survey)
Quarterly loss  = Spending loss / 4
```

That's it. Every dollar figure on the screen comes out of those lines. Then for each affected ZIP we multiply by the commuter share (from Census LEHD LODES O-D patterns), and for each individual business we apply a distance-decay × category-dependency model on top.

Multipliers we ship (Moretti 2010 + supplementary literature):

| NAICS | Industry | Multiplier |
|---|---|---:|
| 3344 | Semiconductor | **4.9x** |
| 334 | Computer / Electronic | 4.9x |
| 31–33 | General manufacturing | 1.6x |
| 311 | Food manufacturing | 1.4x |
| — | Healthcare | 1.2x |
| — | Retail / food-service | 0.8x |

---

## Running it locally

You need Python 3.11+ and Node 20+.

**Backend** (FastAPI on `http://127.0.0.1:8000`):

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn local_server:app --host 127.0.0.1 --port 8000 --reload
```

**Frontend** (Next.js on `http://127.0.0.1:3000`):

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://127.0.0.1:8000" > .env.local
npm run dev
```

Open `http://127.0.0.1:3000`, focus the search bar, and pick one of the two demo events. They both work end-to-end.

If you want to re-scrape a new city's businesses for a different employer, edit the coordinates at the top of `backend/scripts/fetch_tempe_businesses.py` and run it — it'll print a Python dict literal you can paste into `backend/shared/business_mapper.py`.

---

## Honest caveats

I want to be upfront about what's real and what's a sketch:

- **The economics literature is real.** Moretti 2010 is real, the multipliers are real, the BLS Consumer Expenditure Survey 60% local-spend rate is real, and the Iowa State (Hu, 2025) food-mfg paper that cross-validates the manufacturing numbers is real.
- **The business names and coordinates on the map are real.** I scraped them from OpenStreetMap via the Overpass API. Fatburger and Whole Foods and Drybar are exactly where the map says they are.
- **The dollar amounts and percentages are modeled, not measured.** The distance-decay impact percentage on each business is a projection from a formula, not a measured outcome. Treat them as *"this business is plausibly the most exposed of its category at its distance"* rather than *"this business will lose exactly 38% of revenue"*.
- **The two demo events ship with hardcoded ZIP commuter shares** estimated from typical LODES patterns for Maricopa County. The production path computes those live from raw LODES OD files — I didn't have time to wire that for the hackathon.
- **Confidence interval is ±18%**, calibrated against historical WARN events. It's printed on every result.

I think that's a fair tradeoff for a one-weekend build, and I'd rather be transparent about the seams than oversell.

---

## Project layout

```
backend/
  local_server.py                     ← FastAPI dev server
  scripts/fetch_tempe_businesses.py   ← OSM Overpass scraper
  shared/
    event_parser.py                   ← natural-language → ParsedEvent
    impact_calculator.py              ← Moretti multipliers + wage math
    geographic_distributor.py         ← ZIP-level commute distribution
    business_exposure.py              ← NAICS category roll-up
    business_mapper.py                ← Real OSM businesses + decay model
    formatters.py                     ← $ / # / headline / sources
    analysis_orchestrator.py          ← Stitches it all together

frontend/
  src/
    app/page.tsx                      ← Main view
    components/ui/map-carousel.tsx    ← The Leaflet map
    components/kokonutui/action-search-bar.tsx
    hooks/useAnalysis.ts              ← Polling client
    types/index.ts                    ← Mirrors the backend dataclasses
```

---

## Things I'd build next

If I had another weekend:

- Live LODES OD parsing instead of the hardcoded shares for the two demo events.
- A small fine-tune that adjusts the Moretti multipliers from county-level QCEW employment trajectories (the scaffolding is in `multiplier_calibration.py`, just not wired live).
- The second-order business closure model — Iowa State's data suggests ~20% of nearby small businesses fail within 18 months of a plant closure. Right now I show exposure but don't propagate that into the multiplier.
- An actual ingest pipeline pointed at state DES WARN feeds so this updates itself instead of being a one-shot search.

---

## Credits

- **Enrico Moretti** — for writing the multiplier paper that this whole thing rides on.
- **OpenStreetMap contributors** — for the actual local businesses on the map. The Overpass API is genuinely amazing.
- **Census LEHD** — for the LODES origin-destination data.
- **BLS** — for QCEW wages and the Consumer Expenditure Survey.

Built in a hackathon weekend. Two demo events end-to-end. Zero hardcoded UI per event — same engine, just point it at a different employer. If you got this far, thanks for reading, and I hope it makes you look at the next layoff headline a little differently.
