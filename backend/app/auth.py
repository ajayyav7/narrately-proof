from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from fastapi import Header, HTTPException

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(status_code=503, detail="Supabase authentication is not configured on the API.")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in to Narrately before submitting an analysis.")

    token = authorization[7:].strip()
    request = Request(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": f"Bearer {token}"},
    )
    try:
        with urlopen(request, timeout=10) as response:
            user = json.loads(response.read())
    except HTTPError as error:
        if error.code in (401, 403):
            raise HTTPException(status_code=401, detail="Your Narrately session expired. Sign in again.") from error
        raise HTTPException(status_code=503, detail="Could not verify the Narrately session.") from error
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=503, detail="Could not reach Supabase Auth to verify the session.") from error

    if not isinstance(user, dict) or not user.get("id"):
        raise HTTPException(status_code=401, detail="Supabase did not return a valid user session.")

    # A valid Narrately identity does not by itself grant access to Proof.
    entitlement_request = Request(
        f"{SUPABASE_URL}/rest/v1/product_entitlements?select=plan_key&user_id=eq.{user['id']}&product_key=eq.proof&status=in.(active,trialing)",
        headers={"apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": f"Bearer {token}"},
    )
    try:
        with urlopen(entitlement_request, timeout=10) as response:
            entitlements = json.loads(response.read())
    except HTTPError as error:
        if error.code == 404:
            raise HTTPException(status_code=503, detail="Narrately Proof access is not configured yet. Apply the product access migration first.") from error
        raise HTTPException(status_code=503, detail="Could not verify Narrately Proof access.") from error
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=503, detail="Could not reach Supabase to verify Narrately Proof access.") from error
    if not isinstance(entitlements, list) or not entitlements:
        raise HTTPException(status_code=403, detail="This account does not have Narrately Proof access. Start the Proof free plan in the app first.")
    return user
