
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
    X,
    MapPin,
    Copy,
    Check,
    AlertCircle,
    Route,
    Zap,
    Building2,
    Globe2,
    Navigation,
    ArrowUpRight,
    Map,
    Crosshair,
} from "lucide-react";
import "./generalPanel.css";

export interface NearbyPole {
    id: number;
    pole_code: string;
    route: string;
    status: "good" | "warning" | "error";
    detail: string | null;
    lng: number;
    lat: number;
    distance_m: number;
}

export interface PoiInfo {
    source?: "osm" | "user";
    id: string | number;
    name: string | null;
    category: string | null;
    fclass?: string | null;
    photo_count?: number;
    distance_m: number;
    lng: number;
    lat: number;
    streetview_id?: number | null;
    streetview_distance_m?: number | null;
}

export interface ClickInfo {
    lng: number;
    lat: number;
    zoom: number;
}

export interface RoadInfo {
    osm_id: string | null;
    name: string | null;
    ref: string | null;
    fclass: string;
    oneway: string | null;
    maxspeed: number | null;
    distance_m: number;
}

export interface StreetViewHit {
    id: number;
    distance_m: number;
}

interface Props {
    info: ClickInfo | null;
    onClose: () => void;
    road?: RoadInfo | null;
    streetview?: StreetViewHit | null;
    address?: string | null;
    pois?: PoiInfo[] | null;
    nearbyPoles?: NearbyPole[] | null;
    loading?: boolean;
    addressLoading?: boolean;
    poisLoading?: boolean;
    error?: string | null;
    onOpenStreetView?: (id: number) => void;
    onPoiClick?: (poi: PoiInfo) => void;
    onPoiDetails?: (poi: PoiInfo) => void;
    onPoiStreetView?: (streetviewId: number) => void;
}

type CoordFormat = "decimal" | "dms";
type CopyState = "idle" | "ok" | "fail";

function toDMS(value: number, pos: string, neg: string): string {
    const dir = value >= 0 ? pos : neg;
    const abs = Math.abs(value);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = ((abs - d) * 60 - m) * 60;
    return `${d}°${m}′${s.toFixed(1)}″${dir}`;
}

function formatDistance(m: number): string {
    return m < 1000
        ? `${Math.round(m)} m`
        : `${(m / 1000).toFixed(1)} km`;
}

const FCLASS_LABEL: Record<string, string> = {
    motorway: "Cao tốc",
    trunk: "Quốc lộ",
    primary: "Đường chính",
    secondary: "Đường cấp hai",
    tertiary: "Đường cấp ba",
    residential: "Khu dân cư",
    service: "Đường nội bộ",
    unclassified: "Chưa phân loại",
    track: "Đường đất",
    path: "Đường mòn",
    footway: "Lối đi bộ",
};

const CATEGORY_LABEL: Record<string, string> = {
    restaurant: "Nhà hàng",
    fast_food: "Đồ ăn nhanh",
    food_court: "Khu ẩm thực",
    cafe: "Cà phê",
    bar: "Quán bar",
    pub: "Quán bia",
    biergarten: "Bia vườn",
    hospital: "Bệnh viện",
    clinic: "Phòng khám",
    doctors: "Bác sĩ",
    pharmacy: "Nhà thuốc",
    dentist: "Nha khoa",
    veterinary: "Thú y",
    nursing_home: "Viện dưỡng lão",
    school: "Trường học",
    university: "Đại học",
    college: "Cao đẳng",
    kindergarten: "Mẫu giáo",
    library: "Thư viện",
    bank: "Ngân hàng",
    atm: "Cây ATM",
    supermarket: "Siêu thị",
    convenience: "Tiện lợi",
    mall: "Trung tâm TM",
    department_store: "Bách hoá",
    clothes: "Quần áo",
    bakery: "Tiệm bánh",
    butcher: "Thịt",
    greengrocer: "Rau củ",
    kiosk: "Ki-ốt",
    market_place: "Chợ",
    bookshop: "Nhà sách",
    shoe_shop: "Giày dép",
    furniture_shop: "Nội thất",
    jeweller: "Trang sức",
    mobile_phone_shop: "Điện thoại",
    hairdresser: "Cắt tóc",
    beauty_shop: "Làm đẹp",
    hotel: "Khách sạn",
    guesthouse: "Nhà nghỉ",
    guest_house: "Nhà nghỉ",
    hostel: "Hostel",
    motel: "Motel",
    chalet: "Nhà nghỉ",
    camp_site: "Khu cắm trại",
    caravan_site: "Khu caravan",
    attraction: "Điểm tham quan",
    museum: "Bảo tàng",
    zoo: "Sở thú",
    theme_park: "Công viên giải trí",
    viewpoint: "Điểm ngắm cảnh",
    monument: "Tượng đài",
    memorial: "Đài tưởng niệm",
    ruins: "Di tích",
    castle: "Lâu đài",
    tourist_info: "Trung tâm TT du lịch",
    artwork: "Tác phẩm nghệ thuật",
    picnic_site: "Khu picnic",
    archaeological: "Khảo cổ",
    police: "Công an",
    fire_station: "Cứu hoả",
    post_office: "Bưu điện",
    town_hall: "UBND",
    courthouse: "Toà án",
    embassy: "Đại sứ quán",
    prison: "Nhà tù",
    community_centre: "Nhà văn hoá",
    public_building: "Công trình công cộng",
    fuel: "Cây xăng",
    parking: "Bãi đỗ xe",
    charging_station: "Trạm sạc",
    car_rental: "Thuê xe",
    bicycle_rental: "Thuê xe đạp",
    toilet: "Nhà vệ sinh",
    other: "Khác",
    an_uong: "Ăn uống",
    y_te: "Y tế",
    giao_duc: "Giáo dục",
    tai_chinh: "Tài chính",
    mua_sam: "Mua sắm",
    du_lich: "Du lịch",
    hanh_chinh: "Hành chính",
    khac: "Khác",
};

function categoryLabel(cat: string | null): string | null {
    if (!cat) return null;
    return CATEGORY_LABEL[cat] ?? cat;
}

function Section({
    icon,
    title,
    badge,
    children,
}: {
    icon: ReactNode;
    title: string;
    badge?: string | number;
    children: ReactNode;
}) {
    return (
        <section className="cs-section">
            <header className="cs-section__header">
                <div className="cs-section__title">
                    <span className="cs-section__icon">{icon}</span>
                    <span>{title}</span>
                </div>
                {badge !== undefined && (
                    <span className="cs-badge">{badge}</span>
                )}
            </header>
            <div className="cs-section__body">{children}</div>
        </section>
    );
}

function Skeleton({ lines = 2 }: { lines?: number }) {
    return (
        <div className="cs-skeleton" aria-hidden="true">
            {Array.from({ length: lines }, (_, i) => (
                <span
                    key={i}
                    className="cs-skeleton__line"
                    style={{ width: i === lines - 1 ? "60%" : "100%" }}
                />
            ))}
        </div>
    );
}

export function GeneralPanel({
    info,
    onClose,
    road,
    streetview,
    address,
    pois,
    nearbyPoles,
    loading = false,
    addressLoading = false,
    poisLoading = false,
    error = null,
    onOpenStreetView,
    onPoiClick,
    onPoiDetails,
    onPoiStreetView,
}: Props) {
    const [format, setFormat] = useState<CoordFormat>("decimal");
    const [copyState, setCopyState] = useState<{
        key: string;
        value: CopyState;
    }>({ key: "", value: "idle" });

    const timer = useRef<number | undefined>(undefined);

    useEffect(() => {
        return () => window.clearTimeout(timer.current);
    }, []);

    const infoKey = info ? `${info.lng}|${info.lat}` : "";
    const copy = copyState.key === infoKey ? copyState.value : "idle";

    const setCopy = (value: CopyState) => {
        setCopyState({ key: infoKey, value });
    };

    const handleCloseKey = (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Escape") onClose();
    };

    if (!info) {
        return (
            <aside
                className="coord-sidebar"
                aria-label="Thông tin điểm"
                onKeyDown={handleCloseKey}
            >
                <header className="coord-sidebar__header">
                    <div className="cs-header-brand">
                        <div className="cs-header-brand__icon">
                            <MapPin size={19} />
                        </div>
                        <div>
                            <h2>Chi tiết vị trí</h2>
                            <p>Thông tin địa lý và dữ liệu bản đồ</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="coord-sidebar__close"
                        onClick={onClose}
                        aria-label="Đóng"
                    >
                        <X size={18} />
                    </button>
                </header>

                <div className="cs-empty-state">
                    <div className="cs-empty-state__icon">
                        <Crosshair size={30} strokeWidth={1.5} />
                    </div>
                    <h3 className="cs-empty-state__title">Chưa chọn vị trí</h3>
                    <p className="cs-empty-state__desc">
                        Chọn một điểm bất kỳ trên bản đồ để xem tọa độ, địa chỉ và
                        các địa điểm xung quanh.
                    </p>
                    <div className="cs-empty-hint">
                        <MapPin size={14} />
                        <span>Nhấp vào bản đồ để bắt đầu</span>
                    </div>
                </div>
            </aside>
        );
    }

    const decimal = `${info.lat.toFixed(6)}, ${info.lng.toFixed(6)}`;
    const dmsLat = toDMS(info.lat, "N", "S");
    const dmsLng = toDMS(info.lng, "E", "W");

    const handleCopy = async () => {
        const text =
            format === "decimal" ? decimal : `${dmsLat}, ${dmsLng}`;

        window.clearTimeout(timer.current);

        try {
            await navigator.clipboard.writeText(text);
            setCopy("ok");
        } catch {
            setCopy("fail");
        }

        timer.current = window.setTimeout(() => setCopy("idle"), 2000);
    };

    const showRoad = loading || road !== undefined;
    const showSv = loading || streetview !== undefined;
    const showAddress = addressLoading || address !== undefined;
    const showPois = poisLoading || pois !== undefined;

    return (
        <aside
            className="coord-sidebar"
            aria-label="Thông tin điểm đã chọn"
            onKeyDown={handleCloseKey}
        >
            <header className="coord-sidebar__header">
                <div className="cs-header-brand">
                    <div className="cs-header-brand__icon">
                        <MapPin size={19} />
                    </div>
                    <div className="cs-header-brand__content">
                        <h2>Thông tin địa điểm</h2>
                        <p>
                            <span className="cs-live-dot" />
                            Điểm đã chọn trên bản đồ
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    className="coord-sidebar__close"
                    onClick={onClose}
                    aria-label="Đóng thanh thông tin"
                    title="Đóng"
                >
                    <X size={18} />
                </button>
            </header>

            <div className="coord-sidebar__scroll">
                {/* Coordinates */}
                <section className="cs-coordinate-panel">
                    <div className="cs-coordinate-panel__top">
                        <div>
                            <span className="cs-eyebrow">VỊ TRÍ ĐÃ CHỌN</span>
                            <h3>Tọa độ địa lý</h3>
                        </div>
                        <span className="cs-zoom-tag">
                            <Map size={12} />
                            Zoom {info.zoom.toFixed(1)}
                        </span>
                    </div>

                    <div className="cs-coords-card">
                        <div className="cs-coords-card__header">
                            <div className="cs-seg" role="tablist" aria-label="Định dạng tọa độ">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={format === "decimal"}
                                    className={`cs-seg__tab ${format === "decimal" ? "is-active" : ""}`}
                                    onClick={() => setFormat("decimal")}
                                >
                                    Decimal
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={format === "dms"}
                                    className={`cs-seg__tab ${format === "dms" ? "is-active" : ""}`}
                                    onClick={() => setFormat("dms")}
                                >
                                    DMS
                                </button>
                            </div>

                            <button
                                type="button"
                                className={`cs-copy-btn ${copy === "ok" ? "is-success" : ""} ${copy === "fail" ? "is-error" : ""}`}
                                onClick={handleCopy}
                                title="Sao chép tọa độ"
                            >
                                {copy === "ok" ? <Check size={14} /> : <Copy size={14} />}
                                {copy === "ok"
                                    ? "Đã sao chép"
                                    : copy === "fail"
                                        ? "Thử lại"
                                        : "Sao chép"}
                            </button>
                        </div>

                        <div className="cs-coords-display">
                            <div className="cs-coords-row">
                                <span className="cs-coords-label">LATITUDE</span>
                                <span className="cs-coords-val">
                                    {format === "decimal" ? info.lat.toFixed(6) : dmsLat}
                                </span>
                            </div>
                            <div className="cs-coords-row">
                                <span className="cs-coords-label">LONGITUDE</span>
                                <span className="cs-coords-val">
                                    {format === "decimal" ? info.lng.toFixed(6) : dmsLng}
                                </span>
                            </div>
                        </div>

                        <span className="cs-visually-hidden" role="status" aria-live="polite">
                            {copy === "ok"
                                ? "Đã sao chép tọa độ."
                                : copy === "fail"
                                    ? "Không thể sao chép tọa độ."
                                    : ""}
                        </span>
                    </div>
                </section>

                {/* Error */}
                {error && (
                    <div className="cs-alert cs-alert--error" role="alert">
                        <AlertCircle size={17} />
                        <span>Tải dữ liệu thất bại ({error}). Vui lòng thử lại.</span>
                    </div>
                )}

                {/* Address */}
                {showAddress && (
                    <Section icon={<MapPin size={16} />} title="Địa chỉ ước tính">
                        {addressLoading ? (
                            <Skeleton lines={2} />
                        ) : address ? (
                            <div className="cs-address-card">
                                <div className="cs-address-card__icon">
                                    <Navigation size={17} />
                                </div>
                                <p className="cs-address-text">{address}</p>
                            </div>
                        ) : (
                            <p className="cs-muted">Chưa tìm thấy thông tin địa chỉ.</p>
                        )}
                    </Section>
                )}

                {/* Road */}
                {showRoad && (
                    <Section icon={<Route size={16} />} title="Tuyến đường gần nhất">
                        {loading ? (
                            <Skeleton lines={3} />
                        ) : road ? (
                            <div className="cs-road-card">
                                <div className="cs-road-card__main">
                                    <h4 className="cs-road-card__name">
                                        {road.name?.trim() || "Tuyến đường chưa đặt tên"}
                                    </h4>
                                    <div className="cs-chip-group">
                                        {road.ref && (
                                            <span className="cs-chip cs-chip--primary">
                                                {road.ref}
                                            </span>
                                        )}
                                        <span className="cs-chip">
                                            {FCLASS_LABEL[road.fclass] ?? road.fclass}
                                        </span>
                                        {(road.oneway === "F" || road.oneway === "T") && (
                                            <span className="cs-chip cs-chip--neutral">
                                                Một chiều
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="cs-road-card__meta">
                                    <span>
                                        <MapPin size={13} />
                                        Cách {formatDistance(road.distance_m)}
                                    </span>
                                    {road.maxspeed && road.maxspeed > 0 && (
                                        <span>
                                            <Navigation size={13} />
                                            Tối đa {road.maxspeed} km/h
                                        </span>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className="cs-muted">
                                Không có dữ liệu đường xá xung quanh.
                            </p>
                        )}
                    </Section>
                )}

                {/* Nearby poles */}
                {nearbyPoles && nearbyPoles.length > 0 && (
                    <Section
                        icon={<Zap size={16} />}
                        title="Trụ điện gần đây"
                        badge={nearbyPoles.length}
                    >
                        <ul className="cs-poi-list">
                            {nearbyPoles.map((pole) => (
                                <li key={pole.id} className="cs-poi-item cs-pole-item">
                                    <div className="cs-poi-avatar cs-poi-avatar--pole">
                                        <Zap size={17} />
                                    </div>
                                    <div className="cs-poi-item__content">
                                        <span className="cs-poi-item__title">
                                            {pole.pole_code}
                                        </span>
                                        <div className="cs-poi-item__details">
                                            <span className="cs-poi-item__cat">{pole.route}</span>
                                            <span
                                                className={`cs-pole-status cs-pole-status--${pole.status}`}
                                            >
                                                {pole.status === "good"
                                                    ? "Bình thường"
                                                    : pole.status === "warning"
                                                        ? "Cảnh báo"
                                                        : "Sự cố"}
                                            </span>
                                            <span className="cs-poi-item__dist">
                                                {pole.distance_m < 10
                                                    ? "<10 m"
                                                    : formatDistance(pole.distance_m)}
                                            </span>
                                        </div>
                                        {pole.detail && (
                                            <span className="cs-muted cs-pole-detail">
                                                {pole.detail}
                                            </span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}

                {/* Nearby POIs */}
                {showPois && (
                    <Section
                        icon={<Building2 size={16} />}
                        title="Địa điểm xung quanh"
                        badge={pois?.length ?? 0}
                    >
                        {poisLoading ? (
                            <Skeleton lines={4} />
                        ) : pois && pois.length > 0 ? (
                            <ul className="cs-poi-list">
                                {pois.map((poi) => {
                                    const streetviewId = poi.streetview_id;

                                    return (
                                        <li
                                            key={`${poi.source ?? "osm"}-${poi.id}`}
                                            className="cs-poi-item"
                                        >
                                            <button
                                                type="button"
                                                className="cs-poi-item__action"
                                                onClick={() => onPoiClick?.(poi)}
                                                aria-label={`Xem ${poi.name?.trim() || "địa điểm chưa đặt tên"} trên bản đồ`}
                                            >
                                                <span className="cs-poi-avatar">
                                                    <MapPin size={17} />
                                                </span>
                                                <span className="cs-poi-item__content">
                                                    <span className="cs-poi-item__title">
                                                        {poi.name?.trim() || "Chưa đặt tên"}
                                                    </span>
                                                    <span className="cs-poi-item__details">
                                                        {(poi.fclass || poi.category) && (
                                                            <span className="cs-poi-item__cat">
                                                                {categoryLabel(poi.fclass || poi.category)}
                                                            </span>
                                                        )}
                                                        {poi.source === "user" && (
                                                            <span className="cs-user-badge">
                                                                Đóng góp
                                                            </span>
                                                        )}
                                                        <span className="cs-poi-item__dist">
                                                            {formatDistance(poi.distance_m)}
                                                        </span>
                                                    </span>
                                                    {poi.source === "user" && (
                                                        <span className="cs-muted cs-poi-coords">
                                                            {poi.lat.toFixed(6)}, {poi.lng.toFixed(6)}
                                                        </span>
                                                    )}
                                                </span>
                                            </button>

                                            <div className="cs-poi-actions">
                                                {onPoiDetails && (
                                                    <button
                                                        type="button"
                                                        className="cs-icon-action"
                                                        onClick={() => onPoiDetails(poi)}
                                                        aria-label={`Xem chi tiết ${poi.name ?? ""}`}
                                                        title="Chi tiết"
                                                    >
                                                        <ArrowUpRight size={16} />
                                                    </button>
                                                )}

                                                {streetviewId != null && onPoiStreetView && (
                                                    <button
                                                        type="button"
                                                        className="cs-360-btn"
                                                        onClick={() => onPoiStreetView(streetviewId)}
                                                        title={
                                                            poi.streetview_distance_m != null
                                                                ? `Xem 360° (${formatDistance(poi.streetview_distance_m)})`
                                                                : "Xem ảnh 360°"
                                                        }
                                                    >
                                                        <Globe2 size={14} />
                                                        360°
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="cs-muted">
                                Không tìm thấy địa điểm lân cận.
                            </p>
                        )}
                    </Section>
                )}

                {/* Street View */}
                {showSv && (
                    <Section icon={<Globe2 size={16} />} title="Ảnh toàn cảnh">
                        {loading ? (
                            <Skeleton lines={2} />
                        ) : streetview ? (
                            <div className="cs-sv-card">
                                <div className="cs-sv-card__visual">
                                    <Globe2 size={25} />
                                </div>
                                <div className="cs-sv-card__info">
                                    <h4 className="cs-sv-card__title">
                                        Panorama #{streetview.id}
                                    </h4>
                                    <p className="cs-sv-card__sub">
                                        Cách vị trí đã chọn {formatDistance(streetview.distance_m)}
                                    </p>
                                </div>
                                {onOpenStreetView && (
                                    <button
                                        type="button"
                                        className="cs-btn cs-btn--primary"
                                        onClick={() => onOpenStreetView(streetview.id)}
                                    >
                                        Mở xem panorama
                                        <ArrowUpRight size={16} />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className="cs-muted">
                                Không có dữ liệu 360° khu vực này.
                            </p>
                        )}
                    </Section>
                )}

                <footer className="cs-panel-footer">
                    <span>LOCATION DATA</span>
                    <span>Lat {info.lat.toFixed(4)} · Lng {info.lng.toFixed(4)}</span>
                </footer>
            </div>
        </aside>
    );
}
