import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { WizardState } from "./types";

type Status = "idle" | "running" | "ok" | "error";

interface LogLine {
  ts: string;
  text: string;
  level: "info" | "ok" | "err";
}

interface FlashLogEvent {
  level: string;
  text: string;
}

// 11.1
interface AssetStatus {
  name: string;
  download_url: string;
  sha256_url: string | null;
  size: number;
  cached_path: string | null;
}

interface FirmwareStatus {
  latest_tag: string;
  html_url: string;
  cached_tag: string | null;
  needs_update: boolean;
  bin_assets: AssetStatus[];
}

interface DownloadProgressEvent {
  downloaded: number;
  total: number | null;
}

interface Props {
  state: WizardState;
  onUpdate: (updates: Partial<WizardState>) => void;
  onBack: () => void;
  onNext: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export default function WizardStep3_Flash({ state, onUpdate, onBack, onNext }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [firmwarePath, setFirmwarePath] = useState<string>(state.firmwarePath ?? "");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // GitHub Release state (11.1)
  const [ghStatus, setGhStatus] = useState<FirmwareStatus | null>(null);
  const [ghChecking, setGhChecking] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null); // asset name
  const [dlProgress, setDlProgress] = useState<{ downloaded: number; total: number | null } | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  function addLog(text: string, level: LogLine["level"] = "info") {
    const ts = new Date().toLocaleTimeString("es-AR", { hour12: false });
    setLogs((prev) => [...prev, { ts, text, level }]);
  }

  async function selectFirmware() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Firmware ESP32", extensions: ["bin"] }],
    });
    if (typeof selected === "string") {
      setFirmwarePath(selected);
    }
  }

  async function startFlash() {
    if (!firmwarePath) return;
    setStatus("running");
    setLogs([]);
    setErrorMsg(null);

    const unlisten = await listen<FlashLogEvent>("flash-log", (e) => {
      addLog(e.payload.text, e.payload.level as LogLine["level"]);
    });

    try {
      await invoke("flash_firmware", {
        port: state.port,
        firmwarePath,
      });
      setStatus("ok");
      onUpdate({ firmwarePath });
      addLog("✓ Flash completado con éxito", "ok");
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      setStatus("error");
      setErrorMsg(msg);
      addLog(`✕ ${msg}`, "err");
    } finally {
      unlisten();
    }
  }

  // 11.1: Consultar GitHub Releases
  async function checkGitHub() {
    setGhChecking(true);
    setGhError(null);
    try {
      const info = await invoke<FirmwareStatus>("check_firmware_update");
      setGhStatus(info);
    } catch (err: unknown) {
      setGhError(typeof err === "string" ? err : String(err));
    } finally {
      setGhChecking(false);
    }
  }

  // 11.2 + 11.4: Descargar asset y cachear
  async function downloadAsset(asset: AssetStatus) {
    setDownloading(asset.name);
    setDlProgress({ downloaded: 0, total: asset.size || null });

    const unlisten = await listen<DownloadProgressEvent>("download-progress", (e) => {
      setDlProgress({ downloaded: e.payload.downloaded, total: e.payload.total });
    });

    try {
      const localPath = await invoke<string>("download_firmware", {
        tag: ghStatus!.latest_tag,
        assetName: asset.name,
        downloadUrl: asset.download_url,
        sha256Url: asset.sha256_url,
      });
      // 11.3: Auto-seleccionar el binario descargado
      setFirmwarePath(localPath);
      // Actualizar caché en ghStatus
      setGhStatus((prev) =>
        prev
          ? {
              ...prev,
              cached_tag: prev.latest_tag,
              needs_update: false,
              bin_assets: prev.bin_assets.map((a) =>
                a.name === asset.name ? { ...a, cached_path: localPath } : a
              ),
            }
          : prev
      );
    } catch (err: unknown) {
      setGhError(typeof err === "string" ? err : String(err));
    } finally {
      unlisten();
      setDownloading(null);
      setDlProgress(null);
    }
  }

  const logColor = (level: LogLine["level"]) => {
    if (level === "ok") return "#4ade80";
    if (level === "err") return "#f87171";
    return "#cbd5e1";
  };

  const dlPercent =
    dlProgress && dlProgress.total
      ? Math.round((dlProgress.downloaded / dlProgress.total) * 100)
      : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%", maxWidth: 640 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
          Flash de firmware
        </h3>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Puerto:{" "}
          <code style={{ fontFamily: "monospace", color: "#60a5fa" }}>{state.port}</code>
        </p>
      </div>

      {/* ── GitHub Releases (11.1–11.3) ────────────────────────────────────── */}
      <div style={{
        background: "#0f1117",
        border: "1px solid #2d3148",
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>
            Firmware desde GitHub Releases
          </span>
          <button
            className="btn btn-secondary"
            onClick={checkGitHub}
            disabled={ghChecking || status === "running"}
            style={{ fontSize: 11, padding: "3px 10px" }}
          >
            {ghChecking ? "Consultando…" : "Verificar actualización"}
          </button>
        </div>

        {ghError && (
          <p style={{ fontSize: 12, color: "#f87171", margin: 0 }}>{ghError}</p>
        )}

        {ghStatus && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>Última versión:</span>
              <span style={{ fontSize: 12, color: "#93c5fd", fontWeight: 600 }}>
                {ghStatus.latest_tag}
              </span>
              {ghStatus.cached_tag && !ghStatus.needs_update && (
                <span style={{
                  fontSize: 11, padding: "1px 6px", borderRadius: 4,
                  background: "#14532d", color: "#4ade80",
                }}>
                  ✓ en caché
                </span>
              )}
              {ghStatus.needs_update && ghStatus.cached_tag && (
                <span style={{
                  fontSize: 11, padding: "1px 6px", borderRadius: 4,
                  background: "#422006", color: "#fb923c",
                }}>
                  actualización disponible
                </span>
              )}
            </div>

            {/* Assets */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ghStatus.bin_assets.map((asset) => {
                const isDownloading = downloading === asset.name;
                const isCached = !!asset.cached_path;
                return (
                  <div key={asset.name} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    background: "#1a1d2e",
                    border: "1px solid #2d3148",
                    borderRadius: 6,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: "#e2e8f0", fontFamily: "monospace" }}>
                        {asset.name}
                      </div>
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                        {formatBytes(asset.size)}
                        {asset.sha256_url && " · SHA256 verificado"}
                      </div>
                      {/* Barra de progreso (11.2) */}
                      {isDownloading && dlProgress && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{
                            height: 4,
                            background: "#2d3148",
                            borderRadius: 2,
                            overflow: "hidden",
                          }}>
                            <div style={{
                              height: "100%",
                              width: dlPercent != null ? `${dlPercent}%` : "100%",
                              background: "#3b82f6",
                              transition: "width 0.2s",
                              animation: dlPercent == null ? "pulse 1s infinite" : undefined,
                            }} />
                          </div>
                          <span style={{ fontSize: 11, color: "#60a5fa", marginTop: 2, display: "block" }}>
                            {formatBytes(dlProgress.downloaded)}
                            {dlProgress.total ? ` / ${formatBytes(dlProgress.total)}` : ""}
                            {dlPercent != null ? ` (${dlPercent}%)` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {isCached && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => setFirmwarePath(asset.cached_path!)}
                          style={{ fontSize: 11, padding: "3px 8px" }}
                        >
                          ✓ Usar caché
                        </button>
                      )}
                      <button
                        className="btn btn-secondary"
                        onClick={() => downloadAsset(asset)}
                        disabled={!!downloading || status === "running"}
                        style={{ fontSize: 11, padding: "3px 8px" }}
                      >
                        {isDownloading ? "Descargando…" : isCached ? "Re-descargar" : "Descargar"}
                      </button>
                    </div>
                  </div>
                );
              })}
              {ghStatus.bin_assets.length === 0 && (
                <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>
                  No se encontraron archivos .bin en el último release.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Selección manual de firmware ──────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          className="btn btn-secondary"
          onClick={selectFirmware}
          disabled={status === "running"}
        >
          Seleccionar .bin…
        </button>
        {firmwarePath ? (
          <code style={{
            fontSize: 12, color: "#94a3b8", fontFamily: "monospace",
            flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {firmwarePath}
          </code>
        ) : (
          <span style={{ fontSize: 13, color: "#475569" }}>
            Seleccioná o descargá el firmware .bin
          </span>
        )}
      </div>

      {/* ── Log ──────────────────────────────────────────────────────────── */}
      <div className="log-section" style={{ minHeight: 180, maxHeight: 260 }}>
        <div className="log-header">
          <span className="log-title">Salida de esptool</span>
          {status === "running" && <span style={{ fontSize: 12, color: "#60a5fa" }}>● en curso</span>}
          {status === "ok"      && <span style={{ fontSize: 12, color: "#4ade80" }}>✓ completado</span>}
          {status === "error"   && <span style={{ fontSize: 12, color: "#f87171" }}>✕ error</span>}
        </div>
        <div className="log-container">
          {logs.length === 0 ? (
            <div className="log-empty">
              {!firmwarePath
                ? "Seleccioná o descargá un archivo .bin para comenzar."
                : "Presioná «Flash firmware» para comenzar."}
            </div>
          ) : (
            logs.map((l, i) => (
              <div key={i} className="log-line">
                <span className="log-ts">{l.ts}</span>
                <span style={{ color: logColor(l.level), fontFamily: "monospace", fontSize: 12 }}>
                  {l.text}
                </span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* Error de permisos USB */}
      {status === "error" && errorMsg?.includes("dialout") && (
        <div style={{
          padding: "12px 14px",
          background: "#1c1017",
          border: "1px solid #7f1d1d",
          borderRadius: 8,
          fontSize: 12,
          color: "#f87171",
          lineHeight: 1.7,
        }}>
          <strong>Error de permisos USB</strong>
          <pre style={{
            marginTop: 6, fontFamily: "monospace", fontSize: 11, color: "#fca5a5",
            background: "#0f0a0a", padding: "6px 8px", borderRadius: 4,
          }}>
            sudo usermod -aG dialout $USER{"\n"}
            # Luego cerrá sesión y volvé a iniciarla
          </pre>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn btn-secondary" onClick={onBack} disabled={status === "running"}>
          ← Atrás
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {status === "error" && (
            <button
              className="btn btn-secondary"
              onClick={() => { setStatus("idle"); setLogs([]); setErrorMsg(null); }}
            >
              Reintentar
            </button>
          )}
          {status === "idle" && (
            <button
              className="btn btn-primary"
              disabled={!firmwarePath}
              onClick={startFlash}
            >
              Flash firmware
            </button>
          )}
          {status === "ok" && (
            <button className="btn btn-primary" onClick={onNext}>
              Siguiente → NVS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
