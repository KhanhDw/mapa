# **Chốt kiến trúc frontend MAPA**

Đã đủ 4 file cuối. Có thể chốt hướng tái kiến trúc dựa trên code thực tế đã nhận.

**Nguyên tắc:** tổ chức theo domain/feature, không tổ chức theo loại component. Một feature phải sở hữu UI, hooks, API, types và styles liên quan đến nghiệp vụ của nó. `app` chỉ điều phối các feature; `core` chứa hạ tầng; `shared` chứa thành phần thực sự dùng chung.

Không cần cài thêm thư viện hoặc thay đổi nghiệp vụ trong đợt tái cấu trúc này.

## **1. Cấu trúc thư mục đích**

```
frontend/
├── public/
├── shared/                         # Chỉ giữ nếu dùng ngoài src
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── ActivityBar/
│   │   │   ├── SidebarContent.tsx
│   │   │   └── MapContainerView.tsx
│   │   ├── hooks/
│   │   │   ├── useNavigationRequests.ts
│   │   │   └── usePoleLocationRecording.ts
│   │   ├── App.tsx
│   │   └── App.css
│   │
│   ├── core/
│   │   ├── api/
│   │   │   ├── ApiClient.ts
│   │   │   └── repositories/
│   │   │       └── PoiRepository.ts
│   │   ├── auth/
│   │   │   └── tokenStorage.ts
│   │   ├── config/
│   │   │   └── index.ts
│   │   └── errors/
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── AuthContext.tsx
│   │   │   ├── AuthGate.tsx
│   │   │   ├── storage.ts
│   │   │   ├── types.ts
│   │   │   ├── useAuth.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── map/
│   │   │   ├── components/
│   │   │   │   ├── EsriSatelliteMap/
│   │   │   │   ├── SatelliteMap/
│   │   │   │   └── OsmPolygonMap/
│   │   │   ├── layers/
│   │   │   ├── hooks/
│   │   │   ├── types/
│   │   │   └── index.ts
│   │   │
│   │   ├── search/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── index.ts
│   │   │
│   │   ├── poi/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── types/
│   │   │   └── index.ts
│   │   │
│   │   ├── electric-poles/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   └── index.ts
│   │   │
│   │   ├── streetview/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── index.ts
│   │   │
│   │   └── contribute/
│   │       ├── api/
│   │       ├── components/
│   │       ├── hooks/
│   │       └── index.ts
│   │
│   ├── shared/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/
│   │
│   ├── styles/
│   │   └── index.css
│   └── main.tsx
│
├── .env*
├── package.json
├── tsconfig*.json
└── vite.config.ts
```

Một số thư mục như `core/errors`, `shared/hooks` chỉ tạo khi có module thực tế cần đặt vào đó. Không tạo file rỗng để lấp đầy cây thư mục.

## **2. Phân chia ownership các panel**

Đây là phần quan trọng nhất vì hiện tại nhiều domain đang nằm chung trong `components/layout/panels`.

| Component hiện tại                       | Vị trí mới                                  | Lý do                                                                                       |
| ---------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `GeneralPanel`                           | `features/map/components/MapPointInfoPanel` | Hiển thị thông tin điểm được click trên bản đồ, kết hợp đường, POI, trụ điện và Street View |
| `PlaceDetailSidebar`                     | `features/poi/components/PlaceDetailPanel`  | Hiển thị chi tiết một POI                                                                   |
| `LayersPanel`                            | `features/map/components/LayersPanel`       | Quản lý hiển thị các lớp bản đồ                                                             |
| `SettingsPanel`                          | `app/components/SettingsPanel`              | Điều phối lựa chọn map renderer và cài đặt giao diện ở cấp ứng dụng                         |
| `ContributePanel`                        | `features/contribute/components`            | Nghiệp vụ đóng góp dữ liệu                                                                  |
| `SearchPanel`                            | `features/search/components`                | Nghiệp vụ tìm kiếm                                                                          |
| `PoiManagementPanel`                     | `features/poi/components`                   | Quản lý POI                                                                                 |
| `PoleDetailPanel`, `PoleManagementPanel` | `features/electric-poles/components`        | Quản lý và hiển thị trụ điện                                                                |
| `StreetViewManagementPanel`              | `features/streetview/components`            | Quản lý ảnh toàn cảnh                                                                       |

`SidebarContent` tiếp tục nằm trong `app`: nó chỉ chọn panel dựa trên `activePanel` và truyền props. Không chuyển nó vào `shared`, vì nó phụ thuộc vào các feature cụ thể.

`MapContainerView` cũng nằm trong `app/components`: đây là composition component chọn renderer theo `MapType`, không phải renderer bản đồ. Các renderer thực tế chuyển vào `features/map/components`.

## **3. Mapping file cũ → mới**

### **App và layout**

| Đường dẫn cũ                                 | Đường dẫn mới                             |
| -------------------------------------------- | ----------------------------------------- |
| `src/App.tsx`                                | `src/app/App.tsx`                         |
| `src/App.css`                                | `src/app/App.css`                         |
| `src/app/SidebarContent.tsx`                 | `src/app/components/SidebarContent.tsx`   |
| `src/components/layout/MapContainerView.tsx` | `src/app/components/MapContainerView.tsx` |
| `src/components/layout/Activitybar/**`       | `src/app/components/ActivityBar/**`       |
| `src/components/UserMenu.tsx`                | `src/app/components/UserMenu.tsx`         |
| `src/components/UserMenu.css`                | `src/app/components/UserMenu.css`         |
| `src/components/ErrorBoundary.tsx`           | `src/shared/components/ErrorBoundary.tsx` |
| `src/components/dev/TestPSV.tsx`             | `src/app/dev/TestPSV.tsx`                 |

### **Core và cấu hình**

| Đường dẫn cũ                            | Đường dẫn mới                           |
| --------------------------------------- | --------------------------------------- |
| `src/config.ts`                         | `src/core/config/index.ts`              |
| `src/api/http/ApiClient.ts`             | `src/core/api/ApiClient.ts`             |
| `src/api/repositories/PoiRepository.ts` | `src/features/poi/api/PoiRepository.ts` |

`PoiRepository` thuộc nghiệp vụ POI, không phải HTTP infrastructure.

### **Auth**

| Đường dẫn cũ                | Đường dẫn mới                           |
| --------------------------- | --------------------------------------- |
| `src/features/auth/**`      | Giữ nguyên trong `src/features/auth/**` |
| Phần đọc token phục vụ HTTP | `src/core/auth/tokenStorage.ts`         |

Chỉ tách phần truy cập token khỏi feature auth sau khi thống nhất API của storage. Không thay đổi key `forma.auth`, định dạng persisted session hoặc cơ chế hết hạn.

### **Map**

| Đường dẫn cũ                                   | Đường dẫn mới                                     |
| ---------------------------------------------- | ------------------------------------------------- |
| `src/components/maps/EsriSatelliteMap/**`      | `src/features/map/components/EsriSatelliteMap/**` |
| `src/components/maps/SatelliteMap/**`          | `src/features/map/components/SatelliteMap/**`     |
| `src/components/maps/OsmPolygonMap/**`         | `src/features/map/components/OsmPolygonMap/**`    |
| `src/components/layout/panels/LayersPanel.tsx` | `src/features/map/components/LayersPanel.tsx`     |
| `src/components/layout/panels/LayersPanel.css` | `src/features/map/components/LayersPanel.css`     |
| `src/components/layout/panels/types.ts`        | `src/features/map/types/layers.ts`                |
| `src/app/hooks/useNavigationRequests.ts`       | `src/app/hooks/useNavigationRequests.ts`          |
| `src/app/hooks/usePoleLocationRecording.ts`    | `src/app/hooks/usePoleLocationRecording.ts`       |

Các hooks `useClickMarker`, `useClickPointInfo`, `useStreetViewPoints` đang gắn trực tiếp với Esri map nên giữ trong `EsriSatelliteMap/hooks`, không đưa lên `app`.

### **Search**

| Đường dẫn cũ                                  | Đường dẫn mới                                   |
| --------------------------------------------- | ----------------------------------------------- |
| `src/api/search.ts`                           | `src/features/search/api/search.ts`             |
| `src/app/hooks/useMapSearch.ts`               | `src/features/search/hooks/useMapSearch.ts`     |
| `src/components/layout/panels/SearchPanel/**` | `src/features/search/components/SearchPanel/**` |

### **POI**

| Đường dẫn cũ                                         | Đường dẫn mới                                       |
| ---------------------------------------------------- | --------------------------------------------------- |
| `src/api/pois.ts`                                    | `src/features/poi/api/pois.ts`                      |
| `src/api/poiManagement.ts`                           | `src/features/poi/api/poiManagement.ts`             |
| `src/api/pointInfo.ts`                               | `src/features/poi/api/pointInfo.ts`                 |
| `src/api/repositories/PoiRepository.ts`              | `src/features/poi/api/PoiRepository.ts`             |
| `src/components/layout/panels/PoiManagementPanel/**` | `src/features/poi/components/PoiManagementPanel/**` |
| `src/components/layout/panels/PlaceDetailPanel/**`   | `src/features/poi/components/PlaceDetailPanel/**`   |
| `src/components/layout/panels/generalPanel/**`       | `src/features/map/components/MapPointInfoPanel/**`  |

`PoiInfo` nên được định nghĩa tại `features/poi/types`, không tiếp tục phụ thuộc vào file UI `generalPanel.tsx`. `ClickInfo`, `RoadInfo`, `StreetViewHit` và `NearbyPole` cần được tách theo domain sở hữu sau khi kiểm tra các API trả về các kiểu dữ liệu này.

### **Electric poles**

| Đường dẫn cũ                                      | Đường dẫn mới                                           |
| ------------------------------------------------- | ------------------------------------------------------- |
| `src/api/electricPoles.ts`                        | `src/features/electric-poles/api/electricPoles.ts`      |
| `src/app/hooks/useElectricPoles.ts`               | `src/features/electric-poles/hooks/useElectricPoles.ts` |
| `src/components/layout/panels/PoleDetailPanel/**` | `src/features/electric-poles/components/**`             |

### **Street View**

| Đường dẫn cũ                                                | Đường dẫn mới                                                     |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/api/streetview.ts`                                     | `src/features/streetview/api/streetview.ts`                       |
| `src/api/tiles.ts`                                          | Giữ ở `src/features/map/api/tiles.ts`                             |
| `src/components/streetview/StreetViewModal/**`              | `src/features/streetview/components/StreetViewModal/**`           |
| `src/components/layout/panels/StreetViewCreateForm/**`      | `src/features/streetview/components/StreetViewCreateForm/**`      |
| `src/components/layout/panels/StreetViewManagementPanel/**` | `src/features/streetview/components/StreetViewManagementPanel/**` |

### **Contribute**

| Đường dẫn cũ                                       | Đường dẫn mới                                            |
| -------------------------------------------------- | -------------------------------------------------------- |
| `src/api/contribute.ts`                            | `src/features/contribute/api/contribute.ts`              |
| `src/api/contributePublic.ts`                      | `src/features/contribute/api/contributePublic.ts`        |
| `src/components/layout/panels/contribute/**`       | `src/features/contribute/hooks/**`                       |
| `src/components/layout/panels/ContributePanel.tsx` | `src/features/contribute/components/ContributePanel.tsx` |
| `src/components/layout/panels/ContributePanel.css` | `src/features/contribute/components/ContributePanel.css` |

### **Shared và styles**

| Đường dẫn cũ                | Đường dẫn mới                                                  |
| --------------------------- | -------------------------------------------------------------- |
| `shared/canvas/drawIcon.ts` | `src/shared/utils/canvas/drawIcon.ts` nếu chỉ frontend sử dụng |
| `src/index.css`             | `src/styles/index.css`                                         |

`shared/canvas/drawIcon.ts` chỉ chuyển vào `src` sau khi xác nhận không có package khác sử dụng. Nếu được dùng ngoài frontend, giữ ở root `shared`.

`src/auth` và root `utils` đang xuất hiện như thư mục rỗng trong tree đã gửi. Chưa xóa cho đến khi xác nhận chúng thực sự không chứa file bị bỏ qua.

## **4. Những phụ thuộc cần xử lý khi di chuyển**

Có 5 điểm cần chú ý để tránh tạo kiến trúc mới nhưng vẫn giữ phụ thuộc ngược.

### **4.1.&#x20;**`ApiClient`**&#x20;và Auth**

Hiện tại:

```
// ApiClient.ts
import { getAuthToken } from "../../features/auth/storage";
```

Nếu `ApiClient` chuyển vào `core`, đây là dependency ngược `core → features`.

Hướng xử lý:

- Tạo `core/auth/tokenStorage.ts` chỉ cung cấp khả năng đọc token cho HTTP client.
- Giữ `features/auth/storage.ts` làm nơi quản lý persisted session và user.
- Hai module phải dùng chung storage key và quy tắc hết hạn.
- Không thay đổi format `forma.auth`.

Không nên chuyển toàn bộ AuthContext vào `core`, vì AuthContext là nghiệp vụ xác thực của feature.

### **4.2.&#x20;**`GeneralPanel`**&#x20;đang chứa domain types**

Hiện tại:

```
import type { ClickInfo } from
    "../components/layout/panels/generalPanel/generalPanel";
```

Đây là kiểu phụ thuộc không nên duy trì: component khác phải import type từ implementation UI.

Nên chuyển các kiểu dữ liệu về domain:

```
features/
├── map/
│   └── types/
│       └── mapPoint.ts
└── poi/
    └── types/
        └── poi.ts
```

`PoiInfo` thuộc POI; `ClickInfo` thuộc map. Các kiểu `NearbyPole`, `RoadInfo`, `StreetViewHit` cần phân loại theo API và nơi sử dụng thực tế trước khi tách.

### **4.3.&#x20;**`LayersPanel`**&#x20;phụ thuộc registry của Esri**

Hiện tại:

```
import {
    DEFAULT_LAYER_KEYS,
    DEFAULT_LAYER_KEY_SET,
    LAYER_GROUPS,
    LAYER_META,
} from "../../maps/EsriSatelliteMap/layers/registry";
```

Trong khi layer visibility được truyền từ `App` và có thể dùng cho nhiều map renderer.

Nên chuyển registry ra khỏi `EsriSatelliteMap`:

```
features/map/
├── layers/
│   ├── registry.ts
│   └── types.ts
└── components/
    └── LayersPanel.tsx
```

Các renderer map sẽ sử dụng registry chung. Không để cấu hình layer toàn ứng dụng phụ thuộc vào một renderer cụ thể.

### **4.4.&#x20;**`PlaceDetailSidebar`**&#x20;đang tự gọi&#x20;**`fetch`

Hiện tại component gọi trực tiếp:

```
fetch(`${apiBase.replace(/\/+$/, "")}/api/user-pois/${userPoiId}`)
```

Đây là trách nhiệm API đang nằm trong UI.

Trong đợt tái cấu trúc đầu tiên, chỉ chuyển file nguyên trạng để giảm rủi ro. Sau đó mới tách request sang API module của POI và sử dụng `apiClient`, giữ nguyên AbortController, trạng thái loading và error.

Không gộp việc này vào cùng một thay đổi di chuyển thư mục.

### **4.5.&#x20;**`SettingsPanel`**&#x20;và&#x20;**`MapType`

`SettingsPanel` import `MapType` từ ActivityBar, trong khi nó chỉ cần kiểu map renderer.

Nên chuyển `MapType` thành domain type:

```
features/map/types/mapType.ts
```

Cả ActivityBar, SettingsPanel và MapContainerView cùng import type này. Điều này tránh phụ thuộc giữa hai component UI.

## **5. Thứ tự thực hiện an toàn**

Không nên di chuyển tất cả file cùng lúc. Chia thành 6 giai đoạn, mỗi giai đoạn phải build thành công trước khi tiếp tục.

1. **Giai đoạn 1 – Chuẩn bị core**

   Di chuyển `config.ts`, chuẩn hóa export và cập nhật import. Chưa thay đổi nội dung cấu hình.
2. **Giai đoạn 2 – Di chuyển API theo feature**

   Di chuyển các API files vào từng feature. Giữ nguyên tên export, request, response và hành vi.
3. **Giai đoạn 3 – Di chuyển map**

   Di chuyển map renderers, layers, registry và map hooks. Cập nhật import tương ứng.
4. **Giai đoạn 4 – Di chuyển panel theo feature**

   Di chuyển POI, Search, Contribute, Electric poles, Street View và MapPointInfoPanel. Giữ nguyên CSS đi kèm.
5. **Giai đoạn 5 – Chuẩn hóa app**

   Chuyển App, ActivityBar, SidebarContent và MapContainerView vào app. Sửa public exports và dependency types.
6. **Giai đoạn 6 – Chuẩn hóa import và kiểm tra**

   Kiểm tra import cũ, xử lý barrel exports, chạy TypeScript, ESLint và production build.

## **6. Quy trình kiểm tra sau mỗi giai đoạn**

Chạy tại thư mục `frontend`:

```
npm run check
npm run lint
npm run build
```

Tìm import còn trỏ đến cấu trúc cũ:

```
Get-ChildItem .\src -Recurse -File -Include *.ts,*.tsx |
    Select-String -Pattern 'components/maps|components/layout/panels|from "\.\.?/api/|from "\.\.?/config"'
```

Kiểm tra file API cũ còn tồn tại:

```
Get-ChildItem .\src\api -Recurse -File
```

Kiểm tra những thư mục rỗng:

```
Get-ChildItem .\src -Directory -Recurse |
    Where-Object {
        -not (Get-ChildItem $_.FullName -Force -Recurse -File)
    } |
    Select-Object FullName
```

**Lưu ý:** lệnh tìm import cũ chỉ là bước rà soát, không phải bằng chứng tự động rằng tất cả import đã được sửa. Cần kiểm tra kết quả trước khi xóa thư mục cũ.

## **7. Cách triển khai đề xuất**

Tôi đề xuất thực hiện từng giai đoạn bằng cách di chuyển file trước, cập nhật import sau, rồi chạy build. Chưa nên thêm alias `@/` ngay lập tức; trước hết giữ relative import để giảm số lượng thay đổi đồng thời. Sau khi cấu trúc ổn định mới chuẩn hóa alias trong TypeScript và Vite.

**Bước tiếp theo: Giai đoạn 1 – chuẩn bị core và config.**

Trước khi viết patch, cần xác nhận thêm hai thông tin để tránh bỏ sót dependency:

1\. Kết quả tìm kiếm toàn bộ frontend đang import `src/config.ts`:

```
Get-ChildItem .\src -Recurse -File -Include *.ts,*.tsx |
    Select-String -Pattern 'from ["''].*config|from ["''].*ApiClient'
```

2\. Kết quả tìm kiếm nơi sử dụng `readPersistedAuth`, `writePersistedAuth`, `getAuthToken`:

```
Get-ChildItem .\src -Recurse -File -Include *.ts,*.tsx |
    Select-String -Pattern 'readPersistedAuth|writePersistedAuth|getAuthToken'
```

Gửi output hai lệnh này. Tôi sẽ chốt patch di chuyển đầu tiên, không thay đổi logic auth hay cấu hình runtime.