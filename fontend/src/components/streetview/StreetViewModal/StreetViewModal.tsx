import { useEffect, useMemo, useState } from "react";
import {
    ReactPhotoSphereViewer,
    type PluginConfig,
} from "react-photo-sphere-viewer";
import { EquirectangularAdapter, type Viewer } from "@photo-sphere-viewer/core";
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
    const pointsById = useMemo(
        () => new Map(allPoints.map((point) => [Number(point.id), point])),
        [allPoints]
    );
    const currentNode = pointsById.get(Number(currentId));
    const heading = currentNode?.heading ?? 0;

    useEffect(() => {
        if (!currentNode) return;
        currentNode.next_ids.forEach((id) => {
            const target = pointsById.get(Number(id));
            if (target?.image_url) {
                const img = new Image();
                img.src = resolveImageUrl(target.image_url);
            }
        });
    }, [currentNode, pointsById]);

    const markerConfigs = useMemo<MarkerCfg[]>(() => {
        if (!currentNode) return [];

        return currentNode.next_ids
            .map((nextId): MarkerCfg | null => {
                const target = pointsById.get(Number(nextId));
                if (!target) return null;

                const bearing = computeBearing(
                    currentNode.lng,
                    currentNode.lat,
                    target.lng,
                    target.lat
                );

                let yaw = bearing - heading;
                while (yaw > 180) yaw -= 360;
                while (yaw < -180) yaw += 360;

                return {
                    id: `arrow-${target.id}`,
                    position: {
                        yaw: `${yaw.toFixed(1)}deg`,
                        pitch: "-25deg",
                    },
                    html: `<div class="sv-arrow">↑</div>`,
                    anchor: "center center",
                    tooltip: `Đi tới ảnh ${target.id}`,
                    data: { targetId: Number(target.id) },
                };
            })
            .filter((m): m is MarkerCfg => m !== null);
    }, [currentNode, pointsById, heading]);

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
            if (event.key === "ArrowRight" && !isEditing) {
                const firstTargetId = markerConfigs[0]?.data.targetId;
                if (firstTargetId != null) {
                    const nextPoint = pointsById.get(Number(firstTargetId));
                    if (nextPoint) {
                        event.preventDefault();
                        setCurrentId(nextPoint.id);
                        onNodeChange?.(nextPoint);
                    }
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [markerConfigs, pointsById, onClose, onNodeChange]);

    const plugins = useMemo<PluginConfig[]>(() => [[MarkersPlugin, {}]], []);

    const panoSrc = currentNode ? resolveImageUrl(currentNode.image_url) : "";

    const handleReady = (viewer: Viewer) => {
        const plugin = viewer.getPlugin<MarkersPlugin>(MarkersPlugin);
        if (!plugin) {
            console.error("[StreetViewModal] MarkersPlugin is unavailable.");
            return;
        }

        markerConfigs.forEach((marker) => plugin.addMarker(marker));

        plugin.addEventListener("select-marker", (event) => {
            const targetId: unknown = event.marker.data?.targetId;
            if (typeof targetId !== "number") return;
            const target = pointsById.get(targetId);
            if (!target) return;
            setCurrentId(target.id);
            onNodeChange?.(target);
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
                <button
                    type="button"
                    className="sv-modal-close"
                    onClick={onClose}
                    aria-label="Đóng ảnh toàn cảnh"
                    title="Đóng"
                    autoFocus
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </button>
                {!currentNode ? (
                    <div className="sv-modal-empty" role="status">
                        <h2>Không tìm thấy ảnh panorama</h2>
                        <p>
                            Ảnh #{currentId} không có trong dữ liệu hiện tại
                            ({allPoints.length} ảnh).
                        </p>
                    </div>
                ) : (
                    <ReactPhotoSphereViewer
                        key={currentId}
                        src={panoSrc}
                        height="100%"
                        width="100%"
                        adapter={[EquirectangularAdapter, { resolution: 128 }]}
                        plugins={plugins}
                        onReady={handleReady}
                        navbar={["zoom", "caption", "fullscreen"]}
                    />
                )}
            </div>
        </div>
    );
}