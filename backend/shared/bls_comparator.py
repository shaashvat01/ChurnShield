"""
BLS comparator: builds comparison between current BLS baseline data
and the engine's predicted post-event values.
"""
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional

from .models import ParsedEvent, BLSComparison


def build_comparison(
    event: ParsedEvent,
    total_jobs_lost: int,
    total_wage_loss: float,
    qcew_df: Optional[pd.DataFrame] = None,
) -> BLSComparison:
    """Build a BLS comparison showing baseline vs predicted employment/wages."""
    baseline_emp = 0
    baseline_wages = 0.0
    data_vintage = "QCEW 2024 Q2"

    if qcew_df is not None:
        total_row = qcew_df[
            (qcew_df["own_code"] == "0")
            & (qcew_df["industry_code"] == "10")
        ]
        if not total_row.empty:
            emp = total_row.iloc[0].get("month1_emplvl")
            wages = total_row.iloc[0].get("total_qtrly_wages")
            if pd.notna(emp):
                baseline_emp = int(emp)
            if pd.notna(wages):
                baseline_wages = float(wages)

    predicted_emp = max(0, baseline_emp - total_jobs_lost)
    predicted_wages = max(0, baseline_wages - (total_wage_loss / 4.0))

    projected_quarter = _project_report_quarter()

    return BLSComparison(
        baseline_employment=baseline_emp,
        predicted_employment=predicted_emp,
        baseline_wages=baseline_wages,
        predicted_wages=predicted_wages,
        projected_report_quarter=projected_quarter,
        data_vintage=data_vintage,
    )


def _project_report_quarter() -> str:
    """BLS QCEW data has a ~5 month lag.
    Current quarter end + 5 months = projected report quarter.
    """
    now = datetime.now()
    quarter_month = ((now.month - 1) // 3) * 3 + 3
    quarter_end = datetime(now.year, quarter_month, 1) + timedelta(days=31)
    quarter_end = quarter_end.replace(day=1) - timedelta(days=1)

    report_date = quarter_end + timedelta(days=150)
    report_q = (report_date.month - 1) // 3 + 1
    return f"Q{report_q} {report_date.year}"
