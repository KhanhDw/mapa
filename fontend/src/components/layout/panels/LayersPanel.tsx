import "../../sidebar/CoordSidebar/CoordSidebar.css";

export function LayersPanel({ onClose }: { onClose: () => void }) {
    return (
        <aside className="coord-sidebar" aria-label="Lớp bản đồ">
            <header className="coord-sidebar__header">
                <div>
                    <h2>Lớp bản đồ</h2>
                    <p className="cs-muted">Bật/tắt lớp hiển thị</p>
                </div>
                <button
                    type="button"
                    className="coord-sidebar__close"
                    onClick={onClose}
                    aria-label="Đóng"
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                    </svg>
                </button>
            </header>
            <div className="coord-sidebar__scroll">
                <p className="cs-muted">Tính năng đang phát triển.</p>
            </div>
        </aside>
    );
}