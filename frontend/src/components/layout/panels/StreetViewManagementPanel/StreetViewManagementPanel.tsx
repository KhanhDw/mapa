
import type { StreetViewImage } from "../../../../api/streetview";

import {
  useStreetViewDetail,
  useStreetViewManagement,
} from "./hooks/useStreetViewManagement";

import { StreetViewCreateForm } from "../StreetViewCreateForm/StreetViewCreateForm";

import "./StreetViewManagementPanel.css";

interface Props {
  onClose: () => void;
  onChanged: () => void;

  isRecordingLocation: boolean;

  onStartLocationRecording: (
    cb: (loc: { lng: number; lat: number }) => void
  ) => void;

  onStopLocationRecording: () => void;

  onGoToImage: (image: StreetViewImage) => void;
}

const COMPASS = [
  "Bắc",
  "Đông Bắc",
  "Đông",
  "Đông Nam",
  "Nam",
  "Tây Nam",
  "Tây",
  "Tây Bắc",
];

function headingLabel(h: number | null): string {
  if (h == null) return "Chưa có hướng";

  return `${Math.round(h)}° · ${COMPASS[
    Math.round(h / 45) % 8
  ]}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Không rõ";

  const d = new Date(iso);

  return Number.isNaN(d.getTime())
    ? "Không rõ"
    : d.toLocaleString("vi-VN");
}

export function StreetViewManagementPanel({
  onClose,
  onChanged,
  isRecordingLocation,
  onStartLocationRecording,
  onStopLocationRecording,
  onGoToImage,
}: Props) {
  const m = useStreetViewManagement({
    isRecordingLocation,
    onStartLocationRecording,
    onStopLocationRecording,
    onChanged,
  });

  return (
    <aside
      className="coord-sidebar sv-management sv-dashboard"
      aria-label="Quản lý Street View"
    >
      {/* HEADER */}
      <header className="sv-dashboard__header">
        {m.mode === "list" ? (
          <>
            <div className="sv-dashboard__title">
              <strong>Quản lý Street View</strong>
              <span>Ảnh 360° trên bản đồ</span>
            </div>

            <div className="sv-dashboard__header-actions">
              <button
                type="button"
                className="sv-btn sv-btn--primary"
                style={{
                  padding: "4px 10px",
                  fontSize: "12px",
                  height: "32px",
                }}
                onClick={m.startCreate}
              >
                + Thêm 360°
              </button>

              <button
                type="button"
                className="sv-icon-btn"
                onClick={m.handleRefresh}
                disabled={m.refreshing}
                aria-label="Tải lại"
              >
                <RefreshIcon spinning={m.refreshing} />
              </button>

              <button
                type="button"
                className="sv-icon-btn"
                onClick={onClose}
                aria-label="Đóng"
              >
                <CloseIcon />
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="sv-icon-btn"
              onClick={m.handleBack}
              aria-label="Quay lại"
            >
              <BackIcon />
            </button>

            <div className="sv-dashboard__title">
              <strong>
                {m.mode === "create"
                  ? "Thêm ảnh 360° mới"
                  : `Ảnh #${m.selected?.id ?? ""}`}
              </strong>

              <span>
                {m.mode === "create"
                  ? "Đóng góp panorama"
                  : "Chi tiết panorama"}
              </span>
            </div>

            <button
              type="button"
              className="sv-icon-btn"
              onClick={onClose}
              aria-label="Đóng"
            >
              <CloseIcon />
            </button>
          </>
        )}
      </header>

      {/* DETAIL */}
      {m.mode === "detail" && m.selected ? (
        <ImageDetailView
          image={m.selected}
          confirmDelete={
            m.confirmDeleteId === m.selected.id
          }
          busy={m.busy}
          error={m.error}
          apiKey={m.apiKey}
          onGoToImage={onGoToImage}
          onEdit={() => m.beginEdit(m.selected!)}
          onRequestDelete={() =>
            m.setConfirmDeleteId(m.selected!.id)
          }
          onConfirmDelete={() =>
            m.handleDelete(m.selected!)
          }
          onCancelDelete={() =>
            m.setConfirmDeleteId(null)
          }
          onRefreshImage={m.setSelected}
          onReloadList={() => m.handleRefresh()}
        />
      ) : (
        <div className="coord-sidebar__scroll sv-dashboard__scroll">
          {/* CREATE */}
          {m.mode === "create" ? (
            <StreetViewCreateForm
              apiKey={m.apiKey}
              setApiKey={m.setApiKey}
              apiKeyError={m.apiKeyError}
              setApiKeyError={m.setApiKeyError}
              isRecordingLocation={isRecordingLocation}
              onStartLocationRecording={
                onStartLocationRecording
              }
              onStopLocationRecording={
                onStopLocationRecording
              }
              onSuccess={m.handleCreateSuccess}
              onCancel={m.closeCreate}
            />
          ) : (
            <>
              {/* STATS */}
              <div
                className="sv-stats"
                title="Số liệu thống kê trên các ảnh đã tải"
              >
                <Stat
                  value={m.stats.total}
                  label="Tổng ảnh"
                />

                <Stat
                  value={m.stats.linked}
                  label="Có liên kết"
                  variant="ok"
                />

                <Stat
                  value={m.stats.isolated}
                  label="Chưa liên kết"
                  variant="warn"
                />
              </div>

              {/* API KEY */}
              <label className="sv-field">
                <span>API key (quyền thao tác)</span>

                <input
                  type="password"
                  className={
                    m.apiKeyError
                      ? "sv-input-error"
                      : ""
                  }
                  value={m.apiKey}
                  onChange={(e) => {
                    m.setApiKey(e.target.value);

                    if (m.apiKeyError) {
                      m.setApiKeyError(false);
                    }
                  }}
                  placeholder="Nhập X-API-Key"
                  autoComplete="off"
                />
              </label>

              {/* EDIT */}
              {m.editing && <EditForm mgmt={m} />}

              {/* ERROR */}
              {m.error && (
                <div
                  className="sv-alert"
                  role="alert"
                  aria-live="polite"
                >
                  <AlertIcon />
                  <span>{m.error}</span>
                </div>
              )}

              {/* LIST */}
              <section className="sv-list">
                <div className="sv-list__head">
                  <h3>
                    Danh sách{" "}
                    <span className="sv-count">
                      {m.visibleImages.length}/{m.total}
                    </span>
                  </h3>

                  <div
                    className="sv-chips"
                    role="group"
                    aria-label="Lọc theo liên kết"
                  >
                    <FilterChip
                      active={m.filter === "all"}
                      onClick={() => m.setFilter("all")}
                      label="Tất cả"
                      count={m.images.length}
                    />

                    <FilterChip
                      active={m.filter === "linked"}
                      onClick={() => m.setFilter("linked")}
                      label="Có liên kết"
                      count={m.stats.linked}
                    />

                    <FilterChip
                      active={m.filter === "isolated"}
                      onClick={() => m.setFilter("isolated")}
                      label="Chưa liên kết"
                      count={m.stats.isolated}
                    />
                  </div>

                  <label className="sv-search">
                    <SearchIcon />

                    <input
                      type="search"
                      value={m.search}
                      onChange={(e) =>
                        m.setSearch(e.target.value)
                      }
                      placeholder="Tìm theo ID hoặc đường dẫn ảnh…"
                    />
                  </label>
                </div>

                {/* LOADING */}
                {m.loading ? (
                  <ul
                    className="sv-cards"
                    aria-busy="true"
                  >
                    {[0, 1, 2].map((i) => (
                      <li
                        key={i}
                        className="sv-card sv-card--skeleton"
                      />
                    ))}
                  </ul>
                ) : m.visibleImages.length === 0 ? (
                  <div className="sv-empty">
                    <PanoIcon size={32} />
                    <p>Không có ảnh phù hợp.</p>
                  </div>
                ) : (
                  <>
                    <ul className="sv-cards">
                      {m.visibleImages.map((img) => (
                        <ImageCard
                          key={img.id}
                          img={img}
                          confirmDelete={
                            m.confirmDeleteId === img.id
                          }
                          busy={m.busy}
                          onOpen={() => m.openDetail(img)}
                          onGo={() => onGoToImage(img)}
                          onEdit={() => m.beginEdit(img)}
                          onRequestDelete={() =>
                            m.setConfirmDeleteId(img.id)
                          }
                          onConfirmDelete={() =>
                            m.handleDelete(img)
                          }
                          onCancelDelete={() =>
                            m.setConfirmDeleteId(null)
                          }
                        />
                      ))}
                    </ul>

                    {/* LOAD MORE */}
                    {m.hasMore && (
                      <button
                        type="button"
                        className="sv-btn sv-load-more"
                        onClick={m.handleLoadMore}
                        disabled={m.loadingMore}
                      >
                        {m.loadingMore
                          ? "Đang tải thêm…"
                          : `Tải thêm (còn ${
                              m.total - m.images.length
                            } ảnh)`}
                      </button>
                    )}
                  </>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

// ======================================================
// PRESENTATIONAL COMPONENTS
// ======================================================

function Stat({
  value,
  label,
  variant,
}: {
  value: number;
  label: string;
  variant?: "ok" | "warn";
}) {
  return (
    <div
      className={`sv-stat${
        variant ? ` sv-stat--${variant}` : ""
      }`}
    >
      <span className="sv-stat__value">{value}</span>
      <span className="sv-stat__label">{label}</span>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      className={`sv-chip${active ? " is-active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {label} <span>{count}</span>
    </button>
  );
}

// ======================================================
// EDIT FORM
// ======================================================

function EditForm({
  mgmt: m,
}: {
  mgmt: ReturnType<typeof useStreetViewManagement>;
}) {
  return (
    <form
      className="sv-form"
      onSubmit={m.handleSubmit}
    >
      <h3 className="sv-form__title">
        Chỉnh sửa ảnh #{m.editing!.id}
      </h3>

      <button
        type="button"
        className={`sv-location-btn${
          m.isRecording ? " is-recording" : ""
        }`}
        onClick={m.toggleLocationRecording}
      >
        <MapPinIcon size={16} />

        <span>
          {m.isRecording
            ? "Bấm lên bản đồ để chọn vị trí… (bấm để hủy)"
            : m.editLocationLabel}
        </span>
      </button>

      <div className="sv-form__row">
        <label className="sv-field">
          <span>Kinh độ (Lng)</span>

          <input
            inputMode="decimal"
            value={m.draft.lng}
            onChange={(e) =>
              m.updateDraft("lng", e.target.value)
            }
          />
        </label>

        <label className="sv-field">
          <span>Vĩ độ (Lat)</span>

          <input
            inputMode="decimal"
            value={m.draft.lat}
            onChange={(e) =>
              m.updateDraft("lat", e.target.value)
            }
          />
        </label>
      </div>

      <label className="sv-field">
        <span>Hướng nhìn (0–360°)</span>

        <input
          inputMode="decimal"
          value={m.draft.heading}
          onChange={(e) =>
            m.updateDraft("heading", e.target.value)
          }
          placeholder="VD: 90"
        />
      </label>

      <label className="sv-field">
        <span>Thời gian chụp</span>

        <input
          type="datetime-local"
          value={m.draft.captured_at}
          onChange={(e) =>
            m.updateDraft("captured_at", e.target.value)
          }
        />
      </label>

      <div className="sv-form__actions">
        <button
          type="submit"
          className="sv-btn sv-btn--primary"
          disabled={m.busy}
        >
          {m.busy ? "Đang lưu…" : "Lưu thay đổi"}
        </button>

        <button
          type="button"
          className="sv-btn"
          onClick={m.closeEditForm}
        >
          Hủy
        </button>
      </div>
    </form>
  );
}

// ======================================================
// IMAGE CARD
// ======================================================

function ImageCard({
  img,
  confirmDelete,
  busy,
  onOpen,
  onGo,
  onEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  img: StreetViewImage;
  confirmDelete: boolean;
  busy: boolean;
  onOpen: () => void;
  onGo: () => void;
  onEdit: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  // Backend chưa hỗ trợ next_ids.
  const links = 0;

  links;

  return (
    <li className="sv-card">
      <button
        type="button"
        className="sv-card__main"
        onClick={onOpen}
      >
        <Thumb src={img.image_url} />

        <div className="sv-card__body">
          <div className="sv-card__top">
            <strong>#{img.id}</strong>

            <span className="sv-badge sv-badge--warn">
              Chưa liên kết
            </span>
          </div>

          <span className="sv-card__meta">
            {headingLabel(img.heading)}
          </span>

          <span className="sv-card__meta sv-card__meta--mono">
            {img.lat.toFixed(5)}, {img.lng.toFixed(5)}
          </span>
        </div>
      </button>

      {confirmDelete ? (
        <div className="sv-confirm">
          <span>Xóa ảnh #{img.id}?</span>

          <button
            type="button"
            className="sv-btn sv-btn--danger"
            disabled={busy}
            onClick={onConfirmDelete}
          >
            {busy ? "Đang xóa…" : "Xóa"}
          </button>

          <button
            type="button"
            className="sv-btn"
            disabled={busy}
            onClick={onCancelDelete}
          >
            Hủy
          </button>
        </div>
      ) : (
        <div className="sv-card__actions">
          <button
            type="button"
            className="sv-btn sv-btn--ghost"
            onClick={onGo}
          >
            <MapPinIcon size={14} /> Đến
          </button>

          <button
            type="button"
            className="sv-btn sv-btn--ghost"
            onClick={onEdit}
          >
            <EditIcon /> Sửa
          </button>

          <button
            type="button"
            className="sv-btn sv-btn--ghost sv-btn--danger-text"
            onClick={onRequestDelete}
          >
            <TrashIcon /> Xóa
          </button>
        </div>
      )}
    </li>
  );
}

// ======================================================
// IMAGE DETAIL
// ======================================================

function ImageDetailView({
  image,
  confirmDelete,
  busy,
  error,
  apiKey,
  onGoToImage,
  onEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onRefreshImage,
  onReloadList,
}: {
  image: StreetViewImage;
  confirmDelete: boolean;
  busy: boolean;
  error: string | null;
  apiKey: string;
  onGoToImage: (image: StreetViewImage) => void;
  onEdit: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onRefreshImage: (image: StreetViewImage) => void;
  onReloadList: () => void;
}) {
  const d = useStreetViewDetail(image, apiKey, {
    onRefreshImage,
    onReloadList,
  });

  return (
    <div className="coord-sidebar__scroll sv-dashboard__scroll">
      <div className="sv-detail-preview">
        <Thumb src={image.image_url} />
      </div>

      {/* INFORMATION */}
      <div className="sv-panel-card">
        <div className="sv-panel-card__head">
          <span className="sv-panel-card__label">
            Thông tin chi tiết
          </span>

          <span className="sv-badge sv-badge--warn">
            Chưa liên kết
          </span>
        </div>

        <dl className="sv-dl">
          <dt>ID Panorama</dt>
          <dd>#{image.id}</dd>

          <dt>Hướng nhìn</dt>
          <dd>{headingLabel(image.heading)}</dd>

          <dt>Pitch</dt>
          <dd>{image.pitch}°</dd>

          <dt>Thời gian chụp</dt>
          <dd>{formatDate(image.captured_at)}</dd>

          <dt>Đường dẫn tệp</dt>
          <dd className="sv-dl__break">
            {image.file_path}
          </dd>
        </dl>
      </div>

      {/* COORDINATES */}
      <div className="sv-panel-card">
        <div className="sv-panel-card__head">
          <span className="sv-panel-card__label">
            Tọa độ không gian
          </span>

          <button
            type="button"
            className="sv-btn sv-btn--ghost"
            onClick={d.handleCopy}
          >
            {d.copyState === "ok"
              ? "Đã chép"
              : d.copyState === "fail"
                ? "Lỗi chép"
                : "Sao chép tọa độ"}
          </button>
        </div>

        <div className="sv-coords">
          <div>
            <small>LAT</small>
            <code>{image.lat.toFixed(6)}</code>
          </div>

          <div>
            <small>LNG</small>
            <code>{image.lng.toFixed(6)}</code>
          </div>
        </div>

        <button
          type="button"
          className="sv-btn sv-btn--primary sv-btn--block"
          onClick={() => onGoToImage(image)}
        >
          <MapPinIcon size={16} />
          Bay đến vị trí trên bản đồ
        </button>
      </div>

      {/* NEARBY */}
      <div className="sv-panel-card">
        <div className="sv-panel-card__head">
          <span className="sv-panel-card__label">
            Ảnh panorama lân cận
          </span>
        </div>

        <p className="sv-muted">
          Các ảnh trong bán kính 60m quanh vị trí hiện tại.
        </p>

        {d.loadingNearby ? (
          <p className="sv-muted">
            Đang tìm ảnh lân cận...
          </p>
        ) : d.nearby.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              marginTop: "8px",
            }}
          >
            {d.nearby.map((nb) => (
              <div
                key={nb.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(255,255,255,0.03)",
                  padding: "6px 8px",
                  borderRadius: "4px",
                }}
              >
                <div>
                  <strong>#{nb.id}</strong>

                  <span
                    style={{
                      marginLeft: "8px",
                      fontSize: "11px",
                      color: "var(--sv-muted)",
                    }}
                  >
                    {nb.distance_meters != null
                      ? `${nb.distance_meters.toFixed(1)}m`
                      : "Khoảng cách không rõ"}
                  </span>
                </div>

                <button
                  type="button"
                  className="sv-btn sv-btn--ghost"
                  style={{
                    fontSize: "11px",
                    padding: "2px 6px",
                  }}
                  onClick={() => onGoToImage(nb)}
                >
                  Xem ảnh
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p
            style={{
              fontSize: "11px",
              color: "var(--sv-muted)",
              marginTop: "8px",
            }}
          >
            Không tìm thấy ảnh lân cận.
          </p>
        )}
      </div>

      {/* ERROR */}
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

      {/* ACTIONS */}
      {confirmDelete ? (
        <div className="sv-confirm sv-confirm--bar">
          <span>Xóa ảnh này?</span>

          <button
            type="button"
            className="sv-btn sv-btn--danger"
            disabled={busy}
            onClick={onConfirmDelete}
          >
            {busy ? "Đang xóa…" : "Xác nhận xóa"}
          </button>

          <button
            type="button"
            className="sv-btn"
            disabled={busy}
            onClick={onCancelDelete}
          >
            Hủy
          </button>
        </div>
      ) : (
        <div className="sv-detail-actions">
          <button
            type="button"
            className="sv-btn"
            onClick={onEdit}
          >
            <EditIcon /> Sửa thông tin
          </button>

          <button
            type="button"
            className="sv-btn sv-btn--danger-outline"
            onClick={onRequestDelete}
          >
            <TrashIcon /> Xóa ảnh
          </button>
        </div>
      )}
    </div>
  );
}


/* Thumb + icons giữ nguyên như file cũ */
function Thumb({
  src,
  alt,
  className = "",
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}
      >
        <PanoIcon />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? "Street View"}
      className={className}
      loading="lazy"
    />
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

const CloseIcon = () => <svg {...svg()}><path d="M18 6 6 18M6 6l12 12" /></svg>;
const BackIcon = () => <svg {...svg()}><path d="m15 18-6-6 6-6" /></svg>;
const SearchIcon = () => <svg {...svg(16)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;
const EditIcon = () => <svg {...svg(14)}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" /></svg>;
const TrashIcon = () => <svg {...svg(14)}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>;
const AlertIcon = () => <svg {...svg(16)}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>;
const MapPinIcon = ({ size = 18 }: { size?: number }) => <svg {...svg(size)}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>;
const PanoIcon = ({ size = 18 }: { size?: number }) => <svg {...svg(size)}><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></svg>;
const RefreshIcon = ({ spinning }: { spinning?: boolean }) => <svg {...svg()} className={spinning ? "sv-spin" : undefined}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>;