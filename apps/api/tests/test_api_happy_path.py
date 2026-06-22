from __future__ import annotations

import os
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_api_happy_path(rectangular_parcel, planning_constraints, tower_prototype, slab_prototype):
    project_resp = client.post("/api/projects", json={"title": "Demo Parcel", "city": "Shanghai"})
    assert project_resp.status_code == 200
    project = project_resp.json()

    blocked_diagnostics_resp = client.get(f"/api/projects/{project['id']}/diagnostics")
    assert blocked_diagnostics_resp.status_code == 200
    blocked_diagnostics = blocked_diagnostics_resp.json()
    assert blocked_diagnostics["readiness"] == "blocked"
    assert {"parcel", "constraints", "prototypes"}.issubset({check["key"] for check in blocked_diagnostics["checks"]})

    parcel_resp = client.post(f"/api/projects/{project['id']}/parcels", json=rectangular_parcel)
    assert parcel_resp.status_code == 200
    parcel = parcel_resp.json()
    assert parcel["area_m2"] == 9600

    brief_resp = client.post(
        f"/api/projects/{project['id']}/brief",
        json={"user_text": "改善型住宅，偏稳健，关注收益和风险平衡。"},
    )
    assert brief_resp.status_code == 200
    assert brief_resp.json()["strategy_preference"] in {"balanced", "revenue_first", "low_risk"}

    constraints_resp = client.post(f"/api/projects/{project['id']}/constraints", json=planning_constraints)
    assert constraints_resp.status_code == 200

    tower_resp = client.post(f"/api/projects/{project['id']}/prototypes", json=tower_prototype)
    slab_resp = client.post(f"/api/projects/{project['id']}/prototypes", json=slab_prototype)
    assert tower_resp.status_code == 200
    assert slab_resp.status_code == 200

    diagnostics_resp = client.get(f"/api/projects/{project['id']}/diagnostics")
    assert diagnostics_resp.status_code == 200
    diagnostics = diagnostics_resp.json()
    assert diagnostics["readiness"] in {"ready", "needs_attention"}
    assert diagnostics["score"] >= 50
    assert diagnostics["metrics"]["candidate_count"] > 0
    assert diagnostics["metrics"]["estimated_far_utilization"] > 0
    assert "capacity_probe" in {check["key"] for check in diagnostics["checks"]}
    assert diagnostics["suggestions"]

    job_resp = client.post(f"/api/projects/{project['id']}/generate-site-options?run_sync=true")
    assert job_resp.status_code == 200
    job = job_resp.json()
    assert job["status"] == "finished"
    assert len(job["result_ids"]) >= 3

    options_resp = client.get(f"/api/projects/{project['id']}/options")
    assert options_resp.status_code == 200
    options = options_resp.json()
    assert len(options) >= 3

    command_resp = client.get(f"/api/projects/{project['id']}/command-center")
    assert command_resp.status_code == 200
    command = command_resp.json()
    assert command["project_id"] == project["id"]
    assert command["workflow_steps"]
    assert "investment_pack" in {step["key"] for step in command["workflow_steps"]}
    assert {"option_explain_reasoner", "investment_committee_writer"}.issubset(
        {module["key"] for module in command["llm_modules"]}
    )
    assert command["portable_services"]

    detail_resp = client.get(f"/api/options/{options[0]['id']}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["metrics"]["total_gfa_m2"] > 0

    review_resp = client.get(f"/api/options/{options[0]['id']}/review")
    assert review_resp.status_code == 200
    review = review_resp.json()
    assert review["grade"] in {"A", "B", "C", "D"}
    assert 0 <= review["overall_score"] <= 100
    assert {"compliance", "far_efficiency", "economics"}.issubset({item["key"] for item in review["items"]})
    assert review["next_actions"]

    visual_resp = client.post(
        f"/api/projects/{project['id']}/visual-design",
        json={
            "option_id": options[0]["id"],
            "style_preference": "现代高端、温暖社区感，强调中央花园和清晰体块。",
            "reference_notes": "避免夸张异形建筑，偏真实投委会汇报。",
            "audience": "design_presentation",
        },
    )
    assert visual_resp.status_code == 200
    visual = visual_resp.json()
    assert visual["project_id"] == project["id"]
    assert visual["option_id"] == options[0]["id"]
    assert visual["design_title"]
    assert len(visual["material_palette"]) >= 3
    assert len(visual["rendering_prompts"]) >= 3
    assert visual["negative_prompt"]

    explain_resp = client.post(f"/api/options/{options[0]['id']}/explain")
    assert explain_resp.status_code == 200
    assert "仅基于用户输入约束和系统计算指标" in explain_resp.json()["explanation"]

    export_resp = client.post(f"/api/options/{options[0]['id']}/export?format=geojson")
    assert export_resp.status_code == 200
    export_payload = export_resp.json()
    assert export_payload["local_path"].endswith(".geojson")
    download_resp = client.get(export_payload["download_path"])
    assert download_resp.status_code == 200

    sensitivity_resp = client.get(f"/api/options/{options[0]['id']}/sensitivity")
    assert sensitivity_resp.status_code == 200
    assert len(sensitivity_resp.json()["scenarios"]) >= 8

    memo_resp = client.post(f"/api/options/{options[0]['id']}/investment-memo")
    assert memo_resp.status_code == 200
    memo = memo_resp.json()
    assert memo["recommendation"] in {"go", "conditional_go", "no_go"}
    assert memo["confidence_score"] >= 0
    assert memo["key_metrics"]
    assert memo["data_room_checklist"]
    assert memo["next_actions"]

    diligence_resp = client.post(f"/api/options/{options[0]['id']}/due-diligence")
    assert diligence_resp.status_code == 200
    diligence = diligence_resp.json()
    assert diligence["option_id"] == options[0]["id"]
    assert diligence["evidence_gaps"]
    assert {"parcel_zoning", "market_comps", "cost_library"}.issubset(
        {query["key"] for query in diligence["dataset_queries"]}
    )
    assert "risk_reasoning_copilot" in {assistant["key"] for assistant in diligence["llm_assistants"]}
    assert diligence["portable_services"]

    derive_resp = client.post(f"/api/options/{options[0]['id']}/derive", json={"remove_indexes": [0], "name": "without first"})
    assert derive_resp.status_code == 200
    assert len(derive_resp.json()["buildings"]) == len(options[0]["buildings"]) - 1

    deduped_derive_resp = client.post(
        f"/api/options/{options[0]['id']}/derive",
        json={"keep_indexes": [0, 0, 1, 1, 999], "name": "deduped keep"},
    )
    assert deduped_derive_resp.status_code == 200
    assert len(deduped_derive_resp.json()["buildings"]) == min(2, len(options[0]["buildings"]))

    report_resp = client.post(f"/api/options/{options[0]['id']}/report")
    assert report_resp.status_code == 200
    report_payload = report_resp.json()
    assert report_payload["download_path"].endswith(".report.html")
    report_download = client.get(report_payload["download_path"])
    assert report_download.status_code == 200
    assert "投决备忘录" in report_download.text
    assert "尽调证据包" in report_download.text

    aggregate_resp = client.get(f"/api/projects/{project['id']}")
    assert aggregate_resp.status_code == 200
    aggregate = aggregate_resp.json()
    assert aggregate["parcel"]["id"] == parcel["id"]
    assert len(aggregate["options"]) >= 3

    duplicate_resp = client.post(f"/api/projects/{project['id']}/duplicate")
    assert duplicate_resp.status_code == 200
    assert duplicate_resp.json()["project"]["title"].endswith("Copy")

    list_resp = client.get("/api/projects")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 2


def test_project_input_changes_invalidate_generated_options(
    rectangular_parcel,
    planning_constraints,
    tower_prototype,
    slab_prototype,
):
    project_resp = client.post("/api/projects", json={"title": "Invalidation", "city": "Nanjing"})
    project = project_resp.json()
    assert client.post(f"/api/projects/{project['id']}/parcels", json=rectangular_parcel).status_code == 200
    assert client.post(f"/api/projects/{project['id']}/constraints", json=planning_constraints).status_code == 200
    assert client.post(f"/api/projects/{project['id']}/prototypes", json=tower_prototype).status_code == 200
    assert client.post(f"/api/projects/{project['id']}/prototypes", json=slab_prototype).status_code == 200

    first_job_resp = client.post(f"/api/projects/{project['id']}/generate-site-options?run_sync=true")
    assert first_job_resp.status_code == 200
    first_job = first_job_resp.json()
    assert first_job["status"] == "finished"
    assert first_job["result_ids"]
    old_option_id = first_job["result_ids"][0]
    assert client.get(f"/api/options/{old_option_id}").status_code == 200

    updated_constraints = {
        **planning_constraints,
        "far_max": planning_constraints["far_max"] * 0.9,
    }
    update_resp = client.post(f"/api/projects/{project['id']}/constraints", json=updated_constraints)
    assert update_resp.status_code == 200

    assert client.get(f"/api/projects/{project['id']}/options").json() == []
    assert client.get(f"/api/options/{old_option_id}").status_code == 404

    second_job_resp = client.post(f"/api/projects/{project['id']}/generate-site-options?run_sync=true")
    assert second_job_resp.status_code == 200
    second_job = second_job_resp.json()
    assert second_job["status"] == "finished"
    assert second_job["job_id"] != first_job["job_id"]
    assert second_job["result_ids"]


def test_geojson_parcel_and_prototype_delete(rectangular_parcel, tower_prototype):
    project_resp = client.post("/api/projects", json={"title": "GeoJSON Parcel", "city": "Hangzhou"})
    project = project_resp.json()
    geojson = {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[*point, 0] for point in rectangular_parcel["points"] + [rectangular_parcel["points"][0]]]],
        },
        "properties": {},
    }

    parcel_resp = client.post(
        f"/api/projects/{project['id']}/parcels",
        json={"geojson": geojson, "north_angle_deg": 0},
    )
    assert parcel_resp.status_code == 200
    assert parcel_resp.json()["source"] == "geojson"

    prototype_resp = client.post(f"/api/projects/{project['id']}/prototypes", json=tower_prototype)
    assert prototype_resp.status_code == 200
    prototype_id = prototype_resp.json()["id"]

    delete_resp = client.delete(f"/api/projects/{project['id']}/prototypes/{prototype_id}")
    assert delete_resp.status_code == 200
    aggregate_resp = client.get(f"/api/projects/{project['id']}")
    assert aggregate_resp.json()["prototypes"] == []


def test_dxf_parcel_import():
    project_resp = client.post("/api/projects", json={"title": "DXF Parcel", "city": "Suzhou"})
    project = project_resp.json()
    dxf_text = "\n".join(
        [
            "0", "SECTION", "2", "ENTITIES", "0", "LWPOLYLINE", "90", "4",
            "10", "0", "20", "0",
            "10", "120", "20", "0",
            "10", "120", "20", "80",
            "10", "0", "20", "80",
            "0", "ENDSEC", "0", "EOF",
        ]
    )
    parcel_resp = client.post(
        f"/api/projects/{project['id']}/parcels",
        json={"dxf_text": dxf_text, "north_angle_deg": 0},
    )
    assert parcel_resp.status_code == 200
    parcel = parcel_resp.json()
    assert parcel["source"] == "dxf"
    assert parcel["area_m2"] == 9600


def test_openai_settings_can_use_browser_request_header():
    mock_resp = client.get("/api/settings/openai")
    assert mock_resp.status_code == 200
    mock_payload = mock_resp.json()
    assert mock_payload["configured"] is False
    assert mock_payload["source"] == "mock"

    browser_resp = client.get(
        "/api/settings/openai",
        headers={
            "X-OpenAI-API-Key": "sk-test-landweaver-browser-key",
            "X-OpenAI-Model-Text": "gpt-test-text",
            "X-OpenAI-Model-Fast": "gpt-test-fast",
        },
    )
    assert browser_resp.status_code == 200
    browser_payload = browser_resp.json()
    assert browser_payload["configured"] is True
    assert browser_payload["source"] == "browser"
    assert browser_payload["masked_key"] == "sk-test...-key"
    assert browser_payload["model_text"] == "gpt-test-text"
    assert browser_payload["model_fast"] == "gpt-test-fast"

    model_only_resp = client.get(
        "/api/settings/openai",
        headers={
            "X-OpenAI-Model-Text": "gpt-model-only-text",
            "X-OpenAI-Model-Fast": "gpt-model-only-fast",
        },
    )
    assert model_only_resp.status_code == 200
    model_only_payload = model_only_resp.json()
    assert model_only_payload["configured"] is False
    assert model_only_payload["source"] == "browser"
    assert model_only_payload["model_text"] == "gpt-model-only-text"
    assert model_only_payload["model_fast"] == "gpt-model-only-fast"

    after_resp = client.get("/api/settings/openai")
    assert after_resp.status_code == 200
    assert after_resp.json()["source"] == "mock"


def test_openai_settings_rejects_backend_persistence():
    settings_path = Path(os.environ["LANDWEAVER_STORAGE_DIR"]) / "openai_settings.json"

    put_resp = client.put(
        "/api/settings/openai",
        json={
            "api_key": "sk-should-not-touch-disk",
            "model_text": "gpt-server-side-text",
            "model_fast": "gpt-server-side-fast",
        },
    )
    delete_resp = client.delete("/api/settings/openai")

    assert put_resp.status_code == 405
    assert delete_resp.status_code == 405
    assert not settings_path.exists()
