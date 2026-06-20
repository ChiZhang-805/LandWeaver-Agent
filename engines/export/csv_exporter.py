from __future__ import annotations

from pathlib import Path

import pandas as pd


def export_csv(option: dict, output_path: str | Path) -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []
    summary = {
        "row_type": "summary",
        "option_id": option.get("id", ""),
        "strategy": option.get("strategy", ""),
        "score": option.get("score", 0),
        **option.get("metrics", {}),
    }
    rows.append(summary)
    for index, building in enumerate(option.get("buildings", []), start=1):
        rows.append(
            {
                "row_type": "building",
                "building_index": index,
                "option_id": option.get("id", ""),
                "strategy": option.get("strategy", ""),
                "prototype_id": building["prototype_id"],
                "floors": building["floors"],
                "height_m": building["height_m"],
                "gfa_m2": building["gfa_m2"],
                "units": building["units"],
                "rotation_deg": building["rotation_deg"],
                "centroid_x": building["centroid"][0],
                "centroid_y": building["centroid"][1],
            }
        )
    pd.DataFrame(rows).to_csv(path, index=False)
    return path

