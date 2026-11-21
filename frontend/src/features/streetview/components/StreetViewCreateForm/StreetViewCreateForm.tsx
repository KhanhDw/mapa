
import { useStreetViewCreate } from "./hooks/useStreetViewCreate";

interface CreateFormProps {
  isRecordingLocation: boolean;
  onStartLocationRecording: (
    callback: (loc: { lng: number; lat: number }) => void
  ) => void;
  onStopLocationRecording: () => void;
  onSuccess: () => void;
  onCancel: () => void;
}

export function StreetViewCreateForm({
  isRecordingLocation,
  onStartLocationRecording,
  onStopLocationRecording,
  onSuccess,
  onCancel,
}: CreateFormProps) {
  const {
    panoDraft,
    panoPreviewUrl,
    busy,
    error,
    hasPanoLocation,
    panoLocationLabel,
    updateDraft,
    createPanorama,
    toggleLocationRecording,
  } = useStreetViewCreate({
    isRecordingLocation,
    onStartLocationRecording,
    onStopLocationRecording,
    onSuccess,
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void createPanorama();
  };

  return (
    <form className="sv-form" onSubmit={handleSubmit}>
      <h3 className="sv-form__title">
        Ảnh 360° Street View mới
      </h3>

      <button
        type="button"
        className={`sv-location-btn${
          isRecordingLocation ? " is-recording" : ""
        }${hasPanoLocation ? " has-value" : ""}`}
        onClick={toggleLocationRecording}
      >
        <MapPinIcon size={16} />
        <span>
          {isRecordingLocation
            ? "Đang chờ click bản đồ để lấy tọa độ… (bấm để hủy)"
            : panoLocationLabel}
        </span>
      </button>

      <div className="sv-form__row">
        <label className="sv-field">
          <span>Kinh độ (Lng) *</span>
          <input
            inputMode="decimal"
            value={panoDraft.lng}
            onChange={(e) =>
              updateDraft({ lng: e.target.value })
            }
            placeholder="VD: 105.12345"
          />
        </label>

        <label className="sv-field">
          <span>Vĩ độ (Lat) *</span>
          <input
            inputMode="decimal"
            value={panoDraft.lat}
            onChange={(e) =>
              updateDraft({ lat: e.target.value })
            }
            placeholder="VD: 10.12345"
          />
        </label>
      </div>

      <label className="sv-field">
        <span>Hướng nhìn ban đầu (Heading: 0–360°)</span>
        <input
          inputMode="decimal"
          value={panoDraft.heading}
          onChange={(e) =>
            updateDraft({ heading: e.target.value })
          }
          placeholder="VD: 90"
        />
      </label>

      <label className="sv-field">
        <span>Tệp ảnh 360° *</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) =>
            updateDraft({
              file: e.target.files?.[0] || null,
            })
          }
        />
      </label>

      {panoPreviewUrl && (
        <div
          className="sv-detail-preview"
          style={{ marginTop: "8px" }}
        >
          <img
            src={panoPreviewUrl}
            alt="Xem trước panorama"
            style={{
              width: "100%",
              borderRadius: "6px",
              display: "block",
            }}
          />
        </div>
      )}

      {error && (
        <div
          className="sv-alert"
          role="alert"
          aria-live="polite"
        >
          <AlertIcon />
          <span>{error}</span>
        </div>
      )}

      <div className="sv-form__actions">
        <button
          type="submit"
          className="sv-btn sv-btn--primary"
          disabled={busy}
        >
          {busy
            ? "Đang tải lên và xử lý ảnh…"
            : "Xác nhận thêm ảnh 360°"}
        </button>

        <button
          type="button"
          className="sv-btn"
          onClick={onCancel}
        >
          Hủy bỏ
        </button>
      </div>
    </form>
  );
}

const svg = (size = 18) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

const MapPinIcon = ({ size = 18 }: { size?: number }) => (
  <svg {...svg(size)}>
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const AlertIcon = () => (
  <svg {...svg(16)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);
