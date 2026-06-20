from __future__ import annotations

from html import escape
from typing import Any


def _format(value: Any) -> str:
    if isinstance(value, float):
        if abs(value) < 1 and value != 0:
            return f"{value * 100:.1f}%"
        return f"{value:,.2f}"
    if isinstance(value, int):
        return f"{value:,}"
    return escape(str(value))


def _metric_rows(metrics: dict[str, Any]) -> str:
    preferred = [
        "total_gfa_m2",
        "far",
        "far_utilization",
        "building_density",
        "green_ratio_estimate",
        "units",
        "revenue_cny",
        "total_cost_cny",
        "gross_margin_cny",
        "gross_margin_ratio",
    ]
    return "".join(
        f"<tr><th>{escape(key)}</th><td>{_format(metrics.get(key, '-'))}</td></tr>"
        for key in preferred
        if key in metrics
    )


def _investment_memo_section(memo: dict | None) -> str:
    if not memo:
        return ""
    metric_rows = "".join(
        "<tr>"
        f"<td>{escape(str(item.get('label', item.get('key', ''))))}</td>"
        f"<td>{_format(item.get('value', '-'))}</td>"
        f"<td>{escape(str(item.get('signal', '-')))}</td>"
        f"<td>{escape(str(item.get('note', '')))}</td>"
        "</tr>"
        for item in memo.get("key_metrics", [])
    )
    risk_rows = "".join(
        "<tr>"
        f"<td>{escape(str(item.get('severity', '-')))}</td>"
        f"<td>{escape(str(item.get('risk', '')))}</td>"
        f"<td>{escape(str(item.get('owner', '-')))}</td>"
        f"<td>{escape(str(item.get('mitigation', '')))}</td>"
        "</tr>"
        for item in memo.get("risk_register", [])
    ) or "<tr><td colspan=\"4\">暂无高优先级风险登记</td></tr>"
    checklist = "".join(f"<li>{escape(str(item))}</li>" for item in memo.get("data_room_checklist", []))
    actions = "".join(f"<li>{escape(str(item))}</li>" for item in memo.get("next_actions", []))
    return f"""
  <h2>投决备忘录</h2>
  <section class="box">
    <p><strong>建议：</strong>{escape(str(memo.get('recommendation', '-')))} · <strong>置信度：</strong>{_format(memo.get('confidence_score', '-'))}/100</p>
    <p>{escape(str(memo.get('executive_summary', '')))}</p>
    <p class="muted">{escape(str(memo.get('sensitivity_summary', '')))}</p>
  </section>
  <h2>投决关键指标</h2>
  <table>
    <thead><tr><th>指标</th><th>值</th><th>信号</th><th>说明</th></tr></thead>
    <tbody>{metric_rows}</tbody>
  </table>
  <h2>风险登记</h2>
  <table>
    <thead><tr><th>严重度</th><th>风险</th><th>Owner</th><th>缓释动作</th></tr></thead>
    <tbody>{risk_rows}</tbody>
  </table>
  <div class="grid">
    <section class="box">
      <h2>数据室清单</h2>
      <ul>{checklist}</ul>
    </section>
    <section class="box">
      <h2>下一步动作</h2>
      <ul>{actions}</ul>
    </section>
  </div>
"""


def _due_diligence_section(pack: dict | None) -> str:
    if not pack:
        return ""
    gaps = "".join(
        "<tr>"
        f"<td>{escape(str(item.get('severity', '-')))}</td>"
        f"<td>{escape(str(item.get('label', item.get('key', ''))))}</td>"
        f"<td>{escape(str(item.get('owner', '-')))}</td>"
        f"<td>{escape(str(item.get('reason', '')))}</td>"
        "</tr>"
        for item in pack.get("evidence_gaps", [])
    ) or "<tr><td colspan=\"4\">暂无高优先级证据缺口</td></tr>"
    queries = "".join(
        "<tr>"
        f"<td>{escape(str(item.get('dataset_type', '-')))}</td>"
        f"<td>{escape(str(item.get('label', item.get('key', ''))))}</td>"
        f"<td>{escape(str(item.get('query_hint', '')))}</td>"
        f"<td>{escape(str(item.get('update_frequency', '')))}</td>"
        "</tr>"
        for item in pack.get("dataset_queries", [])
    )
    prompts = "".join(f"<li>{escape(str(item))}</li>" for item in pack.get("handoff_prompts", []))
    return f"""
  <h2>尽调证据包</h2>
  <section class="box">
    <p>{escape(str(pack.get('executive_focus', '')))}</p>
  </section>
  <table>
    <thead><tr><th>严重度</th><th>缺口</th><th>Owner</th><th>原因</th></tr></thead>
    <tbody>{gaps}</tbody>
  </table>
  <h2>数据集检索规格</h2>
  <table>
    <thead><tr><th>类型</th><th>数据集</th><th>检索提示</th><th>更新频率</th></tr></thead>
    <tbody>{queries}</tbody>
  </table>
  <section class="box">
    <h2>交接 Prompt</h2>
    <ul>{prompts}</ul>
  </section>
"""


def render_option_report(
    project: dict,
    parcel: dict | None,
    option: dict,
    sensitivity: list[dict],
    explanation: str,
    investment_memo: dict | None = None,
    due_diligence: dict | None = None,
) -> str:
    building_rows = "".join(
        "<tr>"
        f"<td>{escape(str(item.get('prototype_type') or item.get('prototype_id')))}</td>"
        f"<td>{_format(item.get('floors'))}</td>"
        f"<td>{_format(item.get('height_m'))}</td>"
        f"<td>{_format(item.get('gfa_m2'))}</td>"
        f"<td>{_format(item.get('units'))}</td>"
        "</tr>"
        for item in option.get("buildings", [])
    )
    risk_items = "".join(f"<li>{escape(flag)}</li>" for flag in option.get("risk_flags", [])) or "<li>暂无风险提示</li>"
    sensitivity_rows = "".join(
        "<tr>"
        f"<td>{escape(str(item.get('variable')))}</td>"
        f"<td>{_format(item.get('delta'))}</td>"
        f"<td>{_format(item.get('gross_margin_ratio'))}</td>"
        f"<td>{_format(item.get('gross_margin_cny'))}</td>"
        "</tr>"
        for item in sensitivity
    )
    parcel_area = parcel.get("area_m2") if parcel else "-"
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>{escape(project.get('title', 'LandWeaver Report'))}</title>
  <style>
    body {{ margin: 32px; color: #17202a; font: 14px/1.6 Arial, sans-serif; }}
    h1 {{ font-size: 28px; margin: 0 0 8px; }}
    h2 {{ margin: 28px 0 10px; font-size: 18px; }}
    .muted {{ color: #64748b; }}
    .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 8px; }}
    th, td {{ border: 1px solid #d8dee6; padding: 8px 10px; text-align: left; }}
    th {{ background: #f7f8fa; }}
    .box {{ border: 1px solid #d8dee6; padding: 16px; }}
    @media print {{ body {{ margin: 16mm; }} button {{ display: none; }} }}
  </style>
</head>
<body>
  <button onclick="window.print()">打印 / 另存 PDF</button>
  <h1>{escape(project.get('title', 'LandWeaver Report'))}</h1>
  <p class="muted">{escape(project.get('city', ''))} · {escape(option.get('strategy', ''))} · 地块面积 {_format(parcel_area)} m2</p>
  <div class="grid">
    <section class="box">
      <h2>核心指标</h2>
      <table>{_metric_rows(option.get('metrics', {}))}</table>
    </section>
    <section class="box">
      <h2>风险提示</h2>
      <ul>{risk_items}</ul>
    </section>
  </div>
  <h2>楼栋明细</h2>
  <table>
    <thead><tr><th>产品</th><th>层数</th><th>高度</th><th>建面</th><th>户数</th></tr></thead>
    <tbody>{building_rows}</tbody>
  </table>
  <h2>敏感性</h2>
  <table>
    <thead><tr><th>变量</th><th>扰动</th><th>毛利率</th><th>毛利</th></tr></thead>
    <tbody>{sensitivity_rows}</tbody>
  </table>
  {_investment_memo_section(investment_memo)}
  {_due_diligence_section(due_diligence)}
  <h2>AI 说明</h2>
  <p>{escape(explanation)}</p>
</body>
</html>"""
