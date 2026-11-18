
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export class ApiError extends Error {
    status: number;
    detail: unknown;

    constructor(status: number, message: string, detail?: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.detail = detail;
    }
}

/**
 * Chuẩn hóa URL:
 * - Hỗ trợ base URL rỗng (cùng origin).
 * - Hỗ trợ base URL có hoặc không có /api.
 * - Tránh trường hợp /api/api/...
 * - Không thay đổi absolute URL.
 */
function normalizeUrl(url: string): string {
    const input = url.trim();

    if (/^https?:\/\//i.test(input)) {
        return input;
    }

    const path = `/${input.replace(/^\/+/, "")}`;

    if (!API_BASE_URL) {
        return path;
    }

    const base = API_BASE_URL.replace(/\/+$/, "");

    if (base.endsWith("/api") && (path === "/api" || path.startsWith("/api/"))) {
        return `${base}${path.slice(4)}`;
    }

    return `${base}${path}`;
}

/**
 * Chuyển lỗi FastAPI thành thông báo dễ đọc.
 *
 * FastAPI có thể trả:
 * - detail: string
 * - detail: array (validation errors)
 * - detail: object
 */
function getErrorMessage(detail: unknown, status: number): string {
    if (typeof detail === "string" && detail.trim()) {
        return detail;
    }

    if (Array.isArray(detail)) {
        const messages = detail.map((item) => {
            if (typeof item === "string") return item;

            if (item && typeof item === "object") {
                const error = item as Record<string, unknown>;
                const location = Array.isArray(error.loc)
                    ? error.loc.join(" → ")
                    : "";

                const message =
                    typeof error.msg === "string"
                        ? error.msg
                        : "Dữ liệu không hợp lệ";

                return location ? `${location}: ${message}` : message;
            }

            return String(item);
        });

        return messages.join("; ") || `Lỗi HTTP ${status}`;
    }

    if (detail && typeof detail === "object") {
        const error = detail as Record<string, unknown>;

        if (typeof error.message === "string") {
            return error.message;
        }

        if (typeof error.msg === "string") {
            return error.msg;
        }
    }

    return `Lỗi HTTP ${status}`;
}

/**
 * Đọc nội dung response lỗi.
 */
async function parseErrorResponse(response: Response): Promise<ApiError> {
    let detail: unknown;

    try {
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
            const body = await response.json();
            detail = body?.detail ?? body;
        } else {
            const body = await response.text();
            detail = body || undefined;
        }
    } catch {
        detail = undefined;
    }

    return new ApiError(
        response.status,
        getErrorMessage(detail, response.status),
        detail
    );
}

/**
 * Kiểm tra request body có phải JSON string hay không.
 * Không tự đặt Content-Type cho FormData, Blob hoặc URLSearchParams.
 */
function isJsonBody(body: BodyInit | null | undefined): boolean {
    return typeof body === "string";
}

class ApiClient {
    /**
     * Gửi HTTP request đến backend.
     *
     * API key không được tự động thêm ở đây.
     * Từng API ghi dữ liệu phải chủ động truyền X-API-Key.
     */
    async request<T>(
        url: string,
        init: RequestInit = {}
    ): Promise<T> {
        const requestUrl = normalizeUrl(url);

        const headers = new Headers(init.headers);

        if (isJsonBody(init.body) && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }

        const response = await fetch(requestUrl, {
            ...init,
            headers,
        });

        if (!response.ok) {
            throw await parseErrorResponse(response);
        }

        // HTTP 204: No Content
        if (response.status === 204) {
            return undefined as T;
        }

        // HTTP 205: Reset Content
        if (response.status === 205) {
            return undefined as T;
        }

        // Response không có nội dung.
        if (response.headers.get("content-length") === "0") {
            return undefined as T;
        }

        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
            return (await response.json()) as T;
        }

        // Hỗ trợ response text hoặc binary nếu có API sử dụng.
        return (await response.text()) as T;
    }
}

export const apiClient = new ApiClient();
