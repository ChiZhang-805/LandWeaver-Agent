from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from time import monotonic
from typing import Any

from app.core.config import get_openai_runtime_settings
from app.schemas.domain import VisualDesignPackage, PlanningBrief, VisualDesignRequest

_VISUAL_DESIGN_EXECUTOR = ThreadPoolExecutor(max_workers=2)
_VISUAL_DESIGN_OPENAI_DISABLED_UNTIL = 0.0


def _metric_number(metrics: dict[str, Any], key: str, default: float = 0.0) -> float:
    value = metrics.get(key, default)
    return float(value) if isinstance(value, (int, float)) else default


def _mock_brief(user_text: str) -> PlanningBrief:
    lower = user_text.lower()
    risk = "low" if "稳" in user_text or "低风险" in user_text or "low risk" in lower else "medium"
    strategy = "low_risk" if risk == "low" else "balanced"
    if "货值" in user_text or "收益" in user_text or "revenue" in lower:
        strategy = "revenue_first"
    return PlanningBrief(
        target_customer="改善型家庭",
        product_positioning="中高端住宅",
        unit_mix_targets={"90m2": 0.35, "110m2": 0.4, "140m2": 0.25},
        risk_preference=risk,
        strategy_preference=strategy,
        notes=f"Deterministic mock parsed from: {user_text[:80]}",
    )


def _fallback_brief(user_text: str, reason: str | None = None) -> PlanningBrief:
    brief = _mock_brief(user_text)
    return brief


def _planning_brief_response_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "target_customer",
            "product_positioning",
            "unit_mix_targets",
            "risk_preference",
            "strategy_preference",
            "notes",
        ],
        "properties": {
            "target_customer": {
                "type": "string",
                "description": "The explicitly implied buyer or tenant group.",
            },
            "product_positioning": {
                "type": "string",
                "description": "The explicitly implied product positioning.",
            },
            "unit_mix_targets": {
                "type": "object",
                "additionalProperties": False,
                "required": ["90m2", "110m2", "140m2"],
                "properties": {
                    "90m2": {"type": "number"},
                    "110m2": {"type": "number"},
                    "140m2": {"type": "number"},
                },
                "description": "Approximate unit mix ratios. Use 0 for a bucket if it is not implied.",
            },
            "risk_preference": {
                "type": "string",
                "enum": ["low", "medium", "high"],
            },
            "strategy_preference": {
                "type": "string",
                "enum": ["revenue_first", "balanced", "low_risk"],
            },
            "notes": {
                "type": "string",
                "description": "Short note explaining only signals found in user text.",
            },
        },
    }


def parse_planning_brief(user_text: str) -> PlanningBrief:
    settings = get_openai_runtime_settings()
    if not settings["api_key"]:
        return _fallback_brief(user_text)

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings["api_key"], timeout=20.0)
        response = client.responses.create(
            model=settings["model_fast"],
            input=[
                {
                    "role": "system",
                    "content": (
                    "Extract a LandWeaver planning brief. Return only data that is implied by the user text. "
                    "Do not generate building coordinates or regulatory claims. "
                    "For unit_mix_targets, distribute ratios across 90m2, 110m2 and 140m2 buckets and make the sum close to 1."
                ),
            },
            {"role": "user", "content": user_text},
            ],
            text={
                "format": {
                "type": "json_schema",
                "name": "planning_brief",
                "schema": _planning_brief_response_schema(),
                "strict": True,
            }
        },
        )
        payload = json.loads(response.output_text)
        return PlanningBrief.model_validate(payload)
    except Exception as exc:
        return _fallback_brief(user_text, type(exc).__name__)


def _fallback_explanation(option_metrics: dict[str, Any], violations: list[str], risk_flags: list[str], reason: str | None = None) -> str:
    disclaimer = "以下解释仅基于用户输入约束和系统计算指标，不构成法定审查意见。"
    far = _metric_number(option_metrics, "far")
    density = _metric_number(option_metrics, "building_density")
    margin = _metric_number(option_metrics, "gross_margin_ratio")
    risk_text = "；".join(risk_flags) if risk_flags else "未发现高优先级风险提示"
    violation_text = "；".join(violations) if violations else "未发现硬约束违规"
    return (
        f"{disclaimer}\n"
        f"该方案容积率约 {far:.2f}，建筑密度约 {density:.1%}，毛利率约 {margin:.1%}。"
        f"{violation_text}。风险提示：{risk_text}。"
    )


def explain_site_option(option_metrics: dict[str, Any], violations: list[str], risk_flags: list[str]) -> str:
    disclaimer = "以下解释仅基于用户输入约束和系统计算指标，不构成法定审查意见。"
    settings = get_openai_runtime_settings()
    if not settings["api_key"]:
        return _fallback_explanation(option_metrics, violations, risk_flags)

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings["api_key"], timeout=20.0)
        response = client.responses.create(
            model=settings["model_text"],
            input=[
                {
                    "role": "system",
                    "content": (
                        "Explain the site option using only supplied metrics, violations and risk flags. "
                        "Do not cite or invent regulations. Include the required disclaimer verbatim."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "required_disclaimer": disclaimer,
                            "metrics": option_metrics,
                            "violations": violations,
                            "risk_flags": risk_flags,
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
        )
        text = response.output_text.strip()
        return text if disclaimer in text else f"{disclaimer}\n{text}"
    except Exception as exc:
        return _fallback_explanation(option_metrics, violations, risk_flags, type(exc).__name__)


def _visual_design_response_schema() -> dict[str, Any]:
    palette = {
        "type": "object",
        "additionalProperties": False,
        "required": ["label", "hex", "material", "usage"],
        "properties": {
            "label": {"type": "string"},
            "hex": {"type": "string"},
            "material": {"type": "string"},
            "usage": {"type": "string"},
        },
    }
    view_prompt = {
        "type": "object",
        "additionalProperties": False,
        "required": ["title", "purpose", "prompt"],
        "properties": {
            "title": {"type": "string"},
            "purpose": {"type": "string"},
            "prompt": {"type": "string"},
        },
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "project_id",
            "option_id",
            "source",
            "design_title",
            "concept_statement",
            "style_keywords",
            "architectural_style",
            "landscape_strategy",
            "public_space_moves",
            "facade_guidelines",
            "material_palette",
            "rendering_prompts",
            "presentation_notes",
            "negative_prompt",
            "cautions",
        ],
        "properties": {
            "project_id": {"type": "string"},
            "option_id": {"type": ["string", "null"]},
            "source": {"type": "string", "enum": ["openai", "fallback"]},
            "design_title": {"type": "string"},
            "concept_statement": {"type": "string"},
            "style_keywords": {"type": "array", "items": {"type": "string"}},
            "architectural_style": {"type": "string"},
            "landscape_strategy": {"type": "string"},
            "public_space_moves": {"type": "array", "items": {"type": "string"}},
            "facade_guidelines": {"type": "array", "items": {"type": "string"}},
            "material_palette": {"type": "array", "items": palette},
            "rendering_prompts": {"type": "array", "items": view_prompt},
            "presentation_notes": {"type": "array", "items": {"type": "string"}},
            "negative_prompt": {"type": "string"},
            "cautions": {"type": "array", "items": {"type": "string"}},
        },
    }


def _fallback_visual_design(context: dict[str, Any], payload: VisualDesignRequest) -> VisualDesignPackage:
    project = context.get("project") or {}
    brief = context.get("brief") or {}
    option = context.get("option") or {}
    metrics = option.get("metrics") or {}
    review = context.get("review") or {}
    city = project.get("city") or "城市"
    positioning = brief.get("product_positioning") or "中高端住宅"
    customer = brief.get("target_customer") or "改善型家庭"
    far = metrics.get("far")
    density = metrics.get("building_density")
    margin = metrics.get("gross_margin_ratio")
    score = review.get("overall_score")
    quantitative_line = []
    if isinstance(far, (int, float)):
        quantitative_line.append(f"容积率约 {far:.2f}")
    if isinstance(density, (int, float)):
        quantitative_line.append(f"建筑密度约 {density:.1%}")
    if isinstance(margin, (int, float)):
        quantitative_line.append(f"毛利率约 {margin:.1%}")
    if isinstance(score, (int, float)):
        quantitative_line.append(f"方案评审约 {score:.0f} 分")
    base_facts = "，".join(quantitative_line) if quantitative_line else "当前仍处于概念输入阶段"
    prompts = [
        (
            "总体鸟瞰",
            "用于董事会或投委会第一页呈现总体气质。",
            f"{city} residential masterplan aerial axonometric, {payload.style_preference}, verified massing from LandWeaver metrics, elegant podium-free open landscape, warm daylight, clear building volumes, presentation quality, no fake text, no extra towers",
        ),
        (
            "归家界面",
            "表现入口、前场和社区归属感。",
            f"human scale arrival courtyard for {positioning}, refined residential facade, layered planting, calm luxury materials, families walking, soft morning light, no cars blocking entry, no signage text",
        ),
        (
            "中央景观",
            "表现方案中的公共空间和绿化价值。",
            f"central garden between residential towers, pocket gardens, children's play, shaded walking loop, high-end yet warm community landscape, {customer}, cinematic but realistic architectural visualization",
        ),
    ]

    return VisualDesignPackage(
        project_id=str(context["project_id"]),
        option_id=context.get("option_id"),
        source="fallback",
        design_title=f"{city}温暖都会社区",
        concept_statement=f"围绕{customer}和{positioning}，以“清晰体块、温暖材质、可达公共空间”为视觉主线。{base_facts}，视觉表达应强调方案真实强排骨架，而不是额外增减楼栋。",
        style_keywords=["现代高端", "轻奢改善", "温暖社区", "清晰体块", "低饱和材质"],
        architectural_style="建筑表达以简洁竖向线条、浅暖石材基座、克制金属收边和大面玻璃为主，控制装饰密度，让体块秩序和入口尺度成为主要识别点。",
        landscape_strategy="景观以一条连续归家动线串联入口前场、中央花园和口袋活动场地，形成可步行、可停留、可展示的社区公共空间。",
        public_space_moves=[
            "入口前场做低矮水景或树阵，提升第一到达界面。",
            "楼栋之间设置连续慢行环，连接儿童活动、会客平台和安静花园。",
            "把边角余地组织成口袋花园，弱化强排体块带来的硬边界。",
            "用暖色铺装和低照度灯带建立夜间归家识别。",
        ],
        facade_guidelines=[
            "主楼立面采用浅暖灰、香槟金和低反射玻璃，避免过重深色体块。",
            "高层住宅强调竖向比例，阳台和窗墙体系保持规律但不机械。",
            "首层和入口局部提高材质触感，用石材、金属格栅和木色构件建立近人尺度。",
        ],
        material_palette=[
            {"label": "暖石灰", "hex": "#D8D2C4", "material": "浅色石材/仿石涂料", "usage": "主楼基座和公共界面"},
            {"label": "雾银灰", "hex": "#9CA8A7", "material": "金属板/铝型材", "usage": "窗框、竖向线脚和入口收边"},
            {"label": "香槟金", "hex": "#B8945E", "material": "拉丝金属", "usage": "入口雨棚、门头和重点节点"},
            {"label": "庭院绿", "hex": "#5E7D67", "material": "乔灌木与地被", "usage": "中央花园和慢行系统"},
        ],
        rendering_prompts=[
            {"title": title, "purpose": purpose, "prompt": prompt}
            for title, purpose, prompt in prompts
        ],
        presentation_notes=[
            "第一页用真实强排总图或轴测表达整体秩序。",
            "第二页并列展示评审分、FAR、密度、毛利率和视觉关键词。",
            "第三页放材质色板、归家界面和中央景观意向，说明视觉价值如何服务产品定位。",
        ],
        negative_prompt="不要新增不存在的楼栋；不要改变红线、楼间距、容积率和建筑数量；不要生成施工图级承诺；不要出现乱码文字、夸张异形建筑或与住宅定位不符的商业综合体。",
        cautions=[
            "视觉设计包只用于概念表达，不替代报批、日照、消防或施工图审查。",
            "渲染提示词必须基于已生成方案的真实体块和指标，不应自行增加建筑。",
        ],
    )


def _openai_visual_design_package(context: dict[str, Any], payload: VisualDesignRequest, settings: dict[str, Any]) -> VisualDesignPackage:
    from openai import OpenAI

    client = OpenAI(api_key=settings["api_key"], timeout=45.0)
    response = client.responses.create(
        model=settings["model_text"],
        input=[
            {
                "role": "system",
                "content": (
                    "Create a conceptual visual design package for a real-estate site planning workflow. "
                    "Use only the supplied project brief, constraints, option metrics and option review. "
                    "Do not invent regulatory claims, do not change building coordinates, and do not add or remove buildings. "
                    "The output is for visual direction, moodboard, rendering prompts and presentation framing."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "project_id": context["project_id"],
                        "option_id": context.get("option_id"),
                        "style_preference": payload.style_preference,
                        "reference_notes": payload.reference_notes,
                        "audience": payload.audience,
                        "project": context.get("project"),
                        "brief": context.get("brief"),
                        "constraints": context.get("constraints"),
                        "option": context.get("option"),
                        "review": context.get("review"),
                        "required_source": "openai",
                    },
                    ensure_ascii=False,
                ),
            },
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "visual_design_package",
                "schema": _visual_design_response_schema(),
                "strict": True,
            }
        },
    )
    payload_data = json.loads(response.output_text)
    payload_data["source"] = "openai"
    payload_data["project_id"] = str(context["project_id"])
    payload_data["option_id"] = context.get("option_id")
    return VisualDesignPackage.model_validate(payload_data)


def generate_visual_design_package(context: dict[str, Any], payload: VisualDesignRequest) -> VisualDesignPackage:
    global _VISUAL_DESIGN_OPENAI_DISABLED_UNTIL

    settings = get_openai_runtime_settings()
    if not settings["api_key"]:
        return _fallback_visual_design(context, payload)
    if monotonic() < _VISUAL_DESIGN_OPENAI_DISABLED_UNTIL:
        return _fallback_visual_design(context, payload)

    future = _VISUAL_DESIGN_EXECUTOR.submit(_openai_visual_design_package, context, payload, settings)
    try:
        package = future.result(timeout=55.0)
        _VISUAL_DESIGN_OPENAI_DISABLED_UNTIL = 0.0
        return package
    except FutureTimeoutError:
        _VISUAL_DESIGN_OPENAI_DISABLED_UNTIL = monotonic() + 30.0
        return _fallback_visual_design(context, payload)
    except Exception:
        return _fallback_visual_design(context, payload)
