import { useEffect, useRef, useState, type ReactNode } from "react";
import "./CoordSidebar.css";

export interface PoiInfo {
    id: string | number;
    name: string | null;
    category: string | null;
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
    loading?: boolean;
    addressLoading?: boolean;
    poisLoading?: boolean;
    error?: string | null;
    onOpenStreetView?: (id: number) => void;
    onPoiClick?: (poi: PoiInfo) => void;
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
    return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
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
    cafe: "Cà phê",
    restaurant: "Nhà hàng",
    fast_food: "Đồ ăn nhanh",
    bar: "Quán bar",
    pub: "Quán bia",
    pharmacy: "Nhà thuốc",
    hospital: "Bệnh viện",
    clinic: "Phòng khám",
    bank: "Ngân hàng",
    atm: "Cây ATM",
    shop: "Cửa hàng",
    supermarket: "Siêu thị",
    convenience: "Tiện lợi",
    fuel: "Cây xăng",
    hotel: "Khách sạn",
    school: "Trường học",
    university: "Đại học",
    post_office: "Bưu điện",
    police: "Công an",
    tourist_attraction: "Điểm du lịch",
};

function categoryLabel(cat: string | null): string | null {
    if (!cat) return null;
    return CATEGORY_LABEL[cat] ?? cat;
}

function Icon({ children }: { children: ReactNode }) {
    return (
        <svg
            className="cs-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
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
                    {icon}
                    <span>{title}</span>
                </div>
                {badge !== undefined && <span className="cs-badge">{badge}</span>}
            </header>
            <div className="cs-section__body">{children}</div>
        </section>
    );
}

function Skeleton({ lines = 2 }: { lines?: number }) {
    return (
        <div className="cs-skeleton" aria-hidden="true">
            {Array.from({ length: lines }, (_, i) => (
                <span key={i} className="cs-skeleton__line" style={{ width: i === lines - 1 ? "60%" : "100%" }} />
            ))}
        </div>
    );
}

export function CoordSidebar({
    info,
    onClose,
    road,
    streetview,
    address,
    pois,
    loading = false,
    addressLoading = false,
    poisLoading = false,
    error = null,
    onOpenStreetView,
    onPoiClick,
    onPoiStreetView,
}: Props) {
    const [format, setFormat] = useState<CoordFormat>("decimal");
    const [copy, setCopy] = useState<CopyState>("idle");
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);
    useEffect(() => setCopy("idle"), [info?.lat, info?.lng]);

    if (!info) {
        return (
            <aside className="coord-sidebar" aria-label="Thông tin điểm">
                <header className="coord-sidebar__header">
                    <div>
                        <h2>Chi tiết vị trí</h2>
                        <p className="cs-muted">Chọn một vị trí trên bản đồ</p>
                    </div>
                    <button
                        type="button"
                        className="coord-sidebar__close"
                        onClick={onClose}
                        aria-label="Đóng thanh thông tin"
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                        </svg>
                    </button>
                </header>
                <div className="cs-empty-state">
                    <div className="cs-empty-state__icon">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
                            <circle cx="12" cy="10" r="2.5" />
                        </svg>
                    </div>
                    <p className="cs-empty-state__title">Chưa chọn vị trí</p>
                    <p className="cs-empty-state__desc">Vui lòng nhấp vào bất kỳ tọa độ nào trên bản đồ để xem thông tin chi tiết.</p>
                </div>
            </aside>
        );
    }

    const decimal = `${info.lat.toFixed(6)}, ${info.lng.toFixed(6)}`;
    const dmsLat = toDMS(info.lat, "N", "S");
    const dmsLng = toDMS(info.lng, "E", "W");

    const handleCopy = async () => {
        const text = format === "decimal" ? decimal : `${dmsLat}, ${dmsLng}`;
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
            onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
            }}
        >
            <header className="coord-sidebar__header">
                <div>
                    <h2>Thông tin địa điểm</h2>
                    <span className="cs-zoom-tag">Zoom Level {info.zoom.toFixed(1)}</span>
                </div>
                <button
                    type="button"
                    className="coord-sidebar__close"
                    onClick={onClose}
                    aria-label="Đóng thanh thông tin"
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                </button>
            </header>

            <div className="coord-sidebar__scroll">
                {/* Box tọa độ & công cụ sao chép */}
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
                                Thập phân
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
                            className={`cs-copy-btn ${copy === "ok" ? "is-success" : ""}`}
                            onClick={handleCopy}
                            title="Sao chép tọa độ"
                        >
                            {copy === "ok" ? (
                                <>
                                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Đã chép
                                </>
                            ) : (
                                <>
                                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    </svg>
                                    Sao chép
                                </>
                            )}
                        </button>
                    </div>

                    <div className="cs-coords-card__body">
                        {format === "decimal" ? (
                            <div className="cs-coords-display">
                                <div className="cs-coords-row">
                                    <span className="cs-coords-label">LAT</span>
                                    <span className="cs-coords-val">{info.lat.toFixed(6)}</span>
                                </div>
                                <div className="cs-coords-row">
                                    <span className="cs-coords-label">LNG</span>
                                    <span className="cs-coords-val">{info.lng.toFixed(6)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="cs-coords-display">
                                <div className="cs-coords-row">
                                    <span className="cs-coords-label">LAT</span>
                                    <span className="cs-coords-val">{dmsLat}</span>
                                </div>
                                <div className="cs-coords-row">
                                    <span className="cs-coords-label">LNG</span>
                                    <span className="cs-coords-val">{dmsLng}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="cs-alert cs-alert--error" role="alert">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>Tải dữ liệu thất bại ({error}). Vui lòng nhấp lại.</span>
                    </div>
                )}

                {/* Khối địa chỉ */}
                {showAddress && (
                    <Section
                        title="Địa chỉ ước tính"
                        icon={
                            <Icon>
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </Icon>
                        }
                    >
                        {addressLoading ? (
                            <Skeleton lines={2} />
                        ) : address ? (
                            <p className="cs-address-text">{address}</p>
                        ) : (
                            <p className="cs-muted">Chưa tìm thấy thông tin địa chỉ.</p>
                        )}
                    </Section>
                )}

                {/* Khối đường gần nhất */}
                {showRoad && (
                    <Section
                        title="Tuyến đường gần nhất"
                        icon={
                            <Icon>
                                <path d="M4 19L10 3M14 21l6-16M10 9h4M9 15h4" />
                            </Icon>
                        }
                    >
                        {loading ? (
                            <Skeleton lines={3} />
                        ) : road ? (
                            <div className="cs-road-card">
                                <div className="cs-road-card__main">
                                    <p className="cs-road-card__name">
                                        {road.name?.trim() || "Tuyến đường chưa đặt tên"}
                                    </p>
                                    <div className="cs-chip-group">
                                        {road.ref && <span className="cs-chip cs-chip--primary">{road.ref}</span>}
                                        <span className="cs-chip">{FCLASS_LABEL[road.fclass] ?? road.fclass}</span>
                                        {road.oneway === "F" || road.oneway === "T" ? (
                                            <span className="cs-chip cs-chip--neutral">1 chiều</span>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="cs-road-card__meta">
                                    <span>Cách {formatDistance(road.distance_m)}</span>
                                    {road.maxspeed && road.maxspeed > 0 && (
                                        <>
                                            <span className="cs-dot">•</span>
                                            <span>Tối đa {road.maxspeed} km/h</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className="cs-muted">Không có dữ liệu đường xá xung quanh.</p>
                        )}
                    </Section>
                )}

                {/* Khối POI gần đây */}
                {showPois && (
                    <Section
                        title="Địa điểm xung quanh"
                        badge={pois?.length}
                        icon={
                            <Icon>
                                <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16M3 21h18M9 7h1m-1 4h1m-1 4h1m4-8h1m-1 4h1m-1 4h1" />
                            </Icon>
                        }
                    >
                        {poisLoading ? (
                            <Skeleton lines={4} />
                        ) : pois && pois.length > 0 ? (
                            <ul className="cs-poi-list">
                                {pois.map((poi) => {
                                    const hasSv = poi.streetview_id != null;
                                    return (
                                        <li key={String(poi.id)} className="cs-poi-item">
                                            <button
                                                type="button"
                                                className="cs-poi-item__action"
                                                onClick={() => onPoiClick?.(poi)}
                                            >
                                                <div className="cs-poi-item__content">
                                                    <span className="cs-poi-item__title">
                                                        {poi.name?.trim() || "Chưa đặt tên"}
                                                    </span>
                                                    <div className="cs-poi-item__details">
                                                        {poi.category && (
                                                            <span className="cs-poi-item__cat">
                                                                {categoryLabel(poi.category)}
                                                            </span>
                                                        )}
                                                        <span className="cs-poi-item__dist">
                                                            {formatDistance(poi.distance_m)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                            {hasSv && onPoiStreetView && (
                                                <button
                                                    type="button"
                                                    className="cs-btn-360"
                                                    onClick={() => onPoiStreetView(poi.streetview_id!)}
                                                    title={
                                                        poi.streetview_distance_m != null
                                                            ? `Xem 360° (${formatDistance(poi.streetview_distance_m)})`
                                                            : "Xem ảnh 360°"
                                                    }
                                                >
                                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <circle cx="12" cy="12" r="9" />
                                                        <path d="M3.6 9h16.8M3.6 15h16.8" />
                                                    </svg>
                                                    360°
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="cs-muted">Không tìm thấy địa điểm lân cận.</p>
                        )}
                    </Section>
                )}

                {/* Khối Ảnh 360 */}
                {/* Khối Ảnh toàn cảnh gần nhất */}
                {showSv && (
                    <Section
                        title="Ảnh toàn cảnh gần nhất"
                        icon={
                            <Icon>
                                <circle cx="12" cy="12" r="9" />
                                <path d="M3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 0 0 0 18 14.5 14.5 0 0 0 0-18z" />
                            </Icon>
                        }
                    >
                        {loading ? (
                            <Skeleton lines={2} />
                        ) : streetview ? (
                            <div className="cs-sv-card">
                                <div className="cs-sv-card__info">
                                    <span className="cs-sv-card__title">Ảnh toàn cảnh #{streetview.id}</span>
                                    <span className="cs-sv-card__sub">Khoảng cách: {formatDistance(streetview.distance_m)}</span>
                                </div>
                                {onOpenStreetView && (
                                    <button
                                        type="button"
                                        className="cs-btn cs-btn--primary"
                                        onClick={() => onOpenStreetView(streetview.id)}
                                    >
                                        Mở xem panorama
                                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                                            <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className="cs-muted">Không có dữ liệu 360° khu vực này.</p>
                        )}
                    </Section>
                )}
            </div>
        </aside>
    );
}