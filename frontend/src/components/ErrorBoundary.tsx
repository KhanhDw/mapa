import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
    children: ReactNode;
    /** Gọi khi user bấm "Tải lại bản đồ" — dùng để bump key remount toàn bộ subtree */
    onReset?: () => void;
    /** Tùy chọn: override fallback UI */
    fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // Log đầy đủ để debug — giữ cả componentStack
        console.error("[ErrorBoundary]", error, info.componentStack);
    }

    reset = () => {
        // Clear error local (fallback nếu consumer không truyền onReset)
        this.setState({ error: null });
        // Trigger remount ở consumer (xoá sạch state con)
        this.props.onReset?.();
    };

    render() {
        if (this.state.error) {
            if (this.props.fallback) {
                return this.props.fallback(this.state.error, this.reset);
            }
            return (
                <div
                    role="alert"
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                        height: "100%",
                        padding: 32,
                        background: "#09090b",
                        color: "#fafafa",
                        fontFamily:
                            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    }}
                >
                    <h2 style={{ margin: 0, fontSize: 18 }}>Bản đồ gặp sự cố</h2>
                    <p
                        style={{
                            margin: 0,
                            fontSize: 13,
                            color: "#a1a1aa",
                            maxWidth: 480,
                            textAlign: "center",
                            lineHeight: 1.5,
                        }}
                    >
                        {this.state.error.message || "Đã xảy ra lỗi không xác định."}
                    </p>
                    <button
                        type="button"
                        onClick={this.reset}
                        style={{
                            marginTop: 8,
                            padding: "8px 16px",
                            fontSize: 13,
                            fontWeight: 500,
                            border: "none",
                            borderRadius: 6,
                            background: "#2563eb",
                            color: "#fff",
                            cursor: "pointer",
                        }}
                    >
                        Tải lại bản đồ
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}