export default function ComingSoonPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
        <span style={{
          fontSize: "11px",
          padding: "2px 8px",
          borderRadius: "4px",
          background: "#1e293b",
          color: "#64748b",
          border: "1px solid #334155",
          fontFamily: "monospace",
        }}>
          en desarrollo
        </span>
      </div>
      <div className="panel-body" style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", minHeight: "200px" }}>
        <span style={{ fontSize: "32px", opacity: 0.3 }}>🔧</span>
        <p style={{ color: "#64748b", fontSize: "14px", textAlign: "center", maxWidth: "320px" }}>
          {description}
        </p>
      </div>
    </div>
  );
}
