from __future__ import annotations

from typing import Any, Literal

from app.schemas.domain import ConstraintSet, OptionReview, OptionReviewItem, PlanningBrief, SiteOption

ReviewStatus = Literal["excellent", "good", "watch", "risk"]


def _number(metrics: dict[str, Any], key: str, default: float = 0.0) -> float:
    value = metrics.get(key, default)
    return float(value) if isinstance(value, (int, float)) else default


def _item(key: str, label: str, status: ReviewStatus, score: int, message: str, action: str | None = None) -> OptionReviewItem:
    return OptionReviewItem(
        key=key,
        label=label,
        status=status,
        score=max(0, min(100, int(round(score)))),
        message=message,
        action=action,
    )


def _grade(score: int) -> Literal["A", "B", "C", "D"]:
    if score >= 88:
        return "A"
    if score >= 76:
        return "B"
    if score >= 62:
        return "C"
    return "D"


def _composition_types(option: SiteOption) -> set[str]:
    types: set[str] = set()
    for building in option.buildings:
        types.add(str(building.prototype_type or building.prototype_id))
    return types


def _target_unit_area_hint(brief: PlanningBrief | None) -> tuple[float, float] | None:
    if not brief or not brief.unit_mix_targets:
        return None
    weighted_area = 0.0
    total_weight = 0.0
    for key, weight in brief.unit_mix_targets.items():
        digits = "".join(char for char in str(key) if char.isdigit() or char == ".")
        if not digits:
            continue
        weighted_area += float(digits) * float(weight)
        total_weight += float(weight)
    if total_weight <= 0:
        return None
    target = weighted_area / total_weight
    return target * 0.85, target * 1.15


def review_site_option(option: SiteOption, constraints: ConstraintSet, brief: PlanningBrief | None = None) -> OptionReview:
    metrics = option.metrics
    far_util = _number(metrics, "far_utilization")
    density = _number(metrics, "building_density")
    green = _number(metrics, "green_ratio_estimate")
    margin = _number(metrics, "gross_margin_ratio")
    max_height = _number(metrics, "max_height_m")
    avg_unit_area = _number(metrics, "avg_unit_area_estimate_m2")
    building_count = int(_number(metrics, "building_count"))
    density_cap = float(constraints.building_density_max)
    green_min = float(constraints.green_ratio_min)
    height_limit = float(constraints.height_limit_m)
    height_util = max_height / height_limit if height_limit else 0.0
    product_types = _composition_types(option)

    items: list[OptionReviewItem] = []

    compliance_score = 100 - len(option.violations) * 28 - len(option.risk_flags) * 6
    if option.violations:
        items.append(
            _item(
                "compliance",
                "硬约束稳定性",
                "risk",
                compliance_score,
                f"发现 {len(option.violations)} 个硬约束违规，方案需要先修正。",
                "优先处理红线、FAR、密度或绿地率违规，再进入收益比较。",
            )
        )
    elif option.risk_flags:
        items.append(
            _item(
                "compliance",
                "硬约束稳定性",
                "watch",
                compliance_score,
                f"无硬约束违规，但有 {len(option.risk_flags)} 个风险标签。",
                "先查看风险标签对应的指标余量，再决定是否放大方案。",
            )
        )
    else:
        items.append(_item("compliance", "硬约束稳定性", "excellent", 100, "无硬约束违规和显著风险标签。"))

    if far_util >= 0.92:
        items.append(_item("far_efficiency", "FAR 利用", "excellent", 96, f"FAR 利用约 {far_util:.0%}，强度目标利用充分。"))
    elif far_util >= 0.8:
        items.append(_item("far_efficiency", "FAR 利用", "good", 84, f"FAR 利用约 {far_util:.0%}，仍有少量强度余量。"))
    elif far_util >= 0.62:
        items.append(
            _item(
                "far_efficiency",
                "FAR 利用",
                "watch",
                66,
                f"FAR 利用约 {far_util:.0%}，强度未完全打满。",
                "检查是否可提高可用原型层数、减少间距或补充更紧凑的楼栋原型。",
            )
        )
    else:
        items.append(
            _item(
                "far_efficiency",
                "FAR 利用",
                "risk",
                44,
                f"FAR 利用仅约 {far_util:.0%}，与输入目标差距较大。",
                "优先复核目标 FAR 是否过高，并尝试增加高层/小面宽原型。",
            )
        )

    density_ratio = density / density_cap if density_cap else 0.0
    green_gap = green - green_min
    if density_ratio <= 0.82 and green_gap >= 0.06:
        items.append(_item("open_space", "密度与绿地", "excellent", 94, "建筑密度和绿地率都有较充足余量。"))
    elif density <= density_cap and green >= green_min:
        items.append(_item("open_space", "密度与绿地", "good", 82, "建筑密度和绿地率满足输入目标。"))
    elif green < green_min:
        items.append(
            _item(
                "open_space",
                "密度与绿地",
                "risk",
                45,
                f"估算绿地率低于目标约 {abs(green_gap):.1%}。",
                "减少基底面积较大的楼栋，或降低建筑密度上限后重新生成。",
            )
        )
    else:
        items.append(
            _item(
                "open_space",
                "密度与绿地",
                "watch",
                64,
                "密度接近上限，开放空间弹性偏小。",
                "保留边界余量更高的楼栋，减少贴边和大基底组合。",
            )
        )

    if margin >= 0.22:
        items.append(_item("economics", "经济表现", "excellent", 95, f"毛利率约 {margin:.1%}，经济安全垫较好。"))
    elif margin >= 0.12:
        items.append(_item("economics", "经济表现", "good", 82, f"毛利率约 {margin:.1%}，基本具备比较价值。"))
    elif margin >= 0.04:
        items.append(
            _item("economics", "经济表现", "watch", 62, f"毛利率约 {margin:.1%}，安全垫偏薄。", "建议优先做售价和建安成本敏感性分析。")
        )
    else:
        items.append(
            _item("economics", "经济表现", "risk", 38, f"毛利率约 {margin:.1%}，可能难以支撑投资假设。", "复核地价、售价和成本假设，或降低方案强度风险。")
        )

    if len(product_types) >= 2 and building_count >= 4:
        items.append(_item("product_mix", "产品组合", "excellent", 92, f"包含 {len(product_types)} 类产品、{building_count} 栋楼，组合可比性较好。"))
    elif building_count >= 3:
        items.append(_item("product_mix", "产品组合", "good", 78, f"共 {building_count} 栋楼，具备基本排布组合。"))
    elif building_count >= 2:
        items.append(_item("product_mix", "产品组合", "watch", 62, "楼栋数量偏少，方案空间结构可能不够丰富。", "增加可布置原型或降低间距后重新生成。"))
    else:
        items.append(_item("product_mix", "产品组合", "risk", 35, "当前只选出一栋楼，方案比较价值有限。", "放宽退界/间距或加入更小 footprint 的原型。"))

    if height_util > 0.97:
        items.append(_item("height_headroom", "高度余量", "watch", 64, "最高建筑接近限高，后续调整弹性偏小。", "若需要更多容积，优先增加楼栋数量而不是继续加高。"))
    elif far_util < 0.76 and height_util < 0.82:
        items.append(_item("height_headroom", "高度余量", "watch", 66, "限高仍有余量，但 FAR 利用偏低。", "可提高 floors_max 或加入更高层原型，提高强度利用。"))
    else:
        items.append(_item("height_headroom", "高度余量", "good", 82, "高度利用与限高之间保持了可调整余量。"))

    unit_hint = _target_unit_area_hint(brief)
    if avg_unit_area <= 0:
        items.append(_item("unit_scale", "户型尺度", "watch", 60, "缺少有效户型尺度估算。", "检查原型的户数和典型层面积输入。"))
    elif unit_hint:
        low, high = unit_hint
        if low <= avg_unit_area <= high:
            items.append(_item("unit_scale", "户型尺度", "good", 84, f"估算户均面积约 {avg_unit_area:.0f} m2，与简报目标基本匹配。"))
        else:
            items.append(_item("unit_scale", "户型尺度", "watch", 62, f"估算户均面积约 {avg_unit_area:.0f} m2，与简报目标有偏差。", "调整原型 units_per_floor 或 avg_unit_area_m2。"))
    elif 75 <= avg_unit_area <= 145:
        items.append(_item("unit_scale", "户型尺度", "good", 78, f"估算户均面积约 {avg_unit_area:.0f} m2，处于常见概念测算区间。"))
    else:
        items.append(_item("unit_scale", "户型尺度", "watch", 60, f"估算户均面积约 {avg_unit_area:.0f} m2，需要确认是否符合定位。", "在简报或原型中明确目标户型段。"))

    weights = {
        "compliance": 1.35,
        "far_efficiency": 1.1,
        "open_space": 1.0,
        "economics": 1.2,
        "product_mix": 0.85,
        "height_headroom": 0.7,
        "unit_scale": 0.65,
    }
    weighted_sum = sum(item.score * weights.get(item.key, 1.0) for item in items)
    weight_total = sum(weights.get(item.key, 1.0) for item in items)
    overall = int(round(weighted_sum / weight_total)) if weight_total else 0
    overall = max(0, min(100, overall))
    grade = _grade(overall)

    strengths = [item.message for item in items if item.status in {"excellent", "good"}][:4]
    weaknesses = [item.message for item in items if item.status in {"watch", "risk"}][:4]
    next_actions = [item.action for item in items if item.action][:5]
    if not next_actions:
        next_actions = ["当前方案可作为候选基准，建议进入方案对比或导出汇报。"]

    summary = f"{grade}级方案，综合评分 {overall}。"
    if weaknesses:
        summary += " 主要关注：" + "；".join(weaknesses[:2])
    else:
        summary += " 核心指标较均衡，可作为强排基准方案。"

    review_metrics = {
        "far_utilization": round(far_util, 6),
        "density_ratio_to_cap": round(density_ratio, 6),
        "green_gap": round(green_gap, 6),
        "gross_margin_ratio": round(margin, 6),
        "height_utilization": round(height_util, 6),
        "product_type_count": len(product_types),
        "building_count": building_count,
        "avg_unit_area_estimate_m2": round(avg_unit_area, 4),
    }
    return OptionReview(
        option_id=option.id,
        overall_score=overall,
        grade=grade,
        summary=summary,
        metrics=review_metrics,
        items=items,
        strengths=strengths,
        weaknesses=weaknesses,
        next_actions=next_actions,
    )
