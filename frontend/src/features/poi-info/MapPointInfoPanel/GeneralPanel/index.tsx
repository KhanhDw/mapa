import { useEffect, useRef, useState } from "react";
import { X, MapPin, Crosshair } from "lucide-react";
import type { Props, CoordFormat } from "../types";
import { useCopy } from "./useCopy";
import {
    CoordinatesSection,
    AddressSection,
    RoadSection,
    PolesSection,
    PoisSection,
    StreetviewSection,
    ErrorBanner,
} from "./sections";
import "./index.css";

/* ---------- HEADER ---------- */

function Header({
    onClose, subtitle, live = false,
}: { onClose: () => void; subtitle: string; live?: boolean }) {
    return (
        <header className="coord-sidebar__header">
            <div className="cs-header-brand">
                <div className="cs-header-brand__icon"><MapPin size={17} /></div>
                <div className="cs-header-brand__content">
                    <h2>Thông tin vị trí</h2>
                    <p>{live && <span className="cs-live-dot" />}{subtitle}</p>
                </div>
            </div>
            <button
                type="button"
                className="coord-sidebar__close"
                onClick={onClose}
                aria-label="Đóng"
                title="Đóng"
            >
                <X size={17} />
            </button>
        </header>
    );
}

/* ---------- EMPTY STATE ---------- */

function EmptyState({
    panelRef, onClose, onKeyDown,
}: {
    panelRef: React.RefObject<HTMLElement | null>;
    onClose: () => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
}) {
    return (
        <aside ref={panelRef} className="coord-sidebar" aria-label="Thông tin vị trí" onKeyDown={onKeyDown}>
            <Header onClose={onClose} subtitle="Chưa chọn điểm trên bản đồ" />
            <div className="cs-empty-state">
                <div className="cs-empty-state__icon"><Crosshair size={28} strokeWidth={1.5} /></div>
                <h3 className="cs-empty-state__title">Chưa chọn vị trí</h3>
                <p className="cs-empty-state__desc">
                    Nhấp vào một điểm bất kỳ trên bản đồ để kiểm tra tọa độ, địa chỉ, hạ tầng và các địa điểm lân cận.
                </p>
                <div className="cs-empty-hint">
                    <MapPin size={14} />
                    <span>Chọn điểm trên bản đồ để bắt đầu</span>
                </div>
            </div>
        </aside>
    );
}

/* ---------- MAIN ---------- */

export function GeneralPanel({
    info, onClose, road, streetview, address, pois, nearbyPoles,
    loading = false, roadLoading, streetviewLoading,
    addressLoading = false, poisLoading = false, error = null,
    onOpenStreetView, onPoleClick, onPoiClick, onPoiDetails, onPoiStreetView,
}: Props) {
    const [format, setFormat] = useState<CoordFormat>("decimal");
    const [addressExpanded, setAddressExpanded] = useState(false);
    const [showAllPois, setShowAllPois] = useState(false);
    const panelRef = useRef<HTMLElement | null>(null);

    const infoKey = info ? `${info.lng}|${info.lat}` : "";
    const { copy, getStatus } = useCopy(infoKey);

    useEffect(() => {
        setAddressExpanded(false);
        setShowAllPois(false);
    }, [infoKey]);

    const handleCloseKey = (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key !== "Escape") return;
        const target = e.target as Node | null;
        if (panelRef.current && target && panelRef.current.contains(target)) {
            e.stopPropagation();
            onClose();
        }
    };

    if (!info) {
        return <EmptyState panelRef={panelRef} onClose={onClose} onKeyDown={handleCloseKey} />;
    }

    const latDecimal = info.lat.toFixed(6);
    const lngDecimal = info.lng.toFixed(6);

    return (
        <aside
            ref={panelRef}
            className="coord-sidebar"
            aria-label="Thông tin vị trí đã chọn"
            onKeyDown={handleCloseKey}
        >
            <Header onClose={onClose} subtitle="Đang phân tích điểm được chọn" live />

            <div className="coord-sidebar__scroll">
                <CoordinatesSection
                    info={info}
                    format={format}
                    onFormatChange={setFormat}
                    copy={copy}
                    getStatus={getStatus}
                />

                {error && <ErrorBanner error={error} />}

                <AddressSection
                    address={address}
                    loading={addressLoading}
                    expanded={addressExpanded}
                    onToggleExpanded={() => setAddressExpanded(v => !v)}
                    copy={copy}
                    getStatus={getStatus}
                />

                <RoadSection road={road} loading={roadLoading ?? loading} />

                <PolesSection poles={nearbyPoles} onPoleClick={onPoleClick} />

                <PoisSection
                    pois={pois}
                    loading={poisLoading}
                    showAll={showAllPois}
                    onToggleShowAll={() => setShowAllPois(v => !v)}
                    onPoiClick={onPoiClick}
                    onPoiDetails={onPoiDetails}
                    onPoiStreetView={onPoiStreetView}
                />

                <StreetviewSection
                    streetview={streetview}
                    loading={streetviewLoading ?? loading}
                    onOpenStreetView={onOpenStreetView}
                />

                <footer className="cs-panel-footer">
                    <span>GIS FEATURE INSPECTOR</span>
                    <span>Lat {latDecimal} · Lng {lngDecimal}</span>
                </footer>
            </div>
        </aside>
    );
}