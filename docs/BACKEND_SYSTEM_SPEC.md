# BACKEND SYSTEM SPEC

> Hợp đồng API giữa **frontend** và **backend** cho hệ thống Webmap Mapa.
> Frontend chỉ giao tiếp với **một cổng duy nhất `:8000`** — mọi dịch vụ nội bộ
> (PostGIS, pg_tileserv, versatiles) đều được backend proxy hoặc truy vấn trực tiếp.

- **Phiên bản:** 2.3.0
- **Cập nhật:** 2026-10-31
- **Base URL (dev):** `http://127.0.0.1:8000`

---

## 1. Kiến trúc tổng quan

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (browser)                        │
│              MapLibre / OpenLayers / fetch API                   │
└────────────────────────────────┬─────────────────────────────────┘
                                 │  HTTP :8000 (duy nhất)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                    BACKEND FastAPI (:8000)                       │
│  ┌──────────────┬─────────────────┬──────────────────────────┐   │
│  │  /api/*      │  /basemap/*     │  /tiles/*   /mvt/*       │   │
│  │  (đọc/ghi DB)│  (proxy)        │  (proxy)    (tự sinh)    │   │
│  └──────┬───────┴────────┬────────┴─────┬──────────┬─────────┘   │
│         │                │              │          │             │
│         │ asyncpg        │ httpx        │ httpx    │ asyncpg     │
└─────────┼────────────────┼──────────────┼──────────┼─────────────┘
          │                │              │          │
          ▼                ▼              ▼          │
   ┌────────────┐   ┌────────────┐ ┌────────────┐   │
   │  PostGIS   │   │ versatiles │ │ pg_tileserv│◄──┘
   │  :5432     │   │  :8080     │ │  :7800     │
   │ (Docker)   │   │ (Docker)   │ │ (Docker)   │
   └────────────┘   └────────────┘ └────────────┘
```

**Nguyên tắc:**

- Frontend **không bao giờ** gọi `:5432`, `:7800`, `:8080` trực tiếp.
- Backend là **single point of entry** — xử lý CORS, cache, auth, logging, rate-limit.
- Docker chỉ là nơi chứa service nội bộ, có thể bỏ `ports:` khi deploy production.

---

## 2. Docker services (nội bộ)

| Service       | Image                          | Cổng nội bộ | Vai trò                     |
| ------------- | ------------------------------ | ----------- | --------------------------- |
| `postgis`     | `postgis/postgis:17-3.5`       | `5432`      | Database chính (PostGIS)    |
| `pg_tileserv` | `pramsey/pg_tileserv:latest`   | `7800`      | Vector tile server (từ DB)  |
| `versatiles`  | `versatiles/versatiles:latest` | `8080`      | Basemap + satellite tileset |

**Biến môi trường `.env`:**

```env
# Backend
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/webmap_db
WRITE_API_KEY=your-secret-key-here
ENV=dev
ALLOWED_ORIGINS=*

# Proxy tới tile servers
TILESERV_URL=http://127.0.0.1:7800
VERSATILES_URL=http://127.0.0.1:8080
PROXY_TIMEOUT_S=30.0
PROXY_CONNECT_TIMEOUT_S=5.0

# Giới hạn
MAX_UPLOAD_MB=30
MAX_PHOTOS_PER_POI=20
MAX_FEATURES=5000
MAX_BBOX_AREA_DEG2=1.0
PANO_MIN_WIDTH=1024
```

---

## 3. Tổng hợp endpoint — 17 API

| #   | Method   | Path                                      | Auth | Cache | Nhóm        |
| --- | -------- | ----------------------------------------- | ---- | ----- | ----------- |
| 1   | GET      | `/health`                                 | —    | —     | Meta        |
| 2   | GET      | `/api/streetview/points`                  | —    | —     | Street View |
| 3   | GET      | `/api/streetview/image/{id}`              | —    | —     | Street View |
| 4   | GET      | `/api/point-info`                         | —    | —     | Point Info  |
| 5   | POST     | `/api/user-pois`                          | ✅   | —     | Contribute  |
| 6   | GET      | `/api/user-pois/{id}`                     | —    | —     | Contribute  |
| 7   | POST     | `/api/user-pois/{id}/photos`              | ✅   | —     | Contribute  |
| 8   | POST     | `/api/user-panoramas`                     | ✅   | —     | Contribute  |
| 9   | GET/HEAD | `/basemap/vietnam/{z}/{x}/{y}`            | —    | 28d   | Basemap     |
| 10  | GET/HEAD | `/basemap/satellite/{z}/{x}/{y}`          | —    | 28d   | Basemap     |
| 11  | GET/HEAD | `/basemap/{name}/tiles.json`              | —    | —     | Basemap     |
| 12  | GET/HEAD | `/tiles/index.json`                       | —    | 1d    | Tileserv    |
| 13  | GET/HEAD | `/tiles/{schema}.{table}.json`            | —    | —     | Tileserv    |
| 14  | GET/HEAD | `/tiles/{schema}.{table}/{z}/{x}/{y}.pbf` | —    | 1d    | Tileserv    |
| 15  | GET      | `/mvt/{alias}/{z}/{x}/{y}.pbf`            | —    | 1d    | MVT tự sinh |
| 16  | GET/HEAD | `/panoramas/{filename}`                   | —    | 1d    | Static      |
| 17  | GET/HEAD | `/user-media/{poi_id}/{filename}`         | —    | 1d    | Static      |

**Auth:** header `X-API-Key: <WRITE_API_KEY>`

---

## 4. Chi tiết từng nhóm endpoint

### 4.1. Meta

#### `GET /health`

Kiểm tra backend + DB còn sống.

**Response 200:**

```json
{ "status": "ok" }
```

**Lỗi:** `503` nếu DB pool chưa sẵn sàng.

---

### 4.2. Street View — đọc dữ liệu ảnh 360°

#### `GET /api/streetview/points`

Trả về danh sách điểm street view trong bbox (GeoJSON).

**Query params:**

| Tên     | Kiểu  | Bắt buộc | Mặc định              | Mô tả                    |
| ------- | ----- | -------- | --------------------- | ------------------------ |
| `minx`  | float | ✕        | —                     | Kinh độ tây              |
| `miny`  | float | ✕        | —                     | Vĩ độ nam                |
| `maxx`  | float | ✕        | —                     | Kinh độ đông             |
| `maxy`  | float | ✕        | —                     | Vĩ độ bắc                |
| `limit` | int   | ✕        | `MAX_FEATURES` (5000) | Số điểm tối đa (1–20000) |

- Nếu **đủ cả 4 cạnh** → lọc theo bbox (validate `MAX_BBOX_AREA_DEG2 = 1.0`).
- Nếu **thiếu** → trả `limit` điểm đầu tiên (theo `id`).

**Ví dụ:**

```bash
curl "http://127.0.0.1:8000/api/streetview/points?minx=105.7&miny=20.9&maxx=106.0&maxy=21.2&limit=100"
```

**Response 200:**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [105.85, 21.03] },
      "properties": {
        "id": 123,
        "image_url": "/panoramas/u_abc123.jpg",
        "heading": 180.0,
        "next_ids": [124, 125],
        "link_positions": [{ "id": 124, "yaw": 45.0, "pitch": 0.0 }]
      }
    }
  ]
}
```

**Lỗi:**

- `400` — bbox không hợp lệ / quá lớn.

---

#### `GET /api/streetview/image/{image_id}`

Chi tiết 1 ảnh street view.

**Path params:** `image_id` (int)

**Response 200:**

```json
{
  "id": 123,
  "lng": 105.85,
  "lat": 21.03,
  "image_url": "/panoramas/u_abc123.jpg",
  "heading": 180.0,
  "next_ids": [124, 125],
  "link_positions": [...],
  "captured_at": "2026-10-31T12:00:00+00:00"
}
```

**Lỗi:**

- `404` — ảnh không tồn tại.

---

### 4.3. Point Info — thông tin tại 1 điểm

#### `GET /api/point-info`

Trả về: đường gần nhất + street view gần nhất + N POI gần nhất.

**Query params:**

| Tên         | Kiểu  | Bắt buộc | Mặc định | Ràng buộc | Mô tả                   |
| ----------- | ----- | -------- | -------- | --------- | ----------------------- |
| `lng`       | float | ✅       | —        | −180…180  | Kinh độ                 |
| `lat`       | float | ✅       | —        | −90…90    | Vĩ độ                   |
| `radius_m`  | float | ✕        | 50       | 10…1000   | Bán kính tìm kiếm (mét) |
| `poi_limit` | int   | ✕        | 10       | 1…50      | Số POI tối đa           |

**Ví dụ:**

```bash
curl "http://127.0.0.1:8000/api/point-info?lng=105.85&lat=21.03&radius_m=100&poi_limit=10"
```

**Response 200:**

```json
{
  "road": {
    "osm_id": 12345,
    "name": "Phố Hàng Bài",
    "ref": null,
    "fclass": "primary",
    "oneway": false,
    "maxspeed": "50",
    "distance_m": 12.3
  },
  "streetview": {
    "id": 123,
    "distance_m": 45.6
  },
  "address": null,
  "pois": [
    {
      "source": "osm",
      "id": 987,
      "name": "Quán ăn",
      "category": "restaurant",
      "photo_count": 0,
      "lng": 105.851,
      "lat": 21.031,
      "distance_m": 15.2,
      "streetview_id": 123,
      "streetview_distance_m": 45.6
    },
    {
      "source": "user",
      "id": 1,
      "name": "Cà phê user",
      "category": "cafe",
      "photo_count": 3,
      "lng": 105.852,
      "lat": 21.032,
      "distance_m": 22.8,
      "streetview_id": null,
      "streetview_distance_m": null
    }
  ]
}
```

**Ghi chú:**

- `road`, `streetview` có thể là `null`.
- Khóa của POI là cặp `(source, id)` — vì OSM và user dùng sequence riêng.

**Lỗi:**

- `500` — DB error (message chung, không leak SQL).

---

### 4.4. Contribute — ghi dữ liệu user

> Tất cả POST trong nhóm này cần header `X-API-Key: <WRITE_API_KEY>`.
> Sai/thiếu key → `401`. Chưa cấu hình key trong `.env` → `503`.

#### `POST /api/user-pois`

Tạo POI trong `user_data.pois`.

**Headers:**

```
X-API-Key: <key>
Content-Type: application/json
```

**Body (JSON):**

```json
{
  "lng": 105.85,
  "lat": 21.03,
  "name": "Quán cà phê Mộc",
  "category": "cafe",
  "address": "12 Hàng Bài, Hà Nội",
  "phone": "0912345678",
  "description": "Cà phê sân vườn"
}
```

| Field         | Bắt buộc | Ràng buộc                               |
| ------------- | -------- | --------------------------------------- |
| `lng`         | ✅       | −180…180                                |
| `lat`         | ✅       | −90…90                                  |
| `name`        | ✅       | 1–200 ký tự, không rỗng sau trim        |
| `category`    | ✕        | `^[a-z0-9_]{1,50}$`, mặc định `"other"` |
| `address`     | ✕        | ≤ 300 ký tự                             |
| `phone`       | ✕        | ≤ 30 ký tự                              |
| `description` | ✕        | ≤ 2000 ký tự                            |

**Response 201:**

```json
{
  "id": 1,
  "source": "user",
  "lng": 105.85,
  "lat": 21.03,
  "name": "Quán cà phê Mộc",
  "category": "cafe",
  "address": "12 Hàng Bài, Hà Nội",
  "phone": "0912345678",
  "description": "Cà phê sân vườn",
  "created_at": "2026-10-31T12:00:00+00:00",
  "photos": []
}
```

---

#### `GET /api/user-pois/{poi_id}`

Chi tiết POI user + danh sách ảnh.

**Path params:** `poi_id` (int, ≥ 1)

**Response 200:**

```json
{
  "id": 1,
  "source": "user",
  "name": "Quán cà phê Mộc",
  "category": "cafe",
  "address": "12 Hàng Bài, Hà Nội",
  "phone": "0912345678",
  "description": "Cà phê sân vườn",
  "lng": 105.85,
  "lat": 21.03,
  "created_at": "2026-10-31T12:00:00+00:00",
  "photos": [
    {
      "id": 10,
      "url": "/user-media/1/abc123.jpg",
      "thumb_url": "/user-media/1/abc123_t.jpg",
      "width": 1920,
      "height": 1080
    }
  ]
}
```

**Lỗi:**

- `404` — POI không tồn tại.

---

#### `POST /api/user-pois/{poi_id}/photos`

Upload ảnh phẳng cho POI (tối đa `MAX_PHOTOS_PER_POI = 20`).

**Headers:** `X-API-Key`, `Content-Type: multipart/form-data`

**Form data:**

```
file: <binary>
```

**Ràng buộc ảnh:**

- Format: JPEG, PNG, WebP
- Kích thước: ≤ `MAX_UPLOAD_MB = 30` MB
- Resize: cạnh dài ≤ 1920 px
- Tự tạo thumbnail 480 px
- Tự strip EXIF và xoay theo EXIF orientation

**Response 201:**

```json
{
  "id": 10,
  "url": "/user-media/1/abc123.jpg",
  "thumb_url": "/user-media/1/abc123_t.jpg",
  "width": 1920,
  "height": 1080
}
```

**Lỗi:**

- `404` — POI không tồn tại.
- `409` — đã đủ `MAX_PHOTOS_PER_POI` ảnh.
- `413` — file quá lớn.
- `400` — file không hợp lệ / format sai.

---

#### `POST /api/user-panoramas`

Upload ảnh 360° (equirectangular).

**Headers:** `X-API-Key`, `Content-Type: multipart/form-data`

**Form data:**

```
lng: 105.85
lat: 21.03
heading: 180     (optional, 0 ≤ heading < 360)
file: <binary>
```

**Ràng buộc ảnh:**

- Format: JPEG, PNG, WebP
- Tỉ lệ 2:1 (±0.05)
- Chiều rộng ≥ `PANO_MIN_WIDTH = 1024`
- Kích thước file ≤ `MAX_UPLOAD_MB`

**Response 201:**

```json
{
  "id": 456,
  "image_url": "/panoramas/u_xyz789.jpg",
  "lng": 105.85,
  "lat": 21.03,
  "heading": 180.0,
  "width": 4096,
  "height": 2048,
  "captured_at": "2026-10-31T12:00:00+00:00"
}
```

**Ghi chú:** ảnh được insert vào `public.streetview_images` (không phải schema `user_data`), nên **ngay lập tức** xuất hiện trong `/api/streetview/*` và `/api/point-info`.

**Lỗi:**

- `413` — file quá lớn.
- `400` — ảnh sai tỉ lệ / quá nhỏ / format sai.

---

### 4.5. Basemap — versatiles (proxy)

Nền bản đồ: vector tile schema **Shortbread** hoặc raster vệ tinh.

#### `GET|HEAD /basemap/vietnam/{z}/{x}/{y}`

Vector tile basemap Việt Nam (schema Shortbread, zoom 0–14).

**Response 200:**

```
Content-Type: application/vnd.mapbox-vector-tile
Cache-Control: public, max-age=2419200, no-transform
ETag: W/"..."
Content-Length: 109748
```

**Lỗi:** `404` nếu tile không tồn tại (không cache).

#### `GET|HEAD /basemap/satellite/{z}/{x}/{y}`

Raster tile vệ tinh Việt Nam.

**Response 200:**

```
Content-Type: image/jpeg (hoặc image/png)
Cache-Control: public, max-age=2419200, no-transform
```

#### `GET|HEAD /basemap/{name}/tiles.json`

TileJSON metadata cho tileset `{name}`.

**Response 200:**

```json
{
  "tilejson": "3.0.0",
  "name": "Shortbread",
  "tiles": ["/tiles/vietnam/{z}/{x}/{y}"],
  "minzoom": 0,
  "maxzoom": 14,
  "bounds": [102, 6, 118, 24],
  "tile_format": "application/vnd.mapbox-vector-tile",
  "vector_layers": [ ... 28 layer ... ]
}
```

**Ghi chú proxy:**

- Frontend có thể dùng cả `/basemap/vietnam/...` và `/basemap/tiles/vietnam/...` — proxy tự thêm prefix.
- Header `content-encoding` **không** được forward (httpx đã decode).
- HEAD trả `Content-Length: 0`, `Content-Type` giữ nguyên.
- Lỗi 404 **không** bị cache (chỉ cache 200).

**MapLibre style mẫu:**

```js
{
  type: 'vector',
  tiles: ['http://127.0.0.1:8000/basemap/vietnam/{z}/{x}/{y}'],
  minzoom: 0,
  maxzoom: 14,
  attribution: '© OpenStreetMap contributors'
}
```

---

### 4.6. Vector tile dữ liệu — pg_tileserv (proxy)

Vector tile tự sinh từ các bảng PostGIS.

#### `GET|HEAD /tiles/index.json`

Danh sách tất cả bảng có sẵn trong DB.

**Response 200:**

```json
{
  "public.pois": {
    "type": "table",
    "id": "public.pois",
    "name": "pois",
    "schema": "public",
    "description": "",
    "detailurl": "/public.pois.json"
  },
  "public.vietnam_roads": { ... },
  "user_data.pois": { ... }
  // ... 27 bảng
}
```

**Danh sách bảng hiện có:**

| Schema      | Bảng                                                                                                                                                                                                                                                            |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clean`     | admin_areas, buildings, landuse, natural, natural_areas, places, places_areas, pofw, pofw_areas, pois, pois_areas, protected_areas, railways, roads_local, roads_major, roads_minor, traffic, traffic_areas, transport, transport_areas, water_areas, waterways |
| `public`    | osm_roads, pois, streetview_images, vietnam_roads                                                                                                                                                                                                               |
| `user_data` | pois                                                                                                                                                                                                                                                            |

#### `GET|HEAD /tiles/{schema}.{table}.json`

TileJSON cho 1 bảng (ví dụ `/tiles/public.pois.json`).

#### `GET|HEAD /tiles/{schema}.{table}/{z}/{x}/{y}.pbf`

Vector tile của bảng.

**Ví dụ:**

```bash
curl "http://127.0.0.1:8000/tiles/public.pois/14/13007/7213.pbf" -o pois.pbf
curl "http://127.0.0.1:8000/tiles/public.vietnam_roads/14/13007/7213.pbf" -o roads.pbf
```

**Response 200:**

```
Content-Type: application/vnd.mapbox-vector-tile
Cache-Control: public, max-age=86400, immutable
```

**Ghi chú:**

- Cache `immutable` **chỉ khi** upstream trả 200.
- Tile rỗng (0 byte) vẫn trả 200 → client cache và không hỏi lại.
- HEAD trả body rỗng, `Content-Type` giữ nguyên.

**MapLibre style mẫu:**

```js
map.addSource("pois", {
  type: "vector",
  tiles: ["http://127.0.0.1:8000/tiles/public.pois/{z}/{x}/{y}.pbf"],
});
map.addLayer({
  id: "pois-layer",
  type: "circle",
  source: "pois",
  "source-layer": "pois",
  paint: { "circle-radius": 4, "circle-color": "#e11" },
});
```

---

### 4.7. MVT tự sinh — fallback (không cần pg_tileserv)

Backend tự sinh vector tile trực tiếp từ PostGIS, bỏ qua pg_tileserv.

#### `GET /mvt/{alias}/{z}/{x}/{y}.pbf`

**Alias hỗ trợ:**

| URL alias                                    | Bảng thực                  | Layer name trong PBF |
| -------------------------------------------- | -------------------------- | -------------------- |
| `pois` hoặc `public.pois`                    | `public.pois`              | `pois`               |
| `roads` hoặc `public.vietnam_roads`          | `public.vietnam_roads`     | `vietnam_roads`      |
| `streetview` hoặc `public.streetview_images` | `public.streetview_images` | `streetview_images`  |

**Giới hạn:**

- Zoom 0–18 (ngoài → `400`)
- Alias ngoài danh sách → `404`
- Feature limit: `2000 × (z + 1)`
- Simplify: `360 / (2^z × 4096)` độ

**Ví dụ:**

```bash
curl "http://127.0.0.1:8000/mvt/roads/14/13009/7212.pbf" -o roads_mvt.pbf
# → 105209 bytes (đã test)

curl "http://127.0.0.1:8000/mvt/pois/14/13007/7213.pbf" -o pois_mvt.pbf
# → 0 bytes (bảng public.pois chưa có dữ liệu — xem mục 7)
```

**Response 200:**

```
Content-Type: application/x-protobuf
Cache-Control: public, max-age=86400, immutable
```

**Lỗi:**

- `400` — zoom ngoài 0–18
- `404` — alias không có trong whitelist
- `500` — DB error

---

### 4.8. Static files — ảnh

#### `GET|HEAD /panoramas/{filename}`

Ảnh 360° (do `/api/user-panoramas` upload).

**Response 200:**

```
Content-Type: image/jpeg
Cache-Control: public, max-age=86400, immutable
```

#### `GET|HEAD /user-media/{poi_id}/{filename}`

Ảnh POI (do `/api/user-pois/{id}/photos` upload). Có cả thumbnail `_t.jpg`.

**Ví dụ:**

```
/user-media/1/abc123.jpg
/user-media/1/abc123_t.jpg
```

**Ghi chú:** URL tuyệt đối đã được nhúng sẵn trong response của `/api/streetview/*` và `/api/user-pois/*` — frontend không cần tự ghép.

---

## 5. Bảo mật

| Nhóm endpoint                   | Cần `X-API-Key`? | Ghi chú         |
| ------------------------------- | ---------------- | --------------- |
| `/health`                       | ✕                | —               |
| `/api/streetview/*`             | ✕                | read-only       |
| `/api/point-info`               | ✕                | read-only       |
| `/api/user-pois/{id}` (GET)     | ✕                | read-only       |
| `/api/user-pois` (POST)         | ✅               | ghi DB          |
| `/api/user-pois/{id}/photos`    | ✅               | upload file     |
| `/api/user-panoramas`           | ✅               | upload file     |
| `/tiles/*`                      | ✕                | proxy read-only |
| `/basemap/*`                    | ✕                | proxy read-only |
| `/mvt/*`                        | ✕                | read-only       |
| `/panoramas/*`, `/user-media/*` | ✕                | static          |

**Cách gửi key:**

```bash
curl -H "X-API-Key: $WRITE_API_KEY" ...
```

**Mã lỗi auth:**

- `503` — server chưa cấu hình `WRITE_API_KEY`
- `401` — sai/thiếu key

---

## 6. Cache policy tổng hợp

| Endpoint                        | `Cache-Control`                                                  |
| ------------------------------- | ---------------------------------------------------------------- |
| `/basemap/*`                    | `public, max-age=2419200, no-transform` (28 ngày, từ versatiles) |
| `/tiles/*` (tile `.pbf`)        | `public, max-age=86400, immutable` (1 ngày)                      |
| `/mvt/*`                        | `public, max-age=86400, immutable` (1 ngày)                      |
| `/panoramas/*`, `/user-media/*` | `public, max-age=86400, immutable` (1 ngày)                      |
| 404 từ proxy                    | **Không cache** (chỉ set khi 200)                                |
| `/health`, `/api/*`             | **Không cache**                                                  |

**Header passthrough qua proxy:**

Forward lên upstream (`_FORWARD_HEADERS`):

- `Range`, `If-None-Match`, `If-Modified-Since`

Forward về client (`_KEEP_HEADERS`):

- `Content-Type`, `Content-Range`, `Accept-Ranges`, `ETag`, `Last-Modified`, `Cache-Control`
- **KHÔNG** forward `Content-Encoding` (httpx đã decode body)

---

## 7. Trạng thái endpoint

| #     | Endpoint                | Trạng thái                      | Ghi chú                                             |
| ----- | ----------------------- | ------------------------------- | --------------------------------------------------- | ------------------------------- |
| 1     | `GET /health`           | ✅ OK                           | Test pass                                           |
| 2–3   | `GET /api/streetview/*` | ✅ Code sẵn sàng                | Chưa test curl                                      |
| 4     | `GET /api/point-info`   | ✅ Code sẵn sàng                | Chưa test curl                                      |
| 5–8   | `POST /api/contribute*` | ✅ Code sẵn sàng                | Cần `WRITE_API_KEY` trong `.env`                    |
| 9–11  | `GET                    | HEAD /basemap/\*`               | ✅ OK                                               | Test pass 109748 byte tile VN   |
| 12–14 | `GET                    | HEAD /tiles/\*`                 | ✅ OK                                               | Test pass `index.json` + `.pbf` |
| 15    | `GET /mvt/*`            | ⚠️ Logic OK, dữ liệu chưa đủ    | `roads` 105 KB OK; `pois` rỗng do bảng chưa có data |
| 16–17 | `GET                    | HEAD /panoramas`, `/user-media` | ✅ Code sẵn sàng                                    | —                               |

### Việc còn treo

| Việc                                 | Mức độ        | Ghi chú                                                                                                            |
| ------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| Import dữ liệu POI vào `public.pois` | ⚠️ Cao        | `/mvt/pois/*` và `/tiles/public.pois/*` trả 0 byte vì bảng rỗng. Kiểm tra bằng `SELECT count(*) FROM public.pois;` |
| Test `/api/*` bằng curl              | 🟡 Trung bình | Đã có code, cần xác nhận runtime                                                                                   |
| Đổi URL frontend sang `:8000`        | 🟡 Trung bình | Xem mục 8                                                                                                          |

---

## 8. Migration frontend — trước vs sau

| Trước (nhiều cổng)                  | Sau (1 cổng `:8000`)                          |
| ----------------------------------- | --------------------------------------------- |
| `:8000/api/*`                       | `:8000/api/*` (giữ nguyên)                    |
| `:8000/panoramas/*`                 | `:8000/panoramas/*` (giữ nguyên)              |
| `:8000/user-media/*`                | `:8000/user-media/*` (giữ nguyên)             |
| `:7800/public.pois/{z}/{x}/{y}.pbf` | **`:8000/tiles/public.pois/{z}/{x}/{y}.pbf`** |
| `:7800/index.json`                  | **`:8000/tiles/index.json`**                  |
| `:8080/tiles/vietnam/{z}/{x}/{y}`   | **`:8000/basemap/vietnam/{z}/{x}/{y}`**       |
| `:8080/tiles/satellite/{z}/{x}/{y}` | **`:8000/basemap/satellite/{z}/{x}/{y}`**     |
| —                                   | **`:8000/mvt/{alias}/{z}/{x}/{y}.pbf`** (mới) |

**Config frontend duy nhất:**

```js
const API = "http://127.0.0.1:8000";
// Mọi fetch dùng `${API}/...`
```

---

## 9. Cheat sheet MapLibre style

```js
// Basemap vector VN
{
  type: 'vector',
  tiles: ['http://127.0.0.1:8000/basemap/vietnam/{z}/{x}/{y}'],
  minzoom: 0, maxzoom: 14
}

// Satellite raster VN
{
  type: 'raster',
  tiles: ['http://127.0.0.1:8000/basemap/satellite/{z}/{x}/{y}'],
  tileSize: 256
}

// POI (pg_tileserv — khuyến nghị)
{
  type: 'vector',
  tiles: ['http://127.0.0.1:8000/tiles/public.pois/{z}/{x}/{y}.pbf']
}
// → 'source-layer': 'pois'

// Đường (pg_tileserv)
{
  type: 'vector',
  tiles: ['http://127.0.0.1:8000/tiles/public.vietnam_roads/{z}/{x}/{y}.pbf']
}
// → 'source-layer': 'vietnam_roads'

// Street view (pg_tileserv)
{
  type: 'vector',
  tiles: ['http://127.0.0.1:8000/tiles/public.streetview_images/{z}/{x}/{y}.pbf']
}
// → 'source-layer': 'streetview_images'

// POI (MVT tự sinh — fallback)
{
  type: 'vector',
  tiles: ['http://127.0.0.1:8000/mvt/pois/{z}/{x}/{y}.pbf']
}
// → 'source-layer': 'pois'
```

> **Quan trọng:** `source-layer` phải khớp **layer name trong PBF**, không phải URL alias. Ví dụ với `roads`, layer name là `vietnam_roads` (trừ khi đã sửa `tiles.py` cho alias trùng layer).

---

## 10. Mã lỗi chung

| Mã    | Ý nghĩa               | Xảy ra ở                                                      |
| ----- | --------------------- | ------------------------------------------------------------- |
| `400` | Bad Request           | bbox sai, zoom ngoài range, ảnh sai định dạng                 |
| `401` | Unauthorized          | thiếu/sai `X-API-Key`                                         |
| `404` | Not Found             | không tìm thấy POI/ảnh/tile, alias không hợp lệ               |
| `409` | Conflict              | vượt `MAX_PHOTOS_PER_POI`                                     |
| `413` | Payload Too Large     | file > `MAX_UPLOAD_MB`                                        |
| `500` | Internal Server Error | DB error, bug code                                            |
| `502` | Bad Gateway           | upstream (tileserv/versatiles) không phản hồi                 |
| `503` | Service Unavailable   | DB pool chưa sẵn sàng, proxy chưa init, chưa cấu hình API key |

---

## 11. Ghi chú vận hành

- **Khởi động:** `python -m src.main` hoặc `uvicorn src.main:app --reload`
- **Log:** DEBUG khi `ENV=dev`, INFO khi `ENV=prod`
- **Lifespan:** tại `main.py`, compose từ `db._init_pool` + `tiles.init_client`
- **DB check startup:** in `warning` nếu thiếu bảng, không fail (chỉ log)
- **Docker:** khi chuyển sang production, bỏ `ports:` của `pg_tileserv` và `versatiles` — chỉ backend cần truy cập (qua Docker network, đổi `TILESERV_URL=http://pg_tileserv:7800`)

---

_Hết spec._
