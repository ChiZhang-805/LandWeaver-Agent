from __future__ import annotations

from copy import deepcopy
from typing import Any

from .calculator import calculate_profit


def _as_dict(value: Any) -> dict:
    if isinstance(value, dict):
        return deepcopy(value)
    if hasattr(value, "model_dump"):
        return value.model_dump()
    return dict(value)


def calculate_sensitivity(buildings: list[dict], constraint_set: Any) -> list[dict]:
    base = _as_dict(constraint_set)
    scenarios: list[dict] = []
    for price_delta in (-0.10, -0.05, 0.0, 0.05, 0.10):
        scenario = deepcopy(base)
        scenario["assumptions"]["avg_selling_price_cny_per_m2"] *= 1 + price_delta
        snapshot = calculate_profit(buildings, scenario)
        scenarios.append(
            {
                "variable": "avg_selling_price_cny_per_m2",
                "delta": price_delta,
                "gross_margin_ratio": snapshot["gross_margin_ratio"],
                "gross_margin_cny": snapshot["gross_margin_cny"],
            }
        )
    for cost_delta in (-0.05, 0.0, 0.05):
        scenario = deepcopy(base)
        scenario["assumptions"]["hard_cost_cny_per_m2"] *= 1 + cost_delta
        snapshot = calculate_profit(buildings, scenario)
        scenarios.append(
            {
                "variable": "hard_cost_cny_per_m2",
                "delta": cost_delta,
                "gross_margin_ratio": snapshot["gross_margin_ratio"],
                "gross_margin_cny": snapshot["gross_margin_cny"],
            }
        )
    return scenarios

