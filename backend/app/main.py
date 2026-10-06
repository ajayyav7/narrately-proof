from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .documents import extract_document, split_claims
from .auth import get_current_user
from .ollama_client import get_ollama_status
from .verification import build_ledger

app = FastAPI(title="Narrately Proof API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://getnarrately.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "narrately-proof-api"}


@app.get("/api/v1")
def api_info() -> dict[str, str]:
    return {
        "name": "Narrately Proof API",
        "status": "prototype",
        "message": "Upload a report and source pack at POST /api/v1/analyses.",
    }


@app.get("/api/v1/ollama/status")
def ollama_status() -> dict:
    """Expose local model readiness without sending report content to Ollama."""
    return get_ollama_status()


MAX_FILE_BYTES = 25 * 1024 * 1024


async def read_upload(upload: UploadFile, allowed: set[str]) -> bytes:
    suffix = (upload.filename or "").rsplit(".", 1)[-1].lower()
    if suffix not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type for {upload.filename}.")
    content = await upload.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f"{upload.filename} exceeds the 25 MB limit.")
    if not content:
        raise HTTPException(status_code=400, detail=f"{upload.filename} is empty.")
    return content


@app.post("/api/v1/analyses")
async def create_analysis(
    report: UploadFile = File(...),
    sources: list[UploadFile] = File(...),
    user: dict = Depends(get_current_user),
) -> dict:
    del user  # Auth is verified here; persistence will attach this user ID in the next step.
    if not sources:
        raise HTTPException(status_code=400, detail="Upload at least one source document.")
    report_name = report.filename or "report"
    report_bytes = await read_upload(report, {"pdf", "docx"})
    try:
        report_passages = extract_document(report_name, report_bytes)
        source_documents = []
        for source in sources:
            source_name = source.filename or "source"
            source_bytes = await read_upload(source, {"pdf", "docx", "xlsx"})
            source_documents.append((source_name, extract_document(source_name, source_bytes)))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=422, detail=f"Could not extract a document: {error}") from error
    claims = split_claims(report_passages)
    if not claims:
        raise HTTPException(status_code=422, detail="No report sentences could be extracted. Scanned PDFs may need OCR, which is not available yet.")
    ledger = build_ledger(claims, source_documents)
    ledger["report"] = {"filename": report_name, "extracted_passages": len(report_passages)}
    ledger["sources"] = [{"filename": name, "extracted_passages": len(passages)} for name, passages in source_documents]
    return ledger
