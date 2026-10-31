import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")

PANORAMAS_DIR = os.getenv("PANORAMAS_DIR", "data/panoramas")
MAX_FEATURES = 5000