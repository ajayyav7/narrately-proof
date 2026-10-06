# Narrately Proof

**Verify every claim. Trust every report.**

An evidence-backed report verification platform. This repository contains the web workspace foundation and an initial local upload and evidence-matching flow. The dashboard's preloaded recent reports are illustrative sample data.

## Start the web workspace

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

## Start the API and Ollama

The API is set up in its own Python environment. Open a **second PowerShell window** and run:

```powershell
cd "C:\Projects\Narrately Proof\backend"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Ollama is installed and running locally at `http://localhost:11434`. The starter model is `qwen3.5:0.8b`, selected for this PC's 8 GB of RAM. Check the backend at `http://localhost:8000/health` and model readiness at `http://localhost:8000/api/v1/ollama/status`.

## Product direction

The product verifies claims against user-provided evidence. It is not a writing tool, AI detector, or internet fact-checker. The locked spec defines PDF/DOCX reports, PDF/DOCX/XLSX sources, claim-level statuses, source references, and an exportable evidence ledger.

## Shared Narrately infrastructure

Proof is planned to use the existing Narrately Supabase project and Auth session, product-specific `proof_*` tables, a private `proof-files` bucket, and a database-backed `proof_jobs` queue. Its reviewed schema draft is in [supabase/migrations](supabase/migrations); it has **not** been applied to the existing project. See [the setup notes](supabase/README.md). FAISS CPU is the initial vector-search choice; on Windows it needs a Conda-based environment rather than pip in the current Python 3.14 virtual environment.

## Current stage

- Dashboard, report/source upload, document extraction, first-pass claim/evidence matching, results review, and JSON evidence-ledger download are implemented locally.
- Shared Narrately Supabase email/password sign-in, registration, session refresh, and protected dashboard routes are wired in Next.js. Registering here uses the existing project Auth; existing Narrately users can sign in with their existing credentials.
- Supabase Auth environment values are read from local `.env.local` and `backend/.env`; never commit backend secret keys.
- Local Python environment, FastAPI, document readers, Ollama, and the Qwen starter model are installed and running on this PC.
- Ollama is configured and health-checked, but the current verifier does not yet send report text to the model. The analysis endpoint still uses the deterministic first-pass matcher.
- The Supabase schema draft is not applied. Reports are not yet persisted to the shared database or Storage.
- The deterministic matcher ranks source passages by text overlap and checks numbers from related passages. A strong text match alone does not establish support.
- Product-specific identity/access separation is scaffolded: Proof requires its own active Proof entitlement, and users can self-start the Proof free plan after the shared migration is applied. Summary and Research still need their own app-side entitlement checks.
- Persistent report history, secure cloud storage, OCR for scanned PDFs, robust semantic/contradiction analysis, PDF/DOCX exports, billing integration, and usage quota enforcement remain to be built.
