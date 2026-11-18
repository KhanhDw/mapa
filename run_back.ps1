# Set UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Helper: chạy docker "im lặng"
# - Simple function (không param block) để các flag như -i, -d, -X, -U,
#   --format... được truyền nguyên vẹn cho docker (không bị PowerShell
#   hiểu thành tham số của function).
# - Tạm hạ ErrorActionPreference vì "Stop" + "2>&1" với native command
#   có thể ném NativeCommandError.
# - Hỗ trợ pipe stdin qua biến tự động $input.
# ---------------------------------------------------------------------------
function Invoke-DockerQuiet {
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if ($MyInvocation.ExpectingInput) {
            $output = $input | & docker @args 2>&1
        } else {
            $output = & docker @args 2>&1
        }
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevEAP
    }

    return [pscustomobject]@{
        ExitCode = $exitCode
        Output   = $output
    }
}

function ConvertTo-TrimmedString {
    param($Value)
    if ($null -eq $Value) { return "" }
    return ((@($Value) | ForEach-Object { "$_" }) -join "`n").Trim()
}

function Show-CapturedOutput {
    param($Result)
    $text = ConvertTo-TrimmedString $Result.Output
    if (-not [string]::IsNullOrWhiteSpace($text)) {
        Write-Host $text -ForegroundColor DarkRed
    }
}

# ---------------------------------------------------------------------------
# [1/5] Docker status
# ---------------------------------------------------------------------------
Write-Host "[1/5] Checking Docker status..." -ForegroundColor Cyan

$docker = Invoke-DockerQuiet info

if ($docker.ExitCode -ne 0) {
    Write-Host "[!] Docker Desktop is not running." -ForegroundColor Yellow
    Write-Host "[!] Launching Docker Desktop..." -ForegroundColor Yellow

    $dockerPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"

    if (-not (Test-Path $dockerPath)) {
        Write-Host "[X] Docker Desktop not found!" -ForegroundColor Red
        exit 1
    }

    Start-Process $dockerPath | Out-Null

    Write-Host "[!] Waiting for Docker Engine..." -ForegroundColor Yellow

    while ($true) {
        Start-Sleep -Seconds 5

        $docker = Invoke-DockerQuiet info

        if ($docker.ExitCode -eq 0) {
            break
        }

        Write-Host "." -NoNewline
    }
}

Write-Host ""
Write-Host "[+] Docker is ready!" -ForegroundColor Green

# ---------------------------------------------------------------------------
# [2/5] Start containers
# ---------------------------------------------------------------------------
Write-Host "[2/5] Starting containers..." -ForegroundColor Cyan

$compose = Invoke-DockerQuiet compose up -d

if ($compose.ExitCode -ne 0) {
    Show-CapturedOutput $compose
    Write-Host "[X] Docker Compose failed!" -ForegroundColor Red
    exit 1
}

Write-Host "[+] Containers started!" -ForegroundColor Green

# Chờ PostGIS running + healthy (im lặng, không in log)
while ($true) {
    $statusResult = Invoke-DockerQuiet inspect --format "{{.State.Status}}" postgis-webmap
    $containerStatus = ConvertTo-TrimmedString $statusResult.Output

    if ($statusResult.ExitCode -eq 0 -and $containerStatus -eq "running") {
        $healthResult = Invoke-DockerQuiet inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}no_healthcheck{{end}}" postgis-webmap
        $health = ConvertTo-TrimmedString $healthResult.Output

        if ($healthResult.ExitCode -eq 0 -and ($health -eq "healthy" -or $health -eq "no_healthcheck")) {
            break
        }
    }

    Start-Sleep -Seconds 2
}

# ---------------------------------------------------------------------------
# [3/5] Database initialization
# ---------------------------------------------------------------------------
Write-Host "[3/5] Checking database initialization..." -ForegroundColor Cyan

$initScript = "./db/migrations/init_db.sql"

$tableCheckResult = Invoke-DockerQuiet exec -i postgis-webmap psql `
    -X -U postgres -d webmap_db -tA `
    -c "SELECT to_regclass('user_data.electric_poles');"

if ($tableCheckResult.ExitCode -ne 0) {
    Show-CapturedOutput $tableCheckResult
    Write-Host "[X] Cannot connect to database!" -ForegroundColor Red
    exit 1
}

$tableCheck = ConvertTo-TrimmedString $tableCheckResult.Output

if ([string]::IsNullOrWhiteSpace($tableCheck)) {
    if (-not (Test-Path $initScript)) {
        Write-Host "[X] init_db.sql not found!" -ForegroundColor Red
        exit 1
    }

    # Pipe stdin qua $input của Invoke-DockerQuiet
    $initSql = Get-Content $initScript -Raw
    $initResult = $initSql | Invoke-DockerQuiet exec -i postgis-webmap psql `
        -X -U postgres -d webmap_db

    if ($initResult.ExitCode -ne 0) {
        Show-CapturedOutput $initResult
        Write-Host "[X] Database initialization failed!" -ForegroundColor Red
        exit 1
    }

    Write-Host "[+] Database initialized!" -ForegroundColor Green
} else {
    Write-Host "[+] Database already initialized." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# [4/5] Vietnam wards GeoJSON
# ---------------------------------------------------------------------------
Write-Host "[4/5] Checking Vietnam wards GeoJSON data..." -ForegroundColor Cyan

Set-Location "backend"

if (-not (Test-Path "myenv\Scripts\Activate.ps1")) {
    Write-Host "[X] Python virtual environment not found!" -ForegroundColor Red
    exit 1
}

& "myenv\Scripts\Activate.ps1"

$wardCountResult = Invoke-DockerQuiet exec -i postgis-webmap psql `
    -X -U postgres -d webmap_db -tA `
    -c "SELECT CASE WHEN to_regclass('user_data.vietnam_wards_2025') IS NULL THEN -1 ELSE (SELECT COUNT(*) FROM user_data.vietnam_wards_2025) END;"

if ($wardCountResult.ExitCode -ne 0) {
    Show-CapturedOutput $wardCountResult
    Write-Host "[X] Cannot check Vietnam wards table!" -ForegroundColor Red
    exit 1
}

$wardCount = ConvertTo-TrimmedString $wardCountResult.Output

if ($wardCount -eq "-1" -or $wardCount -eq "0") {
    Write-Host "[!] Vietnam wards data missing. Importing GeoJSON..." -ForegroundColor Yellow

    if (-not (Test-Path "import_wards.py")) {
        Write-Host "[X] import_wards.py not found!" -ForegroundColor Red
        exit 1
    }

    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $importOutput = & python -X utf8 import_wards.py 2>&1
        $importExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevEAP
    }

    if ($importExit -ne 0) {
        Show-CapturedOutput ([pscustomobject]@{ Output = $importOutput })
        Write-Host "[X] GeoJSON import failed!" -ForegroundColor Red
        exit 1
    }

    Write-Host "[+] GeoJSON imported successfully!" -ForegroundColor Green
} else {
    Write-Host "[+] Vietnam wards data already exists ($wardCount records). Skipping import." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# [5/5] Start FastAPI Backend
# KHÔNG capture output — để log Uvicorn hiển thị bình thường
# ---------------------------------------------------------------------------
Write-Host "[5/5] Starting FastAPI Backend..." -ForegroundColor Cyan

python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000