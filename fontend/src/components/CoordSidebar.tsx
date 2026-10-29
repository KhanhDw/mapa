import "./CoordSidebar.css";

export interface ClickInfo {
    lng: number;
    lat: number;
    zoom: number;
}

interface Props {
    info: ClickInfo | null;
    onClose: () => void;
}

function toDMS(value: number, pos: string, neg: string): string {
    const dir = value >= 0 ? pos : neg;
    const abs = Math.abs(value);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = ((abs - d) * 60 - m) * 60;
    return `${d}° ${m}′ ${s.toFixed(2)}″ ${dir}`;
}

export function CoordSidebar({ info, onClose }: Props) {
    if (!info) return null;

    const decimal = `${info.lat.toFixed(6)}, ${info.lng.toFixed(6)}`;

    return (
        <aside className="coord-sidebar" aria-label="Thông tin điểm đã chọn">
            <header className="coord-sidebar__header">
                <h2>Điểm đã chọn</h2>
                <button
                    type="button"
                    className="coord-sidebar__close"
                    onClick={onClose}
                    aria-label="Đóng"
                >
                    ✕
                </button>
            </header>

            <dl className="coord-sidebar__body">
                <dt>Vĩ độ (Lat)</dt>
                <dd>{info.lat.toFixed(6)}</dd>

                <dt>Kinh độ (Lng)</dt>
                <dd>{info.lng.toFixed(6)}</dd>

                <dt>Độ phút giây</dt>
                <dd>
                    {toDMS(info.lat, "N", "S")}
                    <br />
                    {toDMS(info.lng, "E", "W")}
                </dd>

                <dt>Mức zoom</dt>
                <dd>{info.zoom.toFixed(2)}</dd>
            </dl>

            <button
                type="button"
                className="coord-sidebar__copy"
                onClick={() => navigator.clipboard.writeText(decimal)}
            >
                Sao chép "lat, lng"
            </button>
        </aside>
    );
}