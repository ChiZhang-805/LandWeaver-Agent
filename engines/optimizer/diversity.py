from __future__ import annotations


def selected_id_set(solution: dict) -> set[str]:
    return {building["candidate_id"] for building in solution.get("selected_candidates", [])}


def option_similarity(left: dict, right: dict) -> float:
    left_ids = selected_id_set(left)
    right_ids = selected_id_set(right)
    if not left_ids and not right_ids:
        return 1.0
    union = left_ids | right_ids
    return len(left_ids & right_ids) / len(union) if union else 0.0

