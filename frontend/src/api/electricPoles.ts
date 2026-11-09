import { API_BASE } from "../config";

export type ElectricPoleStatus = "good" | "warning" | "error";

export interface ElectricPole {
    id: number;
    pole_code: string;
    route: string;
    status: ElectricPoleStatus;
    detail: string | null;
    lng: number;
    lat: number;
    created_at: string;
    updated_at: string;
}

export interface ElectricPoleInput {
    pole_code: string;
    route: string;
    status: ElectricPoleStatus;
    detail: string | null;
    lng: number;
    lat: number;
}

async function ensureSuccess(response: Response): Promise<void> {
    if (response.ok) return;

    const body = await response.text();
    let message = `Yêu cầu thất bại (HTTP ${response.status})`;
    if (body) {
        try {
            const parsed: { detail?: unknown } = JSON.parse(body);
            if (typeof parsed.detail === "string") message = parsed.detail;
        } catch {
            message = body;
        }
    }
    throw new Error(message);
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    await ensureSuccess(response);
    return response.json() as Promise<T>;
}

function writeHeaders(apiKey: string): HeadersInit {
    return {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
    };
}

export async function fetchElectricPoles(): Promise<ElectricPole[]> {
    const result = await requestJson<{ items: ElectricPole[] }>(
        `${API_BASE}/api/electric-poles`
    );
    return result.items;
}

export function createElectricPole(
    pole: ElectricPoleInput,
    apiKey: string
): Promise<ElectricPole> {
    return requestJson(`${API_BASE}/api/electric-poles`, {
        method: "POST",
        headers: writeHeaders(apiKey),
        body: JSON.stringify(pole),
    });
}

export function updateElectricPole(
    id: number,
    pole: ElectricPoleInput,
    apiKey: string
): Promise<ElectricPole> {
    return requestJson(`${API_BASE}/api/electric-poles/${id}`, {
        method: "PUT",
        headers: writeHeaders(apiKey),
        body: JSON.stringify(pole),
    });
}

export async function deleteElectricPole(
    id: number,
    apiKey: string
): Promise<void> {
    const response = await fetch(`${API_BASE}/api/electric-poles/${id}`, {
        method: "DELETE",
        headers: writeHeaders(apiKey),
    });
    await ensureSuccess(response);
}
