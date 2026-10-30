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

/** Khớp hợp đồng GET /api/point-info (osm_id là chuỗi). */
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

/**
 * Quy ước cho road / streetview / address:
 *   undefined = chưa có dữ liệu, không hiện mục đó
 *   null      = đã tải xong nhưng không tìm thấy
 *   có giá trị = hiển thị
 */
interface Props {
    info: ClickInfo | null;
    onClose: () => void;
    road?: RoadInfo | null;
    streetview?: StreetViewHit | null;
    address?: string | null;
    loading?: boolean;
    addressLoading?: boolean;
    error?: string | null;
    onOpenStreetView?: (id: number) => void;
}

type CoordFormat = "decimal" | "dms";
type CopyState = "idle" | "ok" | "fail";

function toDMS(value: number, pos: string, neg: string): string {
    const dir = value >= 0 ? pos : neg;
    const abs = Math.abs(value);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = ((abs - d) * 60 - m) * 60;
    return `${d}° ${m}′ ${s.toFixed(2)}″ ${dir}`;
}

function formatDistance(m: number): string {
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

const FCLASS_LABEL: Record<string, string> = {
    motorway: "Cao tốc",
    trunk: "Quốc lộ",
    primary: "Đường chính",
    secondary: "Đường cấp hai",
    tertiary: "Đường cấp ba",
    residential: "Đường khu dân cư",
    service: "Đường nội bộ",
    unclassified: "Đường chưa phân loại",
    track: "Đường đất",
    path: "Đường mòn",
    footway: "Lối đi bộ",
};

function Icon({ children }: { children: ReactNode }) {
    return (
        <svg
            className="cs-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
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
    children,
}: {
    icon: ReactNode;
    title: string;
    children: ReactNode;
}) {
    return (
        <section className="cs-section">
            <h3 className="cs-section__title">
                {icon}
                {title}
            </h3>
            <div className="cs-section__body">{children}</div>
        </section>
    );
}

function Skeleton({ lines = 2 }: { lines?: number }) {
    return (
        <div className="cs-skeleton" aria-hidden="true">
            {Array.from({ length: lines }, (_, i) => (
                <span key={i} className="cs-skeleton__line" />
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
    loading = false,
    addressLoading = false,
    error = null,
    onOpenStreetView,
}: Props) {
    const [format, setFormat] = useState<CoordFormat>("decimal");
    const [copy, setCopy] = useState<CopyState>("idle");
    const timer = useRef<number | undefined>(undefined);

    // Hook phải đặt trước mọi lệnh return sớm
    useEffect(() => () => window.clearTimeout(timer.current), []);
    useEffect(() => setCopy("idle"), [info?.lat, info?.lng]);

    if (!info) return null;

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

    const roadMeta: string[] = [];
    if (road) {
        roadMeta.push(`Cách ${formatDistance(road.distance_m)}`);
        if (road.maxspeed && road.maxspeed > 0) {
            roadMeta.push(`${road.maxspeed} km/h`);
        }
        if (road.oneway === "F" || road.oneway === "T") {
            roadMeta.push("Một chiều");
        }
    }

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
                    <h2>Vị trí đã chọn</h2>
                    <p className="cs-muted">Mức zoom {info.zoom.toFixed(1)}</p>
                </div>
                <button
                    type="button"
                    className="coord-sidebar__close"
                    onClick={onClose}
                    aria-label="Đóng thanh thông tin"
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path
                            d="M6 6l12 12M18 6L6 18"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            fill="none"
                        />
                    </svg>
                </button>
            </header>

            <div className="coord-sidebar__scroll">
                <div className="cs-coords">
                    <div className="cs-seg" role="group" aria-label="Định dạng tọa độ">
                        <button
                            type="button"
                            aria-pressed={format === "decimal"}
                            onClick={() => setFormat("decimal")}
                        >
                            Thập phân
                        </button>
                        <button
                            type="button"
                            aria-pressed={format === "dms"}
                            onClick={() => setFormat("dms")}
                        >
                            Độ phút giây
                        </button>
                    </div>

                    <div className="cs-coords__value">
                        {format === "decimal" ? (
                            <>
                                <span>{info.lat.toFixed(6)}</span>
                                <span>{info.lng.toFixed(6)}</span>
                            </>
                        ) : (
                            <>
                                <span>{dmsLat}</span>
                                <span>{dmsLng}</span>
                            </>
                        )}
                    </div>

                    <button
                        type="button"
                        className="cs-btn cs-btn--ghost"
                        onClick={handleCopy}
                    >
                        Sao chép tọa độ
                    </button>
                    <p className="cs-copy-status" role="status" aria-live="polite">
                        {copy === "ok" && "Đã sao chép"}
                        {copy === "fail" && "Không sao chép được, hãy chọn và sao chép thủ công"}
                    </p>
                </div>

                {error && (
                    <p className="cs-error" role="alert">
                        Không tải được thông tin điểm ({error}). Click lại trên bản đồ để thử lại.
                    </p>
                )}

                {showAddress && (
                    <Section
                        title="Địa chỉ"
                        icon={
                            <Icon>
                                <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
                                <circle cx="12" cy="10" r="2.4" />
                            </Icon>
                        }
                    >
                        {addressLoading ? (
                            <Skeleton lines={2} />
                        ) : address ? (
                            <p className="cs-text">{address}</p>
                        ) : (
                            <p className="cs-muted">Chưa có địa chỉ cho vị trí này.</p>
                        )}
                    </Section>
                )}

                {showRoad && (
                    <Section
                        title="Đường gần nhất"
                        icon={
                            <Icon>
                                <path d="M8 3L5 21M16 3l3 18M12 4v3M12 10.5v3M12 17v3" />
                            </Icon>
                        }
                    >
                        {loading ? (
                            <Skeleton lines={3} />
                        ) : road ? (
                            <>
                                <p className="cs-text cs-text--strong">
                                    {road.name ?? "Đường chưa đặt tên"}
                                </p>
                                <div className="cs-chips">
                                    {road.ref && (
                                        <span className="cs-chip cs-chip--ref">{road.ref}</span>
                                    )}
                                    <span className="cs-chip">
                                        {FCLASS_LABEL[road.fclass] ?? road.fclass}
                                    </span>
                                </div>
                                <p className="cs-muted">{roadMeta.join(", ")}</p>
                            </>
                        ) : (
                            <p className="cs-muted">Không có đường trong phạm vi tìm kiếm.</p>
                        )}
                    </Section>
                )}

                {showSv && (
                    <Section
                        title="Ảnh 360° gần nhất"
                        icon={
                            <Icon>
                                <circle cx="12" cy="12" r="8.5" />
                                <ellipse cx="12" cy="12" rx="3.6" ry="8.5" />
                                <path d="M3.5 12h17" />
                            </Icon>
                        }
                    >
                        {loading ? (
                            <Skeleton lines={2} />
                        ) : streetview ? (
                            <>
                                <p className="cs-text">
                                    Ảnh số {streetview.id}, cách{" "}
                                    {formatDistance(streetview.distance_m)}
                                </p>
                                {onOpenStreetView && (
                                    <button
                                        type="button"
                                        className="cs-btn cs-btn--primary"
                                        onClick={() => onOpenStreetView(streetview.id)}
                                    >
                                        Xem ảnh 360°
                                    </button>
                                )}
                            </>
                        ) : (
                            <p className="cs-muted">Chưa có ảnh 360° quanh vị trí này.</p>
                        )}
                    </Section>
                )}
            </div>
        </aside>
    );
}