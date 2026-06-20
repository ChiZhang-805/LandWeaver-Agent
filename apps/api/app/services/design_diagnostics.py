from __future__ import annotations

from typing import Literal

from app.schemas.domain import BuildingPrototype, ConstraintSet, DesignDiagnosticCheck, Parcel, PlanningBrief, ProjectDiagnostics
from engines.geometry import GeometryError, buildable_envelope, candidate_footprints, compute_conflicts, normalize_polygon

DiagnosticStatus = Literal["pass", "warn", "fail", "missing"]


def _check(key: str, label: str, status: DiagnosticStatus, message: str, action: str | None = None, metric: float | None = None) -> DesignDiagnosticCheck:
    return DesignDiagnosticCheck(key=key, label=label, status=status, message=message, action=action, metric=metric)


def _adjust_prototype_for_height(prototype: BuildingPrototype, height_limit_m: float) -> tuple[dict | None, int]:
    data = prototype.model_dump()
    max_floors_by_height = int(float(height_limit_m) // float(data["height_per_floor_m"]))
    floors = min(int(data["floors_max"]), max_floors_by_height)
    if floors < int(data["floors_min"]):
        return None, max_floors_by_height
    data["floors_max"] = floors
    return data, max_floors_by_height


def _quick_capacity(candidates: list[dict], constraints: dict, parcel_area_m2: float) -> dict[str, float | int]:
    if not candidates:
        return {
            "selected_count": 0,
            "estimated_gfa_m2": 0.0,
            "estimated_far": 0.0,
            "estimated_density": 0.0,
            "estimated_far_utilization": 0.0,
        }
    conflicts = compute_conflicts(candidates, float(constraints["min_spacing_m"]))
    conflict_lookup = {index: set() for index in range(len(candidates))}
    for left, right in conflicts:
        conflict_lookup[left].add(right)
        conflict_lookup[right].add(left)

    far_cap = parcel_area_m2 * float(constraints["far_max"])
    density_cap = parcel_area_m2 * float(constraints["building_density_max"])
    selected: list[int] = []
    used_gfa = 0.0
    used_footprint = 0.0
    order = sorted(
        range(len(candidates)),
        key=lambda index: (
            float(candidates[index]["gfa_m2"]),
            float(candidates[index].get("edge_clearance_m", 0)),
            -float(candidates[index]["footprint_area_m2"]),
        ),
        reverse=True,
    )
    for index in order:
        candidate = candidates[index]
        if any(index in conflict_lookup[selected_index] for selected_index in selected):
            continue
        next_gfa = used_gfa + float(candidate["gfa_m2"])
        next_footprint = used_footprint + float(candidate["footprint_area_m2"])
        if next_gfa > far_cap or next_footprint > density_cap:
            continue
        selected.append(index)
        used_gfa = next_gfa
        used_footprint = next_footprint

    estimated_far = used_gfa / parcel_area_m2 if parcel_area_m2 else 0.0
    return {
        "selected_count": len(selected),
        "estimated_gfa_m2": round(used_gfa, 4),
        "estimated_far": round(estimated_far, 6),
        "estimated_density": round(used_footprint / parcel_area_m2, 6) if parcel_area_m2 else 0.0,
        "estimated_far_utilization": round(estimated_far / float(constraints["far_max"]), 6) if float(constraints["far_max"]) else 0.0,
    }


def _economic_probe(constraints: ConstraintSet, parcel_area_m2: float) -> dict[str, float]:
    data = constraints.model_dump()
    assumptions = data["assumptions"]
    target_gfa = parcel_area_m2 * float(data["far_max"])
    saleable_area = target_gfa * float(data["saleable_ratio"])
    revenue = saleable_area * float(assumptions["avg_selling_price_cny_per_m2"])
    hard_cost = target_gfa * float(assumptions["hard_cost_cny_per_m2"])
    total_cost = float(assumptions["land_cost_cny"]) + hard_cost * (
        1
        + float(assumptions["soft_cost_ratio"])
        + float(assumptions["tax_ratio"])
        + float(assumptions["marketing_ratio"])
    )
    margin = revenue - total_cost
    return {
        "target_gfa_m2": round(target_gfa, 4),
        "target_revenue_cny": round(revenue, 4),
        "target_margin_cny": round(margin, 4),
        "target_margin_ratio": round(margin / revenue, 6) if revenue else 0.0,
    }


def diagnose_project_design(
    parcel: Parcel | None,
    constraints: ConstraintSet | None,
    prototypes: list[BuildingPrototype],
    brief: PlanningBrief | None = None,
) -> ProjectDiagnostics:
    checks: list[DesignDiagnosticCheck] = []
    suggestions: list[str] = []
    metrics: dict[str, float | int | str | None] = {
        "parcel_area_m2": parcel.area_m2 if parcel else None,
        "prototype_count": len(prototypes),
    }

    checks.append(
        _check(
            "parcel",
            "地块红线",
            "pass" if parcel else "missing",
            f"已保存红线，面积约 {parcel.area_m2:,.0f} m2。" if parcel else "尚未保存地块红线。",
            None if parcel else "先在地块页保存红线。",
        )
    )
    checks.append(
        _check(
            "constraints",
            "规划与经济约束",
            "pass" if constraints else "missing",
            "已保存 FAR、密度、退界和经济假设。" if constraints else "尚未保存规划与经济约束。",
            None if constraints else "先在约束页保存 FAR、密度、退界和售价成本。",
        )
    )
    checks.append(
        _check(
            "prototypes",
            "楼栋产品原型",
            "pass" if prototypes else "missing",
            f"已配置 {len(prototypes)} 个楼栋原型。" if prototypes else "尚未配置楼栋产品原型。",
            None if prototypes else "先添加 tower/slab 等产品原型。",
            float(len(prototypes)),
        )
    )

    if not parcel or not constraints or not prototypes:
        missing_labels = [check.label for check in checks if check.status == "missing"]
        suggestions.extend(check.action for check in checks if check.action)
        return ProjectDiagnostics(
            readiness="blocked",
            score=max(5, int(100 * sum(1 for check in checks if check.status == "pass") / max(len(checks), 1))),
            summary=f"生成前还缺少：{'、'.join(missing_labels)}。",
            metrics=metrics,
            checks=checks,
            suggestions=suggestions,
        )

    constraints_dict = constraints.model_dump()
    parcel_polygon = normalize_polygon(parcel.boundary)
    parcel_area_m2 = float(parcel_polygon.area)
    economic = _economic_probe(constraints, parcel_area_m2)
    metrics.update(economic)
    metrics["far_target_m2"] = round(parcel_area_m2 * float(constraints.far_max), 4)
    metrics["density_cap_m2"] = round(parcel_area_m2 * float(constraints.building_density_max), 4)

    try:
        envelope = buildable_envelope(parcel_polygon, constraints.setbacks_m)
        buildable_ratio = envelope.area / parcel_area_m2 if parcel_area_m2 else 0.0
        metrics["buildable_area_m2"] = round(float(envelope.area), 4)
        metrics["buildable_ratio"] = round(buildable_ratio, 6)
        if buildable_ratio >= 0.45:
            checks.append(_check("buildable_envelope", "可建范围", "pass", f"退界后可建面积约 {envelope.area:,.0f} m2。", metric=buildable_ratio))
        elif buildable_ratio >= 0.25:
            checks.append(
                _check(
                    "buildable_envelope",
                    "可建范围",
                    "warn",
                    f"退界后可建面积仅约 {buildable_ratio:.0%}，排布自由度偏紧。",
                    "优先检查退界是否过于保守，或降低楼栋进深/面宽。",
                    buildable_ratio,
                )
            )
            suggestions.append("可建范围偏紧：优先复核四向退界，必要时降低楼栋尺寸。")
        else:
            checks.append(
                _check(
                    "buildable_envelope",
                    "可建范围",
                    "fail",
                    f"退界后可建面积仅约 {buildable_ratio:.0%}，强排大概率失败。",
                    "降低退界或调整红线输入。",
                    buildable_ratio,
                )
            )
            suggestions.append("退界吞噬了大部分红线：先降低退界或确认红线坐标是否正确。")
    except GeometryError as exc:
        checks.append(_check("buildable_envelope", "可建范围", "fail", str(exc), "降低退界或修正红线。"))
        suggestions.append("当前退界无法形成有效可建范围。")
        return ProjectDiagnostics(
            readiness="blocked",
            score=20,
            summary="退界后没有有效可建范围，暂不能生成强排方案。",
            metrics=metrics,
            checks=checks,
            suggestions=suggestions,
        )

    grid = max(8.0, min(float(constraints.min_spacing_m) * 0.65, 16.0))
    candidates: list[dict] = []
    blocked_by_height: list[str] = []
    candidate_counts: dict[str, int] = {}
    for prototype in prototypes:
        prototype_type = str(prototype.type.value if hasattr(prototype.type, "value") else prototype.type)
        adjusted, max_floors_by_height = _adjust_prototype_for_height(prototype, float(constraints.height_limit_m))
        if adjusted is None:
            blocked_by_height.append(f"{prototype_type} 需要至少 {prototype.floors_min}F，限高最多约 {max_floors_by_height}F")
            candidate_counts[prototype_type] = 0
            continue
        rotations = (0, 90) if adjusted["type"] in {"tower", "slab"} else (0,)
        generated = candidate_footprints(envelope, adjusted, spacing_grid_m=grid, rotations=rotations, max_candidates=120)
        candidate_counts[prototype_type] = candidate_counts.get(prototype_type, 0) + len(generated)
        candidates.extend(generated)
    candidates = candidates[:300]
    metrics["candidate_count"] = len(candidates)
    metrics["prototype_fit_summary"] = ", ".join(f"{key}:{value}" for key, value in candidate_counts.items())

    if blocked_by_height and len(blocked_by_height) == len(prototypes):
        checks.append(
            _check(
                "prototype_height",
                "限高适配",
                "fail",
                "所有原型都超过限高：" + "；".join(blocked_by_height),
                "降低原型最低层数或提高限高。",
            )
        )
        suggestions.append("所有原型均被限高挡住：先降低 floors_min 或提高 height_limit_m。")
    elif blocked_by_height:
        checks.append(
            _check(
                "prototype_height",
                "限高适配",
                "warn",
                "部分原型超过限高：" + "；".join(blocked_by_height),
                "保留可适配原型，或调整受限原型层数。",
            )
        )
        suggestions.append("部分原型因限高无法参与强排，可调整层数范围。")
    else:
        checks.append(_check("prototype_height", "限高适配", "pass", "所有原型均可在当前限高中取到可用层数。"))

    if len(candidates) >= 80:
        checks.append(_check("candidate_richness", "候选丰富度", "pass", f"可生成 {len(candidates)} 个候选楼栋，搜索空间充足。", metric=float(len(candidates))))
    elif candidates:
        checks.append(
            _check(
                "candidate_richness",
                "候选丰富度",
                "warn",
                f"仅生成 {len(candidates)} 个候选楼栋，方案多样性可能不足。",
                "降低楼间距、减小原型尺寸，或增加更多产品原型。",
                float(len(candidates)),
            )
        )
        suggestions.append("候选楼栋偏少：可减小网格约束、楼间距或产品 footprint。")
    else:
        checks.append(
            _check(
                "candidate_richness",
                "候选丰富度",
                "fail",
                "没有任何原型能放入可建范围。",
                "减小原型面宽/进深、降低退界或增加小尺度产品原型。",
            )
        )
        suggestions.append("没有可放置候选：先减小楼栋尺寸或增加 villa/podium 等小原型。")

    capacity = _quick_capacity(candidates, constraints_dict, parcel_area_m2)
    metrics.update(capacity)
    far_util = float(capacity["estimated_far_utilization"])
    if int(capacity["selected_count"]) <= 0:
        checks.append(_check("capacity_probe", "容量粗判", "fail", "快速容量探测无法选出非冲突楼栋。", "降低楼间距、密度约束或调整原型尺寸。"))
        suggestions.append("快速容量探测为空：优先调整 min_spacing_m、楼栋尺寸或退界。")
    elif far_util >= 0.82:
        checks.append(_check("capacity_probe", "容量粗判", "pass", f"快速粗判可利用约 {far_util:.0%} 的 FAR 上限。", metric=far_util))
    elif far_util >= 0.6:
        checks.append(
            _check(
                "capacity_probe",
                "容量粗判",
                "warn",
                f"快速粗判仅利用约 {far_util:.0%} 的 FAR 上限。",
                "尝试增加高层原型、降低楼间距，或提高可布置楼栋数量。",
                far_util,
            )
        )
        suggestions.append("FAR 利用率可能偏低：可增加高层 tower/slab 或适当降低间距。")
    else:
        checks.append(
            _check(
                "capacity_probe",
                "容量粗判",
                "warn",
                f"快速粗判 FAR 利用约 {far_util:.0%}，与目标差距较大。",
                "检查 FAR 是否过高，或补充更高/更紧凑的原型。",
                far_util,
            )
        )
        suggestions.append("目标 FAR 与当前原型/退界组合不匹配，建议先调整产品库。")

    green_density_cap = max(0.0, 1 - float(constraints.green_ratio_min))
    metrics["green_implied_density_cap"] = round(green_density_cap, 6)
    if float(constraints.building_density_max) > green_density_cap:
        checks.append(
            _check(
                "green_density_tension",
                "密度/绿地张力",
                "warn",
                "建筑密度上限高于绿地率隐含密度，部分方案可能出现绿地率风险。",
                "若绿地率是硬目标，将建筑密度上限调低到绿地率可支持范围。",
                green_density_cap,
            )
        )
    else:
        checks.append(_check("green_density_tension", "密度/绿地张力", "pass", "建筑密度上限与绿地率目标基本一致。"))

    prototype_types = {str(prototype.type.value if hasattr(prototype.type, "value") else prototype.type) for prototype in prototypes}
    if len(prototype_types) >= 2:
        checks.append(_check("product_mix", "产品组合", "pass", f"已有 {len(prototype_types)} 类产品，可形成组合对比。", metric=float(len(prototype_types))))
    else:
        checks.append(_check("product_mix", "产品组合", "warn", "当前只有一种产品类型，方案差异可能不足。", "增加 slab/tower/villa 等至少一类补充原型。"))

    margin_ratio = float(economic["target_margin_ratio"])
    if margin_ratio >= 0.15:
        checks.append(_check("economics", "经济粗判", "pass", f"按目标 FAR 粗算毛利率约 {margin_ratio:.1%}。", metric=margin_ratio))
    elif margin_ratio >= 0:
        checks.append(_check("economics", "经济粗判", "warn", f"按目标 FAR 粗算毛利率约 {margin_ratio:.1%}，安全垫偏薄。", "复核售价、地价和建安成本。", margin_ratio))
        suggestions.append("经济安全垫偏薄：建议优先做售价/成本敏感性。")
    else:
        checks.append(_check("economics", "经济粗判", "warn", f"按目标 FAR 粗算毛利率约 {margin_ratio:.1%}，可能倒挂。", "复核地价或提高售价假设。", margin_ratio))
        suggestions.append("经济粗判可能倒挂：需要复核地价、售价和成本假设。")

    if brief:
        checks.append(_check("brief_alignment", "简报连接", "pass", f"已读取策略偏好：{brief.strategy_preference}。"))
    else:
        checks.append(_check("brief_alignment", "简报连接", "warn", "尚未解析产品简报，生成策略缺少业务语义。", "先解析简报，让方案解释和策略偏好更贴近需求。"))

    if not suggestions:
        suggestions.append("当前输入质量较好，可以启动生成并在方案详情中继续做派生调整。")

    status_points = {"pass": 1.0, "warn": 0.55, "fail": 0.0, "missing": 0.0}
    score = int(round(100 * sum(status_points[check.status] for check in checks) / len(checks)))
    hard_fail = any(check.status in {"fail", "missing"} for check in checks if check.key in {"parcel", "constraints", "prototypes", "buildable_envelope", "candidate_richness"})
    if hard_fail:
        readiness = "blocked"
        summary = "关键输入或可建条件未通过，建议先处理失败项。"
    elif any(check.status == "warn" for check in checks):
        readiness = "needs_attention"
        summary = "可以尝试生成，但建议先关注预警项以提高方案质量。"
    else:
        readiness = "ready"
        summary = "输入质量较好，适合启动强排生成。"

    return ProjectDiagnostics(readiness=readiness, score=score, summary=summary, metrics=metrics, checks=checks, suggestions=suggestions[:5])
