import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ReactPhotoSphereViewer,
    type PluginConfig,
} from "react-photo-sphere-viewer";
import {
    EquirectangularAdapter,
    type Viewer,
} from "@photo-sphere-viewer/core";
import {
    MarkersPlugin,
    type MarkerConfig,
} from "@photo-sphere-viewer/markers-plugin";
import "@photo-sphere-viewer/markers-plugin/index.css";
import "./StreetViewModal.css";
import { API_BASE } from "../../../config";

export interface StreetViewPoint {
    id: number;
    image_url: string;
    heading?: number | null;
    next_ids: number[];
    link_positions: { textureX: number; textureY: number }[];
    lng: number;
    lat: number;
}

type MarkerCfg = MarkerConfig & { data: { targetId: number } };

interface StreetViewModalProps {
    startId: number;
    allPoints: StreetViewPoint[];
    onClose: () => void;
    onNodeChange?: (point: StreetViewPoint) => void;
}

function computeBearing(
    lng1: number,
    lat1: number,
    lng2: number,
    lat2: number
): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lng2 - lng1);

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
        Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
}

function distanceBetween(a: StreetViewPoint, b: StreetViewPoint): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const deltaLat = lat2 - lat1;
    const deltaLng = toRad(b.lng - a.lng);
    const haversine =
        Math.sin(deltaLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

    return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatDistance(distance: number): string {
    if (distance < 1000) return `${Math.round(distance)} m`;
    return `${(distance / 1000).toFixed(1)} km`;
}

function resolveImageUrl(url: string): string {
    if (url.startsWith("http")) return url;
    return `${API_BASE}${url}`;
}

export function StreetViewModal({
    startId,
    allPoints,
    onClose,
    onNodeChange,
}: StreetViewModalProps) {
    const [currentId, setCurrentId] = useState(startId);
    const [isNavigating, setIsNavigating] = useState(false);
    const viewerRef = useRef<Viewer | null>(null);
    const navigationIdRef = useRef(0);
    const navigationHandlerRef = useRef<(targetId: number) => void>(() => {});
    const pointsById = useMemo(
        () => new Map(allPoints.map((point) => [Number(point.id), point])),
        [allPoints]
    );
    const currentNode = pointsById.get(Number(currentId));
    const heading = currentNode?.heading ?? 0;
    const [initialImageUrl] = useState(() =>
        currentNode ? resolveImageUrl(currentNode.image_url) : ""
    );

    const previousPoints = useMemo(() => {
        if (!currentNode) return [];
        return allPoints
            .filter((point) =>
                point.next_ids.some((id) => Number(id) === Number(currentNode.id))
            )
            .sort(
                (a, b) =>
                    distanceBetween(currentNode, a) - distanceBetween(currentNode, b)
            );
    }, [allPoints, currentNode]);

    const nextPoints = useMemo(
        () =>
            currentNode
                ? currentNode.next_ids
                      .map((id) => pointsById.get(Number(id)))
                      .filter((point): point is StreetViewPoint => Boolean(point))
                : [],
        [currentNode, pointsById]
    );

    useEffect(() => {
        if (!currentNode) return;

        [...nextPoints, ...previousPoints].forEach((point) => {
            if (point.image_url) {
                const img = new Image();
                img.src = resolveImageUrl(point.image_url);
            }
        });
    }, [currentNode, nextPoints, previousPoints]);

    const markerConfigs = useMemo<MarkerCfg[]>(() => {
        if (!currentNode) return [];

        const connections = new Map<number, { point: StreetViewPoint; isPrevious: boolean }>();
        nextPoints.forEach((point) => {
            connections.set(Number(point.id), { point, isPrevious: false });
        });
        previousPoints.forEach((point) => {
            if (!connections.has(Number(point.id))) {
                connections.set(Number(point.id), { point, isPrevious: true });
            }
        });

        return Array.from(connections.values()).map(({ point, isPrevious }) => {
            const distance = distanceBetween(currentNode, point);
            const bearing = computeBearing(
                currentNode.lng,
                currentNode.lat,
                point.lng,
                point.lat
            );
            let yaw = bearing - heading;
            while (yaw > 180) yaw -= 360;
            while (yaw < -180) yaw += 360;

            const scaleByDistance = Math.max(
                0.72,
                Math.min(1.16, 1.16 - distance / 55)
            );
            const label = isPrevious ? "Ảnh trước" : "Ảnh tiếp theo";

            return {
                id: `arrow-${point.id}`,
                position: {
                    yaw: `${yaw.toFixed(1)}deg`,
                    pitch: "-25deg",
                },
                html: `<div class="sv-arrow${isPrevious ? " sv-arrow--previous" : ""}" role="button" aria-label="${label} #${point.id}">
                    <svg class="sv-arrow__icon" viewBox="0 0 32 32" aria-hidden="true">
                        <path d="M16 3 28 17h-7v12h-10V17H4L16 3Z" />
                    </svg>
                </div>`,
                anchor: "center center",
                scale: (zoomLevel) =>
                    scaleByDistance * (0.78 + zoomLevel / 220),
                tooltip: `${label} #${point.id} · ${formatDistance(distance)}`,
                data: { targetId: Number(point.id) },
            };
        });
    }, [currentNode, heading, nextPoints, previousPoints]);

    const navigateTo = useCallback(
        async (targetId: number) => {
            const target = pointsById.get(Number(targetId));
            const current = pointsById.get(Number(currentId));
            const viewer = viewerRef.current;
            if (!target || !current || target.id === current.id || !viewer) return;

            const requestId = ++navigationIdRef.current;
            const distance = distanceBetween(current, target);
            const bearing = computeBearing(
                current.lng,
                current.lat,
                target.lng,
                target.lat
            );
            let yaw = bearing - (target.heading ?? 0);
            while (yaw > 180) yaw -= 360;
            while (yaw < -180) yaw += 360;
            const zoom = Math.max(30, Math.min(56, 56 - distance * 0.45));

            setIsNavigating(true);
            try {
                const loaded = await viewer.setPanorama(
                    resolveImageUrl(target.image_url),
                    {
                        position: { yaw: `${yaw}deg`, pitch: "0deg" },
                        zoom,
                        transition: {
                            speed: 1200,
                            rotation: true,
                            effect: "fade",
                        },
                    }
                );
                if (!loaded || requestId !== navigationIdRef.current) return;

                setCurrentId(target.id);
                onNodeChange?.(target);
            } catch (error) {
                if (requestId !== navigationIdRef.current) return;
                console.error("[StreetViewModal] Could not load the next panorama.", error);
                viewer.showError("Không thể tải ảnh Street View tiếp theo.");
            } finally {
                if (requestId === navigationIdRef.current) setIsNavigating(false);
            }
        },
        [currentId, onNodeChange, pointsById]
    );
    useEffect(() => {
        navigationHandlerRef.current = (targetId) => {
            void navigateTo(targetId);
        };
    }, [navigateTo]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target;
            const isEditing =
                target instanceof HTMLElement &&
                (target.isContentEditable ||
                    target.matches("input, textarea, select, [role='textbox']"));

            if (event.key === "Escape") {
                onClose();
                return;
            }
            if (isEditing) return;
            if (event.key === "ArrowLeft" && previousPoints[0]) {
                event.preventDefault();
                navigateTo(previousPoints[0].id);
            } else if (event.key === "ArrowRight" && nextPoints[0]) {
                event.preventDefault();
                navigateTo(nextPoints[0].id);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [navigateTo, nextPoints, onClose, previousPoints]);

    useEffect(() => {
        if (!currentNode || !viewerRef.current) return;
        const plugin = viewerRef.current.getPlugin<MarkersPlugin>(MarkersPlugin);
        plugin?.setMarkers(markerConfigs);
    }, [currentNode, markerConfigs]);

    const plugins = useMemo<PluginConfig[]>(() => [[MarkersPlugin, {}]], []);
    const handleReady = (viewer: Viewer) => {
        viewerRef.current = viewer;
        const plugin = viewer.getPlugin<MarkersPlugin>(MarkersPlugin);
        if (!plugin) {
            console.error("[StreetViewModal] MarkersPlugin is unavailable.");
            return;
        }

        plugin.setMarkers(markerConfigs);
        plugin.addEventListener("select-marker", (event) => {
            const targetId: unknown = event.marker.data?.targetId;
            if (typeof targetId === "number") {
                navigationHandlerRef.current(targetId);
            }
        });
    };

    return (
        <div
            className="sv-modal-overlay"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                className="sv-modal-content"
                role="dialog"
                aria-modal="true"
                aria-label="Xem ảnh toàn cảnh"
                tabIndex={-1}
            >
                {!currentNode ? (
                    <div className="sv-modal-empty" role="status">
                        <h2>Không tìm thấy ảnh panorama</h2>
                        <p>
                            Ảnh #{currentId} không có trong dữ liệu hiện tại
                            ({allPoints.length} ảnh).
                        </p>
                    </div>
                ) : (
                    <>
                        <ReactPhotoSphereViewer
                            src={initialImageUrl}
                            height="100%"
                            width="100%"
                            adapter={[EquirectangularAdapter, { resolution: 128 }]}
                            plugins={plugins}
                            onReady={handleReady}
                            navbar={["zoom", "caption", "fullscreen"]}
                            defaultZoomLvl={45}
                            defaultYaw={0}
                            defaultPitch={0}
                            mousewheel
                            mousemove
                            keyboard={false}
                            defaultTransition={{
                                speed: 1200,
                                rotation: true,
                                effect: "fade",
                            }}
                        />
                        <div className="sv-modal-topbar">
                            <div className="sv-modal-location">
                                <span className="sv-modal-kicker">STREET VIEW</span>
                                <strong>Ảnh #{currentNode.id}</strong>
                            </div>
                            <button
                                type="button"
                                className="sv-modal-close"
                                onClick={onClose}
                                aria-label="Đóng ảnh toàn cảnh"
                                title="Đóng"
                            >
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </button>
                        </div>
                        <div className="sv-modal-bottom">
                            <p className="sv-modal-hint">
                                Kéo để nhìn quanh <span>·</span> Cuộn để phóng to
                                <span>·</span> Dùng phím ← →
                            </p>
                            <nav className="sv-navigation" aria-label="Điều hướng Street View">
                                <button
                                    type="button"
                                    className="sv-navigation-button"
                                    onClick={() => previousPoints[0] && navigateTo(previousPoints[0].id)}
                                    disabled={!previousPoints[0] || isNavigating}
                                    title={
                                        previousPoints[0]
                                            ? `Quay lại ảnh #${previousPoints[0].id}`
                                            : "Không có ảnh trước"
                                    }
                                >
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="m15 18-6-6 6-6" />
                                    </svg>
                                    <span>
                                        <strong>Quay lại</strong>
                                        <small>{previousPoints[0] ? `Ảnh #${previousPoints[0].id}` : "Không có ảnh trước"}</small>
                                    </span>
                                </button>
                                <span className="sv-navigation-divider" aria-hidden="true" />
                                <button
                                    type="button"
                                    className="sv-navigation-button sv-navigation-button--next"
                                    onClick={() => nextPoints[0] && navigateTo(nextPoints[0].id)}
                                    disabled={!nextPoints[0] || isNavigating}
                                    title={
                                        nextPoints[0]
                                            ? `Đi tới ảnh #${nextPoints[0].id}`
                                            : "Không có ảnh tiếp theo"
                                    }
                                >
                                    <span>
                                        <strong>Đi tiếp</strong>
                                        <small>{nextPoints[0] ? `Ảnh #${nextPoints[0].id}` : "Không có ảnh tiếp theo"}</small>
                                    </span>
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="m9 18 6-6-6-6" />
                                    </svg>
                                </button>
                            </nav>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
