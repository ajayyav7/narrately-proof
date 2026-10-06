from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3.5:0.8b")
OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "4096"))


def _get_json(path: str) -> dict:
    request = Request(f"{OLLAMA_BASE_URL}{path}", headers={"Accept": "application/json"})
    with urlopen(request, timeout=3) as response:
        return json.loads(response.read())


def get_ollama_status() -> dict:
    try:
        version = _get_json("/api/version").get("version")
        models = _get_json("/api/tags").get("models", [])
        installed = [model.get("name", "") for model in models]
        configured_present = any(name == OLLAMA_MODEL or name.startswith(f"{OLLAMA_MODEL}:") for name in installed)
        return {
            "connected": True,
            "version": version,
            "configured_model": OLLAMA_MODEL,
            "model_installed": configured_present,
            "installed_models": installed,
            "num_ctx": OLLAMA_NUM_CTX,
        }
    except (OSError, TimeoutError, URLError, json.JSONDecodeError):
        return {
            "connected": False,
            "version": None,
            "configured_model": OLLAMA_MODEL,
            "model_installed": False,
            "installed_models": [],
            "num_ctx": OLLAMA_NUM_CTX,
            "message": "Ollama is not responding at the configured local address.",
        }
