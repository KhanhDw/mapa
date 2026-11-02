import type { ElectricPole } from "../../../../api/electricPoles";
import { PoleDetail } from "./PoleDetail";
import "./ElectricPanel.css";

interface Props {
    pole: ElectricPole | null;
    onClose: () => void;
}

export function ElectricPanel({ pole, onClose }: Props) {
    return (
        <aside className="coord-sidebar electric-panel" aria-label="Thông tin trụ điện">
            <PoleDetail pole={pole} onClose={onClose} />
        </aside>
    );
}