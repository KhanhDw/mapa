# Set UTF-8 encoding for proper output display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "[1/3] Checking Docker status..." -ForegroundColor Cyan

# Check if the Docker daemon is running
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Docker is not running. Launching Docker Desktop..." -ForegroundColor Yellow
    
    # Default path for Docker Desktop on Windows
    $dockerPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    
    if (Test-Path $dockerPath) {
        Start-Process $dockerPath
    }
    else {
        Write-Host "[X] Docker Desktop path not found. Please start it manually!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Waiting for Docker to start..." -ForegroundColor Yellow
    while ($true) {
        Start-Sleep -Seconds 5
        docker info *> $null
        if ($LASTEXITCODE -eq 0) {
            break
        }
        Write-Host "." -NoNewline
    }
    Write-Host "`n[+] Docker is ready!" -ForegroundColor Green
}
else {
    Write-Host "[+] Docker is already running, skipping startup." -ForegroundColor Green
}

Write-Host "[2/3] Starting containers with docker compose..." -ForegroundColor Cyan
docker compose up -d

Write-Host "[3/3] Starting FastAPI Backend..." -ForegroundColor Cyan
Set-Location "backend"

# Activate Python virtual environment and run uvicorn
if (Test-Path "myenv\Scripts\Activate.ps1") {
    & "myenv\Scripts\Activate.ps1"
}

python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000