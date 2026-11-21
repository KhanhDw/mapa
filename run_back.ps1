# Set UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

# Resolve project paths independently of the caller's working directory
$ProjectRoot = $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"

Set-Location $BackendDir

# ---------------------------------------------------------------------------
# Helpers
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
    return [pscustomobject]@{ ExitCode = $exitCode; Output = $output }
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

function Invoke-PsqlScalar {
    param([string]$Sql)
    $r = Invoke-DockerQuiet exec -i postgis-webmap psql -X -U postgres -d webmap_db -tA -c $Sql
    if ($r.ExitCode -ne 0) {
        Show-CapturedOutput $r
        throw "psql failed: $Sql"
    }
    return (ConvertTo-TrimmedString $r.Output)
}

function Assert-SchemaV2 {
    Write-Host "    Verifying schema v2..." -ForegroundColor DarkGray

    $checks = @(
        @{ Name = 'citext extension';         Sql = "SELECT count(*) FROM pg_extension WHERE extname='citext';" },
        @{ Name = 'public.users';             Sql = "SELECT CASE WHEN to_regclass('public.users') IS NOT NULL THEN 1 ELSE 0 END;" },
        @{ Name = 'public.streetview_images'; Sql = "SELECT CASE WHEN to_regclass('public.streetview_images') IS NOT NULL THEN 1 ELSE 0 END;" },
        @{ Name = 'public.streetview_links';  Sql = "SELECT CASE WHEN to_regclass('public.streetview_links') IS NOT NULL THEN 1 ELSE 0 END;" },
        @{ Name = 'users.role';               Sql = "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='role';" },
        @{ Name = 'users.last_login_at';      Sql = "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='last_login_at';" },
        @{ Name = 'user_data.pois.user_id';   Sql = "SELECT count(*) FROM information_schema.columns WHERE table_schema='user_data' AND table_name='pois' AND column_name='user_id';" },
        @{ Name = 'trg_users_updated_at';     Sql = "SELECT count(*) FROM pg_trigger WHERE tgname='trg_users_updated_at';" }
    )

    $missing = @()
    foreach ($c in $checks) {
        $raw = Invoke-PsqlScalar $c.Sql
        $num = 0
        if (-not [int]::TryParse($raw, [ref]$num) -or $num -lt 1) {
            $missing += $c.Name
        }
    }

    if ($missing.Count -gt 0) {
        Write-Host ("[X] Schema mismatch. Missing/invalid: " + ($missing -join ", ")) -ForegroundColor Red
        Write-Host "    => DB is OLD, or init script did not complete." -ForegroundColor Red
        Write-Host "    => Fix: docker compose down -v; docker compose up -d" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "[+] Schema v2 OK." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# [1/6] Docker status
# ---------------------------------------------------------------------------
Write-Host "[1/6] Checking Docker status..." -ForegroundColor Cyan

$docker = Invoke-DockerQuiet info
if ($docker.ExitCode -ne 0) {
    Write-Host "[!] Docker Desktop is not running. Launching..." -ForegroundColor Yellow
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
        if ($docker.ExitCode -eq 0) { break }
        Write-Host "." -NoNewline
    }
}
Write-Host ""
Write-Host "[+] Docker is ready!" -ForegroundColor Green

# ---------------------------------------------------------------------------
# [2/6] Start containers
# ---------------------------------------------------------------------------
Write-Host "[2/6] Starting containers..." -ForegroundColor Cyan

Push-Location $ProjectRoot
try { $compose = Invoke-DockerQuiet compose up -d } finally { Pop-Location }

if ($compose.ExitCode -ne 0) {
    Show-CapturedOutput $compose
    Write-Host "[X] Docker Compose failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[+] Containers started!" -ForegroundColor Green

# Single-quoted format strings: không bị PowerShell diễn giải {{...}}
$statusFmt = '{{.State.Status}}'
$healthFmt = '{{if .State.Health}}{{.State.Health.Status}}{{else}}no_healthcheck{{end}}'

while ($true) {
    $statusResult = Invoke-DockerQuiet inspect --format $statusFmt postgis-webmap
    $containerStatus = ConvertTo-TrimmedString $statusResult.Output

    if ($statusResult.ExitCode -eq 0 -and $containerStatus -eq "running") {
        $healthResult = Invoke-DockerQuiet inspect --format $healthFmt postgis-webmap
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

$initScript = Join-Path $ProjectRoot "db\migrations\init_db.sql"

$probeSql = "SELECT (to_regclass('public.users') IS NOT NULL)::int + (to_regclass('public.streetview_links') IS NOT NULL)::int + (to_regclass('user_data.electric_poles') IS NOT NULL)::int + (SELECT count(*) FROM pg_extension WHERE extname='citext')::int;"

$probe = -1
try {
    $probeRaw = Invoke-PsqlScalar $probeSql
    if (-not [int]::TryParse($probeRaw, [ref]$probe)) { $probe = -1 }
} catch {
    Write-Host "[X] Cannot connect to database!" -ForegroundColor Red
    exit 1
}

if ($probe -lt 4) {
    if (-not (Test-Path $initScript)) {
        Write-Host "[X] init_db.sql not found at $initScript" -ForegroundColor Red
        exit 1
    }
    Write-Host "[!] DB missing schema v2 objects (probe=$probe/4). Running init..." -ForegroundColor Yellow

    $initSql = Get-Content $initScript -Raw
    $initResult = $initSql | Invoke-DockerQuiet exec -i postgis-webmap psql -X -U postgres -d webmap_db -v ON_ERROR_STOP=1

    if ($initResult.ExitCode -ne 0) {
        Show-CapturedOutput $initResult
        Write-Host "[X] Database initialization failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "[+] Database initialized!" -ForegroundColor Green
} else {
    Write-Host "[+] Database already initialized." -ForegroundColor Green
}

Assert-SchemaV2

# ---------------------------------------------------------------------------
# [4/6] Vietnam wards GeoJSON
# ---------------------------------------------------------------------------
Write-Host "[4/6] Checking Vietnam wards GeoJSON data..." -ForegroundColor Cyan

if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
    $env:DATABASE_URL = "postgresql://postgres:doi_mat_khau_manh@localhost:5432/webmap_db"
}

$ActivateScript = Join-Path $BackendDir "myenv\Scripts\Activate.ps1"

if (-not (Test-Path $ActivateScript)) {
    Write-Host "[X] Python virtual environment not found: $ActivateScript" -ForegroundColor Red
    exit 1
}

& $ActivateScript

if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Failed to activate Python virtual environment!" -ForegroundColor Red
    exit 1
}

$wardCount = Invoke-PsqlScalar "SELECT CASE WHEN to_regclass('user_data.vietnam_wards_2025') IS NULL THEN -1 ELSE (SELECT COUNT(*) FROM user_data.vietnam_wards_2025) END;"

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

$roadsScript = "import_roads.py"
$roadsFile   = "data\vietnam_roads.geojson"

if (-not (Test-Path $roadsFile)) {
    Write-Host "[X] Vietnam roads GeoJSON not found: $roadsFile" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $roadsScript)) {
    Write-Host "[X] import_roads.py not found!" -ForegroundColor Red
    exit 1
}
if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
    Write-Host "[X] DATABASE_URL environment variable is missing!" -ForegroundColor Red
    exit 1
}

$roadsCountRaw = Invoke-PsqlScalar "SELECT CASE WHEN to_regclass('public.vietnam_roads') IS NULL THEN -1 ELSE (SELECT COUNT(*) FROM public.vietnam_roads) END;"
$roadsCount = 0
if (-not [long]::TryParse($roadsCountRaw, [ref]$roadsCount)) { $roadsCount = -1 }

if ($roadsCount -eq -1) {
    Write-Host "[X] Table public.vietnam_roads does not exist!" -ForegroundColor Red
    exit 1
}

if ($roadsCount -eq 0) {
    Write-Host "[!] Vietnam roads data missing. Importing GeoJSON..." -ForegroundColor Yellow
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
# ---------------------------------------------------------------------------
Write-Host "[6/6] Starting FastAPI Backend..." -ForegroundColor Cyan
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000