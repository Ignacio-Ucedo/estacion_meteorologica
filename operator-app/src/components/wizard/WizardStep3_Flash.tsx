import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FIRMWARE_ASSET, type DeviceType, type FirmwareCheck, type WizardState } from "./types";

type Phase =
  | "waiting"    // esperando que el check de firmware termine
  | "fetching"   // consultando GitHub Releases (ya no ocurre aquí, legado)
  | "downloading"
  | "flashing"
  | "ok"
  | "error";

interface LogLine {
  ts: string;
  text: string;
  level: "info" | "ok" | "err";
}

interface DownloadProgressEvent {
  downloaded: number;
  total: number | null;
}

interface FlashLogEvent {
  level: string;
  text: string;
}

interface Props {
  state: WizardState;
  deviceType: DeviceType;
  firmwareCheck: FirmwareCheck;
  onUpdate: (updates: Partial<WizardState>) => void;
  onBack: () => void;
  onNext: () => void;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}

export default function WizardStep3_Flash({ state, deviceType, firmwareCheck, onUpdate, onBack, onNext }: Props) {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [phaseLabel, setPhaseLabel] = useState("Esperando verificación de firmware…");
  const [firmwareTag, setFirmwareTag] = useState<string | null>(null);
  const [dlProgress, setDlProgress] = useState<{ downloaded: number; total: number | null } | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  function addLog(text: string, level: LogLine["level"] = "info") {
    const ts = new Date().toLocaleTimeString("es-AR", { hour12: false });
    setLogs((p) => [...p, { ts, text, level }]);
  }

  async function run(check: FirmwareCheck) {
    if (check.state === "error") {
      setPhase("error");
      setErrorMsg(check.msg);
      return;
    }
    if (check.state === "loading") return;

    const { status } = check;
    setFirmwareTag(status.latest_tag);

    const targetName = FIRMWARE_ASSET[deviceType];
    const asset = status.bin_assets.find((a) => a.name === targetName) ?? status.bin_assets[0];
    if (!asset) {
      setPhase("error");
      setErrorMsg("No se encontraron archivos .bin en el release.");
      return;
    }

    let firmwarePath: string;

    if (!status.needs_update && asset.cached_path) {
      setPhase("flashing");
      setPhaseLabel(`Usando firmware cacheado ${status.latest_tag}…`);
      firmwarePath = asset.cached_path;
    } else {
      setPhase("downloading");
      setPhaseLabel(`Descargando firmware ${status.latest_tag}…`);
      setDlProgress({ downloaded: 0, total: asset.size || null });

      const unlisten = await listen<DownloadProgressEvent>("download-progress", (e) => {
        setDlProgress({ downloaded: e.payload.downloaded, total: e.payload.total });
      });

      try {
        firmwarePath = await invoke<string>("download_firmware", {
          tag: status.latest_tag,
          assetName: asset.name,
          downloadUrl: asset.download_url,
          sha256Url: asset.sha256_url,
        });
      } catch (err: unknown) {
        setPhase("error");
        setErrorMsg(typeof err === "string" ? err : String(err));
        unlisten();
        return;
      } finally {
        unlisten();
      }
    }

    setPhase("flashing");
    setPhaseLabel("Flasheando firmware…");
    setDlProgress(null);

    const unlisten = await listen<FlashLogEvent>("flash-log", (e) => {
      addLog(e.payload.text, e.payload.level as LogLine["level"]);
    });

    try {
      await invoke("flash_firmware", { port: state.port, firmwarePath });
      onUpdate({ firmwarePath });
      setPhase("ok");
      setPhaseLabel("Firmware instalado");
      addLog("✓ Flash completado con éxito", "ok");
    } catch (err: unknown) {
      const msg = typeof err === "string" ? err : String(err);
      setPhase("error");
      setErrorMsg(msg);
      addLog(`✕ ${msg}`, "err");
    } finally {
      unlisten();
    }
  }

  useEffect(() => {
    if (firmwareCheck.state === "loading") return;
    if (ranRef.current) return;
    ranRef.current = true;
    run(firmwareCheck);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmwareCheck]);

  const dlPercent =
    dlProgress?.total ? Math.round((dlProgress.downloaded / dlProgress.total) * 100) : null;

  const logColor = (level: LogLine["level"]) =>
    level === "ok" ? "#4ade80" : level === "err" ? "#f87171" : "#cbd5e1";

  const usbPermError = phase === "error" && errorMsg?.includes("dialout");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%", maxWidth: 620 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
          Firmware
        </h3>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Puerto: <code style={{ fontFamily: "monospace", color: "#60a5fa" }}>{state.port}</code>
        </p>
      </div>

      {/* Estado principal */}
      <div style={{
        padding: "14px 16px",
        borderRadius: 8,
        border: `1px solid ${phase === "ok" ? "#166534" : phase === "error" ? "#7f1d1d" : "#2d3148"}`,
        background: phase === "ok" ? "#14532d22" : phase === "error" ? "#450a0a22" : "#1a1d2e",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>
            {phase === "ok" ? "✓" : phase === "error" ? "✕" : "⟳"}
          </span>
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: phase === "ok" ? "#4ade80" : phase === "error" ? "#f87171" : "#93c5fd",
          }}>
            {phaseLabel}
          </span>
          {firmwareTag && phase !== "error" && (
            <span style={{
              fontSize: 11, padding: "1px 6px", borderRadius: 4,
              background: "#1e3a5f", color: "#60a5fa",
            }}>
              {firmwareTag}
            </span>
          )}
        </div>

        {/* Mensaje de error */}
        {phase === "error" && errorMsg && !usbPermError && (
          <p style={{ fontSize: 12, color: "#f87171", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {errorMsg}
          </p>
        )}

        {/* Barra de progreso descarga */}
        {phase === "downloading" && dlProgress && (
          <div>
            <div style={{ height: 4, background: "#2d3148", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: dlPercent != null ? `${dlPercent}%` : "40%",
                background: "#3b82f6",
                transition: "width 0.2s",
                animation: dlPercent == null ? "pulse 1s infinite" : undefined,
              }} />
            </div>
            <span style={{ fontSize: 11, color: "#60a5fa", marginTop: 4, display: "block" }}>
              {formatBytes(dlProgress.downloaded)}
              {dlProgress.total ? ` / ${formatBytes(dlProgress.total)}` : ""}
              {dlPercent != null ? ` (${dlPercent}%)` : ""}
            </span>
          </div>
        )}
      </div>

      {/* Log de esptool */}
      {(phase === "flashing" || phase === "ok" || (phase === "error" && logs.length > 0)) && (
        <div className="log-section" style={{ minHeight: 160, maxHeight: 240 }}>
          <div className="log-header">
            <span className="log-title">Salida de esptool</span>
            {phase === "flashing" && <span style={{ fontSize: 12, color: "#60a5fa" }}>● en curso</span>}
            {phase === "ok"      && <span style={{ fontSize: 12, color: "#4ade80" }}>✓ completado</span>}
            {phase === "error"   && <span style={{ fontSize: 12, color: "#f87171" }}>✕ error</span>}
          </div>
          <div className="log-container">
            {logs.map((l, i) => (
              <div key={i} className="log-line">
                <span className="log-ts">{l.ts}</span>
                <span style={{ color: logColor(l.level), fontFamily: "monospace", fontSize: 12 }}>
                  {l.text}
                </span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {/* Error de permisos USB */}
      {usbPermError && (
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
        <button
          className="btn btn-secondary"
          onClick={onBack}
          disabled={phase === "flashing" || phase === "downloading"}
        >
          ← Atrás
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {phase === "error" && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setPhase("waiting");
                setLogs([]);
                setErrorMsg(null);
                ranRef.current = false;
              }}
            >
              Reintentar
            </button>
          )}
          {phase === "ok" && (
            <button className="btn btn-primary" onClick={onNext}>
              Siguiente → NVS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
