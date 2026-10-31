# Đặc tả hệ thống frontend

## 1. Tổng quan

Frontend là ứng dụng React/TypeScript chạy bằng Vite trong thư mục
`fontend/` (giữ nguyên cách viết tên thư mục trong repository). Ứng dụng hiển
thị bản đồ bằng MapLibre GL, gọi API FastAPI để lấy thông tin vị trí và điểm
Street View, đồng thời lấy vector tile từ pg_tileserv.

```text
React app (Vite :5173)
  ├─ /api, /panoramas, /user-media ──> FastAPI :8000
  ├─ /tileserver ────────────────────> pg_tileserv :7800
  └─ /satellite/tiles ───────────────> VersaTiles :8080
```

Trong dev server, các đường dẫn trên được proxy tại
[`fontend/vite.config.ts`](../fontend/vite.config.ts). Cấu hình frontend nằm
trong [`fontend/src/config.ts`](../fontend/src/config.ts), ứng dụng và điều
hướng map ở [`fontend/src/App.tsx`](../fontend/src/App.tsx).

## 2. Công nghệ và lệnh chạy

- React 19, TypeScript, Vite.
- MapLibre GL cho các bản đồ chính.
- Photo Sphere Viewer cho panorama 360°.
- Leaflet / React Leaflet được cài đặt cho các phần bản đồ phụ trợ.
- Dependency và lệnh scripts: [`fontend/package.json`](../fontend/package.json).

Chạy từ thư mục gốc:

```powershell
npm run font
```

Hoặc:

```powershell
Set-Location fontend
npm install
npm run dev
```

Dev server mặc định bind `127.0.0.1`; URL hiển thị sau khi Vite khởi động.
Các lệnh kiểm tra:

```powershell
npm run build
npm run lint
```

Chạy các lệnh build/lint trong `fontend/`.

## 3. Cấu hình runtime

Vite nạp biến `VITE_*` từ môi trường build/dev. Các giá trị chính:

| Biến | Mặc định / mục đích |
| --- | --- |
| `VITE_API_BASE` | `window.location.origin`; đặt URL API khác origin nếu không dùng cùng origin/proxy. |
| `VITE_TILE_BASE` | `VITE_TILESERVER_URL`, nếu có; nếu không là `/tileserver`. |
| `VITE_TILESERVER_URL` | Biến tương thích cũ cho URL pg_tileserv. |
| `VITE_SATELLITE_URL` | `/satellite/tiles/{z}/{x}/{y}`; template tile của VersaTiles. |
| `VITE_SHOW_MAP_SWITCHER` | Chỉ bật bộ chọn map khi giá trị chính xác là `"true"`. |

Mẫu cấu hình local nằm trong [`fontend/.env.example`](../fontend/.env.example).
Nếu sử dụng Vite proxy mặc định, nên gọi API/tile qua cùng origin của Vite;
không cần ghi URL FastAPI trực tiếp vào `VITE_API_BASE`.

## 4. Cấu trúc và chế độ bản đồ

`App.tsx` mặc định chọn bản đồ `esri`; bộ chuyển map bị ẩn trừ khi bật
`VITE_SHOW_MAP_SWITCHER=true`. Các mode trong mã nguồn:

| Mode | Thành phần | Nguồn / mục đích |
| --- | --- | --- |
| `esri` | `EsriSatelliteMap` | Esri World Imagery, lớp đường từ pg_tileserv, điểm Street View từ API; chế độ mặc định. |
| `selfhost` | `SatelliteMap` | Raster satellite cục bộ từ VersaTiles. |
| `osm` | `OsmPolygonMap` | Basemap OSM và một số polygon layer từ `clean.*`. |
| `test` | `TestPSV` | Màn hình thử nghiệm Photo Sphere Viewer. |

Trong bản đồ Esri:

- Vị trí khởi đầu là `[105.43, 10.38]`, zoom 13.
- Lớp đường xuất hiện từ zoom 14; nhãn đường từ zoom 15.
- Điểm Street View xuất hiện từ zoom 16.9.
- Panel lớp bật/tắt đường, tên đường và Street View; trạng thái mặc định đều
  bật.
- Click bản đồ đặt marker và mở panel thông tin; panel gọi
  `GET /api/point-info`. Click dấu X Street View mở viewer 360°.
- Viewer dùng các liên kết `next_ids` và `heading` để chuyển giữa panorama;
  ảnh kế tiếp được prefetch. `Esc` đóng viewer, phím mũi tên phải chuyển tới
  ảnh kế tiếp đầu tiên nếu có.
- Panel Settings hiện chỉ là placeholder.

`OsmPolygonMap` hiển thị các layer `clean.admin_areas`,
`clean.water_areas`, `clean.landuse` và `clean.buildings`. Bản đồ này và
`SatelliteMap` có thể được chọn qua switcher khi switcher được bật.

## 5. Tích hợp API và dữ liệu

- `useStreetViewPoints` tải `GET /api/streetview/points`; GeoJSON cung cấp
  source/layer Street View và metadata ảnh cho viewer.
- `useClickPointInfo` tải `GET /api/point-info` theo tọa độ click. Request cũ
  bị bỏ qua khi người dùng click vị trí mới.
- Ảnh được tải từ URL trong `image_url`; URL tương đối được ghép với
  `VITE_API_BASE`.
- Frontend không có form đóng góp POI/ảnh trong cấu trúc hiện tại. API upload
  được mô tả trong [đặc tả backend](./BACKEND_SYSTEM_SPEC.md).

Lớp đường trên bản đồ Esri tham chiếu
`public.vietnam_roads`; lớp này cần được cấp quyền cho `tile_reader` và cần
tồn tại trong database. Đây không phải một trong các `clean.roads_*` view
được tạo bởi pipeline OSM.

## 6. Dịch vụ ngoài và lưu ý triển khai

- Chế độ Esri tải World Imagery từ ArcGIS Online.
- MapLibre worker và glyphs hiện lấy từ CDN/nguồn demo công khai; cần kiểm tra
  chính sách mạng và nguồn tài nguyên khi triển khai.
- `OsmPolygonMap` dùng các tile server công khai của OpenStreetMap.
- Vite cấu hình `allowedHosts` cho các domain ngrok và HMR WebSocket HTTPS;
  đây là cấu hình dev, không thay cho reverse proxy hoặc cấu hình production.
- Frontend không gửi `WRITE_API_KEY`; không đưa khóa ghi vào biến `VITE_*`
  hoặc bundle trình duyệt. Nếu sau này thêm UI đóng góp, cần thiết kế cơ chế
  xác thực server-side phù hợp.
