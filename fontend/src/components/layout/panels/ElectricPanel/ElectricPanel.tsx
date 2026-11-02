import { useState } from "react";
import { PoleList } from "./PoleList";
import { PoleDetail } from "./PoleDetail";
import "./ElectricPanel.css";

// Định nghĩa Types dựa trên dữ liệu ảnh
export interface PoleData {
    id: string; // Mã trụ
    route: string; // Tuyến đường
    status: "good" | "warning" | "error"; // Tình trạng hiện tại
    statusLabel: string;
    updatedAt: string; // Ngày cập nhật
    location: { lat: number; lng: number };
    images: string[];
    incidentCount: number;
    incidentLevel: "low" | "medium" | "high";
    dataStatus: "verified" | "pending"; // Trạng thái dữ liệu

    // Thông tin người nhập/cập nhật
    inputBy: { name: string; phone: string; zalo: string };
    updateContent?: string;

    // Sự cố (nếu có)
    incidents: Array<{
        id: string;
        type: string; // Loại sự cố
        description: string;
        media: string[];
        reporter: string;
        phone: string;
        date: string;
    }>;
}

interface Props {
    onClose: () => void;
}

export function ElectricPanel({ onClose }: Props) {
    const [view, setView] = useState<"list" | "detail">("list");
    const [selectedPole, setSelectedPole] = useState<PoleData | null>(null);

    const handleSelectPole = (pole: PoleData) => {
        setSelectedPole(pole);
        setView("detail");
    };

    const handleBack = () => {
        setView("list");
        setSelectedPole(null);
    };

    return (
        <aside className="coord-sidebar electric-panel" aria-label="Quản lý trụ điện">
            {view === "list" ? (
                <PoleList
                    onSelect={handleSelectPole}
                    onClose={onClose}
                />
            ) : (
                <PoleDetail
                    pole={selectedPole!}
                    onBack={handleBack}
                    onClose={onClose}
                />
            )}
        </aside>
    );
}