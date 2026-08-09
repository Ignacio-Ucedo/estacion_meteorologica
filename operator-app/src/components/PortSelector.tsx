import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface PortInfo {
  name: string;
  vid: number | null;
  pid: number | null;
  manufacturer: string | null;
  chip: string;
}

interface Props {
  selectedPort: string | null;
  onSelect: (port: string | null) => void;
}

export default function PortSelector({ selectedPort, onSelect }: Props) {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [flash, setFlash] = useState<{ name: string; kind: "connected" | "disconnected" } | null>(null);

  useEffect(() => {
    invoke<PortInfo[]>("list_ports").then(setPorts).catch(console.error);

    const unlistenUpdated = listen<PortInfo[]>("ports-updated", (e) => {
      setPorts(e.payload);
      // Deseleccionar si el puerto activo desapareció.
      if (selectedPort && !e.payload.some((p) => p.name === selectedPort)) {
        onSelect(null);
      }
    });

    const unlistenConnected = listen<PortInfo>("port-connected", (e) => {
      setFlash({ name: e.payload.name, kind: "connected" });
      setTimeout(() => setFlash(null), 2000);
    });

    const unlistenDisconnected = listen<PortInfo>("port-disconnected", (e) => {
      setFlash({ name: e.payload.name, kind: "disconnected" });
      setTimeout(() => setFlash(null), 2000);
    });

    return () => {
      unlistenUpdated.then((fn) => fn());
      unlistenConnected.then((fn) => fn());
      unlistenDisconnected.then((fn) => fn());
    };
  }, [selectedPort, onSelect]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {flash && (
        <div
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: 13,
            background: flash.kind === "connected" ? "#dcfce7" : "#fee2e2",
            color: flash.kind === "connected" ? "#166534" : "#991b1b",
            border: `1px solid ${flash.kind === "connected" ? "#86efac" : "#fca5a5"}`,
          }}
        >
          {flash.kind === "connected" ? "✓ Conectado" : "✕ Desconectado"}: {flash.name}
        </div>
      )}

      {ports.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
          No se detectaron dispositivos ESP32. Conectá el ESP32 por USB.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ports.map((port) => {
            const active = port.name === selectedPort;
            return (
              <button
                key={port.name}
                onClick={() => onSelect(active ? null : port.name)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  border: `2px solid ${active ? "#3b82f6" : "#e2e8f0"}`,
                  borderRadius: 8,
                  background: active ? "#eff6ff" : "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 0.15s",
                }}
              >
                <span style={{ fontSize: 20 }}>🔌</span>
                <span style={{ flex: 1 }}>
                  <strong style={{ display: "block", fontSize: 14 }}>{port.name}</strong>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    {port.chip}
                    {port.manufacturer ? ` — ${port.manufacturer}` : ""}
                    {port.vid != null
                      ? ` (VID ${port.vid.toString(16).toUpperCase().padStart(4, "0")}`
                      : ""}
                    {port.pid != null
                      ? `:${port.pid.toString(16).toUpperCase().padStart(4, "0")})`
                      : ""}
                  </span>
                </span>
                {active && (
                  <span style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600 }}>
                    Seleccionado
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
