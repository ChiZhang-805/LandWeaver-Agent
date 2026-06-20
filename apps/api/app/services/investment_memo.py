from __future__ import annotations

from typing import Any, Literal

from app.schemas.domain import (
    ConstraintSet,
    InvestmentMemo,
    InvestmentMemoMetric,
    InvestmentRiskRegisterItem,
    OptionReview,
    Parcel,
    PlanningBrief,
    Project,
    SiteOption,
)


Signal = Literal["positive", "neutral", "watch", "risk"]
Severity = Literal["low", "medium", "high", "critical"]


def _number(metrics: dict[str, Any], key: str, default: float = 0.0) -> float:
    value = metrics.get(key, default)
    return float(value) if isinstance(value, (int, float)) else default


def _money_yi(value: float) -> str:
    return f"{value / 100000000:.2f}亿"


def _metric(key: str, label: str, value: float | int | str | None, signal: Signal, note: str) -> InvestmentMemoMetric:
    return InvestmentMemoMetric(key=key, label=label, value=value, signal=signal, note=note)


def _risk(
    key: str,
    risk: str,
    severity: Severity,
    mitigation: str,
    owner: Literal["investment", "design", "cost", "legal", "market", "data"],
    metric: str | None = None,
) -> InvestmentRiskRegisterItem:
    return InvestmentRiskRegisterItem(
        key=key,
        risk=risk,
        severity=severity,
        metric=metric,
        mitigation=mitigation,
        owner=owner,
    )


def _downside_scenarios(sensitivity: list[dict[str, Any]]) -> tuple[float | None, float | None]:
    price_down = [
        row
        for row in sensitivity
        if row.get("variable") == "avg_selling_price_cny_per_m2" and float(row.get("delta", 0)) < 0
    ]
    cost_up = [
        row
        for row in sensitivity
        if row.get("variable") == "hard_cost_cny_per_m2" and float(row.get("delta", 0)) > 0
    ]
    price_margin = min((float(row.get("gross_margin_ratio", 0)) for row in price_down), default=None)
    cost_margin = min((float(row.get("gross_margin_ratio", 0)) for row in cost_up), default=None)
    return price_margin, cost_margin


def _recommendation(
    option: SiteOption,
    review: OptionReview,
    price_downside_margin: float | None,
) -> Literal["go", "conditional_go", "no_go"]:
    margin = _number(option.metrics, "gross_margin_ratio")
    if option.violations or review.grade == "D" or margin < 0.04:
        return "no_go"
    if review.grade == "C" or margin < 0.12:
        return "conditional_go"
    if price_downside_margin is not None and price_downside_margin < 0:
        return "conditional_go"
    return "go"


def _confidence(option: SiteOption, review: OptionReview, parcel: Parcel | None, brief: PlanningBrief | None) -> int:
    score = review.overall_score * 0.58 + min(max(option.score, 0), 100) * 0.22 + 18
    if option.violations:
        score -= 22
    if option.risk_flags:
        score -= min(len(option.risk_flags) * 4, 16)
    if parcel is None:
        score -= 12
    if brief is None:
        score -= 6
    return max(0, min(100, int(round(score))))


def _key_metrics(option: SiteOption, constraints: ConstraintSet, review: OptionReview) -> list[InvestmentMemoMetric]:
    metrics = option.metrics
    margin = _number(metrics, "gross_margin_ratio")
    far_util = _number(metrics, "far_utilization")
    density = _number(metrics, "building_density")
    green = _number(metrics, "green_ratio_estimate")
    revenue = _number(metrics, "revenue_cny")
    total_gfa = _number(metrics, "total_gfa_m2")
    units = int(_number(metrics, "units"))
    height_util = _number(review.metrics, "height_utilization")
    density_signal: Signal = "positive" if density <= constraints.building_density_max * 0.9 else "watch"
    green_signal: Signal = "positive" if green >= constraints.green_ratio_min else "risk"
    margin_signal: Signal = "positive" if margin >= 0.18 else "watch" if margin >= 0.1 else "risk"
    far_signal: Signal = "positive" if far_util >= 0.82 else "watch" if far_util >= 0.62 else "risk"

    return [
        _metric("review_grade", "方案等级", review.grade, "positive" if review.grade in {"A", "B"} else "watch", review.summary),
        _metric("far_utilization", "FAR 利用率", round(far_util, 4), far_signal, f"当前利用约 {far_util:.0%}。"),
        _metric("total_gfa_m2", "总建面", round(total_gfa, 1), "neutral", "用于复核容积强度和成本口径。"),
        _metric("units", "户数", units, "neutral", "用于估算车位、销售节奏和产品段。"),
        _metric("revenue_cny", "货值", _money_yi(revenue), "positive" if revenue > 0 else "watch", "基于用户输入售价和可售比计算。"),
        _metric("gross_margin_ratio", "毛利率", round(margin, 4), margin_signal, f"当前毛利率约 {margin:.1%}。"),
        _metric("building_density", "建筑密度", round(density, 4), density_signal, f"输入上限为 {constraints.building_density_max:.0%}。"),
        _metric("green_ratio_estimate", "估算绿地率", round(green, 4), green_signal, f"输入目标为 {constraints.green_ratio_min:.0%}。"),
        _metric("height_utilization", "限高利用", round(height_util, 4), "watch" if height_util > 0.92 else "neutral", "用于判断后续加高余量。"),
    ]


def _value_drivers(option: SiteOption, review: OptionReview, brief: PlanningBrief | None) -> list[str]:
    metrics = option.metrics
    drivers: list[str] = []
    margin = _number(metrics, "gross_margin_ratio")
    far_util = _number(metrics, "far_utilization")
    product_breakdown = metrics.get("product_breakdown")
    if far_util >= 0.82:
        drivers.append(f"FAR 利用约 {far_util:.0%}，强度目标转化较充分。")
    if margin >= 0.12:
        drivers.append(f"毛利率约 {margin:.1%}，在当前售价/成本假设下具备比较价值。")
    if isinstance(product_breakdown, dict) and len(product_breakdown) >= 2:
        drivers.append(f"产品组合包含 {len(product_breakdown)} 类，可用于不同户型段对比。")
    if review.strengths:
        drivers.extend(review.strengths[:2])
    if brief:
        drivers.append(f"方案已连接简报定位：{brief.product_positioning} / {brief.target_customer}。")
    return drivers[:6] or ["当前方案形成了可复核的强排、指标和收益闭环，可作为比较基准。"]


def _risk_register(
    option: SiteOption,
    constraints: ConstraintSet,
    brief: PlanningBrief | None,
    price_downside_margin: float | None,
    cost_upside_margin: float | None,
) -> list[InvestmentRiskRegisterItem]:
    metrics = option.metrics
    risks: list[InvestmentRiskRegisterItem] = []
    for index, violation in enumerate(option.violations):
        risks.append(
            _risk(
                f"violation_{index}",
                violation,
                "critical",
                "先回到约束和排布阶段修正硬约束，再进入投决比较。",
                "design",
                "violations",
            )
        )
    for index, flag in enumerate(option.risk_flags):
        severity: Severity = "high" if "Gross margin" in flag or "green" in flag else "medium"
        owner: Literal["investment", "design", "cost", "legal", "market", "data"] = "investment"
        if "height" in flag or "FAR" in flag or "density" in flag or "green" in flag:
            owner = "design"
        if "Parking" in flag:
            owner = "design"
        risks.append(_risk(f"risk_flag_{index}", flag, severity, "复核对应指标余量，并生成放宽/保守两套派生方案。", owner))

    margin = _number(metrics, "gross_margin_ratio")
    if margin < 0.12:
        risks.append(
            _risk(
                "margin_buffer",
                f"当前毛利率约 {margin:.1%}，投资安全垫偏薄。",
                "high" if margin < 0.04 else "medium",
                "复核地价、售价、建安和软成本口径，并把售价下行场景作为投委会重点。",
                "investment",
                "gross_margin_ratio",
            )
        )
    if price_downside_margin is not None and price_downside_margin < 0.08:
        risks.append(
            _risk(
                "price_sensitivity",
                f"售价下行情景最低毛利率约 {price_downside_margin:.1%}。",
                "high" if price_downside_margin < 0 else "medium",
                "补充竞品成交、去化和折扣数据，设定保守售价红线。",
                "market",
                "sensitivity.price_downside",
            )
        )
    if cost_upside_margin is not None and cost_upside_margin < 0.1:
        risks.append(
            _risk(
                "cost_sensitivity",
                f"建安上行情景最低毛利率约 {cost_upside_margin:.1%}。",
                "medium",
                "要求成本团队拆分地下室、外立面、景观和配套成本敏感项。",
                "cost",
                "sensitivity.cost_upside",
            )
        )
    if _number(metrics, "green_ratio_estimate") < constraints.green_ratio_min:
        risks.append(
            _risk(
                "green_ratio",
                "估算绿地率低于输入目标。",
                "high",
                "减少大基底楼栋或提高开放空间，重新生成低密度派生方案。",
                "design",
                "green_ratio_estimate",
            )
        )
    if brief is None:
        risks.append(
            _risk(
                "brief_missing",
                "尚未解析业务简报，策略偏好和产品定位没有进入决策口径。",
                "medium",
                "补充目标客群、户型段、风险偏好和产品定位后重新生成备忘录。",
                "data",
            )
        )
    return risks[:8]


def _sensitivity_summary(price_downside_margin: float | None, cost_upside_margin: float | None) -> str:
    parts: list[str] = []
    if price_downside_margin is not None:
        parts.append(f"售价下行情景最低毛利率约 {price_downside_margin:.1%}")
    if cost_upside_margin is not None:
        parts.append(f"建安上行情景最低毛利率约 {cost_upside_margin:.1%}")
    if not parts:
        return "尚未形成敏感性摘要，请先生成售价和建安成本扰动场景。"
    return "；".join(parts) + "。"


def _committee_questions(recommendation: str, option: SiteOption, brief: PlanningBrief | None) -> list[str]:
    questions = [
        "当前售价假设是否有可追溯的竞品成交、挂牌和去化数据支撑？",
        "地价、税费、营销费和软成本是否与公司最新测算口径一致？",
        "红线、退界、限高、配建、停车和绿地率是否已由设计/法务复核？",
    ]
    if recommendation != "go":
        questions.insert(0, "若作为条件通过，本轮需要哪几个硬条件先关闭？")
    if option.risk_flags:
        questions.append("风险标签对应的指标余量是否足以支撑下一轮深化？")
    if brief and brief.risk_preference == "low":
        questions.append("用户简报偏低风险，是否需要把 low_risk 方案作为主推而非收益优先？")
    return questions[:6]


def _data_room_checklist(parcel: Parcel | None, constraints: ConstraintSet, brief: PlanningBrief | None) -> list[str]:
    checklist = [
        "红线坐标、权属边界、用地性质和规划条件原件。",
        "最新版控规/详规指标：FAR、密度、绿地率、限高、退界、配建和停车。",
        "近 6-12 个月竞品成交、挂牌、去化、折扣和客群画像数据。",
        "公司成本库口径：建安、地下室、景观、配套、公区精装、软成本和税费。",
        "地价付款节奏、融资成本、开发周期和销售节奏假设。",
    ]
    if parcel and parcel.source == "manual":
        checklist.insert(1, "当前红线为手动输入，需用 CAD/GIS 正式红线替换或复核。")
    if brief is None:
        checklist.append("补充产品定位简报，明确风险偏好、目标客群和户型段。")
    if constraints.assumptions.land_cost_cny <= 0:
        checklist.append("当前地价为 0 或缺失，必须补齐后才能进入投决。")
    return checklist[:7]


def _next_actions(recommendation: str, review: OptionReview, risks: list[InvestmentRiskRegisterItem]) -> list[str]:
    if recommendation == "go":
        actions = [
            "把本方案作为基准版，导出 DXF/GeoJSON/CSV 交给设计、投拓和成本复核。",
            "用售价 -5% / -10% 与建安 +5% 情景准备投委会敏感性页。",
            "锁定红线和规划条件来源，进入下一轮方案深化。",
        ]
    elif recommendation == "conditional_go":
        actions = [
            "先关闭高优先级风险，再决定是否进入投委会。",
            "生成一个更低风险派生方案，与当前方案做收益/风险对照。",
            "要求市场和成本团队补齐售价、地价、建安成本证据。",
        ]
    else:
        actions = [
            "暂缓进入投决，把硬约束或经济倒挂问题退回输入条件。",
            "重新检查红线、退界、限高、楼栋原型和经济假设。",
            "若项目仍要推进，先建立保守版本并设定明确的放宽条件。",
        ]
    actions.extend(review.next_actions[:2])
    actions.extend(f"关闭风险：{risk.risk}" for risk in risks if risk.severity in {"high", "critical"})
    return actions[:7]


def build_investment_memo(
    project: Project,
    project_id: str,
    parcel: Parcel | None,
    constraints: ConstraintSet,
    option: SiteOption,
    review: OptionReview,
    sensitivity: list[dict[str, Any]],
    brief: PlanningBrief | None = None,
) -> InvestmentMemo:
    price_downside_margin, cost_upside_margin = _downside_scenarios(sensitivity)
    recommendation = _recommendation(option, review, price_downside_margin)
    confidence = _confidence(option, review, parcel, brief)
    risks = _risk_register(option, constraints, brief, price_downside_margin, cost_upside_margin)
    margin = _number(option.metrics, "gross_margin_ratio")
    far_util = _number(option.metrics, "far_utilization")
    executive_summary = (
        f"{project.title} / {project.city} 的 {option.strategy} 方案建议为 {recommendation}。"
        f"方案等级 {review.grade}，FAR 利用约 {far_util:.0%}，毛利率约 {margin:.1%}。"
        "结论仅基于用户输入约束、系统强排和本地测算指标。"
    )
    caveats = [
        "本备忘录不是法定规划审查或投资承诺。",
        "所有结论仅基于用户输入约束、楼栋原型和经济假设。",
        "日照、消防、人防、配建、精确停车和地方条文需另行接入规范/审查数据。",
    ]
    if parcel is None:
        caveats.append("当前缺少地块红线，无法形成完整投决资料。")

    return InvestmentMemo(
        option_id=option.id,
        project_id=project_id,
        recommendation=recommendation,
        confidence_score=confidence,
        executive_summary=executive_summary,
        key_metrics=_key_metrics(option, constraints, review),
        value_drivers=_value_drivers(option, review, brief),
        risk_register=risks,
        sensitivity_summary=_sensitivity_summary(price_downside_margin, cost_upside_margin),
        committee_questions=_committee_questions(recommendation, option, brief),
        data_room_checklist=_data_room_checklist(parcel, constraints, brief),
        next_actions=_next_actions(recommendation, review, risks),
        caveats=caveats,
    )
