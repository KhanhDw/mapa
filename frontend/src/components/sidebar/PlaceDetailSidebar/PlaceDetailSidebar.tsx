import { useEffect, useState } from "react";
import type { PoiInfo } from "../CoordSidebar/CoordSidebar";
import "./PlaceDetailSidebar.css";

interface UserPoiDetails {
    address: string | null;
    phone: string | null;
    description: string | null;
    photos: Array<{
        id: number;
        url: string | null;
        thumb_url: string | null;
        width: number | null;
        height: number | null;
    }>;
}

interface Props {
    place: PoiInfo;
    apiBase: string;
    onBack: () => void;
    onClose: () => void;
    onOpenStreetView?: (id: number) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
    an_uong: "Ăn uống",
    y_te: "Y tế",
    giao_duc: "Giáo dục",
    tai_chinh: "Tài chính",
    mua_sam: "Mua sắm",
    du_lich: "Du lịch",
    hanh_chinh: "Hành chính",
    khac: "Khác",
};

function formatDistance(distance: number): string {
    return distance < 1000
        ? `${Math.round(distance)} m`
        : `${(distance / 1000).toFixed(1)} km`;
}

function categoryLabel(category: string | null): string | null {
    if (!category) return null;
    return CATEGORY_LABELS[category] ?? category.replaceAll("_", " ");
}

export function PlaceDetailSidebar({
    place,
    apiBase,
    onBack,
    onClose,
    onOpenStreetView,
}: Props) {
    const isUserPlace = place.source === "user";
    const userPoiId = isUserPlace ? Number(place.id) : null;
    const validUserPoiId =
        userPoiId !== null && Number.isSafeInteger(userPoiId) && userPoiId > 0;
    const detailKey = `${place.source ?? "osm"}:${place.id}`;
    const [result, setResult] = useState<{
        key: string;
        details: UserPoiDetails | null;
        error: string | null;
    }>({ key: "", details: null, error: null });

    useEffect(() => {
        if (!isUserPlace || userPoiId === null || !validUserPoiId) return;

        const controller = new AbortController();
        fetch(
            `${apiBase.replace(/\/+$/, "")}/api/user-pois/${userPoiId}`,
            { signal: controller.signal }
        )
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json() as Promise<UserPoiDetails>;
            })
            .then((details) => setResult({ key: detailKey, details, error: null }))
            .catch((error: Error) => {
                if (error.name !== "AbortError") {
                    setResult({
                        key: detailKey,
                        details: null,
                        error: error.message || "Không thể tải thông tin địa điểm.",
                    });
                }
            });

        return () => controller.abort();
    }, [apiBase, detailKey, isUserPlace, userPoiId, validUserPoiId]);

    const details = result.key === detailKey ? result.details : null;
    const detailError =
        result.key === detailKey
            ? result.error
            : isUserPlace && !validUserPoiId
              ? "Mã địa điểm người dùng không hợp lệ."
              : null;
    const detailLoading =
        isUserPlace && validUserPoiId && result.key !== detailKey;
    const name = place.name?.trim() || "Địa điểm chưa đặt tên";
    const category = categoryLabel(place.fclass ?? place.category);
    const streetviewId = place.streetview_id;

    return (
        <aside
            className="place-detail-sidebar"
            aria-label={`Chi tiết địa điểm: ${name}`}
            onKeyDown={(event) => {
                if (event.key === "Escape") onBack();
            }}
        >
            <header className="place-detail-sidebar__header">
                <button
                    type="button"
                    className="place-detail-sidebar__back"
                    onClick={onBack}
                    aria-label="Quay lại thông tin vị trí"
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Quay lại</span>
                </button>
                <button
                    type="button"
                    className="place-detail-sidebar__close"
                    onClick={onClose}
                    aria-label="Đóng thông tin địa điểm"
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                </button>
            </header>

            <div className="place-detail-sidebar__scroll">
                <section className="place-detail-hero">
                    <span className={`place-detail-source${isUserPlace ? " is-user" : ""}`}>
                        <span className="place-detail-source__dot" />
                        {isUserPlace ? "Người dùng đóng góp" : "Hệ thống · OpenStreetMap"}
                    </span>
                    <h2>{name}</h2>
                    {category && <span className="place-detail-category">{category}</span>}
                </section>

                <section className="place-detail-section" aria-labelledby="place-location-title">
                    <h3 id="place-location-title">Vị trí</h3>
                    <dl className="place-detail-coordinates">
                        <div>
                            <dt>Vĩ độ (LAT)</dt>
                            <dd>{place.lat.toFixed(6)}</dd>
                        </div>
                        <div>
                            <dt>Kinh độ (LNG)</dt>
                            <dd>{place.lng.toFixed(6)}</dd>
                        </div>
                    </dl>
                    <div className="place-detail-meta">
                        <span>Mã địa điểm</span>
                        <code>{place.id}</code>
                    </div>
                    <div className="place-detail-meta">
                        <span>Cách vị trí đã chọn</span>
                        <strong>{formatDistance(place.distance_m)}</strong>
                    </div>
                </section>

                {isUserPlace && (
                    <section className="place-detail-section" aria-labelledby="place-contribution-title">
                        <h3 id="place-contribution-title">Thông tin đóng góp</h3>
                        {detailLoading ? (
                            <p className="place-detail-muted" role="status">Đang tải thông tin...</p>
                        ) : detailError ? (
                            <p className="place-detail-error" role="alert">
                                Không thể tải thông tin bổ sung ({detailError}).
                            </p>
                        ) : details ? (
                            <div className="place-detail-extra">
                                {details.address && (
                                    <div className="place-detail-field">
                                        <span>Địa chỉ</span>
                                        <p>{details.address}</p>
                                    </div>
                                )}
                                {details.phone && (
                                    <div className="place-detail-field">
                                        <span>Số điện thoại</span>
                                        <a href={`tel:${details.phone}`}>{details.phone}</a>
                                    </div>
                                )}
                                {details.description && (
                                    <div className="place-detail-field">
                                        <span>Mô tả</span>
                                        <p>{details.description}</p>
                                    </div>
                                )}
                                {details.photos.length > 0 && (
                                    <div className="place-detail-field">
                                        <span>Ảnh ({details.photos.length})</span>
                                        <div className="place-detail-photos">
                                            {details.photos.map((photo) => {
                                                const imageUrl = photo.thumb_url ?? photo.url;
                                                return imageUrl ? (
                                                    <a
                                                        key={photo.id}
                                                        href={photo.url ?? imageUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        aria-label={`Mở ảnh địa điểm ${photo.id}`}
                                                    >
                                                        <img src={imageUrl} alt={`Ảnh ${name}`} loading="lazy" />
                                                    </a>
                                                ) : null;
                                            })}
                                        </div>
                                    </div>
                                )}
                                {!details.address && !details.phone && !details.description && details.photos.length === 0 && (
                                    <p className="place-detail-muted">Chưa có thông tin bổ sung.</p>
                                )}
                            </div>
                        ) : null}
                    </section>
                )}

                {onOpenStreetView && streetviewId != null && (
                    <button
                        type="button"
                        className="place-detail-streetview"
                        onClick={() => onOpenStreetView(streetviewId)}
                    >
                        Mở ảnh toàn cảnh 360°
                    </button>
                )}
            </div>
        </aside>
    );
}
