// api/http/ApiClient.ts

export class ApiClient {
    private static instance: ApiClient;

    private constructor() {}

    public static getInstance(): ApiClient {
        if (!ApiClient.instance) {
            ApiClient.instance = new ApiClient();
        }

        return ApiClient.instance;
    }

    public async request<T>(
        url: string,
        init: RequestInit = {}
    ): Promise<T> {
        const response = await fetch(url, init);

        if (!response.ok) {
            let message = `Lỗi ${response.status}`;

            try {
                const body = await response.json();

                if (typeof body?.detail === "string") {
                    message = body.detail;
                }
            } catch {
                // Ignore JSON parsing errors
            }

            throw new Error(message);
        }

        if (response.status === 204) {
            return undefined as T;
        }

        return response.json() as Promise<T>;
    }
}

export const apiClient = ApiClient.getInstance();