# Webmap VN: Wireframe điều phối phát triển

*Dành cho Orchestrator (Claude) ra lệnh và các AI coder thực thi. Căn cứ vào tài liệu handoff kiến trúc hiện tại.*

## 1. Mô hình làm việc

**Orchestrator (Claude)** không viết code hàng loạt. Việc của Orchestrator: chia task, giao brief, chốt hợp đồng API, review kết quả, quyết định bước tiếp.

| Agent | Phạm vi được sửa | Không được đụng |
| --- | --- | --- |
| **DB/Ops Agent** | `docker-compose.yml`, SQL migration, `.env.example`, script PowerShell | Code `backend/`, `fontend/` |
| **Backend Agent** | `backend/main.py` (hoặc tách module), `requirements.txt` | Schema DB (chỉ đề xuất migration cho DB/Ops) |
| **Frontend Agent** | `fontend/src/**` | Backend, DB |
| **QA Agent** | Chạy curl, checklist, báo lỗi, viết test | Sửa code sản phẩm (chỉ báo cáo) |

**Quy tắc chung cho mọi agent**

1. Mỗi task chỉ sửa đúng các file ghi trong brief.
2. Không đổi hợp đồng API (mục 3) nếu chưa có lệnh của Orchestrator.
3. Giữ kiểu dữ liệu: `osm_id` là chuỗi, toạ độ là `[lng, lat]`, SRID 4326.
4. Trả kết quả theo mẫu handoff (mục 6), kèm lệnh để Orchestrator tự kiểm tra.
5. Gặp điểm mơ hồ thì hỏi lại, không tự đoán schema.

## 2. Wireframe giao diện đích

```
+----------------------------------------------------------------+
| [Vệ tinh nội bộ] [Esri Satellite] [OSM Polygon]   (map-switcher)|
+-------------------+--------------------------------------------+
| SIDEBAR (320px)   |                                            |
| Điểm đã chọn   X  |                  BẢN ĐỒ                    |
|-------------------|                                            |
| LAT   10.380000   |            (marker đỏ tại điểm click)      |
| LNG  105.430000   |                                            |
| DMS   ...         |        o  chấm xanh = ảnh 360              |
| ZOOM  16.20       |                                            |
|-------------------|                                            |
| ĐƯỜNG GẦN NHẤT    |                                            |
|  QL91 | primary   |                                            |
|  cách 12 m        |                                            |
|  60 km/h, 1 chiều |                                            |
|-------------------|                                            |
| ẢNH 360 GẦN NHẤT  |                                            |
|  #1, cách 40 m    |                                            |
|  [Xem ảnh 360]    |                                            |
|-------------------|                                            |
| ĐỊA CHỈ (tải sau) |                                            |
|  Đang tải...      |                                            |
| [Sao chép lat,lng]|                                            |
+-------------------+--------------------------------------------+
```

**Luồng tương tác**

```
Click bản đồ -> bỏ qua nếu trúng chấm 360
  -> đặt marker + mở sidebar (toạ độ hiện ngay)
  -> gọi /api/point-info (nhanh)      -> hiện đường + ảnh 360
  -> gọi /api/reverse-geocode (chậm)  -> hiện địa chỉ khi có
Click [Xem ảnh 360] -> gọi /api/streetview/graph/{id} -> mở modal
```

## 3. Hợp đồng API (chốt trước khi code)

**GET `/api/point-info`**

Query: `lng`, `lat` (bắt buộc), `road_radius` (mét, mặc định 50), `sv_radius` (mét, mặc định 100).

```json
{
  "point": {"lng": 105.8523, "lat": 21.0288},
  "road": {"osm_id": "123", "name": "Phố A", "ref": "QL91", "fclass": "primary",
           "oneway": "B", "maxspeed": 60, "distance_m": 12.3},
  "streetview": {"id": 1, "image_url": "/panoramas/demo1.png", "distance_m": 40.1}
}
```

`road` và `streetview` là `null` nếu ngoài bán kính. Không gọi dịch vụ ngoài trong endpoint này.

**GET `/api/reverse-geocode`**

Query: `lng`, `lat`. Trả `{"address": "..." | null, "cached": true|false}`. Có cache theo toạ độ làm tròn 5 chữ số, timeout 3 giây, đúng User-Agent Nominatim, tối đa 1 request/giây.

**GET `/api/streetview/graph/{id}`**

```json
{
  "node": {"id": 1, "lng": 0, "lat": 0, "image_url": "...", "heading": 90, "next_ids": [2, 4]},
  "neighbors": [{"id": 2, "lng": 0, "lat": 0, "image_url": "...", "heading": 270, "next_ids": [1, 3]}]
}
```

Trả 404 nếu `id` không tồn tại. Không còn trả `link_positions`.

## 4. Lộ trình theo giai đoạn

### Giai đoạn 0: Dọn nền (làm trước, song song được)

| ID | Agent | Việc | Nghiệm thu |
| --- | --- | --- | --- |
| OPS-01 | DB/Ops | Đổi cổng thành `127.0.0.1:5432`, `127.0.0.1:7800`, `127.0.0.1:8080`; thêm `.env.example` | `docker compose up -d` chạy, app vẫn tải được tile |
| OPS-02 | DB/Ops | Migration: GRANT SELECT cho `tile_reader` trên cả hai bảng; xác nhận GiST index; `ANALYZE` | `\d` hiện đủ index; `tile_reader` truy vấn được |
| BE-00 | Backend | Thêm `python-dotenv`, `httpx` vào `requirements.txt`; bỏ mật khẩu fallback trong `main.py` (thiếu `DATABASE_URL` thì báo lỗi rõ) | Cài sạch trong venv mới và chạy được |
| FE-00 | Frontend | Gom `API_BASE`, `TILE_BASE` vào `src/config.ts` dùng `import.meta.env.VITE_*`; sửa `.map-wrapper` thành `height: 100%`, bỏ trùng lặp CSS reset | Không còn URL hard-code trong component |

### Giai đoạn 1: Sidebar thông tin điểm (BE-01 và FE-01 chạy song song)

| ID | Agent | Việc | Phụ thuộc | Nghiệm thu |
| --- | --- | --- | --- | --- |
| BE-01 | Backend | Endpoint `/api/point-info` theo hợp đồng. Đường: CTE lấy 10 ứng viên bằng toán tử `<->`, xếp lại bằng `ST_Distance(...::geography)`. Ảnh 360: cùng cách, LIMIT 1 | OPS-02 | `curl` tại 105.8523,21.0288 trả cả đường lẫn ảnh; tại ruộng trả `null`; EXPLAIN dùng index GiST; phản hồi dưới 100 ms |
| FE-01 | Frontend | Component `CoordSidebar` (toạ độ, DMS, zoom, nút sao chép), marker đỏ, bỏ qua click trúng `sv-points-layer`, dọn marker khi unmount, `AbortController` cho request | FE-00, hợp đồng (dùng dữ liệu giả cho tới khi BE-01 xong) | Click liên tiếp: request cũ `canceled`; sidebar mở và đóng đúng; không lỗi console |
| QA-01 | QA | Chạy checklist: click vào đường, ra ruộng, trúng chấm 360, click nhanh, đóng sidebar | BE-01, FE-01 | Báo cáo đạt/không đạt từng mục |

### Giai đoạn 2: Street View không phụ thuộc `allPoints`

| ID | Agent | Việc | Phụ thuộc | Nghiệm thu |
| --- | --- | --- | --- | --- |
| BE-02 | Backend | Endpoint `/api/streetview/graph/{id}` (một truy vấn lấy node và `next_ids`) | OPS-02 | Có đủ `neighbors`; id lạ trả 404 |
| FE-02 | Frontend | `StreetViewModal` nhận `startId`, tự tải graph; dùng `Map` để tra cứu; return sớm khi lỗi; thêm `aria-label` cho nút đóng; nút `ArrowLeft` quay lại | BE-02 | Mở modal từ sidebar với id ngoài 5000 điểm đầu vẫn hoạt động |
| FE-03 | Frontend | Điểm 360 tải theo bbox khi `moveend` (có debounce, hủy request cũ) thay vì tải toàn bộ lúc khởi động | BE-02 | Network chỉ tải điểm trong khung nhìn |

### Giai đoạn 3: Địa chỉ và độ chính xác

| ID | Agent | Việc | Phụ thuộc | Nghiệm thu |
| --- | --- | --- | --- | --- |
| BE-03 | Backend | `/api/reverse-geocode` có cache (bộ nhớ hoặc bảng) và giới hạn tốc độ | BE-00 | Lần gọi thứ hai cùng toạ độ trả `cached: true`; lỗi Nominatim vẫn trả 200 với `address: null` |
| FE-04 | Frontend | Sidebar tải địa chỉ sau, không chặn phần đường/ảnh; tính bán kính theo zoom (khoảng 12 px) và gửi lên `point-info` | BE-03 | Đường và ảnh hiện ngay, địa chỉ hiện sau |
| FE-05 | Frontend | Hiển thị `ref`, `oneway`, `maxspeed`; bản dịch nhãn `fclass` sang tiếng Việt | BE-01 | Hiển thị đúng khi trường rỗng |

### Giai đoạn 4: Dọn kỹ thuật

| ID | Agent | Việc |
| --- | --- | --- |
| BE-04 | Bỏ `link_positions` khỏi các response; cân nhắc tách `main.py` thành `routers/` và `db.py` |  |
| OPS-03 | Ghim phiên bản image `pg_tileserv`, `versatiles`; cập nhật `add-streetview.ps1` thôi ghi `link_positions` |  |
| FE-06 | Thay `any` bằng kiểu `Viewer`, `MarkerConfig`; bỏ mốc `line-opacity` thừa khi layer có `minzoom: 14` |  |
| QA-02 | Hồi quy toàn bộ, kiểm tra CORS (thu hẹp `allow_origins` về `http://localhost:5173` khi deploy) |  |

### Backlog (chưa xếp lịch)

Upload ảnh từ giao diện và tự tính `next_ids` theo GPS, la bàn và mini-map trong Street View, tile ảnh 8K, thư viện ảnh trước/sau, tự host Nominatim.

## 5. Thứ tự và song song hoá

```
GĐ0: OPS-01 | OPS-02 | BE-00 | FE-00   (song song)
  v
GĐ1: BE-01 || FE-01  ->  QA-01
  v
GĐ2: BE-02  ->  FE-02  ->  FE-03
  v
GĐ3: BE-03  ->  FE-04, FE-05
  v
GĐ4: BE-04 | OPS-03 | FE-06  ->  QA-02
```

Cổng chuyển giai đoạn: Orchestrator chỉ cho phép sang giai đoạn sau khi QA báo đạt toàn bộ mục nghiệm thu của giai đoạn trước.

## 6. Mẫu lệnh của Orchestrator và mẫu báo cáo

**Mẫu brief giao việc**

```
VAI TRÒ: <Backend/Frontend/DB-Ops/QA Agent>
TASK: <ID> - <tên>
BỐI CẢNH: stack (FastAPI + asyncpg + PostGIS; React + Vite + MapLibre + PSV), chạy trên Windows/PowerShell
FILE ĐƯỢC SỬA: <danh sách>
HỢP ĐỒNG: <dán đoạn API liên quan ở mục 3>
YÊU CẦU: <gạch đầu dòng cụ thể>
KHÔNG ĐƯỢC: đổi hợp đồng, sửa file ngoài danh sách, thêm thư viện chưa được duyệt
NGHIỆM THU: <dán bảng nghiệm thu>
TRẢ VỀ: diff hoặc file đầy đủ + lệnh kiểm tra + các điểm chưa chắc chắn
```

**Mẫu báo cáo của agent**

```
TASK: <ID>   TRẠNG THÁI: xong / xong một phần / bị chặn
FILE ĐÃ SỬA: ...
CÁCH KIỂM TRA: <lệnh curl hoặc các bước click>
KẾT QUẢ THỰC TẾ: <dán output>
LƯU Ý / GIẢ ĐỊNH: ...
```

## 7. Checklist review của Orchestrator

- Đúng hợp đồng, đúng kiểu dữ liệu (`osm_id` là chuỗi).
- Truy vấn không gian dùng được index (đã xem `EXPLAIN`).
- Không có thư viện mới chưa duyệt, không có URL hay mật khẩu hard-code.
- Có xử lý huỷ request, lỗi mạng và trạng thái rỗng.
- Hook React đặt trước mọi lệnh `return` sớm.
- Dữ liệu test: dùng toạ độ Hà Nội của 4 ảnh demo (khác tâm bản đồ mặc định ở Long Xuyên).

## 8. Rủi ro cần theo dõi

| Rủi ro | Biện pháp |
| --- | --- |
| Vượt 5000 điểm 360 làm modal rỗng | FE-02, FE-03 (graph theo id, tải theo bbox) |
| Nominatim chặn hoặc chậm | BE-03 cache, tách endpoint, cân nhắc tự host |
| Hai agent sửa cùng file gây xung đột | Phân vùng file ở mục 1; Backend và Frontend chỉ gặp nhau qua hợp đồng API |
| Agent tự thay đổi schema | Mọi thay đổi DB đi qua DB/Ops Agent và migration có số thứ tự |
