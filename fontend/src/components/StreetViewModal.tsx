import { useEffect, useMemo, useState } from "react";
import {
    ReactPhotoSphereViewer,
    type PluginConfig,
} from "react-photo-sphere-viewer";
import { EquirectangularAdapter } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import "@photo-sphere-viewer/markers-plugin/index.css";
import "./StreetViewModal.css";
import { API_BASE } from "../config";

export interface StreetViewPoint {
    id: number;
    image_url: string;
    heading?: number | null;
    next_ids: number[];
    link_positions: { textureX: number; textureY: number }[];
    lng: number;
    lat: number;
}

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

export function StreetViewModal({
    startId,
    allPoints,
    onClose,
    onNodeChange,
}: StreetViewModalProps) {
    const [currentId, setCurrentId] = useState(startId);

    const currentNode = allPoints.find((p) => p.id === currentId);
    const heading = currentNode?.heading ?? 0;

    // Prefetch ảnh kế tiếp để giảm flash khi chuyển
    useEffect(() => {
        if (!currentNode) return;
        currentNode.next_ids.forEach((id) => {
            const t = allPoints.find((p) => p.id === id);
            if (t?.image_url) {
                const img = new Image();
                img.src = t.image_url.startsWith("http")
                    ? t.image_url
                    : `${API_BASE}${t.image_url}`;
            }
        });
    }, [currentNode, allPoints]);

    // Tính marker cho ảnh hiện tại
    const markerConfigs = useMemo(() => {
        if (!currentNode) return [];

        return currentNode.next_ids
            .map((nextId) => {
                const target = allPoints.find((p) => p.id === nextId);
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
                    data: { targetId: target.id },
                };
            })
            .filter(Boolean) as any[];
    }, [currentNode, allPoints, heading]);

    // Keyboard shortcuts: Esc đóng, → chuyển ảnh đầu tiên
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
                return;
            }
            if (e.key === "ArrowRight") {
                const firstTargetId = markerConfigs[0]?.data?.targetId;
                if (firstTargetId != null) {
                    const target = allPoints.find((p) => p.id === firstTargetId);
                    if (target) {
                        setCurrentId(target.id);
                        onNodeChange?.(target);
                    }
                }
            }
        };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [markerConfigs, allPoints, onClose, onNodeChange]);

    const plugins = useMemo<PluginConfig[]>(() => [[MarkersPlugin, {}]], []);

    const panoSrc = currentNode
        ? currentNode.image_url.startsWith("http")
            ? currentNode.image_url
            : `${API_BASE}${currentNode.image_url}`
        : "";

    const handleReady = (instance: any) => {
        const plugin = instance.getPlugin(MarkersPlugin);
        if (!plugin) {
            console.error("[SV] MarkersPlugin không tìm thấy");
            return;
        }
        markerConfigs.forEach((m) => plugin.addMarker(m));
        plugin.addEventListener("select-marker", (e: any) => {
            const targetId =
                e.marker?.config?.data?.targetId ?? e.marker?.data?.targetId;
            if (targetId == null) return;
            const target = allPoints.find((p) => p.id === targetId);
            if (target) {
                setCurrentId(target.id);
                onNodeChange?.(target);
            }
        });
    };

    return (
        <div className="sv-modal-overlay" onClick={onClose}>
            <div
                className="sv-modal-content"
                onClick={(e) => e.stopPropagation()}
            >
                <button className="sv-modal-close" onClick={onClose}>
                    ✕
                </button>
                <ReactPhotoSphereViewer
                    key={currentId}
                    src={panoSrc}
                    height="85vh"
                    width="100%"
                    adapter={[EquirectangularAdapter, { resolution: 128 }]}
                    plugins={plugins}
                    onReady={handleReady}
                    navbar={["zoom", "caption", "fullscreen"]}
                />
            </div>
        </div>
    );
}