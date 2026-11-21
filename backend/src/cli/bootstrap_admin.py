
"""Bootstrap tài khoản Admin đầu tiên.

Chạy từ thư mục backend:
    python -m src.cli.bootstrap_admin

Điều kiện:
    ADMIN_BOOTSTRAP_ENABLED=true

Không chạy tự động khi FastAPI startup.
"""

import asyncio
import getpass
import logging
import re
import sys

import asyncpg
from pwdlib import PasswordHash

from src.config import settings


logger = logging.getLogger(__name__)

password_hasher = PasswordHash.recommended()

# Khóa cố định để đồng bộ các lần chạy bootstrap.
BOOTSTRAP_LOCK_ID = 728194635210

USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_.-]{3,50}$")
EMAIL_PATTERN = re.compile(
    r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
)

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


def prompt_required(label: str, max_length: int) -> str:
    """Nhập một giá trị bắt buộc."""
    while True:
        value = input(f"{label}: ").strip()

        if not value:
            print("Giá trị không được để trống.")
            continue

        if len(value) > max_length:
            print(f"Độ dài tối đa là {max_length} ký tự.")
            continue

        return value


def prompt_username() -> str:
    while True:
        username = prompt_required("Username", 50)

        if USERNAME_PATTERN.fullmatch(username):
            return username

        print(
            "Username phải dài 3-50 ký tự, "
            "chỉ gồm chữ, số, dấu _, dấu . hoặc dấu -."
        )


def prompt_email() -> str:
    while True:
        email = prompt_required("Email", 254)

        if EMAIL_PATTERN.fullmatch(email):
            return email

        print("Email không hợp lệ.")


def prompt_display_name() -> str | None:
    while True:
        value = input("Display name (Enter để bỏ qua): ").strip()

        if not value:
            return None

        if len(value) <= 100:
            return value

        print("Display name tối đa 100 ký tự.")


def prompt_password() -> str:
    while True:
        password = getpass.getpass("Admin password: ")

        if not MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH:
            print(
                f"Mật khẩu phải dài từ {MIN_PASSWORD_LENGTH} "
                f"đến {MAX_PASSWORD_LENGTH} ký tự."
            )
            continue

        confirmation = getpass.getpass("Confirm password: ")

        if password != confirmation:
            print("Hai mật khẩu không khớp.")
            continue

        return password


async def create_admin(
    username: str,
    email: str,
    display_name: str | None,
    password: str,
) -> int:
    """Tạo Admin đầu tiên trong transaction."""

    if not settings.DATABASE_URL.strip():
        raise RuntimeError("DATABASE_URL chưa được cấu hình.")

    password_hash = await asyncio.to_thread(
        password_hasher.hash,
        password,
    )

    conn = await asyncpg.connect(
        settings.DATABASE_URL,
        command_timeout=settings.DB_COMMAND_TIMEOUT,
    )

    try:
        async with conn.transaction():
            # Đồng bộ các tiến trình bootstrap.
            await conn.execute(
                "SELECT pg_advisory_xact_lock($1::bigint)",
                BOOTSTRAP_LOCK_ID,
            )

            # Chặn INSERT/UPDATE/DELETE đồng thời trong lúc kiểm tra
            # và tạo tài khoản đầu tiên.
            await conn.execute(
                "LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE"
            )

            total_users = await conn.fetchval(
                "SELECT COUNT(*) FROM public.users"
            )

            if total_users != 0:
                raise RuntimeError(
                    "Không thể bootstrap Admin: "
                    f"public.users đã có {total_users} tài khoản. "
                    "Không tự động nâng quyền."
                )

            user_id = await conn.fetchval(
                """
                INSERT INTO public.users (
                    username,
                    email,
                    password_hash,
                    display_name,
                    role,
                    is_active
                )
                VALUES ($1, $2, $3, $4, 'admin', TRUE)
                RETURNING id
                """,
                username,
                email,
                password_hash,
                display_name,
            )

            return user_id

    finally:
        await conn.close()


async def main() -> int:
    if not settings.ADMIN_BOOTSTRAP_ENABLED:
        print(
            "Bootstrap bị từ chối: "
            "ADMIN_BOOTSTRAP_ENABLED chưa được bật trong backend/.env."
        )
        return 1

    if not settings.DATABASE_URL.strip():
        print("DATABASE_URL chưa được cấu hình.")
        return 1

    print("=== MAPA Admin Bootstrap ===")
    print("Chỉ tạo Admin nếu public.users đang rỗng.")
    print()

    username = prompt_username()
    email = prompt_email()
    display_name = prompt_display_name()
    password = prompt_password()

    confirm = input(
        "\nXác nhận tạo tài khoản Admin đầu tiên? (yes/no): "
    ).strip().lower()

    if confirm != "yes":
        print("Đã hủy bootstrap.")
        return 1

    try:
        user_id = await create_admin(
            username=username,
            email=email,
            display_name=display_name,
            password=password,
        )

        print()
        print("Bootstrap Admin thành công.")
        print(f"User ID: {user_id}")
        print(f"Username: {username}")
        print(f"Email: {email}")
        print("Role: admin")

        return 0

    except asyncpg.UniqueViolationError:
        print(
            "Không thể tạo Admin: username hoặc email đã tồn tại."
        )
        return 1

    except Exception as exc:
        logger.exception("Admin bootstrap failed")
        print(f"Bootstrap thất bại: {exc}")
        return 1


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        print("\nĐã hủy bootstrap.")
        sys.exit(130)
