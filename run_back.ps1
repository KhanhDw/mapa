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
# [1/6] Docker status
# ---------------------------------------------------------------------------
Write-Host "[1/6] Checking Docker status..." -ForegroundColor Cyan

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
# [2/6] Start containers
# ---------------------------------------------------------------------------
Write-Host "[2/6] Starting containers..." -ForegroundColor Cyan

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
# [3/6] Database initialization
# ---------------------------------------------------------------------------
Write-Host "[3/6] Checking database initialization..." -ForegroundColor Cyan

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
# [4/6] Vietnam wards GeoJSON
# ---------------------------------------------------------------------------
Write-Host "[4/6] Checking Vietnam wards GeoJSON data..." -ForegroundColor Cyan

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
# [5/6] Vietnam roads GeoJSON
# ---------------------------------------------------------------------------
Write-Host "[5/6] Checking Vietnam roads GeoJSON data..." -ForegroundColor Cyan
$env:DATABASE_URL = "postgresql://postgres:doi_mat_khau_manh@localhost:5432/webmap_db"
$roadsScript = "import_roads.py"
$roadsFile = "data\vietnam_roads.geojson"

# Kiểm tra file GeoJSON
if (-not (Test-Path $roadsFile)) {
    Write-Host "[X] Vietnam roads GeoJSON not found: $roadsFile" -ForegroundColor Red
    exit 1
}

# Kiểm tra script import
if (-not (Test-Path $roadsScript)) {
    Write-Host "[X] import_roads.py not found!" -ForegroundColor Red
    exit 1
}

# Kiểm tra bảng và số lượng dữ liệu
$roadsCountResult = Invoke-DockerQuiet exec -i postgis-webmap psql `
    -X -U postgres -d webmap_db -tA `
    -c "SELECT CASE WHEN to_regclass('public.vietnam_roads') IS NULL THEN -1 ELSE (SELECT COUNT(*) FROM public.vietnam_roads) END;"

if ($roadsCountResult.ExitCode -ne 0) {
    Show-CapturedOutput $roadsCountResult
    Write-Host "[X] Cannot check Vietnam roads table!" -ForegroundColor Red
    exit 1
}

$roadsCountText = ConvertTo-TrimmedString $roadsCountResult.Output

if ($roadsCountText -eq "-1") {
    Write-Host "[X] Table public.vietnam_roads does not exist!" -ForegroundColor Red
    exit 1
}

$roadsCount = [long]$roadsCountText

if ($roadsCount -eq 0) {

    Write-Host "[!] Vietnam roads data missing. Importing GeoJSON..." -ForegroundColor Yellow

    # Kiểm tra biến môi trường mật khẩu PostgreSQL
    # Kiểm tra DATABASE_URL
if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
    Write-Host "[X] DATABASE_URL environment variable is missing!" -ForegroundColor Red
    exit 1
}

    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'

    try {
        $importOutput = & python -X utf8 $roadsScript 2>&1
        $importExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevEAP
    }

    if ($importExit -ne 0) {
        Show-CapturedOutput ([pscustomobject]@{ Output = $importOutput })
        Write-Host "[X] Vietnam roads import failed!" -ForegroundColor Red
        exit 1
    }

    Write-Host "[+] Vietnam roads imported successfully!" -ForegroundColor Green

} else {

    Write-Host "[+] Vietnam roads data already exists ($roadsCount records). Skipping import." -ForegroundColor Green

}

# ---------------------------------------------------------------------------
# [6/6] Start FastAPI Backend
# KHÔNG capture output — để log Uvicorn hiển thị bình thường
# ---------------------------------------------------------------------------
Write-Host "[6/6] Starting FastAPI Backend..." -ForegroundColor Cyan

python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
