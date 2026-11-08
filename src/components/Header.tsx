import React from "react";
import {
  IconPaint,
  IconCube,
  IconSofa,
  IconFileText,
  IconRotate360,
  IconReset,
  IconDownload,
  IconSettings,
} from "./Icons";

export type StudioTab = "paint" | "model" | "interior" | "vehicle";

interface HeaderProps {
  activeTab: StudioTab;
  onTabChange: (tab: StudioTab) => void;
  currentModelName: string;
  turntable: boolean;
  onToggleTurntable: () => void;
  onResetCamera: () => void;
  onExportPng: () => void;
  onOpenSettings: () => void;
}

export default function Header({
  activeTab,
  onTabChange,
  currentModelName,
  turntable,
  onToggleTurntable,
  onResetCamera,
  onExportPng,
  onOpenSettings,
}: HeaderProps) {
  return (
    <header className="app-header">
      {/* Brand & Model Status */}
      <div className="header-brand-group">
        <div className="brand-logo">
          <div className="brand-badge-icon">
            <IconPaint size={16} />
          </div>
          <div className="brand-info">
            <span className="brand-title">CAR PAINT STUDIO</span>
            <span className="brand-version">PRO 3D</span>
          </div>
        </div>

        <div className="active-model-chip" title="Modelo carregado no estúdio">
          <span className="model-dot" />
          <span className="model-name">{currentModelName || "Carro Base Procedural"}</span>
        </div>
      </div>

      {/* Main Studio Navigation Tabs */}
      <nav className="header-tabs">
        <button
          className={`tab-btn ${activeTab === "paint" ? "active" : ""}`}
          onClick={() => onTabChange("paint")}
        >
          <IconPaint size={16} />
          <span>Pintura & Acabamento</span>
        </button>

        <button
          className={`tab-btn ${activeTab === "model" ? "active" : ""}`}
          onClick={() => onTabChange("model")}
        >
          <IconCube size={16} />
          <span>Modelo 3D & Scan</span>
        </button>

        <button
          className={`tab-btn ${activeTab === "interior" ? "active" : ""}`}
          onClick={() => onTabChange("interior")}
        >
          <IconSofa size={16} />
          <span>Interior</span>
        </button>

        <button
          className={`tab-btn ${activeTab === "vehicle" ? "active" : ""}`}
          onClick={() => onTabChange("vehicle")}
        >
          <IconFileText size={16} />
          <span>Dados & FIPE</span>
        </button>
      </nav>

      {/* Quick Action Tools */}
      <div className="header-actions">
        <button
          className={`action-btn ${turntable ? "active-glow" : ""}`}
          onClick={onToggleTurntable}
          title={turntable ? "Parar giro showroom" : "Giro contínuo 360° (Showroom)"}
        >
          <IconRotate360 size={16} className={turntable ? "spinning-icon" : ""} />
          <span className="action-btn-label">Giro 360°</span>
        </button>

        <button
          className="action-btn"
          onClick={onResetCamera}
          title="Resetar posição e ângulo da câmera"
        >
          <IconReset size={16} />
          <span className="action-btn-label">Câmera</span>
        </button>

        <button
          className="action-btn btn-export"
          onClick={onExportPng}
          title="Exportar captura em alta resolução PNG"
        >
          <IconDownload size={16} />
          <span>Exportar Foto</span>
        </button>

        <button
          className="icon-action-btn"
          onClick={onOpenSettings}
          title="Configurações e Chaves de API"
        >
          <IconSettings size={18} />
        </button>
      </div>
    </header>
  );
}

