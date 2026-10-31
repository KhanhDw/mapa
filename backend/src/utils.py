import json
from fastapi import HTTPException


def parse_link_positions(value):
    if isinstance(value, str):
        return json.loads(value)
    return value or []


def validate_bbox(minx: float, miny: float, maxx: float, maxy: float):
    if minx >= maxx or miny >= maxy:
        raise HTTPException(400, "bbox không hợp lệ")
    return minx, miny, maxx, maxy