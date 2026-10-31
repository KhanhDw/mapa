# Đặc tả database

## 1. Tổng quan

PostgreSQL/PostGIS chạy trong Docker Compose; database mặc định là
`webmap_db`. Backend kết nối từ máy host, pg_tileserv tạo vector tiles và
VersaTiles phục vụ tile nền tĩnh.

| Thuộc tính | Giá trị |
| --- | --- |
| Image | `postgis/postgis:17-3.5` |
| Container | `postgis-webmap` |
| Database / role quản trị | `webmap_db` / `postgres` |
| Cổng host | `127.0.0.1:5432` |
| Lưu trữ | Named volume `postgis_data` |
| Init scripts | `./init` mount read-only; chỉ chạy khi khởi tạo data directory lần đầu |

Các biến `PG_PASSWORD` và `TILE_PASSWORD` được đặt trong `.env` tại root.
Không lưu mật khẩu thật trong tài liệu hoặc Git. Thay đổi `PG_PASSWORD` sau
khi volume đã được khởi tạo không tự đổi mật khẩu role hiện có.

## 2. Service và quyền truy cập

| Service | Cổng host | Vai trò |
| --- | ---: | --- |
| `postgis` | `127.0.0.1:5432` | Database không gian, lưu trong `postgis_data`. |
| `pg_tileserv` | `127.0.0.1:7800` | Vector tiles; kết nối bằng role `tile_reader`. |
| `versatiles` | `127.0.0.1:8080` | Tile tĩnh; mount `data/` chỉ đọc, phục vụ nguồn `vietnam` và `satellite`. |

Compose bind các cổng lên loopback. `pg_tileserv` đợi health check của PostGIS;
backend FastAPI không phải service Compose và kết nối qua cổng host.

## 3. Init và migration

Compose chỉ mount [`init/01-pois.sql`](../init/01-pois.sql) làm init script.
Script này tạo `public.pois`, index GiST trên `geom` và index B-tree trên
`category`. Init script chỉ chạy với data directory mới; thay đổi schema sau
đó phải được áp dụng rõ ràng.

Các SQL trong [`db/migrations/`](../db/migrations/) không tự chạy từ Compose:

| File | Mục đích / điều kiện |
| --- | --- |
| [`01_qa_raw.sql`](../db/migrations/01_qa_raw.sql) | Tạo lại `qa.report` từ các bảng hình học trong `raw`. |
| [`02_clean.sql`](../db/migrations/02_clean.sql) | Tạo các materialized view cơ bản trong `clean`, role `tile_reader`, GiST index và quyền đọc. Yêu cầu dữ liệu `raw` tương ứng. |
| [`03_extra_layers.sql`](../db/migrations/03_extra_layers.sql) | Tạo thêm các layer; chạy sau migration 02. |
| [`04_grants.sql`](../db/migrations/04_grants.sql) | Kiểm tra GiST index và cấp quyền đọc tile cho `public.vietnam_roads` và `public.streetview_images`; yêu cầu hai bảng đã tồn tại. |
| [`05_user_data.sql`](../db/migrations/05_user_data.sql) | Tạo `user_data.pois`, `user_data.poi_photos`, role `mapa_api` và quyền backend; yêu cầu các bảng public được migration tham chiếu đã tồn tại. |

Migration 05 có mật khẩu phát triển dự phòng trong SQL để tạo role mới. Trước
khi triển khai, thay bằng thông tin xác thực an toàn và dùng URI tương ứng
trong `backend/.env`. `WRITE_API_KEY` là khóa HTTP riêng, không thay thế quyền
database.

## 4. Nạp dữ liệu OSM

Ý tưởng pipeline trong [`rebuild.ps1`](../rebuild.ps1):

1. Khởi động PostGIS và đợi health check.
2. Nạp `data/vietnam.gpkg` vào schema `raw` bằng GDAL/`ogr2ogr`, đặt hình học
   tên `geom`, SRID 4326 và GiST index.
3. Tạo `qa.report`.
4. Tạo các materialized view trong `clean`.
5. Khởi động lại pg_tileserv để nhận các layer mới.

### Sai khác đường dẫn hiện tại

Trong repository hiện tại, các script nằm ở `db/migrations/`, nhưng
`rebuild.ps1` vẫn copy từ `sql\01_qa_raw.sql`, `sql\02_clean.sql` và
`sql\03_extra_layers.sql`. Thư mục `sql\` không còn hiện diện trong worktree;
do đó pipeline không thể chạy nguyên trạng. Cần đồng bộ đường dẫn trong script
trước khi sử dụng. Không coi việc script hoàn tất là bằng chứng schema đã
được cập nhật nếu chưa xử lý sai khác này.

Khi import dữ liệu mới, script có ý định xóa và tạo lại riêng schema `raw`;
không chạy nếu chưa xác nhận backup và tác động của các đối tượng phụ thuộc.
Các bảng `public` không được script tuyên bố xóa.

## 5. Schema dữ liệu

### `public`

| Bảng | Nguồn / vai trò |
| --- | --- |
| `public.pois` | Bảng POI được định nghĩa tại init script; API dùng cho nguồn OSM. Khác với `clean.pois`. |
| `public.streetview_images` | Panorama phục vụ `/api/streetview/*`, `point-info` và upload panorama mới. DDL đầy đủ chưa có trong các init/migration hiện tại. |
| `public.vietnam_roads` | Bảng đường dùng bởi API `point-info`, lớp đường Esri và migration quyền. DDL đầy đủ chưa có trong các init/migration hiện tại. |

Hợp đồng các cột của `public.streetview_images`: `id`, `geom`, `image_url`,
`heading`, `next_ids`, `link_positions`, `captured_at`. API dùng `geom` dạng
điểm EPSG:4326; `link_positions` được đọc như JSON và panorama upload ghi
`next_ids` rỗng.

Hợp đồng các cột của `public.vietnam_roads`: `osm_id`, `name`, `ref`, `fclass`,
`oneway`, `maxspeed`, `geom`. Đây là hợp đồng truy vấn, không thay cho DDL.

**Lưu ý tên lớp đường:** migrations 02/03 tạo `clean.roads_major`,
`clean.roads_minor` và `clean.roads_local`, không tạo
`public.vietnam_roads`. Cần có quy trình riêng để provision/cập nhật bảng
public mà backend, frontend và migration 04 đang tham chiếu.

### `user_data`

Migration 05 định nghĩa:

- `user_data.pois`: `id`, `name`, `category`, `address`, `phone`,
  `description`, `geom`, `created_at`; có GiST index trên `geom` và B-tree
  index trên `category`.
- `user_data.poi_photos`: thông tin đường dẫn ảnh/thumbnail, kích thước và
  thời điểm tạo; `poi_id` tham chiếu `user_data.pois` với `ON DELETE CASCADE`.

API hợp nhất POI từ `public.pois` và `user_data.pois`. Các sequence riêng có
thể sinh ID trùng, vì vậy response `point-info` bao gồm `source` (`osm` hoặc
`user`) cùng với `id`. Ảnh không được lưu trong database; đường dẫn tương đối
trỏ tới static directory do backend phục vụ.

### `raw`

Schema nguồn được nạp từ GeoPackage; danh sách bảng tùy thuộc dữ liệu đầu vào.
Migration 01 tạo lại `qa.report` gồm tổng dòng, geometry null/rỗng/không hợp
lệ, bản ghi thiếu tên và OSM ID trùng nếu có cột tương ứng. Đây là báo cáo
kiểm tra dữ liệu, không phải nguồn API.

### `clean`

Migration 02 tạo 7 materialized view:

- `admin_areas`, `protected_areas`
- `pois`, `places`
- `roads_major`, `roads_minor`, `roads_local`

Migration 03 bổ sung 15 view:

- Polygon: `water_areas`, `landuse`, `places_areas`, `natural_areas`,
  `buildings`, `pois_areas`, `pofw_areas`, `traffic_areas`,
  `transport_areas`.
- Line: `railways`, `waterways`.
- Point: `pofw`, `traffic`, `transport`, `natural`.

Các view được dẫn xuất từ `raw.*`, có xử lý geometry/tên theo từng layer và có
GiST index trên `geom`. Migration 02 định nghĩa `clean.refresh_all()` để làm
mới các materialized view. `tile_reader` được cấp quyền đọc schema `clean`;
migration 04 cũng cấp quyền đọc các bảng public được chỉ định. Schema
`user_data` không được cấp cho role tile server.

## 6. Truy vấn không gian và quyền

- Backend dùng bbox cho truy vấn điểm panorama; dùng `ST_DWithin` và
  `ST_Distance` trên `geography` cho khoảng cách theo mét.
- Tìm ứng viên gần dùng toán tử KNN `<->`.
- `public.pois`: GiST `geom`, B-tree `category`.
- `clean.*`: GiST `geom`.
- `public.vietnam_roads` và `public.streetview_images`: migration 04 yêu cầu
  GiST index trên `geom` trước khi cấp quyền tile.
- Role `mapa_api` do migration 05 dùng cho truy vấn/ghi dữ liệu API; role
  `tile_reader` dành cho pg_tileserv. Không dùng `tile_reader` làm tài khoản
  backend ghi dữ liệu.

## 7. Sao lưu và vận hành

- Backup database gồm dump hoặc backup volume `postgis_data`.
- Backup riêng dữ liệu ngoài DB: `data/vietnam.gpkg`, tile `.versatiles`,
  `PANORAMAS_DIR` và `USER_MEDIA_DIR`.
- Init scripts không chạy lại trên volume đã có dữ liệu; migration cần được
  áp dụng có chủ đích.
- Sau khi rebuild, xác nhận counts của các layer và kiểm tra
  `http://127.0.0.1:7800/index.html`.
