from __future__ import annotations

from typing import Literal

from app.schemas.domain import (
    ConstraintSet,
    DatasetQuerySpec,
    DueDiligenceGap,
    DueDiligencePack,
    InvestmentMemo,
    OptionReview,
    Parcel,
    PlanningBrief,
    PortableServiceSpec,
    Project,
    SiteOption,
)


Severity = Literal["low", "medium", "high", "critical"]
Owner = Literal["investment", "design", "cost", "legal", "market", "data"]


def _number(metrics: dict, key: str, default: float = 0.0) -> float:
    value = metrics.get(key, default)
    return float(value) if isinstance(value, (int, float)) else default


def _gap(
    key: str,
    label: str,
    severity: Severity,
    reason: str,
    evidence_needed: list[str],
    owner: Owner,
) -> DueDiligenceGap:
    return DueDiligenceGap(
        key=key,
        label=label,
        severity=severity,
        reason=reason,
        evidence_needed=evidence_needed,
        owner=owner,
    )


def _query(
    key: str,
    label: str,
    dataset_type: Literal["gis", "zoning", "market", "cost", "legal", "demographic", "mobility"],
    query_hint: str,
    fields: list[str],
    update_frequency: str,
    license_note: str,
) -> DatasetQuerySpec:
    return DatasetQuerySpec(
        key=key,
        label=label,
        dataset_type=dataset_type,
        query_hint=query_hint,
        fields=fields,
        update_frequency=update_frequency,
        license_note=license_note,
    )


def _evidence_gaps(
    parcel: Parcel | None,
    constraints: ConstraintSet,
    option: SiteOption,
    review: OptionReview,
    memo: InvestmentMemo,
    brief: PlanningBrief | None,
) -> list[DueDiligenceGap]:
    metrics = option.metrics
    margin = _number(metrics, "gross_margin_ratio")
    far_util = _number(metrics, "far_utilization")
    gaps: list[DueDiligenceGap] = []
    if parcel is None or (parcel and parcel.source == "manual"):
        gaps.append(
            _gap(
                "survey_redline",
                "正式红线与权属边界",
                "high" if parcel else "critical",
                "当前红线缺少正式 CAD/GIS 来源，无法支撑投决归档。",
                ["带坐标系红线 CAD/GIS", "权属边界", "用地面积证明", "坐标系说明"],
                "legal",
            )
        )
    if constraints.assumptions.land_cost_cny <= 0:
        gaps.append(
            _gap(
                "land_cost",
                "地价与付款节奏",
                "critical",
                "地价为 0 或缺失，收益测算没有投资基础。",
                ["土地款总额", "付款节奏", "融资成本", "税费口径"],
                "investment",
            )
        )
    if margin < 0.12:
        gaps.append(
            _gap(
                "margin_buffer",
                "收益安全垫",
                "high",
                f"当前毛利率约 {margin:.1%}，需要补齐售价、地价和成本证据。",
                ["竞品成交", "折扣/去化", "建安成本拆分", "软成本和税费测算"],
                "investment",
            )
        )
    if far_util < 0.75:
        gaps.append(
            _gap(
                "far_gap",
                "强度利用不足",
                "medium",
                f"FAR 利用约 {far_util:.0%}，可能由退界、限高、楼间距或产品原型造成。",
                ["控规条件", "日照/间距初判", "可放宽条款", "更高/更紧凑原型库"],
                "design",
            )
        )
    if option.violations:
        gaps.append(
            _gap(
                "hard_violations",
                "硬约束违规",
                "critical",
                "方案存在硬约束违规，不应进入投委会主推。",
                option.violations,
                "design",
            )
        )
    if review.grade in {"C", "D"}:
        gaps.append(
            _gap(
                "option_quality",
                "方案质量短板",
                "high" if review.grade == "D" else "medium",
                review.summary,
                review.weaknesses or ["方案评审明细", "派生方案对照"],
                "design",
            )
        )
    if brief is None:
        gaps.append(
            _gap(
                "business_brief",
                "业务简报缺失",
                "medium",
                "目标客群、产品定位和风险偏好未进入决策口径。",
                ["目标客群", "户型段", "风险偏好", "产品定位", "竞品画像"],
                "market",
            )
        )
    for risk in memo.risk_register:
        if risk.severity in {"high", "critical"}:
            gaps.append(
                _gap(
                    f"memo_{risk.key}",
                    risk.risk[:32],
                    risk.severity,
                    risk.risk,
                    [risk.mitigation],
                    risk.owner,
                )
            )
    return gaps[:10]


def _dataset_queries(project: Project, parcel: Parcel | None, brief: PlanningBrief | None) -> list[DatasetQuerySpec]:
    city = project.city or "project city"
    parcel_hint = f"project_id={project.id}"
    if parcel:
        parcel_hint += f", area_m2={parcel.area_m2:.0f}, source={parcel.source}"
    positioning = brief.product_positioning if brief else "target product positioning"
    return [
        _query(
            "parcel_zoning",
            "地块与规划条件",
            "zoning",
            f"{city} parcel/zoning lookup for {parcel_hint}",
            ["parcel_id", "geometry", "land_use", "far_max", "density_max", "height_limit", "green_ratio", "effective_date"],
            "项目启动和控规变更时更新",
            "优先官方规划/自然资源部门或公司授权 GIS；禁止用无法追溯截图作为唯一依据。",
        ),
        _query(
            "built_context",
            "周边建成环境",
            "gis",
            f"{city} 1-3km buildings, roads, POI and transit context",
            ["building_footprint", "height", "road_class", "poi_category", "transit_stop", "distance_to_site"],
            "月度或数据源更新时",
            "Overture Maps、OSM/Geofabrik、地方开放数据需保留 license 和下载日期。",
        ),
        _query(
            "market_comps",
            "竞品成交与去化",
            "market",
            f"{city} comparable residential projects for {positioning}",
            ["project_name", "distance", "unit_area", "price", "discount", "sell_through", "launch_date", "source"],
            "周度到月度",
            "正式项目应使用公司成交/渠道库；公开研究数据仅适合 demo 或趋势参考。",
        ),
        _query(
            "cost_library",
            "成本参数库",
            "cost",
            f"cost benchmark for {positioning}, tower/slab/villa mix",
            ["prototype_type", "hard_cost", "basement_cost", "facade_cost", "landscape_cost", "soft_cost_ratio", "effective_date"],
            "季度或成本库更新时",
            "优先公司内部成本库；第三方造价数据需确认授权。",
        ),
        _query(
            "legal_risk",
            "权属与审批风险",
            "legal",
            f"legal due diligence for {parcel_hint}",
            ["title_status", "easement", "relocation", "heritage", "environmental_risk", "approval_path"],
            "投决前必须更新",
            "由法务/报批团队提供正式资料，不由模型编造法规结论。",
        ),
    ]


def _llm_assistants(has_option: bool) -> list[PortableServiceSpec]:
    return [
        PortableServiceSpec(
            key="data_room_summarizer",
            label="数据室摘要助手",
            service_type="api",
            purpose="读取公司资料、控规文本、市场表和成本表，抽取证据、来源、有效日期和矛盾点。",
            inputs=["pdf", "xlsx", "docx", "csv"],
            outputs=["evidence_table", "source_conflicts", "committee_questions"],
            status="planned",
        ),
        PortableServiceSpec(
            key="vision_zoning_reader",
            label="控规图视觉助手",
            service_type="api",
            purpose="从控规截图或扫描 PDF 中读取地块编号、用地性质、指标表和图例候选，交给人工/GIS 校验。",
            inputs=["zoning_map_image", "planning_pdf_page"],
            outputs=["zoning_candidates", "uncertain_regions"],
            status="planned",
        ),
        PortableServiceSpec(
            key="risk_reasoning_copilot",
            label="投决风险推理助手",
            service_type="api",
            purpose="基于本地测算、敏感性和尽调缺口，生成条件通过/暂缓/退回的推理链摘要。",
            inputs=["InvestmentMemo", "DueDiligencePack", "SensitivityScenario[]"],
            outputs=["recommendation_rationale", "condition_precedents"],
            status="ready" if has_option else "blocked",
        ),
    ]


def _portable_services(has_option: bool) -> list[PortableServiceSpec]:
    return [
        PortableServiceSpec(
            key="evidence_pack_export",
            label="证据包 Markdown/JSON 导出",
            service_type="export",
            purpose="把尽调缺口、数据查询、投委会问题和 next actions 导出给投拓团队。",
            inputs=["DueDiligencePack"],
            outputs=["due_diligence.md", "due_diligence.json"],
            status="ready" if has_option else "blocked",
        ),
        PortableServiceSpec(
            key="market_comp_loader_cli",
            label="竞品库导入 CLI",
            service_type="cli",
            purpose="把授权竞品成交/去化表规范化为 project market comps 索引。",
            inputs=["market_comps.xlsx", "source_license"],
            outputs=["market_comps.parquet", "postgis.market_comps"],
            status="planned",
        ),
        PortableServiceSpec(
            key="committee_packet_worker",
            label="投委会材料 Worker",
            service_type="worker",
            purpose="批量生成 HTML/PDF、图层导出、敏感性页和证据缺口附录。",
            inputs=["SiteOption", "InvestmentMemo", "DueDiligencePack"],
            outputs=["committee_packet.html", "committee_packet.pdf"],
            status="ready" if has_option else "blocked",
        ),
    ]


def build_due_diligence_pack(
    project: Project,
    project_id: str,
    parcel: Parcel | None,
    constraints: ConstraintSet,
    option: SiteOption,
    review: OptionReview,
    memo: InvestmentMemo,
    brief: PlanningBrief | None = None,
) -> DueDiligencePack:
    gaps = _evidence_gaps(parcel, constraints, option, review, memo, brief)
    critical_count = sum(1 for gap in gaps if gap.severity == "critical")
    high_count = sum(1 for gap in gaps if gap.severity == "high")
    executive_focus = (
        f"{project.title} 的 {option.strategy} 方案需要优先关闭 "
        f"{critical_count} 个 critical、{high_count} 个 high 尽调缺口；"
        f"投决建议当前为 {memo.recommendation}。"
    )
    return DueDiligencePack(
        option_id=option.id,
        project_id=project_id,
        executive_focus=executive_focus,
        evidence_gaps=gaps,
        dataset_queries=_dataset_queries(project, parcel, brief),
        llm_assistants=_llm_assistants(True),
        portable_services=_portable_services(True),
        handoff_prompts=[
            "请把控规/土地条件文件中的 FAR、密度、绿地率、限高、退界、配建和停车字段整理成带页码的证据表。",
            "请比较本方案毛利率与售价 -5%/-10%、建安 +5% 情景，说明投委会需要哪些通过条件。",
            "请检查红线、权属、道路、市政接口、日照、消防、人防、配建和审批路径是否存在一票否决风险。",
        ],
        next_actions=[
            "先关闭 critical/high 证据缺口，再把方案作为投委会主推材料。",
            "把 dataset_queries 映射到 PostGIS/公司数据仓字段，形成可追溯资料链。",
            "导出 GeoJSON/DXF/CSV 与 HTML 报告，交给设计、成本、市场和法务同步复核。",
        ],
        caveats=[
            "Due Diligence Pack 是资料组织和风险提示，不构成法定审查或投资建议。",
            "模型可辅助摘要和发现矛盾，但规划、法务、成本和市场结论必须由责任团队确认。",
        ],
    )
