"""
Main analysis orchestrator: Tie all modules together into a single analysis pipeline.
Now with dynamic multiplier calibration and real business mapping.

Based on:
- Moretti (2010) "Local Multipliers" - American Economic Review
- Iowa State (Hu, 2025) "Local Economic Impacts of Food Manufacturing Plant Closures"
"""

from dataclasses import dataclass, asdict
from typing import Optional, List, Dict
import json

from .event_parser import ParsedEvent, INTEL_CHANDLER_EVENT, MICROCHIP_TEMPE_EVENT
from .impact_calculator import calculate_impact, ImpactResult, INTEL_CHANDLER_IMPACT
from .geographic_distributor import (
    ZipImpact,
    INTEL_CHANDLER_ZIP_IMPACTS,
    MICROCHIP_TEMPE_ZIP_IMPACTS,
)
from .business_exposure import BusinessExposure, INTEL_CHANDLER_BUSINESS_EXPOSURE
from .business_mapper import (
    Business,
    get_businesses_for_zip,
    compute_businesses_from_epicenter,
    INTEL_CHANDLER_BUSINESSES,
    MICROCHIP_TEMPE_BUSINESSES,
)
from .formatters import (
    format_dollar,
    format_number,
    format_multiplier,
    generate_headline_summary,
    generate_methodology_explanation,
    generate_data_sources,
    generate_confidence_interval,
    format_confidence_interval,
)


@dataclass
class Epicenter:
    """Source-employer location for the map (rendered as a red pin)."""
    employer: str
    city: str
    state: str
    zip_code: Optional[str]
    latitude: float
    longitude: float
    direct_jobs: int


@dataclass
class AnalysisResponse:
    """Complete analysis response with all computed values."""
    event: ParsedEvent
    epicenter: Optional[Epicenter]
    direct_jobs: int
    multiplier: float
    multiplier_source: str  # "moretti_2010" or "calibrated"
    indirect_jobs: int
    total_jobs_at_risk: int
    quarterly_revenue_loss: float
    annual_revenue_loss: float
    affected_zips: List[ZipImpact]
    business_exposure: List[BusinessExposure]
    businesses_by_category: Dict[str, List[Business]]
    headline_summary: str
    methodology: Dict[str, str]
    data_sources: Dict[str, str]
    confidence_interval: str


def run_analysis(
    event: ParsedEvent,
    use_calibrated_multiplier: bool = False,
) -> AnalysisResponse:
    """
    Run full analysis pipeline for a given event.
    
    Args:
        event: ParsedEvent object with employer, location, headcount, etc.
        use_calibrated_multiplier: Use trained model or Moretti literature values
    
    Returns:
        AnalysisResponse with all computed values
    """
    
    # Step 1: Calculate impact using Moretti multipliers
    multiplier_source = "moretti_2010"
    multiplier_override = None
    
    if use_calibrated_multiplier:
        try:
            from .multiplier_calibration import train_multiplier_model, predict_multiplier
            model, scaler, metadata = train_multiplier_model()
            multiplier_override = predict_multiplier(
                naics_code=event.naics_code or "3344",
                wage=95000,
                unemployment_rate=0.05,
                pop_density=60,
                direct_jobs=event.direct_jobs,
                model=model,
                scaler=scaler,
            )
            multiplier_source = f"calibrated (R²={metadata['r2_score']:.3f}, n={metadata['n_samples']})"
        except Exception as e:
            print(f"Multiplier calibration failed: {e}. Using Moretti (2010) values.")
            multiplier_source = "moretti_2010"
    
    # Calculate impact
    impact = calculate_impact(
        direct_jobs=event.direct_jobs,
        naics_code=event.naics_code,
        industry=event.industry,
        multiplier_override=multiplier_override,
        wage_override=95000 if event.industry == "semiconductor" else None,
    )
    
    # Step 2: Distribute impact geographically
    # For demo, route to per-employer hardcoded ZIP impact tables. In
    # production, would compute from live LODES data via geographic_distributor.
    if event.employer == "Intel":
        affected_zips = INTEL_CHANDLER_ZIP_IMPACTS
    elif event.employer == "Microchip":
        affected_zips = MICROCHIP_TEMPE_ZIP_IMPACTS
    else:
        affected_zips = []

    # Step 3: Business exposure (NAICS-aggregated, scales with quarterly loss).
    # We reuse the Intel Chandler exposure mix for any semiconductor event in
    # Maricopa County and rescale dollar impact proportional to the new event.
    if event.employer == "Intel":
        business_exposure = INTEL_CHANDLER_BUSINESS_EXPOSURE
    elif event.employer == "Microchip":
        scale = impact.quarterly_revenue_loss / 252_000_000.0
        business_exposure = [
            BusinessExposure(
                naics_code=b.naics_code,
                naics_description=b.naics_description,
                # Tempe has fewer establishments than Chandler; conservatively
                # scale establishment counts down a touch.
                establishment_count=int(round(b.establishment_count * 0.85)),
                dollar_impact=b.dollar_impact * scale,
                exposure_score=b.exposure_score,
            )
            for b in INTEL_CHANDLER_BUSINESS_EXPOSURE
        ]
    else:
        business_exposure = []

    # Step 4: Get real businesses near the source employer
    businesses_by_category: Dict[str, List[Business]] = {}
    if event.latitude is not None and event.longitude is not None:
        if event.employer == "Intel":
            # Intel Chandler — canonical real-business set scraped from OSM.
            businesses_by_category = INTEL_CHANDLER_BUSINESSES
        elif event.employer == "Microchip":
            # Microchip Tempe — real businesses scraped from OSM around the
            # Tempe epicenter (see backend/scripts/fetch_tempe_businesses.py).
            businesses_by_category = MICROCHIP_TEMPE_BUSINESSES
        else:
            # For other AZ events, recompute distances + impact% from the
            # known Phoenix-metro business set against the new epicenter.
            try:
                businesses_by_category = compute_businesses_from_epicenter(
                    epicenter_lat=event.latitude,
                    epicenter_lon=event.longitude,
                    keep_top=10,
                    max_radius_miles=8.0,
                )
            except Exception as e:
                print(f"Business recomputation failed: {e}. Using empty set.")
                businesses_by_category = {}
    
    # Step 5: Generate output
    headline = generate_headline_summary(
        employer=event.employer,
        location=f"{event.location_city}, {event.location_state}",
        direct_jobs=impact.direct_jobs,
        indirect_jobs=impact.indirect_jobs,
        quarterly_revenue_loss=impact.quarterly_revenue_loss,
        affected_zip_count=len(affected_zips),
    )
    
    methodology = generate_methodology_explanation()
    data_sources = generate_data_sources()
    
    # Confidence interval
    lower, upper = generate_confidence_interval(impact.quarterly_revenue_loss)
    confidence_str = format_confidence_interval(lower, upper)
    
    epicenter = None
    if event.latitude is not None and event.longitude is not None:
        epicenter = Epicenter(
            employer=event.employer,
            city=event.location_city,
            state=event.location_state,
            zip_code=event.location_zip,
            latitude=event.latitude,
            longitude=event.longitude,
            direct_jobs=impact.direct_jobs,
        )

    return AnalysisResponse(
        event=event,
        epicenter=epicenter,
        direct_jobs=impact.direct_jobs,
        multiplier=impact.multiplier,
        multiplier_source=multiplier_source,
        indirect_jobs=impact.indirect_jobs,
        total_jobs_at_risk=impact.total_jobs_at_risk,
        quarterly_revenue_loss=impact.quarterly_revenue_loss,
        annual_revenue_loss=impact.annual_revenue_loss,
        affected_zips=affected_zips,
        business_exposure=business_exposure,
        businesses_by_category=businesses_by_category,
        headline_summary=headline,
        methodology=methodology,
        data_sources=data_sources,
        confidence_interval=confidence_str,
    )


def analysis_response_to_json(response: AnalysisResponse) -> str:
    """
    Convert AnalysisResponse to JSON for API response.
    """
    
    def serialize_obj(obj):
        if hasattr(obj, '__dataclass_fields__'):
            return asdict(obj)
        return str(obj)
    
    # Serialize businesses
    businesses_serialized = {}
    for category, businesses in response.businesses_by_category.items():
        businesses_serialized[category] = [serialize_obj(b) for b in businesses]
    
    data = {
        "event": serialize_obj(response.event),
        "epicenter": serialize_obj(response.epicenter) if response.epicenter else None,
        "direct_jobs": response.direct_jobs,
        "multiplier": response.multiplier,
        "multiplier_source": response.multiplier_source,
        "indirect_jobs": response.indirect_jobs,
        "total_jobs_at_risk": response.total_jobs_at_risk,
        "quarterly_revenue_loss": response.quarterly_revenue_loss,
        "annual_revenue_loss": response.annual_revenue_loss,
        "affected_zips": [serialize_obj(z) for z in response.affected_zips],
        "business_exposure": [serialize_obj(b) for b in response.business_exposure],
        "businesses_by_category": businesses_serialized,
        "headline_summary": response.headline_summary,
        "methodology": response.methodology,
        "data_sources": response.data_sources,
        "confidence_interval": response.confidence_interval,
    }
    
    return json.dumps(data, indent=2)


# Demo: Run analysis on Intel Chandler event
if __name__ == "__main__":
    print("=" * 60)
    print("ECONOMIC BLAST RADIUS ENGINE - Intel Chandler Analysis")
    print("=" * 60)
    
    response = run_analysis(INTEL_CHANDLER_EVENT, use_calibrated_multiplier=False)
    
    print(f"\n{response.headline_summary}")
    print(f"\nMultiplier source: {response.multiplier_source}")
    print(f"\n--- IMPACT SUMMARY ---")
    print(f"Direct jobs lost: {format_number(response.direct_jobs)}")
    print(f"Moretti multiplier: {format_multiplier(response.multiplier)}")
    print(f"Indirect jobs at risk: {format_number(response.indirect_jobs)}")
    print(f"Total jobs at risk: {format_number(response.total_jobs_at_risk)}")
    print(f"Quarterly revenue loss: {format_dollar(response.quarterly_revenue_loss)}")
    print(f"Annual revenue loss: {format_dollar(response.annual_revenue_loss)}")
    print(f"Confidence interval: {response.confidence_interval}")
    
    print(f"\n--- TOP AFFECTED ZIP CODES ---")
    for z in response.affected_zips[:5]:
        print(f"  {z.zip_code} ({z.city}): {format_dollar(z.dollar_impact)} ({z.commuter_share*100:.1f}% of workers)")
    
    print(f"\n--- MOST EXPOSED BUSINESS CATEGORIES ---")
    for b in response.business_exposure[:5]:
        print(f"  {b.naics_description}: {format_dollar(b.dollar_impact)} ({b.establishment_count} establishments)")
    
    print(f"\n--- REAL BUSINESSES AT RISK ---")
    for category, businesses in list(response.businesses_by_category.items())[:3]:
        print(f"  {category.upper()}: {len(businesses)} businesses")
        for biz in businesses[:3]:
            print(f"    - {biz.name} ({biz.distance_miles:.1f} mi)")
    
    print(f"\n--- METHODOLOGY ---")
    for step, explanation in response.methodology.items():
        print(f"  {step}: {explanation[:80]}...")
    
    print(f"\n--- DATA SOURCES ---")
    for source, citation in response.data_sources.items():
        print(f"  {source}: {citation[:60]}...")
