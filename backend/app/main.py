from datetime import datetime, timedelta, timezone
import logging
from threading import Lock
from uuid import uuid4

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile
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
logger = logging.getLogger(__name__)
analysis_jobs: dict[str, dict] = {}
analysis_jobs_lock = Lock()


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


def prune_analysis_jobs() -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=2)
    with analysis_jobs_lock:
        expired = [
            job_id for job_id, job in analysis_jobs.items()
            if job["status"] in {"completed", "failed"}
            and datetime.fromisoformat(job["updated_at"]) < cutoff
        ]
        for job_id in expired:
            analysis_jobs.pop(job_id, None)

        finished = sorted(
            (
                (job["updated_at"], job_id)
                for job_id, job in analysis_jobs.items()
                if job["status"] in {"completed", "failed"}
            )
        )
        for _, job_id in finished[:-10]:
            analysis_jobs.pop(job_id, None)


def update_analysis_job(job_id: str, **updates: object) -> None:
    with analysis_jobs_lock:
        job = analysis_jobs.get(job_id)
        if job is not None:
            job.update(updates)
            job["updated_at"] = datetime.now(timezone.utc).isoformat()


def run_analysis_job(
    job_id: str,
    report_name: str,
    report_bytes: bytes,
    sources: list[tuple[str, bytes]],
) -> None:
    update_analysis_job(job_id, status="processing", stage="Extracting documents")
    try:
        report_passages = extract_document(report_name, report_bytes)
        source_documents = [
            (name, extract_document(name, content)) for name, content in sources
        ]
        claims = split_claims(report_passages)
        if not claims:
            raise ValueError(
                "No report sentences could be extracted. Scanned PDFs may need OCR, which is not available yet."
            )

        update_analysis_job(
            job_id,
            stage=f"Verifying {len(claims)} claims against your sources",
        )
        ledger = build_ledger(claims, source_documents)
        ledger["report"] = {
            "filename": report_name,
            "extracted_passages": len(report_passages),
        }
        ledger["sources"] = [
            {"filename": name, "extracted_passages": len(passages)}
            for name, passages in source_documents
        ]
        update_analysis_job(
            job_id, status="completed", stage="Complete", result=ledger
        )
    except ValueError as error:
        update_analysis_job(job_id, status="failed", error=str(error))
    except Exception:
        logger.exception("Analysis job %s failed", job_id)
        update_analysis_job(
            job_id,
            status="failed",
            error="Analysis failed while checking the documents. Please try again.",
        )


@app.post("/api/v1/analyses", status_code=202)
async def create_analysis(
    background_tasks: BackgroundTasks,
    report: UploadFile = File(...),
    sources: list[UploadFile] = File(...),
    user: dict = Depends(get_current_user),
) -> dict:
    if not sources:
        raise HTTPException(status_code=400, detail="Upload at least one source document.")
    report_name = report.filename or "report"
    report_bytes = await read_upload(report, {"pdf", "docx"})
    try:
        source_documents: list[tuple[str, bytes]] = []
        for source in sources:
            source_name = source.filename or "source"
            source_bytes = await read_upload(source, {"pdf", "docx", "xlsx"})
            source_documents.append((source_name, source_bytes))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    prune_analysis_jobs()
    job_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with analysis_jobs_lock:
        analysis_jobs[job_id] = {
            "job_id": job_id,
            "user_id": user["id"],
            "status": "queued",
            "stage": "Queued for verification",
            "created_at": now,
            "updated_at": now,
        }
    background_tasks.add_task(
        run_analysis_job, job_id, report_name, report_bytes, source_documents
    )
    return {"job_id": job_id, "status": "queued"}


@app.get("/api/v1/analyses/{job_id}")
def get_analysis_job(job_id: str, user: dict = Depends(get_current_user)) -> dict:
    with analysis_jobs_lock:
        job = analysis_jobs.get(job_id)
        if job is None or job["user_id"] != user["id"]:
            raise HTTPException(status_code=404, detail="Analysis job not found.")
        return {key: value for key, value in job.items() if key != "user_id"}
