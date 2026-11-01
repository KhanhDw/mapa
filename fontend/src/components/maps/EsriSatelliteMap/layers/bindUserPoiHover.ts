import { Popup, type Map as MapLibreMap } from "maplibre-gl";

const LAYER_ID = "lay-user-pois";

function esc(s: unknown): string {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
    );
}

export function bindUserPoiHover(map: MapLibreMap): void {
    const popup = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: [0, -44],       // nằm phía trên đầu pin
        maxWidth: "260px",
    });

    map.on("mouseenter", LAYER_ID, (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f || f.geometry.type !== "Point") return;
        const p = f.properties ?? {};
        const html =
            `<strong>${esc(p.name || "Chưa đặt tên")}</strong>` +
            `<div style="font-size:12px;color:#92400e">Địa điểm do người dùng đóng góp</div>` +
            (p.address ? `<div style="font-size:12px">${esc(p.address)}</div>` : "");
        popup
            .setLngLat(f.geometry.coordinates as [number, number])
            .setHTML(html)
            .addTo(map);
    });

    map.on("mouseleave", LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
    });
}