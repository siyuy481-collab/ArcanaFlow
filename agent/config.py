import os
from dotenv import load_dotenv


load_dotenv()

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "").strip()
MINDS_API_KEY = os.getenv("MINDS_API_KEY", "").strip()
MINDS_SPARK_ID = os.getenv("MINDS_SPARK_ID", "").strip()
MINDS_API_BASE = os.getenv("MINDS_API_BASE", "https://api.build.hellominds.ai").strip().rstrip("/")
