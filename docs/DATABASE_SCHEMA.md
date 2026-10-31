# Đặc tả database

## 1. Tổng quan triển khai

Database được chạy bằng Docker Compose trong [`docker-compose.yml`](../docker-compose.yml).
Compose khai báo PostgreSQL/PostGIS, dịch vụ tạo vector tile từ database và
dịch vụ phục vụ các file bản đồ `.versatiles`.

| Thuộc tính             | Giá trị                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| Image database         | `postgis/postgis:17-3.5`                                         |
| Container              | `postgis-webmap`                                                 |
| Database mặc định      | `webmap_db`                                                      |
| User quản trị mặc định | `postgres`                                                       |
| Cổng host              | `127.0.0.1:5432`                                                 |
| Persistence            | Named volume `postgis_data` mount vào `/var/lib/postgresql/data` |
| Init scripts           | `./init` mount read-only vào `/docker-entrypoint-initdb.d`       |
| Health check           | `pg_isready -U postgres -d webmap_db`, mỗi 5 giây, tối đa 20 lần |

Mật khẩu quản trị lấy từ `PG_PASSWORD`; mật khẩu role đọc tile lấy từ
`TILE_PASSWORD`. Các giá trị này phải được cấu hình trong `.env` tại root. Không
ghi mật khẩu thật vào tài liệu hoặc commit file `.env`.

PostgreSQL được cấu hình trong Compose với `shared_buffers=1GB`,
`work_mem=64MB`, `maintenance_work_mem=512MB`,
`effective_cache_size=3GB` và `max_parallel_workers_per_gather=2`. Đây là
giá trị cấu hình container, cần điều chỉnh theo tài nguyên máy chủ.

## 2. Service liên quan

| Service       |        Cổng host | Vai trò                                 | Quyền / nguồn dữ liệu                                                                    |
| ------------- | ---------------: | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `postgis`     | `127.0.0.1:5432` | Lưu trữ và truy vấn dữ liệu không gian. | Persistent volume `postgis_data`; chạy init scripts khi khởi tạo data directory lần đầu. |
| `pg_tileserv` | `127.0.0.1:7800` | Cung cấp vector tile động từ PostGIS.   | Kết nối DB bằng `tile_reader`; cấu hình `TS_URLBASE=/`, `TS_DEBUG=false`.                |
| `versatiles`  | `127.0.0.1:8080` | Cung cấp tile từ file tĩnh.             | Mount `./data` read-only; cấu hình nguồn `[vietnam]` và `[satellite]`.                   |

`pg_tileserv` chỉ được start sau khi health check của PostGIS thành công.
Backend FastAPI không được định nghĩa trong Compose và kết nối từ máy host qua
cổng `5432`.

## 3. Khởi tạo và nạp dữ liệu

### Lần khởi tạo volume đầu tiên

Docker image thực thi các file trong `/docker-entrypoint-initdb.d` theo cơ chế
init database của image. Trong repository, file init hiện có là
[`init/01-pois.sql`](../init/01-pois.sql); file này tạo bảng `public.pois` và
index.

Các init scripts chỉ chạy khi data directory được khởi tạo lần đầu. Khi volume
`postgis_data` đã có database, thay đổi trong `init/` không tự chạy lại. Việc
cập nhật schema khi đó cần được áp dụng bằng migration/SQL phù hợp; không xóa
volume để chạy lại init nếu cần giữ dữ liệu.

### Dữ liệu OSM vào schema `raw` và `clean`

[`rebuild.ps1`](../rebuild.ps1) là pipeline quản lý dữ liệu bản đồ:

1. Khởi động/đợi PostGIS healthy và đồng bộ mật khẩu PostgreSQL theo `.env`.
2. Nạp `data/vietnam.gpkg` vào schema `raw` bằng GDAL/`ogr2ogr`, geometry
   `geom`, SRID 4326, spatial index GiST. Tùy chọn `-SkipImport` bỏ qua bước nạp.
3. Chạy `sql/01_qa_raw.sql` để tạo báo cáo chất lượng `qa.report`.
4. Chạy `sql/02_clean.sql` và `sql/03_extra_layers.sql` để tạo materialized
   views trong schema `clean`.
5. Khởi động lại `pg_tileserv` để nhận các layer đã cập nhật.

`rebuild.ps1` drop và tạo lại riêng schema `raw` khi import mới; comment/script
nêu rõ dữ liệu `public` không bị xóa. Các layer `clean.*` có GiST index trên
`geom`; script cấp quyền đọc cho `tile_reader`. `clean.refresh_all()` được định
nghĩa trong `02_clean.sql` để refresh các materialized view sau khi cập nhật
nguồn `raw`.

## 4. Schema và đối tượng dữ liệu

### `public`

Các bảng API đang sử dụng:

| Đối tượng           | Tình trạng trong repository                                                                                                     | Cột / mục đích                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `pois`              | DDL đầy đủ trong `init/01-pois.sql`.                                                                                            | POI điểm, được endpoint `point-info` truy vấn.                    |
| `streetview_images` | DDL đầy đủ chưa được tìm thấy trong các init/migration SQL hiện có. Cột dưới đây suy ra từ truy vấn backend và script nhập ảnh. | Điểm panorama, vị trí ảnh, hướng nhìn, liên kết sang ảnh kế tiếp. |
| `vietnam_roads`     | DDL đầy đủ chưa được tìm thấy trong các init/migration SQL hiện có. Cột dưới đây suy ra từ truy vấn backend và migration quyền. | Lớp đường được endpoint `point-info` dùng để tìm đường gần nhất.  |

#### `public.pois` — schema được định nghĩa

| Cột          | Kiểu                    | Ràng buộc / ý nghĩa                                      |
| ------------ | ----------------------- | -------------------------------------------------------- |
| `id`         | `BIGSERIAL`             | Primary key.                                             |
| `osm_id`     | `TEXT`                  | Unique; có thể null theo đặc tính unique của PostgreSQL. |
| `name`       | `TEXT`                  | Tên POI.                                                 |
| `category`   | `TEXT`                  | Nhóm POI.                                                |
| `geom`       | `GEOMETRY(Point, 4326)` | Bắt buộc; tọa độ điểm WGS 84.                            |
| `created_at` | `TIMESTAMPTZ`           | Mặc định `NOW()`.                                        |

Index được tạo: GiST trên `geom`, B-tree trên `category`. Role `tile_reader`
chưa được cấp quyền SELECT trên `pois` trong init script (dòng GRANT hiện
được comment).

#### Hợp đồng truy vấn `public.streetview_images`

Backend/scripts sử dụng các cột sau; kiểu dữ liệu ngoài các chi tiết thể hiện
trực tiếp trong câu lệnh nhập là **chưa được xác nhận bằng DDL**:

| Cột              | Cách sử dụng                                                                 |
| ---------------- | ---------------------------------------------------------------------------- |
| `id`             | Mã panorama; API tra cứu theo ID và dùng làm khóa liên kết trong `next_ids`. |
| `geom`           | Hình học điểm; API dùng `ST_X`/`ST_Y`, bbox và phép đo khoảng cách.          |
| `image_url`      | URL static của ảnh, ví dụ `/panoramas/<file>`.                               |
| `heading`        | Hướng ban đầu của camera.                                                    |
| `next_ids`       | Mảng ID panorama có thể đi tiếp.                                             |
| `link_positions` | JSON array chứa vị trí hotspot trên ảnh; script insert dùng kiểu `jsonb`.    |
| `captured_at`    | Thời điểm chụp; endpoint trả ISO-8601 hoặc `null`.                           |

`db/migrations/04_grants.sql` yêu cầu GiST index trên `geom` của bảng này và
cấp quyền SELECT cho `tile_reader`.

#### Hợp đồng truy vấn `public.vietnam_roads`

Backend cần các cột:

| Cột                  | Cách sử dụng                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `osm_id`             | Mã đối tượng OpenStreetMap.                                                              |
| `name`, `ref`        | Tên đường và mã tham chiếu.                                                              |
| `fclass`             | Phân loại đường.                                                                         |
| `oneway`, `maxspeed` | Thuộc tính giao thông.                                                                   |
| `geom`               | Hình học tuyến; truy vấn gần nhất và khoảng cách được thực hiện trên geometry/geography. |

Migration [`db/migrations/04_grants.sql`](../db/migrations/04_grants.sql) yêu
cầu GiST index trên `geom` và cấp quyền SELECT cho `tile_reader`. Tuy nhiên,
đây không phải migration tự chạy từ Compose. Cần áp dụng migration trong quy
trình triển khai thích hợp.

**Lưu ý khác biệt tên/schema:** pipeline OSM tạo `clean.roads_major`,
`clean.roads_minor` và `clean.roads_local`, không tạo `public.vietnam_roads`.
Backend đang query `public.vietnam_roads`; nguồn đồng bộ/tạo bảng này chưa được
thể hiện trong `rebuild.ps1`/SQL được kiểm tra và phải được xác nhận riêng.

### `raw`

Schema nguồn dữ liệu OSM được tạo trong quá trình `rebuild.ps1`; các bảng
được nạp từ `data/vietnam.gpkg` bằng GDAL. Cấu trúc và danh sách layer phụ
thuộc nội dung GeoPackage đầu vào; `rebuild.ps1` yêu cầu hình học EPSG:4326 và
đặt tên cột hình học là `geom`.

`sql/01_qa_raw.sql` tạo `qa.report` từ các bảng hình học trong `raw`. Báo cáo
bao gồm tổng số dòng, geometry null/rỗng/không hợp lệ, bản ghi thiếu tên và
ID OSM trùng (nếu có cột tương ứng).

### `clean`

`sql/02_clean.sql` tạo các materialized view:

- `admin_areas`, `protected_areas`
- `pois`, `places`
- `roads_major`, `roads_minor`, `roads_local`

`sql/03_extra_layers.sql` bổ sung:

- Polygon: `water_areas`, `landuse`, `places_areas`, `natural_areas`,
  `buildings`, `pois_areas`, `pofw_areas`, `traffic_areas`, `transport_areas`
- Line: `railways`, `waterways`
- Point: `pofw`, `traffic`, `transport`, `natural`

Các view được dẫn xuất từ `raw.*`; quy trình có chuẩn hóa tên, loại hình học,
loại hình học không hợp lệ/rỗng và simplify hình học tùy layer. POI được gom
thành các category tiếng Việt; lớp places có `minzoom`; road được chia nhóm
theo cấp đường. Các view có cột `geom` được tạo GiST index.

`tile_reader` được cấp `USAGE` schema `clean` và `SELECT` trên các bảng/view
hiện có. `02_clean.sql` cũng cấp default SELECT cho các bảng tạo sau này trong
schema này. `pg_tileserv` kết nối bằng role này để phục vụ vector tiles.

### `qa`

`qa.report` là bảng báo cáo do `sql/01_qa_raw.sql` tạo lại mỗi lần chạy. Đây
là kết quả kiểm tra dữ liệu, không phải nguồn dữ liệu bản đồ cho API.

## 5. Index và truy vấn không gian

- `public.pois`: GiST `geom`, B-tree `category`.
- `clean.*`: GiST trên `geom` cho materialized views.
- `public.vietnam_roads` và `public.streetview_images`: migration
  `04_grants.sql` kiểm tra GiST index trước khi cấp quyền và dừng bằng exception
  nếu index thiếu.
- Backend dùng bbox operator (`geom && envelope`), `ST_DWithin`, khoảng cách
  `geography` để trả về đơn vị mét, và toán tử KNN `<->` để sắp xếp ứng viên gần.

## 6. Kết nối, mật khẩu và quyền

- `PG_PASSWORD` đặt mật khẩu user quản trị trong Compose khi PostgreSQL init
  volume lần đầu; việc thay giá trị `.env` sau đó không tự đổi mật khẩu role
  hiện có.
- `TILE_PASSWORD` được đưa vào URI của `tile_reader` trong cấu hình Compose.
  Script `sql/02_clean.sql` tạo hoặc cập nhật mật khẩu role này khi chạy rebuild.
- Backend dùng `DATABASE_URL` riêng trong `backend/.env`, thường kết nối qua
  `127.0.0.1:5432`.
- `tile_reader` là role dành cho pg_tileserv; backend hiện kết nối bằng URI
  do nhà vận hành cấu hình và cần quyền SELECT trên các bảng ở `public`.
- `04_grants.sql` là migration thủ công: kiểm tra index đường/panorama, cấp
  SELECT cho `tile_reader` trên hai bảng public và chạy `ANALYZE`.

## 7. Sao lưu và vận hành

- Dữ liệu PostgreSQL được lưu trong named volume `postgis_data`; dừng/recreate
  container không đồng nghĩa xóa volume.
- Sao lưu cần bao gồm cả PostgreSQL volume/dump lẫn các file nguồn ngoài DB
  được sử dụng cho hệ thống, đặc biệt `data/vietnam.gpkg`, tile `.versatiles`
  và ảnh panorama.
- Các thay đổi trong init SQL không tự áp dụng lên volume đã tồn tại; theo dõi
  migration và thực thi rõ ràng.
- Sau khi nạp lại OSM, rebuild tạo lại dữ liệu `raw`/`clean`, sau đó khởi động
  lại pg_tileserv. Kiểm tra counts trong output và các layer trên
  `http://127.0.0.1:7800/index.html`.
