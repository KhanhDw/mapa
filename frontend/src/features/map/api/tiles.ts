

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type MVTTable =
    | "pois"
    | "roads"
    | "streetview"
    | "user_pois"
    | "electric_poles"
    | "wards"
    | "public.pois"
    | "public.vietnam_roads"
    | "public.streetview_images"
    | "user_data.pois"
    | "user_data.electric_poles"
    | "user_data.vietnam_wards_2025";

export interface TileRequestOptions {
    signal?: AbortSignal;
    headers?: HeadersInit;
    params?: Record<
        string,
        string | number | boolean | undefined
    >;
}

export interface TileHeadResponse {
    status: number;
    headers: Headers;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Tạo query string từ params.
 */
function buildQueryParams(
    params?: TileRequestOptions["params"]
): string {
    if (!params) {
        return "";
    }

    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            return;
        }

        query.set(key, String(value));
    });

    const result = query.toString();

    return result ? `?${result}` : "";
}

/**
 * Chuẩn hóa path để tránh:
 * - /api/api/tiles/...
 * - /api/tiles/tiles/...
 */
function normalizeTilePath(path: string): string {
    let normalized = path.trim().replace(/^\/+/, "");

    if (normalized.startsWith("api/")) {
        normalized = normalized.slice(4);
    }

    return normalized;
}

/**
 * Tạo URL cho tile.
 */
function buildTileUrl(
    prefix: "/api/tiles" | "/api/basemap",
    path: string,
    params?: TileRequestOptions["params"]
): string {
    const normalized = normalizeTilePath(path);

    return `${prefix}/${normalized}${buildQueryParams(params)}`;
}

/**
 * Kiểm tra MVT table hợp lệ.
 */
function validateMVTTable(table: string): asserts table is MVTTable {
    const allowedTables: MVTTable[] = [
        "pois",
        "roads",
        "streetview",
        "user_pois",
        "electric_poles",
        "wards",
        "public.pois",
        "public.vietnam_roads",
        "public.streetview_images",
        "user_data.pois",
        "user_data.electric_poles",
        "user_data.vietnam_wards_2025",
    ];

    if (!allowedTables.includes(table as MVTTable)) {
        throw new Error(`MVT table không hợp lệ: ${table}`);
    }
}

/* -------------------------------------------------------------------------- */
/* Tile Proxy                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/tiles/{path}
 *
 * Lấy tile thông qua backend proxy.
 * Response được đọc dưới dạng ArrayBuffer.
 */
export async function getTile(
    path: string,
    options: TileRequestOptions = {}
): Promise<ArrayBuffer> {
    const url = buildTileUrl(
        "/api/tiles",
        path,
        options.params
    );

    const response = await fetch(url, {
        method: "GET",
        headers: options.headers,
        signal: options.signal,
    });

    if (!response.ok) {
        throw new Error(
            `Không thể tải tile: HTTP ${response.status}`
        );
    }

    return response.arrayBuffer();
}

/**
 * HEAD /api/tiles/{path}
 *
 * Kiểm tra sự tồn tại và metadata của tile.
 */
export async function headTile(
    path: string,
    options: TileRequestOptions = {}
): Promise<TileHeadResponse> {
    const url = buildTileUrl(
        "/api/tiles",
        path,
        options.params
    );

    const response = await fetch(url, {
        method: "HEAD",
        headers: options.headers,
        signal: options.signal,
    });

    if (!response.ok) {
        throw new Error(
            `Không thể kiểm tra tile: HTTP ${response.status}`
        );
    }

    return {
        status: response.status,
        headers: response.headers,
    };
}

/* -------------------------------------------------------------------------- */
/* Basemap                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/basemap/{path}
 *
 * Lấy tile nền bản đồ.
 */
export async function getBasemapTile(
    path: string,
    options: TileRequestOptions = {}
): Promise<ArrayBuffer> {
    const url = buildTileUrl(
        "/api/basemap",
        path,
        options.params
    );

    const response = await fetch(url, {
        method: "GET",
        headers: options.headers,
        signal: options.signal,
    });

    if (!response.ok) {
        throw new Error(
            `Không thể tải basemap: HTTP ${response.status}`
        );
    }

    return response.arrayBuffer();
}

/**
 * HEAD /api/basemap/{path}
 */
export async function headBasemapTile(
    path: string,
    options: TileRequestOptions = {}
): Promise<TileHeadResponse> {
    const url = buildTileUrl(
        "/api/basemap",
        path,
        options.params
    );

    const response = await fetch(url, {
        method: "HEAD",
        headers: options.headers,
        signal: options.signal,
    });

    if (!response.ok) {
        throw new Error(
            `Không thể kiểm tra basemap: HTTP ${response.status}`
        );
    }

    return {
        status: response.status,
        headers: response.headers,
    };
}

/* -------------------------------------------------------------------------- */
/* MVT                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/mvt/{table}/{z}/{x}/{y}.pbf
 *
 * Lấy vector tile từ backend.
 */
export async function getMVT(
    table: MVTTable,
    z: number,
    x: number,
    y: number,
    options: TileRequestOptions = {}
): Promise<ArrayBuffer> {
    validateMVTTable(table);

    if (
        !Number.isInteger(z) ||
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        z < 0 ||
        z > 18 ||
        x < 0 ||
        y < 0
    ) {
        throw new Error("Tọa độ tile không hợp lệ");
    }

    const tablePath = encodeURIComponent(table);

    const url =
        `/api/mvt/${tablePath}/${z}/${x}/${y}.pbf` +
        buildQueryParams(options.params);

    const response = await fetch(url, {
        method: "GET",
        headers: options.headers,
        signal: options.signal,
    });

    if (!response.ok) {
        throw new Error(
            `Không thể tải MVT: HTTP ${response.status}`
        );
    }

    return response.arrayBuffer();
}

/* -------------------------------------------------------------------------- */
/* Compatibility aliases                                                     */
/* -------------------------------------------------------------------------- */

export const fetchTile = getTile;
export const fetchBasemapTile = getBasemapTile;
export const fetchMVT = getMVT;

export const getVectorTile = getMVT;
export const getBaseTile = getBasemapTile;
