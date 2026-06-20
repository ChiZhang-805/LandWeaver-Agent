from __future__ import annotations

import math
from typing import Any


def _as_dict(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        return value.model_dump()
    return dict(value)


def calculate_profit(buildings: list[dict], constraint_set: Any) -> dict:
    constraints = _as_dict(constraint_set)
    assumptions = _as_dict(constraints["assumptions"])
    total_gfa_m2 = round(sum(float(building["gfa_m2"]) for building in buildings), 4)
    units = int(sum(int(building["units"]) for building in buildings))
    saleable_area_m2 = round(total_gfa_m2 * float(constraints["saleable_ratio"]), 4)
    parking_spaces = int(math.ceil(units * float(constraints["parking_ratio_per_unit"])))
    revenue_cny = round(saleable_area_m2 * float(assumptions["avg_selling_price_cny_per_m2"]), 2)
    hard_cost_cny = round(total_gfa_m2 * float(assumptions["hard_cost_cny_per_m2"]), 2)
    product_breakdown: dict[str, dict] = {}
    for building in buildings:
        key = str(building.get("prototype_type") or building.get("prototype_id") or "unknown")
        bucket = product_breakdown.setdefault(key, {"gfa_m2": 0.0, "units": 0, "building_count": 0})
        bucket["gfa_m2"] += float(building["gfa_m2"])
        bucket["units"] += int(building["units"])
        bucket["building_count"] += 1
    for bucket in product_breakdown.values():
        bucket["gfa_m2"] = round(bucket["gfa_m2"], 4)
        bucket["saleable_area_m2"] = round(bucket["gfa_m2"] * float(constraints["saleable_ratio"]), 4)
        bucket["revenue_cny"] = round(bucket["saleable_area_m2"] * float(assumptions["avg_selling_price_cny_per_m2"]), 2)
    total_cost_cny = round(
        float(assumptions["land_cost_cny"])
        + hard_cost_cny
        * (
            1
            + float(assumptions["soft_cost_ratio"])
            + float(assumptions["tax_ratio"])
            + float(assumptions["marketing_ratio"])
        ),
        2,
    )
    gross_margin_cny = round(revenue_cny - total_cost_cny, 2)
    gross_margin_ratio = round(gross_margin_cny / revenue_cny, 6) if revenue_cny else 0.0
    return {
        "total_gfa_m2": total_gfa_m2,
        "saleable_area_m2": saleable_area_m2,
        "units": units,
        "parking_spaces": parking_spaces,
        "revenue_cny": revenue_cny,
        "hard_cost_cny": hard_cost_cny,
        "total_cost_cny": total_cost_cny,
        "gross_margin_cny": gross_margin_cny,
        "gross_margin_ratio": gross_margin_ratio,
        "product_breakdown": product_breakdown,
    }
