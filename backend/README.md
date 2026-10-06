# Narrately Proof API

Local FastAPI service for document intake and first-pass claim/evidence matching. It extracts PDF, DOCX, and XLSX text with the best available page, paragraph, table-row, or spreadsheet-row location, then returns a JSON evidence ledger.

Run from this directory after installing `requirements.txt`:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Start the API from this folder without activating the environment:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Health check: `http://localhost:8000/health`

Analysis endpoint: `POST http://localhost:8000/api/v1/analyses` as `multipart/form-data` with one `report` (PDF/DOCX) and one or more `sources` (PDF/DOCX/XLSX), plus `Authorization: Bearer <Supabase access token>`. The API verifies the session with the existing Narrately Supabase Auth before accepting an analysis. Files are held in memory and are not saved. Each file is limited to 25 MB. Scanned PDFs need OCR and are not supported yet.

Ollama readiness: `GET http://localhost:8000/api/v1/ollama/status`. Configure the local model in `.env` using `.env.example` as a starting point. The current claim matcher remains deterministic; Ollama is installed and configured, but report text is not sent to the model yet.

The local config uses `qwen3.5:0.8b` with a 4096-token context to fit this PC's 8 GB RAM. To download it again if needed, install Ollama for Windows, then run `ollama pull qwen3.5:0.8b`. Ollama must be running before the API status check will show it as connected.

## Shared Narrately Supabase plan

Proof will use the existing Narrately Supabase project for Auth, Postgres, and Storage. Next.js will use Supabase's SSR client so the existing Auth session can be shared. FastAPI will use the same project for private files and queue processing. Proof metadata uses `proof_*` tables with row-level security; the existing Auth users remain the source of identity. See `../supabase/README.md` before applying the reviewed migration. Do not copy a Supabase secret key into a `NEXT_PUBLIC_*` variable or commit it.

FAISS CPU is the selected initial vector index. The official supported Windows install path is Conda; current Windows package builds are for Python 3.12, while this API environment uses Python 3.14. When vector search is implemented, create a Python 3.12 Conda environment for the worker and install the other API requirements there too. Do not try to add `faiss-cpu` with pip to this environment.
