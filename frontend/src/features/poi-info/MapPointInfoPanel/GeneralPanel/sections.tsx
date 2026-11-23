import {
    AlertCircle, ArrowUpRight, Building2, ChevronDown, ChevronUp,
    Check, Copy, Globe2, MapPin, Navigation, Route, Zap,
} from "lucide-react";
import { Section, Skeleton } from "../miniComponents";
import { FCLASS_LABEL } from "../contants";
import { categoryLabel, formatDistance, toDMS } from "../helper";
import type { Props, CoordFormat, CopyTarget, CopyState } from "../types";

const INITIAL_POI_LIMIT = 6;

type CopyFn = (target: CopyTarget, text: string) => void;
type GetStatusFn = (target: CopyTarget) => CopyState;

/* ---------- SHARED ---------- */

function CoordRow({
    label, value, ariaLabel, copied, onCopy,
}: {
    label: string; value: string; ariaLabel: string; copied: boolean; onCopy: () => void;
}) {
    return (
        <div className="cs-coords-row">
            <span className="cs-coords-label">{label}</span>
            <div className="cs-coords-value-group">
                <span className="cs-coords-val">{value}</span>
                <button type="button" className="cs-mini-copy" onClick={onCopy} aria-label={ariaLabel} title={ariaLabel}>
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
            </div>
        </div>
    );
}

/* ---------- 1. COORDINATES ---------- */

type CoordinatesSectionProps = {
    info: NonNullable<Props["info"]>;
    format: CoordFormat;
    onFormatChange: (f: CoordFormat) => void;
    copy: CopyFn;
    getStatus: GetStatusFn;
};

export function CoordinatesSection({ info, format, onFormatChange, copy, getStatus }: CoordinatesSectionProps) {
    const latDec = info.lat.toFixed(6);
    const lngDec = info.lng.toFixed(6);
    const latDisp = format === "decimal" ? latDec : toDMS(info.lat, "N", "S");
    const lngDisp = format === "decimal" ? lngDec : toDMS(info.lng, "E", "W");
    const all = getStatus("all");

    return (
        <section className="cs-coordinate-panel" aria-label="Tóm tắt vị trí">
            <div className="cs-coordinate-panel__top">
                <div>
                    <span className="cs-eyebrow">VỊ TRÍ · LOCATION SUMMARY</span>
                    <h3>Tọa độ vị trí</h3>
                </div>
                <span className="cs-zoom-tag" title="Mức zoom bản đồ hiện tại">
                    Zoom {info.zoom.toFixed(1)}
                </span>
            </div>

            <div className="cs-coords-card">
                <div className="cs-coords-card__header">
                    <div className="cs-seg" role="group" aria-label="Định dạng tọa độ">
                        {(["decimal", "dms"] as const).map(f => (
                            <button
                                key={f}
                                type="button"
                                aria-pressed={format === f}
                                className={`cs-seg__tab ${format === f ? "is-active" : ""}`}
                                onClick={() => onFormatChange(f)}
                            >
                                {f === "decimal" ? "Decimal" : "DMS"}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        className={`cs-copy-btn ${all === "ok" ? "is-success" : ""} ${all === "fail" ? "is-error" : ""}`}
                        onClick={() => copy("all", `${latDisp}, ${lngDisp}`)}
                        title="Sao chép toàn bộ tọa độ"
                    >
                        {all === "ok" ? <Check size={13} /> : <Copy size={13} />}
                        {all === "ok" ? "Đã sao chép" : all === "fail" ? "Thử lại" : "Sao chép tọa độ"}
                    </button>
                </div>

                <div className="cs-coords-display">
                    <CoordRow
                        label="VĨ ĐỘ (LAT)" value={latDisp} ariaLabel="Sao chép vĩ độ"
                        copied={getStatus("lat") === "ok"} onCopy={() => copy("lat", latDisp)}
                    />
                    <CoordRow
                        label="KINH ĐỘ (LNG)" value={lngDisp} ariaLabel="Sao chép kinh độ"
                        copied={getStatus("lng") === "ok"} onCopy={() => copy("lng", lngDisp)}
                    />
                </div>

                <span className="cs-visually-hidden" role="status" aria-live="polite">
                    {all === "ok" ? "Đã sao chép toàn bộ tọa độ." : all === "fail" ? "Không thể sao chép tọa độ." : ""}
                </span>
            </div>
        </section>
    );
}

/* ---------- 2. ADDRESS ---------- */

type AddressSectionProps = {
    address: Props["address"];
    loading: boolean;
    expanded: boolean;
    onToggleExpanded: () => void;
    copy: CopyFn;
    getStatus: GetStatusFn;
};

export function AddressSection({ address, loading, expanded, onToggleExpanded, copy, getStatus }: AddressSectionProps) {
    if (!loading && address === undefined) return null;

    const status = getStatus("address");
    const isLong = Boolean(address && address.length > 95);

    return (
        <Section groupLabel="VỊ TRÍ" icon={<MapPin size={15} />} title="Địa chỉ ước tính">
            {loading ? (
                <Skeleton lines={2} />
            ) : address ? (
                <div className="cs-address-card">
                    <div className="cs-address-card__top">
                        <div className="cs-address-card__main">
                            <span className="cs-address-card__icon"><Navigation size={15} /></span>
                            <p className={`cs-address-text ${!expanded && isLong ? "is-clamped" : ""}`}>{address}</p>
                        </div>
                        <button
                            type="button"
                            className={`cs-mini-copy ${status === "ok" ? "is-success" : ""}`}
                            onClick={() => copy("address", address)}
                            aria-label="Sao chép địa chỉ"
                            title={status === "ok" ? "Đã sao chép địa chỉ" : "Sao chép địa chỉ"}
                        >
                            {status === "ok" ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                    </div>
                    {isLong && (
                        <button type="button" className="cs-text-toggle" onClick={onToggleExpanded}>
                            {expanded
                                ? <><ChevronUp size={13} />Thu gọn địa chỉ</>
                                : <><ChevronDown size={13} />Xem đầy đủ địa chỉ</>}
                        </button>
                    )}
                </div>
            ) : (
                <p className="cs-muted">Chưa tìm thấy thông tin địa chỉ.</p>
            )}
        </Section>
    );
}

/* ---------- 3. ROAD ---------- */

type RoadSectionProps = { road: Props["road"]; loading: boolean };

export function RoadSection({ road, loading }: RoadSectionProps) {
    if (!loading && road === undefined) return null;

    const hasOneWay = road?.oneway === "F" || road?.oneway === "T";

    return (
        <Section groupLabel="HẠ TẦNG GIAO THÔNG" icon={<Route size={15} />} title="Tuyến đường gần nhất">
            {loading ? (
                <Skeleton lines={3} />
            ) : road ? (
                <div className="cs-road-card">
                    <div className="cs-road-card__header">
                        <h4 className="cs-road-card__name">{road.name?.trim() || "Tuyến đường chưa đặt tên"}</h4>
                        <span className="cs-road-distance-pill">{formatDistance(road.distance_m)}</span>
                    </div>

                    <div className="cs-chip-group">
                        {road.ref && <span className="cs-chip cs-chip--primary">{road.ref}</span>}
                        <span className="cs-chip">{FCLASS_LABEL[road.fclass] ?? road.fclass}</span>
                        {hasOneWay && (
                            <span className="cs-chip cs-chip--neutral">
                                {road.oneway === "F" ? "Một chiều (thuận)" : "Một chiều (ngược)"}
                            </span>
                        )}
                    </div>

                    <div className="cs-road-card__meta">
                        <span><MapPin size={12} />Cách {formatDistance(road.distance_m)}</span>
                        {road.maxspeed != null && road.maxspeed > 0 && (
                            <span className="cs-road-meta-speed"><Navigation size={12} />Tối đa {road.maxspeed} km/h</span>
                        )}
                    </div>
                </div>
            ) : (
                <p className="cs-muted">Chưa tìm thấy tuyến đường phù hợp xung quanh.</p>
            )}
        </Section>
    );
}

/* ---------- 4. POLES ---------- */

type Pole = NonNullable<Props["nearbyPoles"]>[number];

function PoleRowContent({ pole }: { pole: Pole }) {
    const statusLabel =
        pole.status === "good" ? "Bình thường" :
        pole.status === "warning" ? "Cảnh báo" : "Sự cố";

    return (
        <>
            <span className="cs-poi-avatar cs-poi-avatar--pole"><Zap size={15} /></span>
            <span className="cs-poi-item__content">
                <span className="cs-pole-top-row">
                    <span className="cs-poi-item__title">{pole.pole_code}</span>
                    <span className="cs-pole-dist-right">{formatDistance(pole.distance_m)}</span>
                </span>
                <span className="cs-poi-item__details">
                    <span className="cs-poi-item__cat">{pole.route}</span>
                    <span className={`cs-pole-status cs-pole-status--${pole.status}`}>{statusLabel}</span>
                </span>
                {pole.detail && <span className="cs-muted cs-pole-detail">{pole.detail}</span>}
            </span>
        </>
    );
}

type PolesSectionProps = {
    poles: Props["nearbyPoles"];
    onPoleClick?: Props["onPoleClick"];
};

export function PolesSection({ poles, onPoleClick }: PolesSectionProps) {
    if (!poles || poles.length === 0) return null;

    const sorted = [...poles].sort((a, b) => a.distance_m - b.distance_m);
    const stats = sorted.reduce(
        (acc, p) => {
            if (p.status === "good") acc.good += 1;
            else if (p.status === "warning") acc.warning += 1;
            else acc.error += 1;
            return acc;
        },
        { good: 0, warning: 0, error: 0 }
    );

    return (
        <Section groupLabel="HẠ TẦNG ĐIỆN" icon={<Zap size={15} />} title="Trụ điện gần đây" badge={`${sorted.length} trụ`}>
            <div className="cs-pole-summary" aria-label="Tổng hợp trạng thái trụ điện">
                {(["good", "warning", "error"] as const).map(k => (
                    <span key={k} className={`cs-pole-stat cs-pole-stat--${k}`}>
                        <strong>{String(stats[k]).padStart(2, "0")}</strong>
                        {k === "good" ? "Bình thường" : k === "warning" ? "Cảnh báo" : "Sự cố"}
                    </span>
                ))}
            </div>

            <ul className="cs-poi-list">
                {sorted.map(pole => (
                    <li key={pole.id} className="cs-poi-item cs-pole-item">
                        {onPoleClick ? (
                            <button
                                type="button"
                                className="cs-pole-row-btn"
                                onClick={() => onPoleClick(pole)}
                                aria-label={`Định vị trụ ${pole.pole_code} trên bản đồ`}
                            >
                                <PoleRowContent pole={pole} />
                            </button>
                        ) : (
                            <PoleRowContent pole={pole} />
                        )}
                    </li>
                ))}
            </ul>
        </Section>
    );
}

/* ---------- 5. POIs ---------- */

type PoisSectionProps = {
    pois: Props["pois"];
    loading: boolean;
    showAll: boolean;
    onToggleShowAll: () => void;
    onPoiClick?: Props["onPoiClick"];
    onPoiDetails?: Props["onPoiDetails"];
    onPoiStreetView?: Props["onPoiStreetView"];
};

export function PoisSection({
    pois, loading, showAll, onToggleShowAll, onPoiClick, onPoiDetails, onPoiStreetView,
}: PoisSectionProps) {
    if (!loading && pois === undefined) return null;

    const list = pois ?? [];
    const visible = showAll ? list : list.slice(0, INITIAL_POI_LIMIT);
    const remaining = list.length > INITIAL_POI_LIMIT ? list.length - INITIAL_POI_LIMIT : 0;

    return (
        <Section
            groupLabel="TIỆN ÍCH XUNG QUANH"
            icon={<Building2 size={15} />}
            title="Địa điểm xung quanh"
            badge={pois ? `${pois.length} địa điểm` : undefined}
        >
            {loading ? (
                <Skeleton lines={4} />
            ) : list.length > 0 ? (
                <>
                    <ul className="cs-poi-list">
                        {visible.map(poi => {
                            const labelName = poi.name?.trim() || "Chưa đặt tên";
                            const svId = poi.streetview_id;
                            return (
                                <li key={`${poi.source ?? "osm"}-${poi.id}`} className="cs-poi-item">
                                    <button
                                        type="button"
                                        className="cs-poi-item__action"
                                        onClick={() => onPoiClick?.(poi)}
                                        aria-label={`Định vị ${labelName} trên bản đồ`}
                                    >
                                        <span className="cs-poi-avatar"><MapPin size={15} /></span>
                                        <span className="cs-poi-item__content">
                                            <span className="cs-poi-item__title">{labelName}</span>
                                            <span className="cs-poi-item__details">
                                                {(poi.fclass || poi.category) && (
                                                    <span className="cs-poi-item__cat">
                                                        {categoryLabel(poi.fclass || poi.category)}
                                                    </span>
                                                )}
                                                {poi.source === "user" && (
                                                    <span className="cs-user-badge">Đóng góp</span>
                                                )}
                                                <span className="cs-poi-item__dist">· {formatDistance(poi.distance_m)}</span>
                                            </span>
                                        </span>
                                    </button>

                                    <div className="cs-poi-actions">
                                        {onPoiDetails && (
                                            <button
                                                type="button"
                                                className="cs-icon-action"
                                                onClick={() => onPoiDetails(poi)}
                                                aria-label={`Xem chi tiết ${labelName}`}
                                                title="Chi tiết địa điểm"
                                            >
                                                <ArrowUpRight size={15} />
                                            </button>
                                        )}
                                        {svId != null && onPoiStreetView && (
                                            <button
                                                type="button"
                                                className="cs-360-btn"
                                                onClick={() => onPoiStreetView(svId)}
                                                title={
                                                    poi.streetview_distance_m != null
                                                        ? `Xem 360° (${formatDistance(poi.streetview_distance_m)})`
                                                        : "Xem ảnh 360°"
                                                }
                                            >
                                                <Globe2 size={13} />360°
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    {remaining > 0 && (
                        <button type="button" className="cs-list-more-btn" onClick={onToggleShowAll}>
                            {showAll
                                ? <><ChevronUp size={14} />Thu gọn danh sách</>
                                : <><ChevronDown size={14} />Xem thêm {remaining} địa điểm</>}
                        </button>
                    )}
                </>
            ) : (
                <p className="cs-muted">Không tìm thấy địa điểm lân cận.</p>
            )}
        </Section>
    );
}

/* ---------- 6. STREETVIEW ---------- */

type StreetviewSectionProps = {
    streetview: Props["streetview"];
    loading: boolean;
    onOpenStreetView?: Props["onOpenStreetView"];
};

export function StreetviewSection({ streetview, loading, onOpenStreetView }: StreetviewSectionProps) {
    if (!loading && streetview === undefined) return null;

    return (
        <Section groupLabel="TIỆN ÍCH XUNG QUANH" icon={<Globe2 size={15} />} title="Ảnh toàn cảnh 360°">
            {loading ? (
                <Skeleton lines={2} />
            ) : streetview ? (
                <div className="cs-sv-card">
                    <div className="cs-sv-card__top">
                        <div className="cs-sv-card__visual"><Globe2 size={20} /></div>
                        <div className="cs-sv-card__info">
                            <span className="cs-sv-status">Khả dụng</span>
                            <h4 className="cs-sv-card__title">Panorama #{streetview.id}</h4>
                            <p className="cs-sv-card__sub">
                                Cách vị trí chọn {formatDistance(streetview.distance_m)}
                            </p>
                        </div>
                    </div>
                    {onOpenStreetView && (
                        <button
                            type="button"
                            className="cs-btn cs-btn--primary"
                            onClick={() => onOpenStreetView(streetview.id)}
                        >
                            Mở xem Panorama 360°<ArrowUpRight size={15} />
                        </button>
                    )}
                </div>
            ) : (
                <p className="cs-muted">Không có dữ liệu ảnh 360° tại khu vực này.</p>
            )}
        </Section>
    );
}

/* ---------- ERROR BANNER ---------- */

export function ErrorBanner({ error }: { error: string }) {
    return (
        <div className="cs-alert cs-alert--error" role="alert">
            <AlertCircle size={16} />
            <span>Không thể tải dữ liệu ({error}). Vui lòng thử lại.</span>
        </div>
    );
}