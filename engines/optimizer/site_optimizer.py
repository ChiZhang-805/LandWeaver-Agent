from __future__ import annotations

import random
from copy import deepcopy
from typing import Any, Literal

from shapely.geometry import Polygon

try:
    from ortools.sat.python import cp_model
except ImportError:  # pragma: no cover - exercised only in dependency-light environments.
    cp_model = None

from engines.geometry import (
    GeometryError,
    buildable_envelope,
    candidate_footprints,
    compute_conflicts,
    density_area,
    polygon_to_points,
)
from engines.profit import calculate_profit


Strategy = Literal["revenue_first", "balanced", "low_risk"]


def _as_dict(value: Any) -> dict:
    if isinstance(value, dict):
        return deepcopy(value)
    if hasattr(value, "model_dump"):
        return value.model_dump()
    return dict(value)


def _adjust_prototype_for_height(prototype: Any, height_limit_m: float) -> dict | None:
    data = _as_dict(prototype)
    max_floors_by_height = int(float(height_limit_m) // float(data["height_per_floor_m"]))
    floors = min(int(data["floors_max"]), max_floors_by_height)
    if floors < int(data["floors_min"]):
        return None
    data["floors_max"] = floors
    return data


def _prepare_candidates(
    envelope: Polygon,
    prototypes: list[Any],
    constraints: dict,
    seed: int,
    spacing_grid_m: float | None,
) -> list[dict]:
    grid = spacing_grid_m or max(8.0, min(float(constraints["min_spacing_m"]) * 0.65, 16.0))
    candidates: list[dict] = []
    for prototype in prototypes:
        adjusted = _adjust_prototype_for_height(prototype, float(constraints["height_limit_m"]))
        if adjusted is None:
            continue
        rotations = (0, 90) if adjusted["type"] in {"tower", "slab"} else (0,)
        generated = candidate_footprints(envelope, adjusted, spacing_grid_m=grid, rotations=rotations)
        candidates.extend(generated)

    random.Random(seed).shuffle(candidates)
    for index, candidate in enumerate(candidates):
        candidate["solver_index"] = index
    return candidates[:260]


def _objective_terms(strategy: Strategy, candidates: list[dict], constraints: dict, parcel_area_m2: float) -> list[int]:
    assumptions = constraints["assumptions"]
    saleable_ratio = float(constraints["saleable_ratio"])
    price = float(assumptions["avg_selling_price_cny_per_m2"])
    hard_cost = float(assumptions["hard_cost_cny_per_m2"])
    margin_per_gfa = max(1.0, saleable_ratio * price - hard_cost)
    terms: list[int] = []
    for candidate in candidates:
        gfa = float(candidate["gfa_m2"])
        footprint = float(candidate["footprint_area_m2"])
        clearance = float(candidate.get("edge_clearance_m", 0))
        if strategy == "revenue_first":
            score = gfa * saleable_ratio * price / 1000 + gfa
        elif strategy == "low_risk":
            score = gfa * 0.42 + clearance * 35 - footprint * 0.18
        else:
            far_util = gfa / max(parcel_area_m2, 1)
            score = gfa * 0.68 + margin_per_gfa * far_util / 20 + clearance * 12 - footprint * 0.05
        terms.append(int(round(score * 100)))
    return terms


def _build_building(candidate: dict) -> dict:
    centroid = candidate["polygon"].centroid
    return {
        "candidate_id": candidate["id"],
        "prototype_id": candidate["prototype_id"],
        "prototype_type": candidate.get("prototype_type"),
        "footprint": polygon_to_points(candidate["polygon"]),
        "centroid": [round(float(centroid.x), 4), round(float(centroid.y), 4)],
        "rotation_deg": candidate["rotation_deg"],
        "floors": candidate["floors"],
        "height_m": round(candidate["height_m"], 4),
        "gfa_m2": round(candidate["gfa_m2"], 4),
        "units": candidate["units"],
        "violations": [],
    }


def _risk_flags(metrics: dict, constraints: dict) -> list[str]:
    flags: list[str] = []
    if metrics["far_utilization"] < 0.75:
        flags.append("FAR utilization below 75%; consider smaller spacing or higher floors.")
    if metrics["building_density"] > float(constraints["building_density_max"]) * 0.92:
        flags.append("Building density is close to the input cap.")
    if metrics["green_ratio_estimate"] < float(constraints["green_ratio_min"]):
        flags.append("Estimated green ratio is below the input target.")
    if metrics["gross_margin_ratio"] < 0.12:
        flags.append("Gross margin ratio is below 12% under current assumptions.")
    if metrics.get("max_height_m", 0) > float(constraints["height_limit_m"]) * 0.95:
        flags.append("Max building height is close to the height limit.")
    if metrics.get("parking_spaces", 0) > metrics.get("units", 0) * 1.4:
        flags.append("Parking demand is high relative to residential units.")
    if metrics.get("building_count", 0) <= 1:
        flags.append("Only one building selected; layout diversity is low.")
    return flags


def _solution_payload(
    strategy: Strategy,
    parcel_id: str,
    parcel_area_m2: float,
    envelope: Polygon,
    candidates: list[dict],
    selected_indexes: list[int],
    constraints: dict,
    seed: int,
    objective_value: float,
) -> dict:
    selected_candidates = [candidates[index] for index in selected_indexes]
    buildings = [_build_building(candidate) for candidate in selected_candidates]
    profit = calculate_profit(buildings, constraints)
    footprint_area = density_area([candidate["polygon"] for candidate in selected_candidates])
    far = profit["total_gfa_m2"] / parcel_area_m2 if parcel_area_m2 else 0
    density = footprint_area / parcel_area_m2 if parcel_area_m2 else 0
    metrics = {
        **profit,
        "parcel_area_m2": round(parcel_area_m2, 4),
        "footprint_area_m2": round(footprint_area, 4),
        "far": round(far, 6),
        "far_utilization": round(far / float(constraints["far_max"]), 6),
        "building_density": round(density, 6),
        "green_ratio_estimate": round(max(0.0, 1 - density), 6),
        "building_count": len(buildings),
        "max_height_m": round(max((float(building["height_m"]) for building in buildings), default=0), 4),
        "avg_unit_area_estimate_m2": round(
            profit["saleable_area_m2"] / profit["units"], 4
        )
        if profit["units"]
        else 0,
    }
    violations: list[str] = []
    if metrics["far"] > float(constraints["far_max"]) + 1e-6:
        violations.append("FAR exceeds input maximum.")
    if metrics["building_density"] > float(constraints["building_density_max"]) + 1e-6:
        violations.append("Building density exceeds input maximum.")
    if metrics["green_ratio_estimate"] < float(constraints["green_ratio_min"]) - 1e-6:
        violations.append("Estimated green ratio is below input minimum.")
    flags = _risk_flags(metrics, constraints)
    score = round(
        objective_value / 1000
        + metrics["gross_margin_cny"] / 10_000_000
        + metrics["far_utilization"] * 20
        - len(flags) * 3
        - len(violations) * 10,
        4,
    )
    return {
        "strategy": strategy,
        "parcel_id": parcel_id,
        "buildings": buildings,
        "metrics": metrics,
        "violations": violations,
        "risk_flags": flags,
        "score": score,
        "seed": seed,
        "buildable_envelope": polygon_to_points(envelope),
        "selected_candidates": [{"candidate_id": candidate["id"]} for candidate in selected_candidates],
    }


def infeasible_result(reason: str) -> dict:
    return {
        "status": "infeasible",
        "infeasible_reason": reason,
        "relax_suggestions": [
            "降低目标 FAR 或允许更低的容积率利用率。",
            "减少最小楼间距或退界，扩大可建范围。",
            "调整楼栋原型尺寸、层数或限高输入。",
        ],
    }


def optimize_site_option(
    parcel_polygon: Polygon,
    constraints: Any,
    prototypes: list[Any],
    strategy: Strategy = "balanced",
    parcel_id: str = "parcel",
    seed: int = 0,
    previous_selections: list[set[str]] | None = None,
    spacing_grid_m: float | None = None,
) -> dict:
    constraints_dict = _as_dict(constraints)
    parcel_area_m2 = float(parcel_polygon.area)
    try:
        envelope = buildable_envelope(parcel_polygon, constraints_dict["setbacks_m"])
    except GeometryError as exc:
        return infeasible_result(str(exc))

    candidates = _prepare_candidates(envelope, prototypes, constraints_dict, seed, spacing_grid_m)
    if not candidates:
        return infeasible_result("No building candidates fit inside the buildable envelope and height limit.")

    conflicts = compute_conflicts(candidates, constraints_dict["min_spacing_m"])
    if cp_model is None:
        return _optimize_greedy(
            parcel_id,
            parcel_area_m2,
            envelope,
            candidates,
            conflicts,
            constraints_dict,
            strategy,
            seed,
            previous_selections or [],
        )

    model = cp_model.CpModel()
    vars_ = [model.NewBoolVar(f"candidate_{index}") for index in range(len(candidates))]
    for left, right in conflicts:
        model.Add(vars_[left] + vars_[right] <= 1)

    far_cap = int(parcel_area_m2 * float(constraints_dict["far_max"]))
    density_cap = int(parcel_area_m2 * float(constraints_dict["building_density_max"]))
    model.Add(sum(int(round(candidate["gfa_m2"])) * vars_[index] for index, candidate in enumerate(candidates)) <= far_cap)
    model.Add(
        sum(int(round(candidate["footprint_area_m2"])) * vars_[index] for index, candidate in enumerate(candidates))
        <= density_cap
    )
    model.Add(sum(vars_) >= 1)

    previous_selections = previous_selections or []
    candidate_ids = [candidate["id"] for candidate in candidates]
    for previous in previous_selections:
        indexes = [index for index, candidate_id in enumerate(candidate_ids) if candidate_id in previous]
        if indexes:
            model.Add(sum(vars_[index] for index in indexes) <= max(0, len(indexes) - 1))

    coefficients = _objective_terms(strategy, candidates, constraints_dict, parcel_area_m2)
    randomizer = random.Random(seed)
    coefficients = [coefficient + randomizer.randint(0, 37) for coefficient in coefficients]
    model.Maximize(sum(coefficient * vars_[index] for index, coefficient in enumerate(coefficients)))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 8
    solver.parameters.num_search_workers = 8
    solver.parameters.random_seed = seed
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return infeasible_result("CP-SAT could not select any non-conflicting buildings within FAR and density caps.")

    selected_indexes = [index for index, var in enumerate(vars_) if solver.Value(var) == 1]
    if not selected_indexes:
        return infeasible_result("Solver returned an empty solution.")

    payload = _solution_payload(
        strategy,
        parcel_id,
        parcel_area_m2,
        envelope,
        candidates,
        selected_indexes,
        constraints_dict,
        seed,
        solver.ObjectiveValue(),
    )
    payload["status"] = "feasible"
    return payload


def _optimize_greedy(
    parcel_id: str,
    parcel_area_m2: float,
    envelope: Polygon,
    candidates: list[dict],
    conflicts: list[tuple[int, int]],
    constraints: dict,
    strategy: Strategy,
    seed: int,
    previous_selections: list[set[str]],
) -> dict:
    coefficients = _objective_terms(strategy, candidates, constraints, parcel_area_m2)
    conflict_lookup = {index: set() for index in range(len(candidates))}
    for left, right in conflicts:
        conflict_lookup[left].add(right)
        conflict_lookup[right].add(left)

    order = sorted(range(len(candidates)), key=lambda index: (coefficients[index], candidates[index]["edge_clearance_m"]), reverse=True)
    far_cap = parcel_area_m2 * float(constraints["far_max"])
    density_cap = parcel_area_m2 * float(constraints["building_density_max"])
    selected: list[int] = []
    selected_ids: set[str] = set()
    used_gfa = 0.0
    used_footprint = 0.0
    for index in order:
        candidate = candidates[index]
        if any(index in conflict_lookup[selected_index] for selected_index in selected):
            continue
        if used_gfa + float(candidate["gfa_m2"]) > far_cap:
            continue
        if used_footprint + float(candidate["footprint_area_m2"]) > density_cap:
            continue
        trial_ids = selected_ids | {candidate["id"]}
        if any(trial_ids == previous for previous in previous_selections):
            continue
        selected.append(index)
        selected_ids.add(candidate["id"])
        used_gfa += float(candidate["gfa_m2"])
        used_footprint += float(candidate["footprint_area_m2"])

    if not selected:
        return infeasible_result("Greedy fallback could not select any non-conflicting buildings within caps.")
    payload = _solution_payload(
        strategy,
        parcel_id,
        parcel_area_m2,
        envelope,
        candidates,
        selected,
        constraints,
        seed,
        sum(coefficients[index] for index in selected),
    )
    payload["status"] = "feasible"
    payload["solver"] = "greedy_fallback"
    return payload


def generate_site_options(
    parcel_polygon: Polygon,
    constraints: Any,
    prototypes: list[Any],
    parcel_id: str = "parcel",
    strategies: list[Strategy] | None = None,
    seed: int = 42,
) -> dict:
    strategies = strategies or ["revenue_first", "balanced", "low_risk"]
    options: list[dict] = []
    previous: list[set[str]] = []
    errors: list[str] = []

    for offset, strategy in enumerate(strategies):
        result = optimize_site_option(
            parcel_polygon,
            constraints,
            prototypes,
            strategy=strategy,
            parcel_id=parcel_id,
            seed=seed + offset * 17,
            previous_selections=previous,
        )
        if result.get("status") == "feasible":
            selected = {item["candidate_id"] for item in result.get("selected_candidates", [])}
            previous.append(selected)
            options.append(result)
        else:
            errors.append(result.get("infeasible_reason", "Unknown infeasible result."))

    retry = 0
    while len(options) < 3 and retry < 4:
        strategy = strategies[retry % len(strategies)]
        result = optimize_site_option(
            parcel_polygon,
            constraints,
            prototypes,
            strategy=strategy,
            parcel_id=parcel_id,
            seed=seed + 100 + retry * 31,
            previous_selections=previous,
            spacing_grid_m=10 + retry * 2,
        )
        if result.get("status") == "feasible":
            selected = {item["candidate_id"] for item in result.get("selected_candidates", [])}
            previous.append(selected)
            options.append(result)
        else:
            errors.append(result.get("infeasible_reason", "Unknown infeasible result."))
        retry += 1

    if not options:
        return infeasible_result(errors[0] if errors else "No feasible option could be generated.")

    return {"status": "feasible", "options": options[:3]}
