from fastapi import HTTPException

from .config import settings


def validate_bbox(
    minx: float, miny: float, maxx: float, maxy: float
) -> tuple[float, float, float, float]:
    """Chặn bbox rỗng / ngược / quá lớn để tránh query nặng."""
    if minx >= maxx or miny >= maxy:
        raise HTTPException(400, "bbox không hợp lệ")

    area = (maxx - minx) * (maxy - miny)
    if area > settings.MAX_BBOX_AREA_DEG2:
        raise HTTPException(
            400,
            f"bbox quá lớn (tối đa {settings.MAX_BBOX_AREA_DEG2} deg²)",
        )
    return minx, miny, maxx, maxy
