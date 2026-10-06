$ErrorActionPreference = "Stop"
$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $backendDir

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Error "Backend environment is missing. Run: python -m venv .venv; .\.venv\Scripts\python.exe -m pip install -r requirements.txt"
}

Write-Host "Starting Narrately Proof API at http://localhost:8000"
Write-Host "Ollama status: http://localhost:8000/api/v1/ollama/status"
& ".venv\Scripts\python.exe" -m uvicorn app.main:app --reload --port 8000
