from __future__ import annotations

import json

import ezdxf
import pandas as pd
import pytest

from app.schemas.domain import BuildingPrototype, ConstraintSet, Parcel
from app.services.design_diagnostics import diagnose_project_design
from engines.export import export_csv, export_dxf, export_geojson
from engines.geometry import normalize_polygon, polygon_to_points
from engines.optimizer import generate_site_options, optimize_site_option
from engines.profit import calculate_profit, calculate_sensitivity


def test_cp_sat_happy_path_returns_three_options(rectangular_parcel, planning_constraints, tower_prototype, slab_prototype):
    polygon = normalize_polygon(rectangular_parcel["points"])
    result = generate_site_options(polygon, planning_constraints, [tower_prototype, slab_prototype], parcel_id="parcel_test")
    assert result["status"] == "feasible"
    assert len(result["options"]) >= 3
    assert all(option["buildings"] for option in result["options"])
    assert {option["strategy"] for option in result["options"]} >= {"revenue_first", "balanced", "low_risk"}


def test_cp_sat_infeasible_case_returns_reason(rectangular_parcel, planning_constraints, tower_prototype):
    polygon = normalize_polygon(rectangular_parcel["points"])
    bad_constraints = {**planning_constraints, "height_limit_m": 20}
    result = optimize_site_option(polygon, bad_constraints, [tower_prototype], parcel_id="parcel_test")
    assert result["status"] == "infeasible"
    assert result["infeasible_reason"]
    assert result["relax_suggestions"]


def test_profit_calculation_and_sensitivity(planning_constraints):
    buildings = [
        {"gfa_m2": 1000, "units": 10},
        {"gfa_m2": 500, "units": 6},
    ]
    snapshot = calculate_profit(buildings, planning_constraints)
    assert snapshot["saleable_area_m2"] == 1230
    assert snapshot["units"] == 16
    assert snapshot["parking_spaces"] == 18
    assert snapshot["revenue_cny"] == 39360000
    assert snapshot["hard_cost_cny"] == 7800000
    scenarios = calculate_sensitivity(buildings, planning_constraints)
    assert len(scenarios) == 8
    assert {scenario["variable"] for scenario in scenarios} == {
        "avg_selling_price_cny_per_m2",
        "hard_cost_cny_per_m2",
    }


def test_diagnostics_economic_probe_matches_profit_engine(
    rectangular_parcel, planning_constraints, tower_prototype, slab_prototype
):
    polygon = normalize_polygon(rectangular_parcel["points"])
    constraints = ConstraintSet.model_validate(planning_constraints)
    parcel = Parcel(
        project_id="project_test",
        boundary=polygon_to_points(polygon),
        area_m2=float(polygon.area),
    )
    prototypes = [
        BuildingPrototype.model_validate(tower_prototype),
        BuildingPrototype.model_validate(slab_prototype),
    ]
    target_gfa = float(polygon.area) * constraints.far_max
    snapshot = calculate_profit([{"gfa_m2": target_gfa, "units": 1}], constraints)

    diagnostics = diagnose_project_design(parcel, constraints, prototypes)

    assert diagnostics.metrics["target_margin_ratio"] == pytest.approx(snapshot["gross_margin_ratio"])


def test_export_files_exist_and_contain_expected_content(
    tmp_path, rectangular_parcel, planning_constraints, tower_prototype, slab_prototype
):
    polygon = normalize_polygon(rectangular_parcel["points"])
    result = generate_site_options(polygon, planning_constraints, [tower_prototype, slab_prototype], parcel_id="parcel_test")
    option = result["options"][0]
    option["id"] = "option_test"

    geojson_path = export_geojson(polygon, option, tmp_path / "option.geojson")
    dxf_path = export_dxf(polygon, option, tmp_path / "option.dxf")
    csv_path = export_csv(option, tmp_path / "option.csv")

    assert geojson_path.exists()
    data = json.loads(geojson_path.read_text(encoding="utf-8"))
    assert data["type"] == "FeatureCollection"
    assert {"parcel", "buildable_envelope"} <= {feature["properties"]["name"] for feature in data["features"]}

    assert dxf_path.exists()
    doc = ezdxf.readfile(dxf_path)
    layer_names = {layer.dxf.name for layer in doc.layers}
    assert {"PARCEL_REDLINE", "BUILDABLE_ENVELOPE", "BUILDING_FOOTPRINT", "BUILDING_LABEL", "RISK"} <= layer_names

    assert csv_path.exists()
    frame = pd.read_csv(csv_path)
    assert {"row_type", "strategy", "gfa_m2", "units"} <= set(frame.columns)
    assert "summary" in set(frame["row_type"])
