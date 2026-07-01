import { Skeleton } from "./Skeleton";

type StationPanelProps = {
  name: string;
  location: string;
  status: string;
  statusKey?: "online" | "offline" | "degraded";
  badge: string;
  lastUpdated: string;
  loading?: boolean;
  onSwitchStation: () => void;
};

export function StationPanel({
  name,
  location,
  status,
  statusKey,
  badge,
  lastUpdated,
  loading = false,
  onSwitchStation,
}: StationPanelProps) {
  return (
    <section
      className="station-panel station-panel--clickable"
      aria-labelledby="station-name"
      onClick={onSwitchStation}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSwitchStation()}
      aria-label="Cambiar estación"
    >
      <div>
        <div className="status-line">
          <span className={`status-dot${statusKey ? ` status-dot--${statusKey}` : ""}`} aria-hidden="true" />
          <span>
            {name} - {status}
          </span>
        </div>
        <h2 id="station-name">{name}</h2>
        <p className="station-location">{location}</p>
      </div>
      <div className="station-meta">
        {loading ? (
          <Skeleton width="140px" height="34px" radius={999} />
        ) : (
          <span className="system-badge">{badge}</span>
        )}
        {loading ? (
          <Skeleton width="110px" height="13px" />
        ) : (
          <span className="last-updated">{lastUpdated}</span>
        )}
      </div>
    </section>
  );
}