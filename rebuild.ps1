# rebuild.ps1 - dung lai du lieu ban do: raw -> bao cao chat luong -> clean
# Chay trong thu muc du an (canh docker-compose.yml):  .\rebuild.ps1
# Tuy chon:
#   -SkipImport    bo qua buoc nap lai vietnam.gpkg (chi chay lai bao cao + clean)
#   -RefreshTiles  tai ban VersaTiles OSM moi nhat cua bbox Viet Nam ra data\vietnam_new.versatiles
#
# Truoc khi chay: copy .env.example thanh .env va doi mat khau; dat vietnam.gpkg vao thu muc data\
# (tai ban moi nhat tu https://download.geofabrik.de/asia/vietnam.html)
# Du lieu cu trong schema public KHONG bi xoa. Chi xoa tay sau khi da kiem tra ket qua.

param(
  [switch]$SkipImport,
  [switch]$RefreshTiles
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

# --- doc .env ---
if (-not (Test-Path ".env")) { throw "Thieu file .env (copy tu .env.example)" }
Get-Content ".env" | ForEach-Object {
  if ($_ -match '^\s*([^#=\s]+)\s*=\s*(.*)$') {
    Set-Item -Path ("env:" + $Matches[1]) -Value $Matches[2].Trim()
  }
}
if (-not $env:PG_PASSWORD -or -not $env:TILE_PASSWORD) { throw ".env phai co PG_PASSWORD va TILE_PASSWORD" }

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

function Run-Sql([string]$file, [string[]]$extra = @()) {
  docker cp "sql\$file" "postgis-webmap:/tmp/$file" | Out-Null
  docker exec postgis-webmap psql -U postgres -d webmap_db -v ON_ERROR_STOP=1 @extra -f "/tmp/$file"
  if ($LASTEXITCODE -ne 0) { throw "Loi khi chay $file" }
}

# --- 1. Khoi dong PostGIS ---
Step "1/6 Khoi dong PostGIS"
docker compose up -d postgis
if ($LASTEXITCODE -ne 0) { throw "docker compose that bai" }
for ($i = 0; $i -lt 60; $i++) {
  $h = docker inspect -f "{{.State.Health.Status}}" postgis-webmap 2>$null
  if ($h -eq "healthy") { break }
  Start-Sleep -Seconds 3
}
if ($h -ne "healthy") { throw "PostGIS chua san sang" }
# POSTGRES_PASSWORD chi co tac dung khi volume duoc tao lan dau, nen dong bo mat khau thu cong.
# (Ket noi cuc bo ben trong container khong can mat khau.) Mat khau khong nen chua dau nhay don '.
if ($env:PG_PASSWORD -match "'") { throw "PG_PASSWORD khong duoc chua dau nhay don" }
docker exec postgis-webmap psql -U postgres -d webmap_db -v ON_ERROR_STOP=1 -c "ALTER USER postgres PASSWORD '$($env:PG_PASSWORD)';"
if ($LASTEXITCODE -ne 0) { throw "Khong dat duoc mat khau postgres" }
docker exec postgis-webmap psql -U postgres -d webmap_db -c "CREATE SCHEMA IF NOT EXISTS raw;"

# --- 2. Nap du lieu tho vao schema raw ---
if (-not $SkipImport) {
  Step "2/5 Nap vietnam.gpkg vao schema raw (co the mat vai chuc phut)"
  if (-not (Test-Path "data\vietnam.gpkg")) { throw "Khong thay data\vietnam.gpkg" }
  $net = (Split-Path $root -Leaf).ToLower() + "_default"   # ten network cua docker compose
  $dst = "PG:host=postgis dbname=webmap_db user=postgres password=$($env:PG_PASSWORD)"
  # Lam sach schema raw (chi xoa raw, khong dung toi public/clean/community)
  docker exec postgis-webmap psql -U postgres -d webmap_db -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS raw CASCADE; CREATE SCHEMA raw;"
  if ($LASTEXITCODE -ne 0) { throw "Khong reset duoc schema raw (co the clean.* dang phu thuoc; chay 02_clean.sql sau)" }
  # Khong dung -nln (gay gop hinh hoc) va khong dung -overwrite (khong tuong thich -lco SCHEMA).
  # Tat Arrow API de tranh loi khi doc GPKG.
  docker run --rm --network $net -v "${root}\data:/data" ghcr.io/osgeo/gdal:alpine-small-latest `
    ogr2ogr --config OGR2OGR_USE_ARROW_API NO -f PostgreSQL $dst /data/vietnam.gpkg `
    -a_srs EPSG:4326 -lco SCHEMA=raw -lco OVERWRITE=YES -lco GEOMETRY_NAME=geom -lco FID=fid -lco SPATIAL_INDEX=GIST -progress
  if ($LASTEXITCODE -ne 0) { throw "ogr2ogr that bai (neu ghcr.io bi chan, nap bang cach da dung lan truoc, voi -lco SCHEMA=raw -lco GEOMETRY_NAME=geom)" }
} else {
  Step "2/6 Bo qua nap du lieu (-SkipImport)"
}

# --- 3. Bao cao chat luong du lieu tho ---
Step "3/6 Bao cao chat luong du lieu tho"
Run-Sql "01_qa_raw.sql"

# --- 4. Tao schema clean ---
Step "4/6 Tao schema clean"
Run-Sql "02_clean.sql" @("-v", "tilepw=$($env:TILE_PASSWORD)")

Step "5/6 Tao schema clean"
Run-Sql "03_extra_layers.sql"

# --- 6. Khoi dong lai cac dich vu ---
Step "6/6 Khoi dong pg_tileserv va VersaTiles"
docker compose up -d
docker compose restart pg_tileserv
Write-Host "`nXong. Kiem tra: http://localhost:7800/index.html  (chi nen thay cac lop clean.*)" -ForegroundColor Green

# --- Tuy chon: lam moi ban do nen VersaTiles ---
if ($RefreshTiles) {
  Step "Tai ban do nen OSM moi cho bbox Viet Nam"
  # Kiem tra co --bbox / --max-zoom o trang https://download.versatiles.org/ (o chon bbox cho ra lenh chinh xac)
  docker run --rm -v "${root}\data:/data" versatiles/versatiles convert `
    --bbox "102,6,118,24" "https://download.versatiles.org/osm.versatiles" /data/vietnam_new.versatiles
  Write-Host "Da tao data\vietnam_new.versatiles. Kiem tra roi doi ten thanh vietnam.versatiles va chay: docker compose restart versatiles"
}