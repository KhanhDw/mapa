import { useEffect, useMemo, useState } from "react";
import {
    ReactPhotoSphereViewer,
    type PluginConfig,
} from "react-photo-sphere-viewer";
import { EquirectangularAdapter } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
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

interface MarkerCfg {
    id: string;
    position: { yaw: string; pitch: string };
    html: string;
    anchor: string;
    tooltip: string;
    data: { targetId: number };
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

    const currentNode = allPoints.find((p) => Number(p.id) === Number(currentId));
    const heading = currentNode?.heading ?? 0;

    // ---- DEBUG: in ra khi state thay đổi ----
    useEffect(() => {
        console.log("[SV] allPoints count:", allPoints.length);
        console.log("[SV] startId:", startId, "currentId:", currentId);
        console.log("[SV] currentNode:", currentNode);
        if (!currentNode) {
            console.warn(
                "[SV] currentNode KHÔNG tìm thấy. Các id có sẵn:",
                allPoints.map((p) => p.id)
            );
        }
    }, [allPoints, startId, currentId, currentNode]);

    // Prefetch ảnh kế tiếp
    useEffect(() => {
        if (!currentNode) return;
        currentNode.next_ids.forEach((id) => {
            const t = allPoints.find((p) => Number(p.id) === Number(id));
            if (t?.image_url) {
                const img = new Image();
                img.src = resolveImageUrl(t.image_url);
            }
        });
    }, [currentNode, allPoints]);

    const markerConfigs = useMemo<MarkerCfg[]>(() => {
        if (!currentNode) return [];

        return currentNode.next_ids
            .map((nextId): MarkerCfg | null => {
                const target = allPoints.find(
                    (p) => Number(p.id) === Number(nextId)
                );
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
    }, [currentNode, allPoints, heading]);

    // Keyboard shortcuts
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
                return;
            }
            if (e.key === "ArrowRight") {
                const firstTargetId = markerConfigs[0]?.data.targetId;
                if (firstTargetId != null) {
                    const target = allPoints.find(
                        (p) => Number(p.id) === Number(firstTargetId)
                    );
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

    const panoSrc = currentNode ? resolveImageUrl(currentNode.image_url) : "";

    const handleReady = (instance: unknown) => {
        console.log("[SV] onReady fired");

        const viewer = instance as {
            getPlugin: (
                p: typeof MarkersPlugin
            ) => InstanceType<typeof MarkersPlugin> | null;
        };
        const plugin = viewer.getPlugin(MarkersPlugin);
        if (!plugin) {
            console.error("[SV] MarkersPlugin không tìm thấy");
            return;
        }

        markerConfigs.forEach((m) =>
            plugin.addMarker(m as Parameters<typeof plugin.addMarker>[0])
        );

        plugin.addEventListener("select-marker", (e) => {
            const ev = e as unknown as {
                marker?: {
                    config?: { data?: { targetId?: number } };
                    data?: { targetId?: number };
                };
            };
            const targetId =
                ev.marker?.config?.data?.targetId ?? ev.marker?.data?.targetId;
            if (targetId == null) return;
            const target = allPoints.find(
                (p) => Number(p.id) === Number(targetId)
            );
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
                {!currentNode ? (
                    <div
                        style={{
                            color: "#fff",
                            padding: 32,
                            textAlign: "center",
                            fontSize: 14,
                        }}
                    >
                        Không tìm thấy ảnh panorama #{currentId}.
                        <br />
                        Có {allPoints.length} ảnh trong dữ liệu.
                    </div>
                ) : (
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
                )}
            </div>
        </div>
    );
}