import { useCallback, useEffect, useRef, useState } from "react";
import {
  uploadStreetViewImage,
  type StreetViewUploadResponse,
} from "../../../../../api/streetview";

export interface NewPanoramaDraft {
  lng: string;
  lat: string;
  heading: string;
  file: File | null;
}

interface Location {
  lng: number;
  lat: number;
}

interface UseStreetViewCreateProps {
  apiKey: string;
  setApiKeyError: (value: boolean) => void;
  isRecordingLocation: boolean;
  onStartLocationRecording: (callback: (location: Location) => void) => void;
  onStopLocationRecording: () => void;
  /** `created` được truyền kèm để caller có thể cập nhật map ngay. */
  onSuccess: (created?: StreetViewUploadResponse) => void;
}

const makeEmptyDraft = (): NewPanoramaDraft => ({
  lng: "",
  lat: "",
  heading: "",
  file: null,
});

const getErrorMessage = (error: unknown): string => {
  // Ưu tiên `detail` từ backend (vd. "File vượt quá 50 MB", "Định dạng không hỗ trợ")
  if (error && typeof error === "object") {
    const e = error as {
      response?: { data?: { detail?: unknown } };
      message?: string;
      code?: string;
      name?: string;
    };
    const detail = e.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (e.code === "ERR_NETWORK") return "Không kết nối được tới server";
    if (e.name === "CanceledError" || e.name === "AbortError")
      return "Upload đã bị huỷ";
    if (e.message) return e.message;
  }
  if (error instanceof Error) return error.message;
  return "Đã có lỗi xảy ra";
};

export function useStreetViewCreate({
  apiKey,
  setApiKeyError,
  isRecordingLocation,
  onStartLocationRecording,
  onStopLocationRecording,
  onSuccess,
}: UseStreetViewCreateProps) {
  const [panoDraft, setPanoDraft] = useState<NewPanoramaDraft>(makeEmptyDraft);
  const [panoPreviewUrl, setPanoPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0); // 0–100

  const recordingRef = useRef(isRecordingLocation);
  const stopRecordingRef = useRef(onStopLocationRecording);
  recordingRef.current = isRecordingLocation;
  stopRecordingRef.current = onStopLocationRecording;

  useEffect(() => {
    return () => {
      if (recordingRef.current) stopRecordingRef.current();
    };
  }, []);

  // Preview ảnh
  useEffect(() => {
    if (!panoDraft.file) {
      setPanoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(panoDraft.file);
    setPanoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [panoDraft.file]);

  const updateDraft = useCallback((data: Partial<NewPanoramaDraft>) => {
    setPanoDraft((current) => ({ ...current, ...data }));
    setError(null);
  }, []);

  const applyLocation = useCallback(({ lng, lat }: Location) => {
    setPanoDraft((current) => ({
      ...current,
      lng: String(lng),
      lat: String(lat),
    }));
    setError(null);
  }, []);

  const toggleLocationRecording = useCallback(() => {
    if (isRecordingLocation) {
      onStopLocationRecording();
      return;
    }
    onStartLocationRecording(applyLocation);
  }, [
    isRecordingLocation,
    onStartLocationRecording,
    onStopLocationRecording,
    applyLocation,
  ]);

  const stopLocationRecording = useCallback(() => {
    if (isRecordingLocation) onStopLocationRecording();
  }, [isRecordingLocation, onStopLocationRecording]);

  const resetDraft = useCallback(() => {
    setPanoDraft(makeEmptyDraft());
    setError(null);
    setUploadProgress(0);
  }, []);

  const createPanorama = useCallback(async () => {
    if (busy) return;

    if (!apiKey.trim()) {
      setApiKeyError(true);
      setError("Vui lòng nhập API key để tải lên ảnh mới");
      return;
    }
    setApiKeyError(false);

    if (!panoDraft.file) {
      setError("Vui lòng chọn tệp ảnh 360° panorama");
      return;
    }

    // ----- toạ độ -----
    const cleanLng = panoDraft.lng.trim().replace(",", ".");
    const cleanLat = panoDraft.lat.trim().replace(",", ".");
    const lng = Number(cleanLng);
    const lat = Number(cleanLat);

    if (
      !cleanLng ||
      !cleanLat ||
      !Number.isFinite(lng) ||
      !Number.isFinite(lat) ||
      lng < -180 ||
      lng > 180 ||
      lat < -90 ||
      lat > 90
    ) {
      setError("Vui lòng cung cấp tọa độ hợp lệ");
      return;
    }

    // ----- heading (optional) -----
    let heading: number | null = null;
    if (panoDraft.heading.trim()) {
      const raw = Number(panoDraft.heading.trim().replace(",", "."));
      if (!Number.isFinite(raw) || raw < 0 || raw > 360) {
        setError("Hướng nhìn phải trong khoảng 0–360°");
        return;
      }
      heading = raw % 360;
    }

    setBusy(true);
    setError(null);
    setUploadProgress(0);

    try {
      const created = await uploadStreetViewImage(
        { lng, lat, heading: heading ?? undefined, file: panoDraft.file },
        {
          apiKey: apiKey.trim(),
          onUploadProgress: ({ percent }) => setUploadProgress(percent),
        },
      );

      stopLocationRecording();
      resetDraft();
      onSuccess(created);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
      setUploadProgress(0);
    }
  }, [
    busy,
    apiKey,
    panoDraft,
    setApiKeyError,
    stopLocationRecording,
    resetDraft,
    onSuccess,
  ]);

  const hasPanoLocation = Boolean(panoDraft.lng.trim() && panoDraft.lat.trim());

  const panoLocationLabel = hasPanoLocation
    ? `Đã chọn: ${Number(panoDraft.lat).toFixed(5)}, ${Number(
        panoDraft.lng,
      ).toFixed(5)}`
    : "Bấm để kích hoạt chấm vị trí trên bản đồ";

  return {
    panoDraft,
    panoPreviewUrl,
    busy,
    error,
    uploadProgress, // 0–100, dùng cho progress bar

    hasPanoLocation,
    panoLocationLabel,

    updateDraft,
    setError,
    createPanorama,
    resetDraft,

    toggleLocationRecording,
    stopLocationRecording,
  };
}
