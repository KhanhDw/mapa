
# Set UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

Write-Host "[1/5] Checking Docker status..." -ForegroundColor Cyan

docker info *> $null

if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Launching Docker Desktop..." -ForegroundColor Yellow

    $dockerPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"

    if (Test-Path $dockerPath) {
        Start-Process $dockerPath
    } else {
        Write-Host "[X] Docker Desktop not found!" -ForegroundColor Red
        exit 1
    }

    Write-Host "Waiting for Docker..." -ForegroundColor Yellow

    while ($true) {
        Start-Sleep -Seconds 5
        docker info *> $null

        if ($LASTEXITCODE -eq 0) {
            break
        }

        Write-Host "." -NoNewline
    }
}

Write-Host "[+] Docker is ready!" -ForegroundColor Green

Write-Host "[2/5] Starting containers..." -ForegroundColor Cyan

docker compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Docker Compose failed!" -ForegroundColor Red
    exit 1
}

# Wait for PostGIS container
Write-Host "Waiting for PostGIS..." -ForegroundColor Yellow

while ($true) {
    $containerStatus = docker inspect --format "{{.State.Status}}" postgis-webmap 2>$null

    if ($containerStatus -eq "running") {
        $health = docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}no_healthcheck{{end}}" postgis-webmap 2>$null

        if ($health -eq "healthy" -or $health -eq "no_healthcheck") {
            break
        }
    }

    Start-Sleep -Seconds 2
}

Write-Host "[+] PostGIS is ready!" -ForegroundColor Green

Write-Host "[3/5] Checking database initialization..." -ForegroundColor Cyan

$initScript = "./db/migrations/init_db.sql"

$tableCheck = docker exec -i postgis-webmap psql `
    -X -U postgres -d webmap_db -tA `
    -c "SELECT to_regclass('user_data.electric_poles');"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Cannot connect to database!" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrWhiteSpace("$tableCheck")) {
    if (Test-Path $initScript) {
        Get-Content $initScript -Raw | docker exec -i postgis-webmap psql -X -U postgres -d webmap_db

        if ($LASTEXITCODE -ne 0) {
            Write-Host "[X] Database initialization failed!" -ForegroundColor Red
            exit 1
        }

        Write-Host "[+] Database initialized!" -ForegroundColor Green
    } else {
        Write-Host "[X] init_db.sql not found!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[+] Database already initialized." -ForegroundColor Green
}

Write-Host "[4/5] Checking Vietnam wards GeoJSON data..." -ForegroundColor Cyan

Set-Location "backend"

if (-not (Test-Path "myenv\Scripts\Activate.ps1")) {
    Write-Host "[X] Python virtual environment not found!" -ForegroundColor Red
    exit 1
}

& "myenv\Scripts\Activate.ps1"

$wardCount = docker exec -i postgis-webmap psql `
    -X -U postgres -d webmap_db -tA `
    -c "SELECT CASE WHEN to_regclass('user_data.vietnam_wards_2025') IS NULL THEN -1 ELSE (SELECT COUNT(*) FROM user_data.vietnam_wards_2025) END;"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Cannot check Vietnam wards table!" -ForegroundColor Red
    exit 1
}

$wardCount = "$wardCount".Trim()

if ($wardCount -eq "-1" -or $wardCount -eq "0") {
    Write-Host "[!] Vietnam wards data missing. Importing GeoJSON..." -ForegroundColor Yellow

    if (-not (Test-Path "import_wards.py")) {
        Write-Host "[X] import_wards.py not found!" -ForegroundColor Red
        exit 1
    }

    python -X utf8 import_wards.py

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] GeoJSON import failed!" -ForegroundColor Red
        exit 1
    }

    Write-Host "[+] GeoJSON imported successfully!" -ForegroundColor Green
} else {
    Write-Host "[+] Vietnam wards data already exists ($wardCount records). Skipping import." -ForegroundColor Green
}

Write-Host "[5/5] Starting FastAPI Backend..." -ForegroundColor Cyan

python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
