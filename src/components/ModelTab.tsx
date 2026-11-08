import React, { useRef, useState } from "react";
import Library from "./Library";
import type { LibEntry } from "../lib/types";
import { IconUpload, IconCube, IconSparkles, IconClose, IconCamera, IconInfo } from "./Icons";
import PhotoGuideModal from "./PhotoGuideModal";

interface ModelTabProps {
  files: File[];
  images: string[];
  onFiles: (files: FileList | null) => void;
  onClearFiles: () => void;
  pgDetail: "reduced" | "medium" | "full";
  setPgDetail: (detail: "reduced" | "medium" | "full") => void;
  pgMask: boolean;
  setPgMask: (mask: boolean) => void;
  onGeneratePhoto: () => void;
  onCancelPhoto: () => void;
  hasKey: boolean;
  onOpenSettings: () => void;
  onGenerateMeshy: () => void;
  onUseBaseCar: () => void;
  busy: string;
  lib: LibEntry[];
  currentId: string | null;
  onOpenEntry: (id: string) => void;
  onRenameEntry: (id: string, name: string) => void;
  onDeleteEntry: (id: string) => void;
}

export default function ModelTab({
  files,
  images,
  onFiles,
  onClearFiles,
  pgDetail,
  setPgDetail,
  pgMask,
  setPgMask,
  onGeneratePhoto,
  onCancelPhoto,
  hasKey,
  onOpenSettings,
  onGenerateMeshy,
  onUseBaseCar,
  busy,
  lib,
  currentId,
  onOpenEntry,
  onRenameEntry,
  onDeleteEntry,
}: ModelTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const isPhotoBusy = busy.startsWith("Gerando modelo 3D: Fotogrametria");

  return (
    <div className="tab-pane">
      {/* Photo Guide Modal */}
      <PhotoGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onSelectFilesClick={() => fileInputRef.current?.click()}
      />

      {/* Base Model Quick Switcher */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <span className="card-title">Modelo Base Padrão</span>
            <span className="card-subtitle">Carroceria coupe esportiva offline</span>
          </div>
        </div>
        <button className="btn-secondary w-full" onClick={onUseBaseCar}>
          <IconCube size={16} /> Carregar Carro Base
        </button>
      </div>

      {/* Upload Dropzone & Photo Guide */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <span className="card-title">Fotos e Vídeos do Veículo</span>
            <span className="card-subtitle">Para reconstrução 3D e extração de cor</span>
          </div>
          {images.length > 0 && (
            <button className="btn-ghost-sm btn-danger-text" onClick={onClearFiles}>
              Limpar
            </button>
          )}
        </div>

        {/* Prominent Photo Guide Banner */}
        <div className="photo-guide-prompt-card" onClick={() => setIsGuideOpen(true)}>
          <div className="guide-prompt-left">
            <div className="guide-prompt-icon">
              <IconCamera size={18} />
            </div>
            <div className="guide-prompt-text">
              <div className="guide-prompt-title-row">
                <span className="guide-prompt-title">Guia Passo a Passo de Fotos</span>
                <span className="badge badge-accent">Como Fotografar</span>
              </div>
              <span className="guide-prompt-desc">
                Veja quais ângulos tirar, distância e como fazer a volta 360° para o 3D ficar perfeito
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn-guide-open"
            onClick={(e) => {
              e.stopPropagation();
              setIsGuideOpen(true);
            }}
          >
            Ver Instruções
          </button>
        </div>

        {/* Quick Angles Strip */}
        <div className="quick-angles-strip">
          <span className="quick-angles-label">Ângulos necessários:</span>
          <div className="quick-angles-pills">
            <button type="button" className="quick-angle-pill" onClick={() => setIsGuideOpen(true)}>
              0° Frente
            </button>
            <button type="button" className="quick-angle-pill" onClick={() => setIsGuideOpen(true)}>
              90° Lateral E.
            </button>
            <button type="button" className="quick-angle-pill" onClick={() => setIsGuideOpen(true)}>
              180° Traseira
            </button>
            <button type="button" className="quick-angle-pill" onClick={() => setIsGuideOpen(true)}>
              270° Lateral D.
            </button>
            <button type="button" className="quick-angle-pill highlight" onClick={() => setIsGuideOpen(true)}>
              360° Volta Completa
            </button>
          </div>
        </div>

        <div
          className="upload-dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFiles(e.dataTransfer.files);
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*,video/*"
            style={{ display: "none" }}
            onChange={(e) => onFiles(e.target.files)}
          />
          <div className="dropzone-icon">
            <IconUpload size={24} />
          </div>
          <span className="dropzone-title">Clique ou arraste fotos/vídeos aqui</span>
          <span className="dropzone-subtitle">Suporta fotos ao redor do carro (PNG, JPG, MP4, MOV)</span>
        </div>

        {images.length > 0 && (
          <div className="thumbs-container">
            <div className="thumbs-header">
              <span className="thumbs-count">{images.length} fotos carregadas</span>
              <span className="form-hint">Ideais: 30 a 80 fotos 360°</span>
            </div>

            {/* Smart Quality Feedback Indicator */}
            <div
              className={`upload-status-indicator ${
                images.length < 4
                  ? "status-warning"
                  : images.length < 25
                  ? "status-info"
                  : "status-success"
              }`}
            >
              {images.length < 4 ? (
                <span>⚠️ {images.length} foto(s). Recomendamos pelo menos 4 fotos (frente, traseira e laterais) para IA, ou 30+ para Fotogrametria no Mac.</span>
              ) : images.length < 25 ? (
                <span>ℹ️ {images.length} fotos carregadas. Suficiente para o gerador por IA. Para a fotogrametria nativa 360°, 30 a 80 fotos darão um acabamento muito superior.</span>
              ) : (
                <span>✅ {images.length} fotos carregadas! Excelente cobertura circular 360° para reconstrução fotogramétrica detalhada.</span>
              )}
            </div>

            <div className="thumbs-grid">
              {images.slice(0, 8).map((src, i) => (
                <div key={i} className="thumb-item">
                  <img src={src} alt={`Upload ${i + 1}`} />
                </div>
              ))}
              {images.length > 8 && (
                <div className="thumb-more">+{images.length - 8}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Apple Photogrammetry (Object Capture macOS) */}
      <div className="card highlight-card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="badge badge-accent">Mac Nativo • Grátis</div>
            <span className="card-title">Fotogrametria Real (Apple Object Capture)</span>
            <span className="card-subtitle">Reconstrói o carro real em 3D sem gastar créditos de nuvem</span>
          </div>
        </div>

        <div className="form-group">
          <label className="field-label">Nível de Detalhe da Geometria</label>
          <div className="segmented-control">
            <button
              className={`segment-btn ${pgDetail === "reduced" ? "active" : ""}`}
              onClick={() => setPgDetail("reduced")}
            >
              Rápido
            </button>
            <button
              className={`segment-btn ${pgDetail === "medium" ? "active" : ""}`}
              onClick={() => setPgDetail("medium")}
            >
              Médio
            </button>
            <button
              className={`segment-btn ${pgDetail === "full" ? "active" : ""}`}
              onClick={() => setPgDetail("full")}
            >
              Ultra (Hi-Res)
            </button>
          </div>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={pgMask}
            onChange={(e) => setPgMask(e.target.checked)}
          />
          <div className="checkbox-text">
            <span>Segmentação inteligente de fundo</span>
            <small>Remove automaticamente o chão e arredores do carro</small>
          </div>
        </label>

        <div className="btn-group-column">
          <button
            className="btn-primary w-full"
            onClick={onGeneratePhoto}
            disabled={files.length < 1 || !!busy}
          >
            {isPhotoBusy ? "Reconstruindo 3D no Mac…" : "Gerar 3D por Fotogrametria"}
          </button>

          {isPhotoBusy && (
            <button className="btn-danger w-full" onClick={onCancelPhoto}>
              <IconClose size={14} /> Cancelar Reconstrução
            </button>
          )}
        </div>
      </div>

      {/* Meshy AI Generator */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="title-with-icon">
              <IconSparkles size={16} />
              <span className="card-title">Gerador 3D por IA (Meshy)</span>
            </div>
            <span className="card-subtitle">Gera o modelo via nuvem a partir de 4 fotos chave</span>
          </div>
        </div>

        {!hasKey ? (
          <div className="alert-box">
            <span>Chave Meshy não configurada.</span>
            <button className="link-button" onClick={onOpenSettings}>
              Configurar chave nas configurações
            </button>
          </div>
        ) : (
          <button
            className="btn-secondary w-full"
            onClick={onGenerateMeshy}
            disabled={images.length < 1 || !!busy}
          >
            <IconSparkles size={16} /> Gerar Modelo 3D com IA
          </button>
        )}
      </div>

      {/* Model Library */}
      <Library
        items={lib}
        currentId={currentId}
        onOpen={onOpenEntry}
        onRename={onRenameEntry}
        onDelete={onDeleteEntry}
      />
    </div>
  );
}

