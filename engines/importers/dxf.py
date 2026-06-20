from __future__ import annotations

from engines.geometry import GeometryError


def _pairs(text: str) -> list[tuple[str, str]]:
    lines = [line.strip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    pairs: list[tuple[str, str]] = []
    index = 0
    while index + 1 < len(lines):
        pairs.append((lines[index], lines[index + 1]))
        index += 2
    return pairs


def _largest_ring(rings: list[list[tuple[float, float]]]) -> list[tuple[float, float]]:
    if not rings:
        raise GeometryError("DXF contains no supported POLYLINE or LWPOLYLINE boundary.")
    return max(rings, key=lambda ring: abs(_shoelace_area(ring)))


def _shoelace_area(points: list[tuple[float, float]]) -> float:
    if len(points) < 3:
        return 0
    closed = points + [points[0]]
    return sum(closed[i][0] * closed[i + 1][1] - closed[i + 1][0] * closed[i][1] for i in range(len(points))) / 2


def parse_dxf_polyline(text: str) -> list[tuple[float, float]]:
    """Parse the largest 2D LWPOLYLINE/POLYLINE ring from an ASCII DXF file."""

    pairs = _pairs(text)
    rings: list[list[tuple[float, float]]] = []
    index = 0
    while index < len(pairs):
        code, value = pairs[index]
        if code == "0" and value.upper() == "LWPOLYLINE":
            index += 1
            points: list[tuple[float, float]] = []
            current_x: float | None = None
            while index < len(pairs) and not (pairs[index][0] == "0"):
                group, group_value = pairs[index]
                if group == "10":
                    current_x = float(group_value)
                elif group == "20" and current_x is not None:
                    points.append((current_x, float(group_value)))
                    current_x = None
                index += 1
            if len(points) >= 3:
                rings.append(points)
            continue
        if code == "0" and value.upper() == "POLYLINE":
            index += 1
            points = []
            while index < len(pairs):
                group, group_value = pairs[index]
                if group == "0" and group_value.upper() == "VERTEX":
                    index += 1
                    x: float | None = None
                    y: float | None = None
                    while index < len(pairs) and pairs[index][0] != "0":
                        vertex_group, vertex_value = pairs[index]
                        if vertex_group == "10":
                            x = float(vertex_value)
                        elif vertex_group == "20":
                            y = float(vertex_value)
                        index += 1
                    if x is not None and y is not None:
                        points.append((x, y))
                    continue
                if group == "0" and group_value.upper() == "SEQEND":
                    index += 1
                    break
                index += 1
            if len(points) >= 3:
                rings.append(points)
            continue
        index += 1
    return _largest_ring(rings)
