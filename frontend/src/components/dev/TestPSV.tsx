import { useEffect, useState } from "react";
import { ReactPhotoSphereViewer } from "react-photo-sphere-viewer";
import { API_BASE } from "../../config";

export default function TestPSV() {
    const src = `${API_BASE}/panoramas/demo1.png`;
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

    useEffect(() => {
        let cancelled = false;
        const img = new Image();

        img.onload = () => {
            if (!cancelled) setStatus("ready");
        };
        img.onerror = () => {
            if (!cancelled) setStatus("error");
        };

        img.src = src;

        return () => {
            cancelled = true;
            img.onload = null;
            img.onerror = null;
        };
    }, [src]);

    if (status === "error") {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "#a1a1aa",
                    fontSize: 14,
                }}
            >
                Không tải được ảnh demo: {src}
            </div>
        );
    }

    if (status === "loading") {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "#a1a1aa",
                    fontSize: 14,
                }}
            >
                Đang tải ảnh demo...
            </div>
        );
    }

    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <ReactPhotoSphereViewer
                src={src}
                height="100%"
                width="100%"
            />
        </div>
    );
}