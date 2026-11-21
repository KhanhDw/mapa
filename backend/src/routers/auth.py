
"""Authentication: đăng ký, đăng nhập và xác thực JWT."""

import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone

import asyncpg
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pwdlib import PasswordHash
from pydantic import BaseModel, Field, field_validator

from ..config import settings
from ..db import get_pool


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/auth",
    tags=["authentication"],
)

bearer_scheme = HTTPBearer(
    auto_error=False,
)

password_hasher = PasswordHash.recommended()

USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_.-]+$")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ============================================================
# SCHEMAS
# ============================================================

class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=100)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        value = value.strip()

        if not USERNAME_PATTERN.fullmatch(value):
            raise ValueError(
                "Username chỉ được chứa chữ cái, số, dấu chấm, "
                "gạch dưới và gạch ngang"
            )

        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip()

        if not EMAIL_PATTERN.fullmatch(value):
            raise ValueError("Email không hợp lệ")

        return value

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: str | None) -> str | None:
        value = (value or "").strip()
        return value or None


class LoginIn(BaseModel):
    identifier: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    display_name: str | None
    role: str
    is_active: bool
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


# ============================================================
# JWT
# ============================================================

def _get_jwt_config() -> tuple[str, str, int]:
    secret = settings.JWT_SECRET_KEY
    algorithm = settings.JWT_ALGORITHM
    expires_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES

    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JWT_SECRET_KEY chưa được cấu hình",
        )

    if expires_minutes <= 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ACCESS_TOKEN_EXPIRE_MINUTES không hợp lệ",
        )

    return secret, algorithm, expires_minutes


def create_access_token(user_id: int) -> tuple[str, int]:
    secret, algorithm, expires_minutes = _get_jwt_config()

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=expires_minutes)

    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": expires_at,
        "type": "access",
    }

    token = jwt.encode(
        payload,
        secret,
        algorithm=algorithm,
    )

    return token, expires_minutes * 60


# ============================================================
# USER HELPERS
# ============================================================

def _serialize_user(row) -> dict:
    return {
        "id": int(row["id"]),
        "username": row["username"],
        "email": row["email"],
        "display_name": row["display_name"],
        "role": row["role"],
        "is_active": bool(row["is_active"]),
        "created_at": row["created_at"],
    }


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Thông tin xác thực không hợp lệ hoặc đã hết hạn",
        headers={"WWW-Authenticate": "Bearer"},
    )


# ============================================================
# AUTHENTICATION DEPENDENCIES
# ============================================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    pool: asyncpg.Pool = Depends(get_pool),
):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()

    token = credentials.credentials

    secret, algorithm, _ = _get_jwt_config()

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=[algorithm],
            options={
                "require": ["sub", "iat", "exp", "type"],
            },
        )

        if payload.get("type") != "access":
            raise _unauthorized()

        subject = payload.get("sub")

        if not isinstance(subject, str) or not subject.isdigit():
            raise _unauthorized()

        user_id = int(subject)

        if user_id <= 0:
            raise _unauthorized()

    except jwt.InvalidTokenError:
        raise _unauthorized()

    row = await pool.fetchrow(
        """
        SELECT
            id,
            username,
            email,
            display_name,
            role,
            is_active,
            created_at
        FROM public.users
        WHERE id = $1
          AND is_active = TRUE
        """,
        user_id,
    )

    if row is None:
        raise _unauthorized()

    return row


async def require_admin(
    current_user=Depends(get_current_user),
):
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thực hiện thao tác này",
        )

    return current_user


# ============================================================
# REGISTER
# ============================================================

@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    body: RegisterIn,
    pool: asyncpg.Pool = Depends(get_pool),
):
    password_hash = await asyncio.to_thread(
        password_hasher.hash,
        body.password,
    )

    try:
        row = await pool.fetchrow(
            """
            INSERT INTO public.users (
                username,
                email,
                password_hash,
                display_name,
                role,
                is_active
            )
            VALUES ($1, $2, $3, $4, 'user', TRUE)
            RETURNING
                id,
                username,
                email,
                display_name,
                role,
                is_active,
                created_at
            """,
            body.username,
            body.email,
            password_hash,
            body.display_name,
        )

    except asyncpg.UniqueViolationError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username hoặc email đã được sử dụng",
        )

    return _serialize_user(row)


# ============================================================
# LOGIN
# ============================================================

@router.post(
    "/login",
    response_model=TokenOut,
)
async def login(
    body: LoginIn,
    pool: asyncpg.Pool = Depends(get_pool),
):
    identifier = body.identifier.strip()

    rows = await pool.fetch(
        """
        SELECT
            id,
            username,
            email,
            display_name,
            password_hash,
            role,
            is_active,
            created_at
        FROM public.users
        WHERE username = $1 OR email = $1
        LIMIT 2
        """,
        identifier,
    )

    # Không chấp nhận trường hợp username của một tài khoản
    # trùng với email của tài khoản khác.
    if len(rows) != 1:
        raise _unauthorized()

    user = rows[0]

    if not user["is_active"]:
        raise _unauthorized()

    password_valid = await asyncio.to_thread(
        password_hasher.verify,
        body.password,
        user["password_hash"],
    )

    if not password_valid:
        raise _unauthorized()

    await pool.execute(
        """
        UPDATE public.users
        SET last_login_at = now()
        WHERE id = $1
        """,
        user["id"],
    )

    token, expires_in = create_access_token(
        int(user["id"]),
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "user": _serialize_user(user),
    }


# ============================================================
# CURRENT USER
# ============================================================

@router.get(
    "/me",
    response_model=UserOut,
)
async def get_me(
    current_user=Depends(get_current_user),
):
    return _serialize_user(current_user)
