from __future__ import annotations

from typing import Literal

from app.schemas.domain import (
    ConstraintSet,
    Parcel,
    PlanningBrief,
    PortableServiceSpec,
    Project,
    ProjectCommandCenter,
    ProjectDiagnostics,
    SiteOption,
    WorkflowStep,
)


StepStatus = Literal["done", "current", "available", "blocked"]


def _step(
    key: str,
    label: str,
    status: StepStatus,
    artifact_count: int,
    blockers: list[str],
    next_actions: list[str],
    automation_hint: str,
) -> WorkflowStep:
    return WorkflowStep(
        key=key,
        label=label,
        status=status,
        artifact_count=artifact_count,
        blockers=blockers,
        next_actions=next_actions,
        automation_hint=automation_hint,
    )


def _current_focus(steps: list[WorkflowStep]) -> str:
    for step in steps:
        if step.status in {"current", "available", "blocked"}:
            return step.key
    return "portfolio_iteration"


def _llm_modules(parcel: Parcel | None, brief: PlanningBrief | None, options: list[SiteOption]) -> list[PortableServiceSpec]:
    has_options = bool(options)
    return [
        PortableServiceSpec(
            key="planning_brief_reasoner",
            label="投拓简报推理",
            service_type="api",
            purpose="把自然语言投资诉求转成客群、产品定位、户型段、风险偏好和策略偏好。",
            inputs=["PlanningBriefInput.user_text"],
            outputs=["PlanningBrief"],
            status="ready",
        ),
        PortableServiceSpec(
            key="vision_cad_redline_reader",
            label="CAD/图纸视觉读取",
            service_type="api",
            purpose="用视觉模型辅助识别扫描红线、控规截图、图纸注记和缺失字段，再交由 GIS/CAD parser 校验。",
            inputs=["pdf_page_image", "cad_snapshot"],
            outputs=["redline_notes", "zoning_field_candidates"],
            status="ready" if parcel else "blocked",
        ),
        PortableServiceSpec(
            key="option_explain_reasoner",
            label="方案解释推理",
            service_type="api",
            purpose="基于本地强排指标、违规项和风险标签，生成可追溯的投委会说明。",
            inputs=["SiteOption.metrics", "violations", "risk_flags"],
            outputs=["option_explanation"],
            status="ready" if has_options else "blocked",
        ),
        PortableServiceSpec(
            key="investment_committee_writer",
            label="投委会文本生成",
            service_type="api",
            purpose="把投决备忘录、尽调缺口和敏感性分析改写成董事会/投委会可阅读材料。",
            inputs=["InvestmentMemo", "DueDiligencePack"],
            outputs=["committee_memo.md", "speaker_notes"],
            status="ready" if has_options and brief else "blocked",
        ),
    ]


def _portable_services(
    parcel: Parcel | None,
    constraints: ConstraintSet | None,
    options: list[SiteOption],
) -> list[PortableServiceSpec]:
    has_options = bool(options)
    return [
        PortableServiceSpec(
            key="postgis_context_loader",
            label="PostGIS 上下文装载器",
            service_type="worker",
            purpose="把 parcel/zoning/buildings/POI/market_area 统一投影后入库，供强排和尽调检索。",
            inputs=["GeoJSON", "DXF", "zoning_csv", "market_area_index"],
            outputs=["postgis.parcels", "postgis.zoning", "postgis.context_layers"],
            status="planned" if parcel else "blocked",
        ),
        PortableServiceSpec(
            key="option_batch_export_cli",
            label="方案批量导出 CLI",
            service_type="cli",
            purpose="在无网页环境下批量导出 GeoJSON/DXF/CSV/HTML，适合投拓批量测算。",
            inputs=["project_id", "option_ids"],
            outputs=["exports/*.geojson", "exports/*.dxf", "exports/*.csv", "exports/*.html"],
            status="ready" if has_options else "blocked",
        ),
        PortableServiceSpec(
            key="constraint_snapshot_api",
            label="约束快照 API",
            service_type="api",
            purpose="冻结规划约束和经济假设，确保投决报告可追溯到有效日期和数据来源。",
            inputs=["ConstraintSet", "source_license", "effective_date"],
            outputs=["ConstraintSnapshot"],
            status="ready" if constraints else "blocked",
        ),
    ]


def build_project_command_center(
    project: Project,
    parcel: Parcel | None,
    brief: PlanningBrief | None,
    constraints: ConstraintSet | None,
    prototypes_count: int,
    options: list[SiteOption],
    diagnostics: ProjectDiagnostics,
) -> ProjectCommandCenter:
    steps = [
        _step(
            "parcel",
            "地块红线",
            "done" if parcel else "current",
            1 if parcel else 0,
            [],
            ["导入 GeoJSON/DXF 或手动画出红线，并复核面积。"] if not parcel else ["红线已保存，可进入简报和约束。"],
            "红线统一归一化为本地米制 polygon；后续 FAR、密度和退界都只基于该 polygon。",
        ),
        _step(
            "brief",
            "投拓简报",
            "done" if brief else "available",
            1 if brief else 0,
            [],
            ["输入客群、产品定位、风险偏好和收益策略。"],
            "文本模型或本地规则将自然语言整理为 PlanningBrief。",
        ),
        _step(
            "constraints",
            "规划/经济约束",
            "done" if constraints else "blocked" if not parcel else "available",
            1 if constraints else 0,
            [] if parcel else ["需要先确定地块红线。"],
            ["录入 FAR、密度、绿地率、限高、退界、售价、成本和地价。"],
            "约束作为所有强排、诊断、收益测算和投决备忘录的输入版本。",
        ),
        _step(
            "prototypes",
            "楼栋原型",
            "done" if prototypes_count else "available" if constraints else "blocked",
            prototypes_count,
            [] if constraints else ["需要先保存约束，才能判断限高和楼栋适配。"],
            ["配置 tower/slab/villa/podium 等产品原型。"],
            "候选 footprint 由原型尺寸、层数、限高和可建范围离散生成。",
        ),
        _step(
            "diagnostics",
            "生成前诊断",
            "done" if diagnostics.readiness == "ready" else "available" if parcel and constraints and prototypes_count else "blocked",
            len(diagnostics.checks),
            [check.message for check in diagnostics.checks if check.status in {"fail", "missing"}][:4],
            diagnostics.suggestions[:4],
            "先用快速容量、经济粗判、候选丰富度和绿地/密度张力判断是否值得启动优化。",
        ),
        _step(
            "options",
            "强排方案",
            "done" if options else "available" if diagnostics.readiness in {"ready", "needs_attention"} else "blocked",
            len(options),
            [] if diagnostics.readiness in {"ready", "needs_attention"} else ["诊断仍有关键阻断项。"],
            ["运行 CP-SAT/贪心 fallback，生成 revenue_first / balanced / low_risk。"],
            "优化器只输出本地可验证楼栋坐标、指标、违规和风险标签。",
        ),
        _step(
            "investment_pack",
            "投决与尽调",
            "available" if options else "blocked",
            len(options),
            [] if options else ["需要至少一套 SiteOption。"],
            ["生成方案评审、投决备忘录、Due Diligence Pack 和 HTML 报告。"],
            "把强排结果转成投拓团队能推进的数据室清单和投委会材料。",
        ),
    ]
    blockers = [item for step in steps for item in step.blockers][:8]
    summary = (
        f"{project.title} 当前处于 {diagnostics.readiness}，诊断分 {diagnostics.score}/100。"
        f"已生成 {len(options)} 套方案。"
    )
    return ProjectCommandCenter(
        project_id=project.id,
        readiness=diagnostics.readiness,
        score=diagnostics.score,
        current_focus=_current_focus(steps),
        summary=summary,
        workflow_steps=steps,
        blockers=blockers,
        automation_plan=[
            "project routes 只做仓储读写；诊断、优化、收益、评审、投决、尽调各自独立 service/engine。",
            "LLM 不直接写最终坐标，只解释输入、生成文本材料、辅助视觉读取和资料归纳。",
            "每个输出都保留输入约束、指标和数据来源字段，方便未来接 PostGIS 与公司数据仓。",
        ],
        llm_modules=_llm_modules(parcel, brief, options),
        portable_services=_portable_services(parcel, constraints, options),
        key_metrics=diagnostics.metrics,
    )
