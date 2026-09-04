import os
from dotenv import load_dotenv


load_dotenv()


def _env_value(*names: str) -> str:
    """Return the first non-empty value, preferring canonical variable names."""
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    return ""


DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "").strip()
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash").strip() or "deepseek-v4-flash"
MINDS_API_KEY = _env_value("MINDS_BUILDER_API_KEY", "MINDS_API_KEY")
MINDS_SPARK_ID = os.getenv("MINDS_SPARK_ID", "").strip()
MINDS_API_BASE = os.getenv("MINDS_API_BASE", "https://api.build.hellominds.ai").strip().rstrip("/")
