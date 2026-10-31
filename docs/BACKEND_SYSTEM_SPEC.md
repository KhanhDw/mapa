# Đặc tả hệ thống backend

## 1. Tổng quan

Backend là API FastAPI chạy riêng trên máy host, không nằm trong Docker Compose.
Ứng dụng phục vụ API bản đồ, ảnh panorama và ảnh do người dùng tải lên; dữ liệu
không gian được truy vấn trong PostgreSQL/PostGIS.

```text
Trình duyệt
  ├─ /api, /panoramas, /user-media ──> FastAPI (127.0.0.1:8000)
  │                                      └─ asyncpg pool ──> PostGIS (127.0.0.1:5432)
  ├─ /tileserver ────────────────────> pg_tileserv (127.0.0.1:7800)
  └─ /satellite/tiles ───────────────> VersaTiles (127.0.0.1:8080)
```

Trong chế độ phát triển, Vite proxy các đường dẫn trên đến các dịch vụ local.
Khi chia sẻ ứng dụng qua tunnel, chỉ expose frontend; không public trực tiếp
cổng PostgreSQL.

## 2. Thành phần

| Thành phần | Công nghệ / vai trò |
| --- | --- |
| API | Python, FastAPI, Uvicorn |
| Truy cập database | `asyncpg`, pool bất đồng bộ |
| Database | PostgreSQL/PostGIS, cấu hình trong [`docker-compose.yml`](../docker-compose.yml) |
| Ảnh | Static files trong các thư mục panorama và user media |
| Router | [`backend/src/routers/streetview.py`](../backend/src/routers/streetview.py), [`point_info.py`](../backend/src/routers/point_info.py), [`contribute.py`](../backend/src/routers/contribute.py) |
| Khởi tạo ứng dụng | [`backend/src/main.py`](../backend/src/main.py), cấu hình tại [`backend/src/config.py`](../backend/src/config.py) |

Dependency Python nằm trong [`backend/requirements.txt`](../backend/requirements.txt).

## 3. Cấu hình và chạy

Backend đọc `backend/.env` bằng `python-dotenv`. Biến đã được thiết lập trong
môi trường tiến trình vẫn được sử dụng.

| Biến | Bắt buộc | Mặc định / ý nghĩa |
| --- | --- | --- |
| `DATABASE_URL` | Có | URI PostgreSQL. Thiếu biến này thì import ứng dụng thất bại. |
| `PANORAMAS_DIR` | Không | `backend/data/panoramas`; nơi lưu ảnh panorama. |
| `USER_MEDIA_DIR` | Không | `backend/data/user_media`; nơi lưu ảnh POI và thumbnail. |
| `WRITE_API_KEY` | Cần cho API ghi | Khóa gửi qua header `X-API-Key`; nếu chưa cấu hình, API ghi trả `503`. |
| `MAX_UPLOAD_MB` | Không | Giới hạn kích thước mỗi file; mặc định `30` MB. |
| `PANO_MIN_WIDTH` | Không | Chiều rộng tối thiểu của ảnh panorama; mặc định `1024` pixel. |

Ví dụ URI database, không dùng mật khẩu thật trong tài liệu hoặc Git:

```dotenv
DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:5432/webmap_db
PANORAMAS_DIR=data/panoramas
USER_MEDIA_DIR=data/user_media
WRITE_API_KEY=<set-a-private-key>
```

Thư mục mặc định của ảnh được xác định từ thư mục `backend`; hai thư mục ảnh
được tạo khi ứng dụng khởi động. Cấu hình quyền database cần tương ứng với
[`db/migrations/05_user_data.sql`](../db/migrations/05_user_data.sql).

Khởi động dịch vụ database và backend từ thư mục gốc:

```powershell
docker compose up -d
Set-Location backend
python -m pip install -r requirements.txt
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

Hoặc dùng lệnh root `npm run back`. Backend phục vụ OpenAPI UI tại
`http://127.0.0.1:8000/docs` và schema tại `/openapi.json`.

### Pool kết nối

- Khi startup, tạo pool `asyncpg` với `min_size=2`, `max_size=10` và
  `command_timeout=10` giây.
- Kiểm tra startup ghi nhận kết nối và sự tồn tại của `public.pois`; kiểm tra
  này không thay thế health check đầy đủ.
- Pool đóng khi ứng dụng shutdown.
- Nếu pool chưa sẵn sàng, dependency database trả HTTP `503`.

## 4. Middleware và static files

- CORS hiện cho phép mọi origin, method và header; credentials bị tắt.
- GZip nén response từ 1.000 byte.
- `/panoramas` phục vụ `PANORAMAS_DIR`; `/user-media` phục vụ `USER_MEDIA_DIR`.
- `image_url` lưu trong database thường là đường dẫn tương đối như
  `/panoramas/<file>.jpg` hoặc `/user-media/<poi_id>/<file>.jpg`.
- Thư mục ảnh không nằm trong volume PostGIS. Khi triển khai, cần bảo đảm chúng
  được lưu bền vững và được backup cùng database.

## 5. API đọc

### `GET /health`

Thực hiện `SELECT 1` qua pool.

- `200`: `{"status":"ok"}`.
- `503`: pool chưa sẵn sàng.

### `GET /api/streetview/points`

Trả GeoJSON `FeatureCollection` từ `public.streetview_images`.

| Tham số | Mặc định | Ràng buộc / ý nghĩa |
| --- | ---: | --- |
| `minx`, `miny`, `maxx`, `maxy` | Không có | Chỉ lọc bounding box khi có đủ cả bốn tọa độ; EPSG:4326. |
| `limit` | `5000` | Số nguyên từ 1 đến 20.000. |

Nếu bbox đầy đủ nhưng `minx >= maxx` hoặc `miny >= maxy`, trả `400`. Bbox
không đầy đủ bị bỏ qua. Mỗi feature có `Point` với tọa độ
`[longitude, latitude]` và properties `id`, `image_url`, `heading`, `next_ids`,
`link_positions`. Giá trị liên kết rỗng được trả thành mảng rỗng.

### `GET /api/streetview/image/{image_id}`

Trả chi tiết panorama gồm `id`, `lng`, `lat`, `image_url`, `heading`,
`next_ids`, `link_positions` và `captured_at`. Thời gian được đổi sang
ISO-8601 hoặc `null`; không có bản ghi thì trả `404`.

### `GET /api/point-info`

Tra cứu đường, panorama gần nhất và POI quanh tọa độ. Khoảng cách trả về tính
bằng mét.

| Tham số | Bắt buộc | Mặc định | Ràng buộc |
| --- | --- | ---: | --- |
| `lng` | Có | — | -180 đến 180 |
| `lat` | Có | — | -90 đến 90 |
| `zoom` | Không | `13` | 0 đến 22; hiện chưa ảnh hưởng truy vấn |
| `radius_m` | Không | `50` | 10 đến 1.000 mét |
| `poi_limit` | Không | `10` | 1 đến 50 |

Response gồm:

- `road`: `osm_id`, `name`, `ref`, `fclass`, `oneway`, `maxspeed`,
  `distance_m`, hoặc `null`.
- `streetview`: `id`, `distance_m`, hoặc `null`.
- `address`: hiện luôn là `null` (chưa tích hợp reverse geocoding).
- `pois`: kết quả từ cả `public.pois` (`source: "osm"`) và
  `user_data.pois` (`source: "user"`). Mỗi phần tử có `source`, `id`, `name`,
  `category`, `photo_count`, tọa độ, khoảng cách và panorama gần nhất trong
  phạm vi 100 m nếu có.

POI được sắp theo khoảng cách. ID POI chỉ duy nhất trong từng nguồn; khi dùng
ID làm khóa cần giữ cả `source`.

## 6. API đóng góp dữ liệu

Các endpoint ghi yêu cầu header `X-API-Key`. Khóa phải khớp
`WRITE_API_KEY`; khóa sai/thiếu trả `401`, chưa cấu hình khóa trả `503`.
Frontend hiện chưa có form đóng góp dữ liệu; các endpoint có thể được gọi qua
client riêng hoặc OpenAPI UI.

### `POST /api/user-pois`

Nhận JSON để tạo POI trong `user_data.pois`; trả `201`, ID, `source: "user"`
và `photos: []`.

- `lng`, `lat`: tọa độ WGS 84 hợp lệ.
- `name`: sau khi trim phải khác rỗng, tối đa 200 ký tự.
- `category`: mặc định `other`, chỉ gồm chữ thường ASCII, chữ số và `_`,
  tối đa 50 ký tự.
- `address`, `phone`, `description`: tùy chọn, tối đa lần lượt 300, 30 và
  2.000 ký tự.

### `GET /api/user-pois/{poi_id}`

Đọc POI người dùng và danh sách ảnh trong `user_data.poi_photos`; không yêu cầu
API key. Không tìm thấy thì trả `404`. URL ảnh và thumbnail được trả dưới
`/user-media/...`.

### `POST /api/user-pois/{poi_id}/photos`

Upload multipart field `file`, yêu cầu API key. Mỗi POI tối đa 20 ảnh. Chấp
nhận JPEG, PNG hoặc WebP; ảnh đầu ra được chuẩn hóa thành JPEG và có thumbnail.
File vượt `MAX_UPLOAD_MB` trả `413`; loại ảnh không hợp lệ trả `400`; POI
không tồn tại trả `404`; vượt số ảnh tối đa trả `409`.

### `POST /api/user-panoramas`

Upload multipart fields `lng`, `lat`, `file` và `heading` tùy chọn
(0 <= heading < 360), yêu cầu API key. Chỉ nhận JPEG, PNG hoặc WebP; ảnh 360°
phải có tỉ lệ 2:1 và đạt `PANO_MIN_WIDTH`. Server chuyển ảnh sang JPEG, lưu
trong `PANORAMAS_DIR` và thêm bản ghi vào `public.streetview_images` với danh
sách liên kết rỗng. Ảnh này được các API Street View sử dụng như panorama khác.

## 7. Phụ thuộc database và giới hạn

Backend cần các bảng/cột sau:

| Bảng | Cột được truy vấn |
| --- | --- |
| `public.streetview_images` | `id`, `geom`, `image_url`, `heading`, `next_ids`, `link_positions`, `captured_at` |
| `public.vietnam_roads` | `osm_id`, `name`, `ref`, `fclass`, `oneway`, `maxspeed`, `geom` |
| `public.pois` | `id`, `name`, `category`, `geom` |
| `user_data.pois` | `id`, `name`, `category`, `geom` |
| `user_data.poi_photos` | `id`, `poi_id`, `file_path`, `thumb_path`, `width`, `height` |

`public.pois` được khởi tạo trong [`init/01-pois.sql`](../init/01-pois.sql);
`user_data` được định nghĩa trong migration 05. DDL tạo
`public.streetview_images` và `public.vietnam_roads` chưa có trong các migration
được kiểm tra. Migration quyền và truy vấn backend giả định các bảng này đã
được provision từ nguồn khác. Pipeline OSM tạo `clean.roads_*`, không tạo
`public.vietnam_roads`; cần xác nhận quy trình đồng bộ riêng.

Các truy vấn được parameter-bind qua `asyncpg`. Riêng `/api/point-info` hiện
bắt lỗi database và trả HTTP `500` kèm chi tiết exception; hành vi này cần
được xem xét lại trước khi public. API hiện chưa có phân quyền đọc; CORS mở
cho mọi origin. Không expose API ghi ra môi trường công khai nếu chưa quản lý
`WRITE_API_KEY`, xác thực và giới hạn upload phù hợp.
