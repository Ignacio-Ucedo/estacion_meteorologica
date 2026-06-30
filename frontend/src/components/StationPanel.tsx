type StationPanelProps = {
  name: string;
  location: string;
  status: string;
  statusKey?: "online" | "offline" | "degraded";
  badge: string;
  lastUpdated: string;
  onSwitchStation: () => void;
};

export function StationPanel({
  name,
  location,
  status,
  statusKey,
  badge,
  lastUpdated,
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
        <span className="system-badge">{badge}</span>
        <span className="last-updated">{lastUpdated}</span>
      </div>
    </section>
  );
}