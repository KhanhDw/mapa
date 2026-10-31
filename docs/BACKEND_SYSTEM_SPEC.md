# Đặc tả hệ thống backend

## 1. Tổng quan

Hệ thống bản đồ gồm giao diện web, API backend và các dịch vụ dữ liệu không
gian. Backend hiện được cài đặt bằng FastAPI trong [`backend/main.py`](../backend/main.py).
API truy vấn PostGIS qua `asyncpg`, cung cấp thông tin điểm trên bản đồ và dữ
liệu Street View 360. Ảnh panorama được phục vụ dưới dạng static files.

Backend **không phải là một service trong Docker Compose**. Nó chạy riêng trên
máy phát triển ở `127.0.0.1:8000`; các container cung cấp database, vector
tiles và bản đồ nền. Cấu hình các container được mô tả trong
[`docker-compose.yml`](../docker-compose.yml).

```text
Trình duyệt
  ├─ API / ảnh panorama ──> FastAPI (127.0.0.1:8000)
  │                           └─ asyncpg pool ──> PostGIS (127.0.0.1:5432)
  ├─ Vector tiles ─────────> pg_tileserv (127.0.0.1:7800)
  │                           └───────────────> PostGIS
  └─ Raster/vector basemap > VersaTiles (127.0.0.1:8080)
```

Trong môi trường phát triển, Vite có thể proxy các đường dẫn API/tile. Khi chia
sẻ ứng dụng qua ngrok, tunnel trỏ đến frontend; không cần public trực tiếp cổng
database.

## 2. Thành phần và công nghệ

| Thành phần        | Công nghệ / vai trò                                        |
| ----------------- | ---------------------------------------------------------- |
| API               | Python, FastAPI, Uvicorn                                   |
| Truy cập database | `asyncpg`, connection pool bất đồng bộ                     |
| Database          | PostgreSQL với PostGIS; container `postgis/postgis:17-3.5` |
| Vector tile động  | `pg_tileserv`, kết nối bằng role `tile_reader`             |
| Bản đồ nền tĩnh   | VersaTiles, đọc các file `.versatiles` trong `data/`       |
| Ảnh Street View   | Static files từ thư mục panorama trên máy chạy backend     |

Dependency Python được liệt kê trong [`backend/requirements.txt`](../backend/requirements.txt).

## 3. Cấu hình và khởi động

### Biến môi trường

Backend nạp `backend/.env` (nếu có) bằng `python-dotenv`; biến môi trường của
tiến trình vẫn được sử dụng nếu đã khai báo bên ngoài.

| Biến            | Bắt buộc | Ý nghĩa                                                                                                             |
| --------------- | -------: | ------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`  |       Có | URI kết nối PostgreSQL. Thiếu biến này thì ứng dụng dừng ngay khi import module.                                    |
| `PANORAMAS_DIR` |    Không | Thư mục ảnh static; mặc định `data/panoramas`. Đường dẫn tương đối được tính theo working directory của tiến trình. |

Ví dụ định dạng URI (thay bằng thông tin phù hợp, không đưa mật khẩu thật vào
tài liệu hoặc Git):

```dotenv
DATABASE_URL=postgresql://<user>:<password>@127.0.0.1:5432/webmap_db
PANORAMAS_DIR=data/panoramas
```

URI của backend chạy trên máy host cần kết nối tới cổng đã publish
`127.0.0.1:5432`. Đặt `DATABASE_URL` trong `backend/.env`; mật khẩu PostgreSQL
cần đồng bộ với `PG_PASSWORD` được Docker Compose sử dụng.

### Chạy ở môi trường phát triển

1. Tạo `.env` từ `.env.example`, thay các giá trị mật khẩu mẫu; cấu hình
   `backend/.env` với `DATABASE_URL`.
2. Khởi chạy các dịch vụ dữ liệu: `docker compose up -d`.
3. Kích hoạt môi trường Python và chạy từ thư mục gốc:

   ```powershell
   .\backend\myenv\Scripts\Activate.ps1
   python -m backend.main
   ```

4. Uvicorn chạy tại `http://127.0.0.1:8000` với auto-reload theo thư mục
   `backend/`.

FastAPI cung cấp OpenAPI UI mặc định tại `/docs` và schema tại `/openapi.json`.

### Vòng đời kết nối

- Khi khởi động ứng dụng, FastAPI tạo pool `asyncpg` với `min_size=2`,
  `max_size=10`, `command_timeout=10` giây.
- Backend kiểm tra sự tồn tại của `public.pois` để ghi trạng thái startup; đây
  là thông tin chẩn đoán, không thay thế health check đầy đủ.
- Mỗi handler lấy connection từ pool và trả connection về pool sau truy vấn.
- Khi shutdown, pool được đóng.
- Nếu pool chưa sẵn sàng, endpoint database trả HTTP `503`.

## 4. HTTP middleware và static files

- CORS cho phép mọi origin, method và header; credentials bị tắt.
- GZip được áp dụng cho response có kích thước tối thiểu 1.000 byte.
- Thư mục panorama được tạo nếu chưa có và mount tại `/panoramas`.
- Ảnh trong database dùng `image_url` (thường là `/panoramas/<tên-file>`); file
  tương ứng phải tồn tại dưới `PANORAMAS_DIR`.

## 5. API hiện có

Các endpoint dưới đây được triển khai trực tiếp trong [`backend/main.py`](../backend/main.py).
Các truy vấn sử dụng parameter binding của `asyncpg`.

### `GET /health`

Kiểm tra pool và thực hiện `SELECT 1`.

- `200`: `{"status":"ok"}`
- `503`: pool chưa sẵn sàng.
- Lỗi kết nối database sẽ được chuyển thành lỗi HTTP của FastAPI.

### `GET /api/streetview/points`

Trả danh sách điểm panorama dưới dạng GeoJSON `FeatureCollection`.

| Query parameter                | Mặc định | Ràng buộc / ý nghĩa                                    |
| ------------------------------ | -------: | ------------------------------------------------------ |
| `minx`, `miny`, `maxx`, `maxy` | Không có | Nếu cung cấp đủ cả bốn, lọc theo bbox trong EPSG:4326. |
| `limit`                        |   `5000` | Số nguyên từ 1 đến 20.000.                             |

Nếu bbox đầy đủ nhưng `minx >= maxx` hoặc `miny >= maxy`, API trả `400`.
Nếu không đủ cả bốn tọa độ, API bỏ qua bbox và trả các điểm theo `id` trong
giới hạn yêu cầu.

Feature có `geometry` kiểu `Point`, tọa độ `[longitude, latitude]`; `properties`
gồm `id`, `image_url`, `heading`, `next_ids` và `link_positions`. Giá trị
`next_ids`/`link_positions` rỗng được chuẩn hóa thành mảng rỗng.

### `GET /api/streetview/image/{image_id}`

Trả chi tiết một panorama theo ID: `id`, `lng`, `lat`, `image_url`, `heading`,
`next_ids`, `link_positions`, `captured_at`.

- `captured_at` được đổi thành chuỗi ISO-8601 hoặc `null`.
- Không tìm thấy bản ghi: `404`.
- Database chưa sẵn sàng: `503`.

### `GET /api/point-info`

Tra cứu đường, panorama gần nhất và POI quanh tọa độ. Tất cả khoảng cách được
tính theo mét trên kiểu `geography`.

| Query parameter | Bắt buộc | Mặc định | Ràng buộc                                                   |
| --------------- | -------: | -------: | ----------------------------------------------------------- |
| `lng`           |       Có |        — | Từ -180 đến 180.                                            |
| `lat`           |       Có |        — | Từ -90 đến 90.                                              |
| `zoom`          |    Không |     `13` | Từ 0 đến 22; hiện được nhận nhưng chưa dùng trong truy vấn. |
| `radius_m`      |    Không |    `200` | Từ 10 đến 2.000 mét.                                        |
| `poi_limit`     |    Không |     `10` | Từ 1 đến 50.                                                |

Response có cấu trúc:

```json
{
  "road": {
    "osm_id": "...",
    "name": "...",
    "ref": "...",
    "fclass": "...",
    "oneway": "...",
    "maxspeed": "...",
    "distance_m": 0.0
  },
  "streetview": { "id": 1, "distance_m": 0.0 },
  "address": null,
  "pois": [
    {
      "id": 1,
      "name": "...",
      "category": "...",
      "lng": 0.0,
      "lat": 0.0,
      "distance_m": 0.0,
      "streetview_id": 1,
      "streetview_distance_m": 0.0
    }
  ]
}
```

`road` hoặc `streetview` là `null` nếu không có kết quả trong bán kính. POI
được sắp theo khoảng cách; mỗi POI có thể kèm ID panorama gần nhất trong phạm
vi 100 m. `address` hiện luôn là `null` (chưa có reverse geocoding). Lỗi truy
vấn ở endpoint này được trả thành HTTP `500` kèm thông tin lỗi database.

## 6. Phụ thuộc dữ liệu

Backend hiện truy vấn các đối tượng sau trong schema `public`:

| Đối tượng           | Endpoint                       | Cột được backend sử dụng                                                          |
| ------------------- | ------------------------------ | --------------------------------------------------------------------------------- |
| `streetview_images` | Street View và `point-info`    | `id`, `geom`, `image_url`, `heading`, `next_ids`, `link_positions`, `captured_at` |
| `vietnam_roads`     | `point-info`                   | `osm_id`, `name`, `ref`, `fclass`, `oneway`, `maxspeed`, `geom`                   |
| `pois`              | `point-info`, kiểm tra startup | `id`, `name`, `category`, `geom`                                                  |

`pois` có DDL trong `init/01-pois.sql`. DDL đầy đủ cho `streetview_images` và
`vietnam_roads` không nằm trong các file schema đã kiểm tra; danh sách cột
trên chỉ mô tả hợp đồng truy vấn của backend. Các bảng này cần tồn tại trước
khi dùng các endpoint tương ứng.

Lưu ý: pipeline [`rebuild.ps1`](../rebuild.ps1) nhập dữ liệu vào `raw` và tạo
các materialized view `clean.*`; pipeline đó không tạo bảng `public.vietnam_roads`.
Vì vậy cần kiểm tra riêng nguồn tạo/cập nhật `public.vietnam_roads` trong môi
trường triển khai.

## 7. Vận hành và giới hạn hiện tại

- Các container trong Compose chỉ bind vào loopback (`127.0.0.1`); không nên
  đổi sang public interface hoặc public trực tiếp cổng PostGIS.
- API hiện không có authentication/authorization và CORS mở cho mọi origin;
  phù hợp cho môi trường phát triển, cần đánh giá lại trước khi public.
- Chưa có endpoint ghi dữ liệu; các thay đổi POI/panorama hiện được thực hiện
  trực tiếp bằng SQL hoặc script quản trị.
- Lỗi truy vấn ở `/api/point-info` hiện trả chi tiết exception trong response;
  không nên để nguyên hành vi này ở production.
- Đảm bảo panorama được lưu đúng thư mục static và đường dẫn `image_url` có thể
  được trình duyệt truy cập.
