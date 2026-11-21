
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response
from pydantic import BaseModel, Field, field_validator

from ..db import get_pool
from .auth import get_current_user


router = APIRouter(prefix="/api/electric-poles", tags=["electric-poles"])

BIGINT_MAX = 9_223_372_036_854_775_807

_POLE_SELECT = """
    SELECT id, pole_code, route, status, detail,
           ST_X(geom) AS lng, ST_Y(geom) AS lat,
           created_at, updated_at
    FROM user_data.electric_poles
"""


class ElectricPoleInput(BaseModel):
    pole_code: str = Field(min_length=1, max_length=100)
    route: str = Field(min_length=1, max_length=300)
    status: Literal["good", "warning", "error"] = "good"
    lng: float = Field(ge=-180, le=180)
    lat: float = Field(ge=-90, le=90)
    detail: str | None = Field(default=None, max_length=5000)

    @field_validator("pole_code", "route")
    @classmethod
    def _required_text_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Trường này không được để trống")
        return value

    @field_validator("detail")
    @classmethod
    def _blank_detail_to_none(cls, value: str | None) -> str | None:
        value = (value or "").strip()
        return value or None


def _serialize_pole(row: asyncpg.Record) -> dict:
    return {
        "id": int(row["id"]),
        "pole_code": row["pole_code"],
        "route": row["route"],
        "status": row["status"],
        "detail": row["detail"],
        "lng": float(row["lng"]),
        "lat": float(row["lat"]),
        "created_at": row["created_at"].isoformat(),
        "updated_at": row["updated_at"].isoformat(),
    }


def _ensure_pole_access(row: asyncpg.Record, current_user: dict) -> None:
    is_owner = row["user_id"] == current_user["id"]
    is_admin = current_user["role"] == "admin"

    if not is_owner and not is_admin:
        raise HTTPException(403, "Bạn không có quyền chỉnh sửa trụ điện này")


@router.get("")
async def list_electric_poles(
    search: str | None = Query(default=None, max_length=100),
    pool: asyncpg.Pool = Depends(get_pool),
):
    async with pool.acquire() as conn:
        if search and search.strip():
            rows = await conn.fetch(
                _POLE_SELECT
                + """
                WHERE pole_code ILIKE '%' || $1 || '%'
                   OR route ILIKE '%' || $1 || '%'
                ORDER BY id
                """,
                search.strip(),
            )
        else:
            rows = await conn.fetch(_POLE_SELECT + " ORDER BY id")

    return {
        "items": [_serialize_pole(row) for row in rows],
        "total": len(rows),
    }


@router.get("/{pole_id}")
async def get_electric_pole(
    pole_id: int = Path(ge=1, le=BIGINT_MAX),
    pool: asyncpg.Pool = Depends(get_pool),
):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            _POLE_SELECT + " WHERE id = $1",
            pole_id,
        )

    if row is None:
        raise HTTPException(404, "Không tìm thấy trụ điện")

    return _serialize_pole(row)


@router.post("", status_code=201)
async def create_electric_pole(
    body: ElectricPoleInput,
    current_user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO user_data.electric_poles
                    (user_id, pole_code, route, status, detail, geom)
                VALUES (
                    $1, $2, $3, $4, $5,
                    ST_SetSRID(ST_MakePoint($6, $7), 4326)
                )
                RETURNING id, pole_code, route, status, detail,
                          ST_X(geom) AS lng, ST_Y(geom) AS lat,
                          created_at, updated_at
                """,
                current_user["id"],
                body.pole_code,
                body.route,
                body.status,
                body.detail,
                body.lng,
                body.lat,
            )
    except asyncpg.UniqueViolationError:
        raise HTTPException(409, "Mã trụ điện đã tồn tại")

    return _serialize_pole(row)


@router.put("/{pole_id}")
async def update_electric_pole(
    body: ElectricPoleInput,
    pole_id: int = Path(ge=1, le=BIGINT_MAX),
    current_user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                owner = await conn.fetchrow(
                    """
                    SELECT user_id
                    FROM user_data.electric_poles
                    WHERE id = $1
                    FOR UPDATE
                    """,
                    pole_id,
                )

                if owner is None:
                    raise HTTPException(404, "Không tìm thấy trụ điện")

                _ensure_pole_access(owner, current_user)

                row = await conn.fetchrow(
                    """
                    UPDATE user_data.electric_poles
                    SET pole_code = $2,
                        route = $3,
                        status = $4,
                        detail = $5,
                        geom = ST_SetSRID(ST_MakePoint($6, $7), 4326),
                        updated_at = now()
                    WHERE id = $1
                    RETURNING id, pole_code, route, status, detail,
                              ST_X(geom) AS lng, ST_Y(geom) AS lat,
                              created_at, updated_at
                    """,
                    pole_id,
                    body.pole_code,
                    body.route,
                    body.status,
                    body.detail,
                    body.lng,
                    body.lat,
                )
    except asyncpg.UniqueViolationError:
        raise HTTPException(409, "Mã trụ điện đã tồn tại")

    return _serialize_pole(row)


@router.delete("/{pole_id}", status_code=204)
async def delete_electric_pole(
    pole_id: int = Path(ge=1, le=BIGINT_MAX),
    current_user=Depends(get_current_user),
    pool: asyncpg.Pool = Depends(get_pool),
):
    async with pool.acquire() as conn:
        async with conn.transaction():
            owner = await conn.fetchrow(
                """
                SELECT user_id
                FROM user_data.electric_poles
                WHERE id = $1
                FOR UPDATE
                """,
                pole_id,
            )

            if owner is None:
                raise HTTPException(404, "Không tìm thấy trụ điện")

            _ensure_pole_access(owner, current_user)

            await conn.execute(
                """
                DELETE FROM user_data.electric_poles
                WHERE id = $1
                """,
                pole_id,
            )

    return Response(status_code=204)
