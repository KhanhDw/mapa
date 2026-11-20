import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  StreetViewImage,
  StreetViewUpdate,
} from "../../../../../api/streetview";

import {
  deleteStreetViewImage,
  getNearbyStreetView,
  getStreetViewImages,
  updateStreetViewImage,
} from "../../../../../api/streetview";

// ======================================================
// FEATURE FLAGS
// ======================================================


// ======================================================
// TYPES & CONSTANTS
// ======================================================

export type LinkFilter = "all" | "linked" | "isolated";

export type Mode = "list" | "create" | "detail";

export interface ImageDraft {
  heading: string;
  lng: string;
  lat: string;
  captured_at: string;
}

const PAGE_SIZE = 50;

const makeEmptyDraft = (): ImageDraft => ({
  heading: "",
  lng: "",
  lat: "",
  captured_at: "",
});

// ======================================================
// HELPERS
// ======================================================

const pad = (n: number) => String(n).padStart(2, "0");

export const errMsg = (e: unknown): string => {
  if (typeof e === "object" && e !== null && "response" in e) {
    const response = (
      e as {
        response?: {
          data?: {
            detail?: string;
            message?: string;
          };
          status?: number;
        };
      }
    ).response;

    const message = response?.data?.detail || response?.data?.message;

    if (message) return message;

    if (response?.status) {
      return `Lỗi máy chủ (${response.status})`;
    }
  }

  return e instanceof Error ? e.message : "Đã có lỗi xảy ra";
};

/**
 * ISO datetime -> datetime-local input.
 */
export function toLocalInput(
  iso: string | null | undefined,
): string {
  if (!iso) return "";

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return "";

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/**
 * StreetViewImage -> ImageDraft.
 */
export function toDraft(img: StreetViewImage): ImageDraft {
  return {
    heading: img.heading == null ? "" : String(img.heading),
    lng: img.lng == null ? "" : String(img.lng),
    lat: img.lat == null ? "" : String(img.lat),
    captured_at: toLocalInput(img.captured_at),
  };
}



/**
 * Kiểm tra tọa độ hợp lệ.
 */
function parseCoordinate(value: string): number | null {
  const normalized = value.trim().replace(",", ".");

  if (!normalized) return null;

  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

// ======================================================
// useStreetViewManagement
// LIST / EDIT / CREATE / DELETE
// ======================================================

export interface UseStreetViewManagementProps {
  isRecordingLocation: boolean;

  onStartLocationRecording: (
    cb: (loc: { lng: number; lat: number }) => void,
  ) => void;

  onStopLocationRecording: () => void;

  onChanged: () => void;
}

export function useStreetViewManagement({
  isRecordingLocation,
  onStartLocationRecording,
  onStopLocationRecording,
  onChanged,
}: UseStreetViewManagementProps) {
  // ====================================================
  // LIST
  // ====================================================

  const [images, setImages] = useState<StreetViewImage[]>([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ====================================================
  // SEARCH & FILTER
  // ====================================================

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [filter, setFilter] = useState<LinkFilter>("all");

  // ====================================================
  // API KEY
  // ====================================================

const [apiKey, setApiKey] = useState("");
  const [apiKeyError, setApiKeyError] = useState(false);

  // ====================================================
  // NAVIGATION
  // ====================================================

  const [mode, setMode] = useState<Mode>("list");

  const [selected, setSelected] = useState<StreetViewImage | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<
  number | string | null
>(null);

  // ====================================================
  // EDIT
  // ====================================================

  const [editing, setEditing] = useState<StreetViewImage | null>(null);

  const [draft, setDraft] = useState<ImageDraft>(makeEmptyDraft);

  // ====================================================
  // REFS
  // ====================================================

  const requestSeq = useRef(0);

  const recordingRef = useRef(isRecordingLocation);

  const stopRecordingRef = useRef(onStopLocationRecording);

  recordingRef.current = isRecordingLocation;
  stopRecordingRef.current = onStopLocationRecording;

  // Dừng ghi nhận tọa độ khi unmount.
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        stopRecordingRef.current();
      }
    };
  }, []);

  // ====================================================
  // LOAD PAGE
  // ====================================================

  const loadPage = useCallback(
    async (offset: number, isMore = false) => {
      const seq = ++requestSeq.current;

      if (!isMore) {
        setLoading(true);
      }

      try {
        const res = await getStreetViewImages({
          search: debouncedSearch || undefined,
          limit: PAGE_SIZE,
          offset,
        });

        // Bỏ qua request cũ.
        if (seq !== requestSeq.current) return;

        setImages((current) => {
          if (offset === 0) {
            return res.items;
          }

          const seen = new Set(current.map((item) => item.id));

          return [
            ...current,
            ...res.items.filter((item) => !seen.has(item.id)),
          ];
        });

        setTotal(res.total);
        setError(null);
      } catch (e) {
        if (seq === requestSeq.current) {
          setError(errMsg(e));
        }
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [debouncedSearch],
  );

  // ====================================================
  // DEBOUNCE SEARCH
  // ====================================================

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  // ====================================================
  // RELOAD WHEN SEARCH CHANGES
  // ====================================================

  useEffect(() => {
    void loadPage(0);
  }, [loadPage]);

  // ====================================================
  // COMPUTED
  // ====================================================

  const stats = useMemo(() => {
  return {
    total,
    linked: 0,
    isolated: images.length,
  };
}, [images.length, total]);

const visibleImages = useMemo(() => {
  if (filter === "linked") {
    return [];
  }

  return images;
}, [images, filter]);

const hasMore = images.length < total;

 

  const hasEditLocation = Boolean(draft.lng.trim() && draft.lat.trim());

  const editLocationLabel = hasEditLocation
    ? `${Number(draft.lat).toFixed(5)}, ${Number(draft.lng).toFixed(5)}`
    : "Ghi nhận vị trí trên bản đồ";

  // ====================================================
  // DRAFT
  // ====================================================

  const updateDraft = useCallback(
    <K extends keyof ImageDraft>(key: K, value: ImageDraft[K]) => {
      setDraft((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [],
  );

  // ====================================================
  // LOCATION RECORDING
  // ====================================================

  const stopLocationRecording = useCallback(() => {
    if (isRecordingLocation) {
      onStopLocationRecording();
    }
  }, [isRecordingLocation, onStopLocationRecording]);

  const applyLocation = useCallback(
    ({ lng, lat }: { lng: number; lat: number }) => {
      setDraft((current) => ({
        ...current,
        lng: String(lng),
        lat: String(lat),
      }));
    },
    [],
  );

  const toggleLocationRecording = useCallback(() => {
    if (isRecordingLocation) {
      onStopLocationRecording();
    } else {
      onStartLocationRecording(applyLocation);
    }
  }, [
    isRecordingLocation,
    onStartLocationRecording,
    onStopLocationRecording,
    applyLocation,
  ]);

  // ====================================================
  // NAVIGATION
  // ====================================================

  const closeEditForm = useCallback(() => {
    stopLocationRecording();

    setEditing(null);
    setDraft(makeEmptyDraft());
    setError(null);
  }, [stopLocationRecording]);

  const beginEdit = useCallback(
    (img: StreetViewImage) => {
      stopLocationRecording();

      setSelected(null);
      setMode("list");
      setConfirmDeleteId(null);

      setEditing(img);
      setDraft(toDraft(img));

      setError(null);
    },
    [stopLocationRecording],
  );

  const openDetail = useCallback(
    (img: StreetViewImage) => {
      stopLocationRecording();

      setEditing(null);
      setDraft(makeEmptyDraft());

      setSelected(img);
      setMode("detail");

      setError(null);
    },
    [stopLocationRecording],
  );

  const startCreate = useCallback(() => {
    stopLocationRecording();

    setEditing(null);
    setSelected(null);

    setApiKeyError(false);
    setMode("create");

    setError(null);
  }, [stopLocationRecording]);

  const closeCreate = useCallback(() => {
    stopLocationRecording();

    setMode("list");
    setError(null);
  }, [stopLocationRecording]);

  const handleBack = useCallback(() => {
    if (mode === "create") {
      closeCreate();
    } else {
      setSelected(null);
      setMode("list");
      setError(null);
    }
  }, [mode, closeCreate]);

  // ====================================================
  // REFRESH & PAGINATION
  // ====================================================

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;

    setRefreshing(true);

    await loadPage(0);
  }, [refreshing, loadPage]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;

    setLoadingMore(true);

    void loadPage(images.length, true);
  }, [loadingMore, loading, hasMore, images.length, loadPage]);

  // ====================================================
  // CREATE SUCCESS
  // ====================================================

  const handleCreateSuccess = useCallback(() => {
    closeCreate();

    void loadPage(0);

    onChanged();
  }, [closeCreate, loadPage, onChanged]);

  // ====================================================
  // SUBMIT EDIT
  // ====================================================

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      if (!editing || busy) return;

      if (!apiKey.trim()) {
        setApiKeyError(true);
        setError("Vui lòng nhập API key để lưu thay đổi");
        return;
      }

      setApiKeyError(false);

      const lng = parseCoordinate(draft.lng);
      const lat = parseCoordinate(draft.lat);

      if (lng === null || lat === null) {
        setError("Kinh độ và vĩ độ phải là số hợp lệ");
        return;
      }

      if (lng < -180 || lng > 180) {
        setError("Kinh độ phải trong khoảng -180 đến 180");
        return;
      }

      if (lat < -90 || lat > 90) {
        setError("Vĩ độ phải trong khoảng -90 đến 90");
        return;
      }

     let heading: number | undefined;

if (draft.heading.trim()) {
  const raw = Number(
    draft.heading.trim().replace(",", "."),
  );

  if (!Number.isFinite(raw) || raw < 0 || raw > 360) {
    setError("Hướng phải trong khoảng 0–360°");
    return;
  }

  heading = raw % 360;
}

      let captured_at: string | null = null;

      if (draft.captured_at) {
        const date = new Date(draft.captured_at);

        if (Number.isNaN(date.getTime())) {
          setError("Thời gian chụp không hợp lệ");
          return;
        }

        captured_at = date.toISOString();
      }

      const updateData: StreetViewUpdate = {
  lng,
  lat,
  captured_at,
};

if (heading !== undefined) {
  updateData.heading = heading;
}

      setBusy(true);
      setError(null);

      try {
        const updated = await updateStreetViewImage(
          editing.id,
          updateData,
          apiKey.trim(),
        );

        closeEditForm();

        await loadPage(0);

        onChanged();

        if (selected?.id === updated.id) {
          setSelected(updated);
        }
      } catch (err) {
        setError(errMsg(err));
      } finally {
        setBusy(false);
      }
    },
    [
      editing,
      busy,
      apiKey,
      draft,
      closeEditForm,
      loadPage,
      onChanged,
      selected,
    ],
  );

  // ====================================================
  // DELETE
  // ====================================================

  const handleDelete = useCallback(
    async (img: StreetViewImage) => {
      if (busy) return;

      if (!apiKey.trim()) {
        setApiKeyError(true);
        setConfirmDeleteId(null);

        setError("Vui lòng nhập API key để thực hiện xóa");

        return;
      }

      setApiKeyError(false);

      setBusy(true);
      setError(null);

      try {
        await deleteStreetViewImage(img.id, apiKey.trim());

        if (editing?.id === img.id) {
          closeEditForm();
        }

        if (selected?.id === img.id) {
          setSelected(null);
          setMode("list");
        }

        setConfirmDeleteId(null);

        await loadPage(0);

        onChanged();
      } catch (err) {
        setError(errMsg(err));
      } finally {
        setBusy(false);
        setConfirmDeleteId(null);
      }
    },
    [busy, apiKey, editing, selected, closeEditForm, loadPage, onChanged],
  );

  // ====================================================
  // RETURN
  // ====================================================

  return {
    // List
    images,
    total,
    loading,
    loadingMore,
    refreshing,
    error,

    // Search & filter
    search,
    setSearch,
    filter,
    setFilter,

    // API key
    apiKey,
    setApiKey,
    apiKeyError,
    setApiKeyError,

    // Navigation
    mode,
    selected,
    setSelected,
    confirmDeleteId,
    setConfirmDeleteId,

    // Edit
    editing,
    draft,
    busy,
    isRecording: isRecordingLocation,

    // Computed
    stats,
    visibleImages,
    hasMore,
    hasEditLocation,
    editLocationLabel,

    // Actions
    updateDraft,
    stopLocationRecording,
    toggleLocationRecording,
    closeEditForm,
    beginEdit,
    openDetail,
    startCreate,
    closeCreate,
    handleBack,
    handleRefresh,
    handleLoadMore,
    handleSubmit,
    handleDelete,
    handleCreateSuccess,
  };
}

// ======================================================
// useStreetViewDetail
// DETAIL PANEL
// ======================================================

export interface UseStreetViewDetailOptions {
  onRefreshImage: (img: StreetViewImage) => void;
  onReloadList: () => void;
}

export function useStreetViewDetail(
  image: StreetViewImage,
) {
  // ====================================================
  // STATE
  // ====================================================

  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");

  const [nearby, setNearby] = useState<StreetViewImage[]>([]);

  const [loadingNearby, setLoadingNearby] = useState(false);

  const timer = useRef<number | undefined>(undefined);

  // ====================================================
  // CLEANUP
  // ====================================================

  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current);
    };
  }, []);

  // ====================================================
  // FETCH NEARBY
  // ====================================================

  useEffect(() => {
  let active = true;

  if (image.lng == null || image.lat == null) {
    setNearby([]);
    setLoadingNearby(false);

    return () => {
      active = false;
    };
  }

  setLoadingNearby(true);
  setNearby([]);

  getNearbyStreetView({
    lng: image.lng,
    lat: image.lat,
    radius: 60,
    exclude_id: image.id,
    limit: 20,
  })
    .then((res) => {
      if (active) {
        setNearby(res.items);
      }
    })
    .catch(() => {
      if (active) {
        setNearby([]);
      }
    })
    .finally(() => {
      if (active) {
        setLoadingNearby(false);
      }
    });

  return () => {
    active = false;
  };
}, [image.id, image.lng, image.lat]);

  // ====================================================
  // COPY COORDINATES
  // ====================================================

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${image.lat}, ${image.lng}`);

      setCopyState("ok");
    } catch {
      setCopyState("fail");
    }

    window.clearTimeout(timer.current);

    timer.current = window.setTimeout(() => {
      setCopyState("idle");
    }, 2000);
  }, [image.lat, image.lng]);





  // ====================================================
  // RETURN
  // ====================================================

  return {
  copyState,
  nearby,
  loadingNearby,
  handleCopy,
};
}
