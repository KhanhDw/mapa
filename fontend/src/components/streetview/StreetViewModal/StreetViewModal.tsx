import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

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

/** Một đường nối từ node hiện tại tới node lân cận (đã gộp next + previous). */
interface Link {
    point: StreetViewPoint;
    distance: number; // mét
    bearing: number; // hướng la bàn tuyệt đối 0..360 (0 = Bắc)
}

/* ------------------------------------------------------------------ */
/* Cấu hình                                                            */
/* ------------------------------------------------------------------ */

/** Độ cao camera so với mặt đất (m) – dùng để ước lượng điểm bấm trên đường. */
const CAMERA_HEIGHT_M = 2.5;
/** Chỉ coi là "bấm xuống đường" khi pitch thấp hơn ngưỡng này. */
const GROUND_PITCH_DEG = -7;
/** Góc lệch tối đa giữa điểm bấm và hướng của link khi bấm trên đường. */
const GROUND_CONE_DEG = 40;
/** Góc lệch tối đa để nút / phím "Tiến" và "Lùi" chọn được link. */
const MOVE_CONE_DEG = 80;
const ROTATE_STEP_DEG = 20;
const TRANSITION_MS = 700;
const MAX_PRELOAD = 6;
/**
 * true  → dùng `link_positions` đã lưu (index khớp với `next_ids`) để đặt mũi tên.
 * false → tính vị trí mũi tên từ GPS + heading (mặc định).
 */
const USE_STORED_LINK_POSITIONS = false;

/* ------------------------------------------------------------------ */
/* Hàm tiện ích                                                        */
/* ------------------------------------------------------------------ */

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

/** Đưa góc về khoảng (-180, 180]. */
function normalizeDeg(angle: number): number {
    const a = ((angle % 360) + 360) % 360;
    return a > 180 ? a - 360 : a;
}

function bearingBetween(a: StreetViewPoint, b: StreetViewPoint): number {
    const φ1 = toRad(a.lat);
    const φ2 = toRad(b.lat);
    const Δλ = toRad(b.lng - a.lng);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
        Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function distanceBetween(a: StreetViewPoint, b: StreetViewPoint): number {
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const dLat = lat2 - lat1;
    const dLng = toRad(b.lng - a.lng);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatDistance(distance: number): string {
    if (distance < 1000) return `${Math.max(1, Math.round(distance))} m`;
    return `${(distance / 1000).toFixed(1)} km`;
}

function resolveImageUrl(url: string): string {
    if (url.startsWith("http")) return url;
    return `${API_BASE}${url}`;
}

/**
 * Chọn link phù hợp nhất với một hướng nhìn.
 * Khi biết khoảng cách điểm bấm trên mặt đường (groundDistance), ưu tiên link
 * có khoảng cách gần nhất với điểm đó – giúp phân biệt các node nằm cùng hướng.
 */
function pickLink(
    links: Link[],
    bearing: number,
    maxDiff: number,
    groundDistance?: number
): Link | null {
    let best: Link | null = null;
    let bestScore = Infinity;
    for (const link of links) {
        const diff = Math.abs(normalizeDeg(link.bearing - bearing));
        if (diff > maxDiff) continue;
        const score =
            diff +
            (groundDistance === undefined
                ? 0
                : Math.abs(link.distance - groundDistance) * 1.5);
        if (score < bestScore) {
            best = link;
            bestScore = score;
        }
    }
    return best;
}

/** Tìm link nằm dưới con trỏ (toạ độ tính theo viewer). Null nếu không bấm xuống đường. */
function findLinkAt(
    viewer: Viewer,
    x: number,
    y: number,
    links: Link[],
    heading: number
): Link | null {
    if (links.length === 0) return null;
    try {
        const pos = viewer.dataHelper.viewerCoordsToSphericalCoords({ x, y });
        if (!pos) return null;
        const pitchDeg = toDeg(pos.pitch);
        if (pitchDeg > GROUND_PITCH_DEG) return null;

        const groundDistance = Math.min(
            80,
            CAMERA_HEIGHT_M / Math.tan(toRad(-pitchDeg))
        );
        const bearing = heading + toDeg(pos.yaw);
        return pickLink(links, bearing, GROUND_CONE_DEG, groundDistance);
    } catch {
        return null;
    }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function StreetViewModal({
    startId,
    allPoints,
    onClose,
    onNodeChange,
}: StreetViewModalProps) {
    const [currentId, setCurrentId] = useState(Number(startId));
    const [isNavigating, setIsNavigating] = useState(false);
    const [viewerReady, setViewerReady] = useState(false);
    const [showHint, setShowHint] = useState(true);

    const rootRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const ringRef = useRef<HTMLDivElement>(null);
    const ringLabelRef = useRef<HTMLSpanElement>(null);
    const compassRef = useRef<HTMLDivElement>(null);

    const viewerRef = useRef<Viewer | null>(null);
    const navigationIdRef = useRef(0);
    const pendingTargetRef = useRef<number | null>(null);
    const currentIdRef = useRef(currentId);
    const linksRef = useRef<Link[]>([]);
    const headingRef = useRef(0);
    const navigateRef = useRef<(targetId: number) => void>(() => { });

    /* ---------- Dữ liệu đồ thị ---------- */

    const pointsById = useMemo(
        () => new Map(allPoints.map((p) => [Number(p.id), p])),
        [allPoints]
    );

    /** Đồ thị ngược: node nào trỏ tới node này. Tính một lần thay vì lọc mỗi lần render. */
    const prevIdsMap = useMemo(() => {
        const map = new Map<number, number[]>();
        for (const p of allPoints) {
            for (const id of p.next_ids) {
                const key = Number(id);
                const list = map.get(key);
                if (list) list.push(Number(p.id));
                else map.set(key, [Number(p.id)]);
            }
        }
        return map;
    }, [allPoints]);

    const getNeighbors = useCallback(
        (node: StreetViewPoint) => {
            const next = node.next_ids
                .map((id) => pointsById.get(Number(id)))
                .filter((p): p is StreetViewPoint => Boolean(p));
            const prev = (prevIdsMap.get(Number(node.id)) ?? [])
                .map((id) => pointsById.get(id))
                .filter((p): p is StreetViewPoint => Boolean(p));
            return { next, prev };
        },
        [pointsById, prevIdsMap]
    );

    /**
     * Heading = hướng la bàn của tâm ảnh panorama.
     * Nếu dữ liệu thiếu heading, suy ra từ node lân cận thay vì mặc định 0
     * (mặc định 0 làm mũi tên chỉ sai hướng hoàn toàn).
     */
    const getHeading = useCallback(
        (node: StreetViewPoint): number => {
            if (typeof node.heading === "number" && Number.isFinite(node.heading)) {
                return node.heading;
            }
            const { next, prev } = getNeighbors(node);
            if (next[0]) return bearingBetween(node, next[0]);
            if (prev[0]) return bearingBetween(prev[0], node);
            return 0;
        },
        [getNeighbors]
    );

    const currentNode = pointsById.get(currentId);
    const heading = currentNode ? getHeading(currentNode) : 0;
    const [initialImageUrl] = useState(() => {
        const node = pointsById.get(Number(startId));
        return node ? resolveImageUrl(node.image_url) : "";
    });

    /** Tất cả node lân cận (next + previous, bỏ trùng), gần nhất trước. */
    const links = useMemo<Link[]>(() => {
        if (!currentNode) return [];
        const { next, prev } = getNeighbors(currentNode);
        const unique = new Map<number, StreetViewPoint>();
        [...next, ...prev].forEach((p) => unique.set(Number(p.id), p));
        return Array.from(unique.values())
            .map((point) => ({
                point,
                distance: distanceBetween(currentNode, point),
                bearing: bearingBetween(currentNode, point),
            }))
            .sort((a, b) => a.distance - b.distance);
    }, [currentNode, getNeighbors]);

    linksRef.current = links;
    headingRef.current = heading;
    currentIdRef.current = currentId;

    /* ---------- Đồng bộ la bàn theo hướng nhìn ---------- */

    const syncView = useCallback(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;
        const viewBearing = headingRef.current + toDeg(viewer.getPosition().yaw);
        if (compassRef.current) {
            compassRef.current.style.transform = `rotate(${-viewBearing}deg)`;
        }
    }, []);

    useEffect(() => {
        syncView();
    }, [heading, viewerReady, syncView]);

    /* ---------- Di chuyển giữa các node ---------- */

    const navigateTo = useCallback(
        async (targetId: number) => {
            const viewer = viewerRef.current;
            const current = pointsById.get(currentIdRef.current);
            const target = pointsById.get(Number(targetId));
            if (!viewer || !current || !target || target.id === current.id) return;
            // Đang tải đúng node này rồi → bỏ qua (tránh bấm đúp làm tải lại)
            if (pendingTargetRef.current === target.id) return;

            const requestId = ++navigationIdRef.current;
            pendingTargetRef.current = target.id;

            // Sau khi tới nơi, nhìn theo hướng vừa đi
            const yaw = normalizeDeg(
                bearingBetween(current, target) - getHeading(target)
            );

            setIsNavigating(true);
            try {
                const loaded = await viewer.setPanorama(
                    resolveImageUrl(target.image_url),
                    {
                        position: { yaw: `${yaw}deg`, pitch: "0deg" },
                        zoom: viewer.getZoomLevel(), // giữ nguyên mức zoom, không nhảy
                        transition: {
                            speed: TRANSITION_MS,
                            rotation: true,
                            effect: "fade",
                        },
                    }
                );
                if (!loaded || requestId !== navigationIdRef.current) return;

                currentIdRef.current = target.id;
                setCurrentId(target.id);
                onNodeChange?.(target);
            } catch (error) {
                if (requestId !== navigationIdRef.current) return;
                console.error("[StreetViewModal] Could not load panorama.", error);
                viewer.showError("Không thể tải ảnh Street View này.");
            } finally {
                if (requestId === navigationIdRef.current) {
                    pendingTargetRef.current = null;
                    setIsNavigating(false);
                }
            }
        },
        [getHeading, onNodeChange, pointsById]
    );
    navigateRef.current = (id) => void navigateTo(id);

    /** dir = 1: tiến theo hướng đang nhìn, dir = -1: lùi lại. */
    const moveByView = useCallback((dir: 1 | -1) => {
        const viewer = viewerRef.current;
        if (!viewer) return;
        const viewBearing = headingRef.current + toDeg(viewer.getPosition().yaw);
        const link = pickLink(
            linksRef.current,
            dir === 1 ? viewBearing : viewBearing + 180,
            MOVE_CONE_DEG
        );
        if (link) navigateRef.current(link.point.id);
    }, []);

    /* ---------- Điều khiển camera ---------- */

    const rotateBy = useCallback((deg: number) => {
        const viewer = viewerRef.current;
        if (!viewer) return;
        const pos = viewer.getPosition();
        void viewer.animate({
            yaw: pos.yaw + toRad(deg),
            pitch: pos.pitch,
            speed: 220,
        });
    }, []);

    const faceNorth = useCallback(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;
        void viewer.animate({
            yaw: `${-headingRef.current}deg`,
            pitch: viewer.getPosition().pitch,
            speed: 500,
        });
    }, []);

    /* ---------- Bàn phím (chuẩn Google: ↑↓ đi, ←→ xoay) ---------- */

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const el = event.target;
            const isEditing =
                el instanceof HTMLElement &&
                (el.isContentEditable ||
                    el.matches("input, textarea, select, [role='textbox']"));

            if (event.key === "Escape") {
                onClose();
                return;
            }
            if (isEditing || event.ctrlKey || event.metaKey || event.altKey) return;
            setShowHint(false);

            switch (event.key) {
                case "ArrowUp":
                case "w":
                case "W":
                    event.preventDefault();
                    moveByView(1);
                    break;
                case "ArrowDown":
                case "s":
                case "S":
                    event.preventDefault();
                    moveByView(-1);
                    break;
                case "ArrowLeft":
                case "a":
                case "A":
                    event.preventDefault();
                    rotateBy(-ROTATE_STEP_DEG);
                    break;
                case "ArrowRight":
                case "d":
                case "D":
                    event.preventDefault();
                    rotateBy(ROTATE_STEP_DEG);
                    break;
                case "+":
                case "=":
                    viewerRef.current?.zoomIn(10);
                    break;
                case "-":
                case "_":
                    viewerRef.current?.zoomOut(10);
                    break;
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [moveByView, onClose, rotateBy]);

    /* ---------- Khoá cuộn trang + focus khi mở ---------- */

    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        rootRef.current?.focus();
        return () => {
            document.body.style.overflow = previous;
        };
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => setShowHint(false), 8000);
        return () => window.clearTimeout(timer);
    }, []);

    /* ---------- Tải trước ảnh lân cận ---------- */

    useEffect(() => {
        const controller = new AbortController();
        links.slice(0, MAX_PRELOAD).forEach(({ point }) => {
            if (!point.image_url) return;
            fetch(resolveImageUrl(point.image_url), { signal: controller.signal })
                .then((res) => res.blob())
                .catch(() => { });
        });
        return () => controller.abort();
    }, [links]);

    /* ---------- Mũi tên trên đường ---------- */

    const markerConfigs = useMemo<MarkerCfg[]>(() => {
        if (!currentNode) return [];
        const nextIds = currentNode.next_ids.map(Number);
        const canUseStored =
            USE_STORED_LINK_POSITIONS &&
            currentNode.link_positions?.length === currentNode.next_ids.length;

        return links.map(({ point, distance, bearing }) => {
            const storedIndex = nextIds.indexOf(Number(point.id));
            const stored =
                canUseStored && storedIndex >= 0
                    ? currentNode.link_positions[storedIndex]
                    : null;

            // Càng xa càng gần đường chân trời & nhỏ hơn → cảm giác chiều sâu
            const nearness = clamp(1 - (distance - 4) / 36, 0, 1);
            const pitch = -(14 + 24 * nearness);
            const baseScale = clamp(1.25 - distance / 50, 0.6, 1.15);

            return {
                id: `arrow-${point.id}`,
                position: stored
                    ? { textureX: stored.textureX, textureY: stored.textureY }
                    : {
                        yaw: `${normalizeDeg(bearing - heading).toFixed(1)}deg`,
                        pitch: `${pitch.toFixed(1)}deg`,
                    },
                html: `<div class="sv-arrow" role="button" aria-label="Đi tới ảnh #${point.id}, cách ${formatDistance(distance)}">
                    <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M4 33 24 11l20 22-6 6-14-16-14 16z"/></svg>
                </div>`,
                anchor: "center center",
                scale: (zoomLevel: number) => baseScale * (0.8 + zoomLevel / 200),
                tooltip: `Ảnh #${point.id} · ${formatDistance(distance)}`,
                data: { targetId: Number(point.id) },
            };
        });
    }, [currentNode, heading, links]);

    // Ẩn mũi tên khi đang chuyển cảnh (tránh mũi tên cũ nằm trên ảnh mới)
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewerReady || !viewer) return;
        const plugin = viewer.getPlugin<MarkersPlugin>(MarkersPlugin);
        if (!plugin) return;
        if (isNavigating) plugin.clearMarkers();
        else plugin.setMarkers(markerConfigs);
    }, [viewerReady, isNavigating, markerConfigs]);

    /* ---------- Con trỏ hình vòng tròn trên mặt đường ---------- */

    const hideRing = useCallback(() => {
        ringRef.current?.classList.remove("is-visible");
        stageRef.current?.classList.remove("is-link-hover");
    }, []);

    const handleStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "touch" || event.buttons !== 0) {
            hideRing();
            return;
        }
        if (
            pendingTargetRef.current !== null ||
            (event.target as Element).closest(".sv-ui, .psv-marker")
        ) {
            hideRing();
            return;
        }
        const viewer = viewerRef.current;
        const stage = stageRef.current;
        const ring = ringRef.current;
        if (!viewer || !stage || !ring) return;

        const rect = stage.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const link = findLinkAt(viewer, x, y, linksRef.current, headingRef.current);
        if (!link) {
            hideRing();
            return;
        }
        ring.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        if (ringLabelRef.current) {
            ringLabelRef.current.textContent = formatDistance(link.distance);
        }
        ring.classList.add("is-visible");
        stage.classList.add("is-link-hover");
    };

    /* ---------- Khởi tạo viewer ---------- */

    const plugins = useMemo<PluginConfig[]>(() => [[MarkersPlugin, {}]], []);

    const handleReady = useCallback(
        (viewer: Viewer) => {
            viewerRef.current = viewer;

            const markers = viewer.getPlugin<MarkersPlugin>(MarkersPlugin);
            markers?.addEventListener("select-marker", (event) => {
                const targetId: unknown = event.marker.data?.targetId;
                if (typeof targetId === "number") navigateRef.current(targetId);
            });

            viewer.addEventListener("position-updated", syncView);

            // Bấm (không kéo) xuống mặt đường → đi tới node gần điểm bấm nhất
            viewer.addEventListener("click", ({ data }) => {
                if (data.rightclick) return;
                const link = findLinkAt(
                    viewer,
                    data.viewerX,
                    data.viewerY,
                    linksRef.current,
                    headingRef.current
                );
                if (link) navigateRef.current(link.point.id);
            });

            setViewerReady(true);
        },
        [syncView]
    );

    /* ---------- Render ---------- */

    return (
        <div
            ref={rootRef}
            className="sv-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Xem ảnh toàn cảnh Street View"
            tabIndex={-1}
        >
            {!currentNode ? (
                <div className="sv-empty" role="status">
                    <h2>Không tìm thấy ảnh panorama</h2>
                    <p>
                        Ảnh #{currentId} không có trong dữ liệu hiện tại ({allPoints.length} ảnh).
                    </p>
                    <button type="button" className="sv-empty__close" onClick={onClose}>
                        Đóng
                    </button>
                </div>
            ) : (
                <div
                    ref={stageRef}
                    className="sv-stage"
                    onPointerMove={handleStagePointerMove}
                    onPointerLeave={hideRing}
                    onPointerDown={() => {
                        hideRing();
                        setShowHint(false);
                    }}
                >
                    <ReactPhotoSphereViewer
                        src={initialImageUrl}
                        height="100%"
                        width="100%"
                        adapter={[EquirectangularAdapter, { resolution: 128 }]}
                        plugins={plugins}
                        onReady={handleReady}
                        navbar={false}
                        defaultZoomLvl={45}
                        defaultYaw={0}
                        defaultPitch={0}
                        mousewheel
                        mousemove
                        keyboard={false}
                        defaultTransition={{
                            speed: TRANSITION_MS,
                            rotation: true,
                            effect: "fade",
                        }}
                    />

                    {/* Vòng tròn bám con trỏ trên mặt đường */}
                    <div ref={ringRef} className="sv-ground-ring" aria-hidden="true">
                        <div className="sv-ground-ring__disc" />
                        <span ref={ringLabelRef} className="sv-ground-ring__label" />
                    </div>

                    {isNavigating && <div className="sv-progress" role="progressbar" aria-label="Đang tải ảnh" />}

                    {/* Thẻ vị trí – góc trên trái như Google */}
                    <header className="sv-card sv-ui">
                        <button
                            type="button"
                            className="sv-card__back"
                            onClick={onClose}
                            aria-label="Đóng Street View"
                            title="Đóng (Esc)"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" />
                            </svg>
                        </button>
                        <div className="sv-card__text">
                            <strong>Street View</strong>
                            <span>
                                Ảnh #{currentNode.id} · {currentNode.lat.toFixed(5)}, {currentNode.lng.toFixed(5)}
                            </span>
                        </div>
                    </header>

                    {/* La bàn + zoom – góc dưới phải */}
                    <aside className="sv-controls sv-ui" aria-label="Điều khiển camera">
                        <button
                            type="button"
                            className="sv-compass"
                            onClick={faceNorth}
                            aria-label="Quay về hướng Bắc"
                            title="Quay về hướng Bắc"
                        >
                            <div ref={compassRef} className="sv-compass__dial">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path className="sv-compass__north" d="M12 2 17 13H7z" />
                                    <path className="sv-compass__south" d="M12 22 7 13h10z" />
                                </svg>
                            </div>
                        </button>
                        <div className="sv-zoom">
                            <button
                                type="button"
                                onClick={() => viewerRef.current?.zoomIn(15)}
                                aria-label="Phóng to"
                                title="Phóng to (+)"
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                onClick={() => viewerRef.current?.zoomOut(15)}
                                aria-label="Thu nhỏ"
                                title="Thu nhỏ (−)"
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M19 13H5v-2h14z" />
                                </svg>
                            </button>
                        </div>
                    </aside>
                    {showHint && (
                        <p className="sv-hint" role="note">
                            Kéo để nhìn quanh · Bấm xuống đường hoặc nhấn ↑ để đi tới
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}