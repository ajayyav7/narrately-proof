# Narrately Proof API

Narrately Proof's FastAPI service extracts PDF, DOCX, and XLSX text, retrieves source passages for report claims, and returns an evidence ledger. When the local Ollama model is ready, it assesses each selected claim against up to four retrieved passages. The API maps the model's selected evidence IDs back to exact server-extracted source locations; the model cannot create citations. If Ollama is unavailable or returns invalid data, that claim uses the deterministic matcher and the result marks its analysis method.

## Local setup

Use three PowerShell windows on the PC that runs Ollama. Keep all three running while using the temporary tunnel.

### 1. Start Ollama and download the model

Start the Ollama Windows app. In PowerShell, run:

```powershell
ollama pull qwen3.5:2b-q4_K_M
ollama list
```

The quantized 2B model is about 1.9 GB. The API uses a 4096-token context to limit memory use on this PC's 8 GB RAM. If Windows becomes too slow, use `qwen3.5:0.8b` instead and set `OLLAMA_MODEL=qwen3.5:0.8b` in `backend/.env`.

### 2. Start the FastAPI service

Pull the latest `main` changes into `C:\Projects\Narrately Proof` first. In a second PowerShell window:

```powershell
cd "C:\Projects\Narrately Proof\backend"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

If this is the first run, create the virtual environment and install dependencies first:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Keep the existing local `.env` populated with the Narrately Supabase URL and publishable key. Never commit `.env` or expose the Supabase secret key in the browser. Check that these open successfully on the same PC:

- `http://localhost:8000/health`
- `http://localhost:8000/api/v1/ollama/status` (should show `connected: true` and `model_installed: true`)

### 3. Create a temporary secure tunnel

Install `cloudflared` from Cloudflare's official Windows download page. In a third PowerShell window, run:

```powershell
cloudflared tunnel --url http://localhost:8000
```

Copy the generated `https://….trycloudflare.com` address. Keep this window open too. Quick Tunnels are for testing; the address changes when restarted and the API is reachable only while this PC and the tunnel are running.

### 4. Point the production Proof app at the API

In Vercel, open the `narrately-proof` project → Settings → Environment Variables. Set `NEXT_PUBLIC_API_URL` to the generated tunnel URL (no trailing slash) for Production, then redeploy the latest Production deployment. Do not use `localhost` here: a visitor's browser would call their own computer. When a Quick Tunnel URL changes, update the Vercel value and redeploy again.

After redeploy, open `https://getnarrately.com/proof` and try Start Verification. The analysis request requires a signed-in Proof user with active Proof entitlement. The tunnel forwards it to the API on this PC; Ollama processes the report and sources locally. Uploaded files are held in memory and are not written to disk by this API. Each file is limited to 25 MB. Scanned PDFs need OCR and are not supported yet.

## Important limits

- This is a temporary development setup, not an always-on production backend. The API and Ollama only work while the PC is awake and all required windows are running.
- The Quick Tunnel hostname changes after restart. For reliable production use, move the API and model to an always-on host, or set up a stable managed tunnel and dedicated API hostname. A server with enough memory/GPU may have ongoing costs.
- To keep local processing responsive, at most 60 relevant claims per analysis are sent to Ollama; other claims and model failures use deterministic text matching. The response reports `ollama_assessed` and `deterministic_fallback` counts.
- Automated findings are a first pass for human review, not proof of factual truth. Always check the original report and cited source passage.

## Shared Narrately Supabase plan

Proof uses the existing Narrately Supabase project for Auth, Postgres, and Storage. FastAPI verifies the session and active Proof entitlement before accepting analysis. Proof metadata uses `proof_*` tables with row-level security; existing Auth users remain the source of identity. See `../supabase/README.md` before applying any migration. Never put a Supabase secret key in a `NEXT_PUBLIC_*` variable or commit it.

FAISS CPU is the selected initial vector index. The official supported Windows install path is Conda; current Windows package builds are for Python 3.12, while this API environment uses Python 3.14. When vector search is implemented, create a Python 3.12 Conda environment for the worker and install the API requirements there too. Do not try to add `faiss-cpu` with pip to this environment.
