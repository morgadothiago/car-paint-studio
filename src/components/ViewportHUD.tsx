import React from "react";
import { IconEye, IconXray, IconRotate360, IconClose, IconPipette, IconBrush } from "./Icons";
import type { Finish } from "../lib/types";
import type { Tones } from "../lib/colors";

export type CameraView = "perspective" | "front" | "side" | "rear" | "top";

interface ViewportHUDProps {
  inside: boolean;
  onToggleInside: () => void;
  xray: boolean;
  onToggleXray: () => void;
  onPhotoreal: () => void;
  turntable: boolean;
  onToggleTurntable: () => void;
  onSelectCameraView: (view: CameraView) => void;
  picking: boolean;
  onCancelPicking: () => void;
  brushOn: boolean;
  brushMode: "protect" | "paint";
  brushR: number;
  onCloseBrush: () => void;
  currentTones: Tones;
  currentFinish: Finish;
  finishLabel: string;
  busy: string;
  error: string;
  onClearToast: () => void;
}

export default function ViewportHUD({
  inside,
  onToggleInside,
  xray,
  onToggleXray,
  onPhotoreal,
  turntable,
  onToggleTurntable,
  onSelectCameraView,
  picking,
  onCancelPicking,
  brushOn,
  brushMode,
  brushR,
  onCloseBrush,
  currentTones,
  currentFinish,
  finishLabel,
  busy,
  error,
  onClearToast,
}: ViewportHUDProps) {
  return (
    <>
      {/* Floating Camera Angles Bar (Top Center/Left) */}
      <div className="hud-camera-angles">
        <span className="hud-section-label">ÂNGULOS</span>
        <button className="hud-cam-btn" onClick={() => onSelectCameraView("perspective")} title="Visão Isométrica / 3/4">
          3/4
        </button>
        <button className="hud-cam-btn" onClick={() => onSelectCameraView("front")} title="Vista Frontal">
          Frente
        </button>
        <button className="hud-cam-btn" onClick={() => onSelectCameraView("side")} title="Vista Lateral">
          Lateral
        </button>
        <button className="hud-cam-btn" onClick={() => onSelectCameraView("rear")} title="Vista Traseira">
          Traseira
        </button>
        <button className="hud-cam-btn" onClick={() => onSelectCameraView("top")} title="Vista Superior">
          Topo
        </button>
      </div>

      {/* Floating View Controls (Top Right) */}
      <div className="hud-view-controls">
        <button
          className={`hud-btn ${inside ? "hud-btn-active" : ""}`}
          onClick={onToggleInside}
          title={inside ? "Voltar para o lado de fora" : "Entrar na cabine do veículo"}
        >
          <IconEye size={16} />
          <span>{inside ? "Visão Externa" : "Ver por Dentro"}</span>
        </button>

        <button
          className={`hud-btn ${xray ? "hud-btn-active" : ""}`}
          onClick={onToggleXray}
          title="Deixa a lataria semitransparente para ver o interior por fora"
        >
          <IconXray size={16} />
          <span>Raio-X</span>
        </button>

        <button
          className={`hud-btn ${turntable ? "hud-btn-active" : ""}`}
          onClick={onToggleTurntable}
          title="Giro contínuo do veículo (Showroom)"
        >
          <IconRotate360 size={16} className={turntable ? "spinning-icon" : ""} />
          <span>Showroom</span>
        </button>

        <button className="hud-btn" onClick={onPhotoreal} title="Gera uma foto realista do carro pintado com IA (Nano Banana)">
          <IconEye size={16} />
          <span>Foto realista</span>
        </button>
      </div>

      {/* Floating Active Tool Banner (Top Center) */}
      {picking && (
        <div className="hud-tool-banner picking-banner">
          <IconPipette size={18} className="tool-banner-icon pulse" />
          <div className="tool-banner-text">
            <strong>Modo Conta-gotas de Lataria:</strong>
            <span>Clique diretamente sobre a lataria do carro na cena 3D.</span>
          </div>
          <button className="tool-banner-close" onClick={onCancelPicking}>
            Cancelar
          </button>
        </div>
      )}

      {brushOn && (
        <div className="hud-tool-banner brush-banner">
          <IconBrush size={18} className="tool-banner-icon" />
          <div className="tool-banner-text">
            <strong>Pincel de Proteção ({brushMode === "protect" ? "Proteger" : "Pintar"}):</strong>
            <span>Arraste sobre a lataria para aplicar a máscara (Raio: {brushR}px)</span>
          </div>
          <button className="tool-banner-close" onClick={onCloseBrush}>
            Concluir
          </button>
        </div>
      )}

      {/* Interior Hint */}
      {inside && (
        <div className="hud-interior-hint">
          <span className="dot-blink" /> Arraste com o mouse para olhar 360° dentro da cabine
        </div>
      )}

      {/* Floating Active Paint Preview (Bottom Right) */}
      <div className="hud-paint-badge" title={`Pintura Atual: ${currentTones.base.toUpperCase()} (${finishLabel})`}>
        <div
          className="hud-paint-gradient"
          style={{
            background: `linear-gradient(135deg, ${currentTones.highlight} 0%, ${currentTones.base} 50%, ${currentTones.shadow} 100%)`,
          }}
        />
        <div className="hud-paint-info">
          <span className="hud-paint-hex">{currentTones.base.toUpperCase()}</span>
          <span className="hud-paint-finish">{finishLabel}</span>
        </div>
      </div>

      {/* Toast Alert / Progress Notification (Bottom Left) */}
      {(busy || error) && (
        <div className={`hud-toast ${error ? "hud-toast-error" : "hud-toast-info"}`}>
          {busy && !error && <div className="hud-spinner" />}
          <div className="hud-toast-content">
            <span className="hud-toast-text">{error || busy}</span>
          </div>
          {error && (
            <button className="hud-toast-close" onClick={onClearToast}>
              <IconClose size={14} />
            </button>
          )}
        </div>
      )}
    </>
  );
}

