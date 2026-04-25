"""
ChurnShield Backend Shared Modules

Economic Blast Radius Engine - Predicts economic ripple effects of employer events.

Based on:
- Moretti (2010) "Local Multipliers" - American Economic Review
- Census LEHD LODES commute flow data
- Census ZIP Code Business Patterns
- BLS QCEW wage data
"""

from .event_parser import ParsedEvent, INTEL_CHANDLER_EVENT, MICROCHIP_TEMPE_EVENT
from .impact_calculator import (
    calculate_impact,
    ImpactResult,
    INTEL_CHANDLER_IMPACT,
    get_multiplier,
    MORETTI_MULTIPLIERS,
)
from .geographic_distributor import (
    ZipImpact,
    distribute_impact_by_commute_flows,
    INTEL_CHANDLER_ZIP_IMPACTS,
    MICROCHIP_TEMPE_ZIP_IMPACTS,
)
from .business_exposure import (
    BusinessExposure,
    analyze_business_exposure,
    INTEL_CHANDLER_BUSINESS_EXPOSURE,
)
from .business_mapper import (
    Business,
    get_businesses_for_zip,
    get_businesses_from_overpass,
    compute_businesses_from_epicenter,
    get_businesses_for_employer,
    INTEL_CHANDLER_BUSINESSES,
    MICROCHIP_TEMPE_BUSINESSES,
)
from .formatters import (
    format_dollar,
    format_dollars,
    format_number,
    format_multiplier,
    generate_headline_summary,
    generate_methodology_explanation,
    generate_data_sources,
    generate_confidence_interval,
    format_confidence_interval,
)
from .analysis_orchestrator import (
    AnalysisResponse,
    run_analysis,
    analysis_response_to_json,
)

__all__ = [
    # Event parsing
    "ParsedEvent",
    "INTEL_CHANDLER_EVENT",
    "MICROCHIP_TEMPE_EVENT",
    
    # Impact calculation
    "calculate_impact",
    "ImpactResult",
    "INTEL_CHANDLER_IMPACT",
    "get_multiplier",
    "MORETTI_MULTIPLIERS",
    
    # Geographic distribution
    "ZipImpact",
    "distribute_impact_by_commute_flows",
    "INTEL_CHANDLER_ZIP_IMPACTS",
    "MICROCHIP_TEMPE_ZIP_IMPACTS",
    
    # Business exposure
    "BusinessExposure",
    "analyze_business_exposure",
    "INTEL_CHANDLER_BUSINESS_EXPOSURE",
    
    # Business mapping
    "Business",
    "get_businesses_for_zip",
    "get_businesses_from_overpass",
    "compute_businesses_from_epicenter",
    "get_businesses_for_employer",
    "INTEL_CHANDLER_BUSINESSES",
    "MICROCHIP_TEMPE_BUSINESSES",
    
    # Formatters
    "format_dollar",
    "format_dollars",
    "format_number",
    "format_multiplier",
    "generate_headline_summary",
    "generate_methodology_explanation",
    "generate_data_sources",
    "generate_confidence_interval",
    "format_confidence_interval",
    
    # Main orchestrator
    "AnalysisResponse",
    "run_analysis",
    "analysis_response_to_json",
]
