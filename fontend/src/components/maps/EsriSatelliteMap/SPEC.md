Đây là đặc tả hoàn chỉnh cho `EsriSatelliteMap` — viết theo cùng style với backend spec (mục lục, bảng, ví dụ, ghi chú vận hành). Copy thành `src/components/maps/EsriSatelliteMap/SPEC.md`.

---

```markdown
# ESRISATELLITEMAP — COMPONENT SPEC

> Đặc tả component bản đồ chính của Webmap Mapa.
> Là **consumer duy nhất** của backend spec (§4.2, §4.3, §4.6, §8, §9).
> Mọi thay đổi API backend phải phản ánh vào file này.

- **Phiên bản:** 1.0.0
- **Cập nhật:** 2026-10-31
- **Component path:** `src/components/maps/EsriSatelliteMap/`
- **Backend spec tham chiếu:** `BACKEND_SYSTEM_SPEC.md` v2.3.0

---

## 1. Mục tiêu & phạm vi

`EsriSatelliteMap` là **map chính** của ứng dụng — hiển thị nền vệ tinh Esri (external) + lớp dữ liệu động từ backend:

- **Đường** (vector tile) từ `public.vietnam_roads`
- **Tên đường** (symbol label)
- **Điểm Street View** (GeoJSON X markers)
- **Point info** khi click (sidebar)
- **Street View viewer** (modal 360°)

**Ngoài phạm vi:** các map test (`SatelliteMap`, `OsmPolygonMap`, `TestPSV`) — không thuộc component này, không sửa.

**Nguyên tắc:** Frontend chỉ gọi backend qua `API_BASE` (`:8000`). Không gọi trực tiếp pg_tileserv (`:7800`), versatiles (`:8080`), PostGIS (`:5432`).

---

## 2. Cấu trúc file
```

EsriSatelliteMap/
├── SPEC.md ← file này
├── index.ts ← re-export default
├── constants.ts ← view init, ID, ngưỡng zoom, params API
├── EsriSatelliteMap.tsx ← orchestrator (init map, gọi hook/layer)
├── EsriSatelliteMap.css ← layout (.map-wrapper, .map-container)
├── hooks/
│ ├── useStreetViewPoints.ts ← fetch /api/streetview/points (1 lần)
│ ├── useClickMarker.ts ← marker đỏ khi click map
│ └── useClickPointInfo.ts ← fetch /api/point-info
├── layers/
│ ├── roadsLayer.ts ← source + line + label cho vietnam_roads
│ ├── streetViewLayer.ts ← source GeoJSON rỗng + symbol X + handlers
│ └── applyLayerVisibility.ts ← bật/tắt layer theo LayerVisibility
└── utils/
└── createStreetViewXIcon.ts ← vẽ canvas X trắng-xanh

````

---

## 3. Cấu hình nền tảng (`constants.ts`)

### 3.1. View khởi tạo

| Thuộc tính | Giá trị | Ghi chú |
|---|---|---|
| `center` | `[105.243684, 10.799102]` | `[lng, lat]` — Cao Lãnh, Đồng Tháp |
| `zoom` | `14` | Đủ thấy đường (roads minzoom 14) |
| `minZoom` | `3` | |
| `maxZoom` | `19` | Khớp source `maxzoom` của Esri tại khu vực |

> **Lưu ý:** `maxZoom` **phải khớp** với khả năng thực của Esri tại viewport hiện tại. Nếu vượt, tile trắng. Tại Cao Lãnh Esri có tới z=18–19.

### 3.2. Ngưỡng & giới hạn

| Constant | Giá trị | Ý nghĩa |
|---|---|---|
| `SV_MIN_ZOOM` | `16.9` | Zoom bắt đầu hiện X street view |
| `SV_LIMIT` | `5000` | Số điểm SV tối đa fetch (spec §4.2) |
| `POINT_INFO_RADIUS_M` | `50` | Bán kính tìm kiếm point-info (spec §4.3) |
| `POINT_INFO_POI_LIMIT` | `10` | Số POI tối đa (spec §4.3) |

### 3.3. ID dùng chung

| Constant | Giá trị | Nơi dùng |
|---|---|---|
| `ROADS_SOURCE_ID` | `roads-pg` | roadsLayer |
| `ROADS_LAYER_ID` | `roads-pg-layer` | roadsLayer, applyLayerVisibility |
| `ROADS_LABEL_LAYER_ID` | `roads-label-layer` | roadsLayer, applyLayerVisibility |
| `SV_SOURCE_ID` | `sv-points` | streetViewLayer |
| `SV_LAYER_ID` | `sv-points-layer` | streetViewLayer, applyLayerVisibility, useClickMarker |
| `SV_ICON_ID` | `sv-x-icon` | streetViewLayer |

---

## 4. Map style (raster satellite)

### 4.1. Source — Esri external

```ts
"satellite-esri": {
    type: "raster",
    tiles: [ESRI_SATELLITE_TILE_URL],  // → config.ts
    tileSize: 256,
    maxzoom: 19,
    attribution: "Tiles © Esri",
}
````

| Thuộc tính    | Giá trị                | Lý do                                                 |
| ------------- | ---------------------- | ----------------------------------------------------- |
| `tiles`       | Esri World Imagery URL | External, không qua backend (map chính dùng ảnh Esri) |
| `tileSize`    | `256`                  | Chuẩn Web Mercator                                    |
| `maxzoom`     | `19`                   | Esri có tile tới z=19 tại khu vực Việt Nam đô thị     |
| `attribution` | `"Tiles © Esri"`       | Bắt buộc theo license                                 |

### 4.2. Layer — raster

```ts
{
    id: "satellite-layer",
    type: "raster",
    source: "satellite-esri",
    minzoom: 0,
    maxzoom: 22,   // overzoom an toàn nếu camera z > source.maxzoom
}
```

### 4.3. Glyphs

```ts
glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";
```

Dùng cho label tên đường. Font stack dùng: `Open Sans Regular`, `Arial Unicode MS Regular`.

### 4.4. Controls

| Control                               | Position      |
| ------------------------------------- | ------------- |
| `NavigationControl`                   | `top-right`   |
| `ScaleControl` (metric, maxWidth 120) | `bottom-left` |

---

## 5. Data layers

### 5.1. Roads layer — `layers/roadsLayer.ts`

**Source** (`roads-pg`):

| Thuộc tính | Giá trị                                             |
| ---------- | --------------------------------------------------- |
| `type`     | `vector`                                            |
| `tiles`    | `${TILE_BASE}/public.vietnam_roads/{z}/{x}/{y}.pbf` |
| `minzoom`  | `0`                                                 |
| `maxzoom`  | `14`                                                |

> `TILE_BASE = ${API_BASE}/tiles` — proxy backend tới pg_tileserv (spec §4.6, §8). Frontend **không** gọi `:7800`.

**Layer line** (`roads-pg-layer`):

| Thuộc tính     | Giá trị                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `type`         | `line`                                                                                                                                                                                                 |
| `source-layer` | **`public.vietnam_roads`** (pg_tileserv emit có schema prefix)                                                                                                                                         |
| `minzoom`      | `14`                                                                                                                                                                                                   |
| `line-color`   | match `fclass` (motorway `#ff5500`, trunk `#ff8800`, primary `#ffcc00`, secondary `#ffe066`, tertiary `#fff2b3`, residential `#ffffff`, service `#cccccc`, unclassified `#e5e5e5`, fallback `#ffffff`) |
| `line-width`   | interp 14→5, 18→9 px                                                                                                                                                                                   |
| `line-opacity` | interp 3→0.95, 6→0.75, 10→0.45, 14→0.35, 18→0.2                                                                                                                                                        |

**Layer label** (`roads-label-layer`):

| Thuộc tính         | Giá trị                   |
| ------------------ | ------------------------- |
| `type`             | `symbol`                  |
| `source-layer`     | `public.vietnam_roads`    |
| `minzoom`          | `15`                      |
| `text-field`       | `coalesce(name, ref, "")` |
| `text-size`        | interp 15→11, 20→16 px    |
| `symbol-placement` | `line`                    |
| `text-halo-width`  | `1.5` (halo trắng)        |

> **Quan trọng:** `source-layer` dùng **`public.vietnam_roads`**, không phải `vietnam_roads`. Backend pg_tileserv emit tên layer có schema prefix. Spec §9 ghi sai — coi như đã sửa theo thực tế.

### 5.2. Street View layer — `layers/streetViewLayer.ts`

**Source** (`sv-points`): GeoJSON rỗng khởi tạo, `setData()` sau khi fetch API xong.

```ts
map.addSource(SV_SOURCE_ID, {
  type: "geojson",
  data: { type: "FeatureCollection", features: [] },
});
```

**Layer symbol** (`sv-points-layer`):

| Thuộc tính              | Giá trị                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `type`                  | `symbol`                                                    |
| `minzoom`               | `16.9`                                                      |
| `icon-image`            | `sv-x-icon` (canvas vẽ runtime)                             |
| `icon-size`             | interp 10→0.5, 14→0.7, 18→1.0                               |
| `icon-allow-overlap`    | `true`                                                      |
| `icon-ignore-placement` | `true`                                                      |
| `icon-opacity`          | interp 16.9→0, 17.0→0.45, 17.7→0.8, 18.2→1.0 (fade-in mượt) |

**Handlers:**

- `click` → callback `onIconClick(id)` → mở `StreetViewModal`
- `mouseenter` → cursor `pointer`
- `mouseleave` → cursor `""`

**Icon X:** `utils/createStreetViewXIcon.ts` — canvas DPR-aware, viền trắng 5px + X xanh `#1a73e8` 2.5px.

### 5.3. Layer visibility — `layers/applyLayerVisibility.ts`

Map key ↔ layer ID:

| `LayerKey`   | MapLibre layer(s)   |
| ------------ | ------------------- |
| `roads`      | `roads-pg-layer`    |
| `roadNames`  | `roads-label-layer` |
| `streetview` | `sv-points-layer`   |

Hàm `applyLayerVisibility(map, layers)` bật/tắt `visibility: visible | none`. Guard `if (map.getLayer(id))` cần vì SV layer thêm **bất đồng bộ** (sau fetch).

---

## 6. API integration

### 6.1. `GET /api/streetview/points` — spec §4.2

**Hook:** `useStreetViewPoints(API_BASE)` — fetch **1 lần khi mount**.

**Request:**

```
GET ${API_BASE}/api/streetview/points?limit=5000
```

Không truyền bbox → backend trả `limit` điểm đầu tiên theo `id`. (Khi cần bbox theo viewport, mở rộng hook thành hook nhận `map`, dùng `moveend` + debounce 300ms; hiện chưa triển khai.)

**Response xử lý:**

```ts
interface StreetViewPoint {
  id: number;
  lng: number; // từ geometry.coordinates[0]
  lat: number; // từ geometry.coordinates[1]
  image_url: string;
  heading: number;
  next_ids: number[];
  link_positions: { id: number; yaw: number; pitch: number }[];
}
```

Backend trả `FeatureCollection` — hook parse ra 2 thứ:

- `points: StreetViewPoint[]` — dùng cho modal 360° và `flyTo`.
- `geojson: FeatureCollection` — nguyên bản, đưa vào `setStreetViewData()`.

**Lỗi:** log `console.error("[sv-points] ...")`, không throw — map vẫn hoạt động.

### 6.2. `GET /api/point-info` — spec §4.3

**Hook:** `useClickPointInfo(API_BASE, clickInfo)` — fetch **mỗi khi click map**.

**Request:**

```
GET ${API_BASE}/api/point-info?lng={lng}&lat={lat}&radius_m=50&poi_limit=10
```

> **KHÔNG gửi `zoom`** — spec §4.3 không có tham số này. Code cũ gửi `zoom` (dead param, FastAPI bỏ qua) — đã xoá.

**Response:**

```ts
interface PointInfoResponse {
  road: RoadInfo | null;
  streetview: StreetViewHit | null;
  address: string | null;
  pois: PoiInfo[];
}
```

**Abort:** dùng `AbortController` — click liên tục không gây race, request cũ bị cancel.

**Lỗi:** log `console.error("[point-info] ...")`, sidebar hiển thị message lỗi.

### 6.3. Không dùng trong component này

| Endpoint                        | Lý do                             |
| ------------------------------- | --------------------------------- |
| `/tiles/index.json`             | Không cần — biết trước bảng dùng  |
| `/tiles/public.pois/*`          | Bảng `public.pois` rỗng (spec §7) |
| `/mvt/*`                        | Chưa cần — pg_tileserv đủ         |
| `/basemap/*`                    | Map chính dùng Esri external      |
| `/api/user-pois*`               | Chưa triển khai Contribute UI     |
| `/api/user-panoramas`           | Chưa triển khai upload            |
| `/panoramas/*`, `/user-media/*` | Đã nhúng sẵn trong response API   |

---

## 7. Tương tác người dùng

### 7.1. Click map → marker + sidebar

```
click map
  ├─ nếu trúng layer SV_LAYER_ID → bỏ qua (modal 360° tự xử lý)
  └─ ngược lại:
      ├─ setClickInfo({ lng, lat, zoom })
      ├─ xoá marker cũ, thêm marker đỏ (#e8453c)
      ├─ fetch /api/point-info
      └─ nếu activePanel !== "info" → onAutoShowInfo() → App mở panel Info
```

**Clear marker khi:**

- `activePanel !== "info"` → `useEffect` gọi `clear()`.
- Người dùng đóng sidebar qua nút X → `onPanelClose()` → `App` set `activePanel = null` → effect clear.

### 7.2. Click icon X → mở Street View

```
click icon X (zoom >= 16.9)
  ├─ onIconClick(id)
  ├─ setSvModal({ open: true, startId: id })
  └─ createPortal(StreetViewModal, document.body)
```

Modal nhận:

- `startId` — điểm bắt đầu
- `allPoints` — toàn bộ SV points (để navigate next/prev)
- `onNodeChange(p)` — callback khi user di chuyển trong modal → `map.flyTo(p)`
- `onClose` → `setSvModal(null)`

### 7.3. Click POI trong sidebar

```
handlePoiClick(poi)
  ├─ nếu poi.streetview_id != null → handleOpenStreetViewById(id)
  └─ ngược lại → map.flyTo({center: [poi.lng, poi.lat], zoom: 17})
```

### 7.4. Panel system

`activePanel` do `App` quản lý (state lift-up). Component render theo giá trị:

| `activePanel` | Component render |
| ------------- | ---------------- |
| `"info"`      | `CoordSidebar`   |
| `"layers"`    | `LayersPanel`    |
| `"settings"`  | `SettingsPanel`  |
| `null`        | không panel      |

`.map-wrapper` nhận class `has-sidebar` khi có panel → CSS co map lại.

---

## 8. Contract nội bộ (không được phá khi refactor)

### 8.1. Props

```ts
interface Props {
  activePanel?: PanelType | null; // từ ActivityBar
  onAutoShowInfo?: () => void; // gọi khi click map, panel chưa mở
  onPanelClose?: () => void; // gọi khi đóng panel
}
```

### 8.2. Lifecycle

| Effect                 | Trigger                                   | Cleanup                                |
| ---------------------- | ----------------------------------------- | -------------------------------------- |
| Init map               | mount lần đầu (`mapRef.current === null`) | `map.remove()`, reset `mapRef.current` |
| Apply layer visibility | `mapReady`, `layers` đổi                  | —                                      |
| Clear marker           | `activePanel !== "info"`                  | —                                      |
| Auto show info         | `clickInfo` mới + panel != info           | —                                      |
| Update SV data         | `geojson` mới                             | —                                      |

### 8.3. StrictMode

Map init có guard `if (!mapContainer.current || mapRef.current) return` để chống double-mount. Cleanup `map.remove()` + `mapRef.current = null` + `setMapReady(false)` — lần mount thứ 2 (StrictMode dev) init lại sạch.

### 8.4. Thứ tự thêm layer

`map.on("load", ...)`:

1. `addRoadsLayer(map)` — thêm source + line + label
2. `ensureStreetViewLayer({ map, onIconClick })` — thêm source rỗng + icon + layer + handlers
3. `setMapReady(true)` — trigger effect `applyLayerVisibility` và `useStreetViewPoints`

**SV layer** được `map.moveLayer(SV_LAYER_ID)` lên trên cùng → không bị roads đè.

---

## 9. Phụ thuộc backend spec

| Component dùng                                 | Backend spec                                 |
| ---------------------------------------------- | -------------------------------------------- |
| `${API_BASE}/api/streetview/points`            | §4.2                                         |
| `${API_BASE}/api/point-info`                   | §4.3                                         |
| `${API_BASE}/tiles/public.vietnam_roads/*.pbf` | §4.6                                         |
| `source-layer: public.vietnam_roads`           | §9 (thực tế — spec ghi `vietnam_roads`, sai) |
| `TILE_BASE = ${API_BASE}/tiles`                | §8 (single-port)                             |
| External Esri tiles                            | §8 ngoại lệ — map chính dùng external        |

**Khi backend đổi:**

- Đổi route `/api/*` → cập nhật `config.ts` + hooks.
- Đổi param `point-info` → cập nhật `constants.ts` + `useClickPointInfo`.
- Đổi response `streetview/points` → cập nhật parser trong `useStreetViewPoints`.
- Đổi tên layer PBF → cập nhật `source-layer` trong `roadsLayer`.

---

## 10. Biến môi trường

| Biến            | Bắt buộc | Giá trị dev             | Dùng ở                 |
| --------------- | -------- | ----------------------- | ---------------------- |
| `VITE_API_BASE` | ✅       | `http://127.0.0.1:8000` | `config.ts → API_BASE` |

Các biến **không dùng** trong component này (chỉ dùng cho map test):

- `VITE_SATELLITE_URL` — cho `SatelliteMap`
- `VITE_TILE_BASE` — không dùng nữa, `TILE_BASE` tự suy từ `API_BASE`

**Quan trọng:** `.env.development` **không được** override `VITE_API_BASE` trừ khi giá trị dev thực sự khác production. Nếu override, kiểm tra kỹ — đã từng gây lỗi 404 gọi `:7800`.

---

## 11. Known limitations & việc chưa làm

| #   | Vấn đề                                            | Mức độ     | Ghi chú                                                                                 |
| --- | ------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| 1   | SV points fetch 1 lần, không theo viewport        | Trung bình | Khi backend có nhiều panorama, fetch bbox + `moveend` debounce. Hiện `limit=5000` là đủ |
| 2   | Không có POI layer từ `public.pois`               | Thấp       | Bảng rỗng (spec §7). Khi có data → thêm `poisLayer.ts` (đã có thiết kế)                 |
| 3   | Không có Contribute UI (tạo POI, upload)          | Thấp       | Cần `X-API-Key`, build UI riêng                                                         |
| 4   | Phụ thuộc glyphs/font từ `demotiles.maplibre.org` | Thấp       | Deploy offline cần host font riêng                                                      |
| 5   | Worker load từ jsDelivr CDN                       | Thấp       | Offline cần bundle worker (Vite `?worker`)                                              |
| 6   | Không cache `/api/streetview/points` ở client     | Thấp       | Fetch 1 lần/mount, OK cho MVP                                                           |

---

## 12. Debug checklist

Khi component không hoạt động, kiểm tra theo thứ tự:

### 12.1. Bản đồ trắng hoàn toàn

- DevTools Console: có lỗi `[maplibre]` không?
- Network: request tile Esri (`server.arcgisonline.com/...`) có 200 không?
- Nếu 404 ở z cao → `ESRI_INITIAL_VIEW.maxZoom` vượt khả năng Esri khu vực → giảm.

### 12.2. Đường không hiện

- Network: `${API_BASE}/tiles/public.vietnam_roads/...pbf` — 200 hay 404?
  - 404 → backend proxy chưa route → check backend.
  - 200 nhưng layer trống → `source-layer` sai → mở PBF kiểm tra tên layer thực.
- Console: có lỗi `source-layer not found` không?

### 12.3. Tên đường không hiện

- Zoom >= 15?
- Roads layer hiện nhưng label không → font glyphs lỗi (mở Network lọc `.pbf` từ `demotiles.maplibre.org`).
- `coalesce(name, ref, "")` trả rỗng → PBF không có field `name`/`ref`.

### 12.4. Icon X không hiện

- Zoom >= 16.9? (fade-in bắt đầu từ 16.9)
- Network: `/api/streetview/points?limit=5000` có 200 + `features: [...]` không?
  - 200 + `features: []` → DB rỗng → upload panorama qua `POST /api/user-panoramas`.
  - 404/500 → backend.
- Console: `[sv-points] fetch error`?

### 12.5. Click map không mở sidebar

- Network: `/api/point-info?...` có gọi không?
  - Không gọi → `clickInfo` không set → `useClickMarker` không bắt được click (map đã load chưa? `mapReady` true chưa?).
  - Gọi nhưng 404/500 → backend.
- `onAutoShowInfo` prop có được `App` truyền không?

### 12.6. Env sai port (đã từng gặp)

- Network: request `/api/*` gọi `:7800` thay vì `:8000` → kiểm tra:
  ```bash
  ls -la .env*
  cat .env.development
  ```
  Override `.env.development` là nguyên nhân phổ biến nhất. Restart dev server sau khi sửa.

---

## 13. Migration log

| Ngày       | Thay đổi                                       | Lý do                                |
| ---------- | ---------------------------------------------- | ------------------------------------ |
| 2026-10-31 | `TILE_BASE` chuyển sang `${API_BASE}/tiles`    | Single-port (spec §8)                |
| 2026-10-31 | `source-layer` → `public.vietnam_roads`        | pg_tileserv emit có schema prefix    |
| 2026-10-31 | `/api/point-info` bỏ param `zoom`              | spec §4.3                            |
| 2026-10-31 | `useStreetViewPoints` fetch 1 lần, không bbox  | Đơn giản hoá MVP; spec §4.2 cho phép |
| 2026-10-31 | Init view → Cao Lãnh `[105.243684, 10.799102]` | Theo yêu cầu                         |
| 2026-10-31 | `maxZoom` 19, source `maxzoom` 19              | Tránh overzoom mờ                    |

---

_Hết spec. Khi thay đổi component, cập nhật file này cùng commit với code._

```

---

## Ghi chú khi commit

1. **Đặt file** tại `src/components/maps/EsriSatelliteMap/SPEC.md` — nằm cùng thư mục component, dễ tìm.
2. **Đồng bộ với backend spec:** khi backend spec đổi §4.2/§4.3/§4.6/§9, mở file này sửa mục **9. Phụ thuộc backend spec** cùng commit.
3. **Đặc biệt lưu ý mục 12.6** — đây là bug đã gặp thực tế (env override), giữ trong spec để lần sau không mất thời gian debug lại.
4. **Mục 5.1** có note rằng spec backend §9 ghi sai (`vietnam_roads` vs `public.vietnam_roads`) — nên báo backend team cập nhật spec của họ để tránh người sau đọc lại vấp.

Bạn có muốn tôi viết thêm **spec cho `StreetViewModal`** (component 360° viewer) và **`CoordSidebar`** (panel info) theo cùng format không? Đó là 2 component con lớn còn lại mà spec này chỉ nhắc tới, chưa đặc tả chi tiết.
```
