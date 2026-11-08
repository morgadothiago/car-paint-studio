import React, { useState } from "react";
import { Finish, MaterialInfo } from "../lib/types";
import { Swatch, Tones, PRESETS, suggest, tonesFromPalette } from "../lib/colors";
import FactoryColors from "./FactoryColors";
import MyPalette from "./MyPalette";
import {
  IconPipette,
  IconBrush,
  IconReset,
  IconSliders,
  IconSparkles,
  IconLayers,
  IconCheck,
} from "./Icons";

const FINISH_OPTIONS: { id: Finish; name: string; desc: string }[] = [
  { id: "gloss", name: "Brilhante", desc: "Verniz transparente clássico" },
  { id: "metallic", name: "Metálico", desc: "Partículas de alumínio refletivas" },
  { id: "pearl", name: "Perolado", desc: "Reflexos iridescentes multicamada" },
  { id: "matte", name: "Fosco", desc: "Sem brilho especular, toque acetinado" },
];

interface PaintTabProps {
  mats: MaterialInfo[];
  selected: string[];
  toggleMat: (uuid: string) => void;
  onSelectAllMats: () => void;
  tones: Tones;
  editTone: (key: keyof Tones, hex: string) => void;
  pickTones: (tones: Tones) => void;
  pick: (hex: string) => void;
  finish: Finish;
  setFinish: (finish: Finish) => void;
  tol: number;
  setTol: (tol: number) => void;
  picking: boolean;
  setPicking: (picking: boolean) => void;
  brushOn: boolean;
  setBrushOn: (on: boolean) => void;
  brushMode: "protect" | "paint";
  setBrushMode: (mode: "protect" | "paint") => void;
  brushR: number;
  setBrushR: (r: number) => void;
  onClearBrush: () => void;
  onRestoreOriginal: () => void;
  palette: Swatch[];
  wheelColor: string | null;
  setWheelColor: (hex: string | null) => void;
}

export default function PaintTab({
  mats,
  selected,
  toggleMat,
  onSelectAllMats,
  tones,
  editTone,
  pickTones,
  pick,
  finish,
  setFinish,
  tol,
  setTol,
  picking,
  setPicking,
  brushOn,
  setBrushOn,
  brushMode,
  setBrushMode,
  brushR,
  setBrushR,
  onClearBrush,
  onRestoreOriginal,
  wheelColor,
  setWheelColor,
  palette,
}: PaintTabProps) {
  const [showMats, setShowMats] = useState(false);

  return (
    <div className="tab-pane">
      {/* 3-Tone Paint Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <span className="card-title">Tons da Pintura</span>
            <span className="card-subtitle">Gradiente automotivo tricamada</span>
          </div>
          <button className="btn-ghost-sm" onClick={onRestoreOriginal} title="Restaurar textura original do modelo">
            <IconReset size={14} /> Original
          </button>
        </div>

        {/* Live Gradient Preview Bar */}
        <div
          className="paint-gradient-preview"
          style={{
            background: `linear-gradient(90deg, ${tones.highlight} 0%, ${tones.base} 50%, ${tones.shadow} 100%)`,
          }}
        >
          <span className="gradient-label">BRILHO</span>
          <span className="gradient-label">BASE</span>
          <span className="gradient-label">SOMBRA</span>
        </div>

        {/* Tones Pickers */}
        <div className="tones-grid">
          {(
            [
              ["base", "Tom Base", tones.base, "Cor predominante da lataria"],
              ["highlight", "Brilho Alto", tones.highlight, "Reflexo da luz direta incidente"],
              ["shadow", "Sombra", tones.shadow, "Vincos, dobras e curvas profundas"],
            ] as const
          ).map(([key, label, val, hint]) => (
            <div key={key} className="tone-item" title={hint}>
              <div className="color-picker-wrapper">
                <input
                  type="color"
                  className="native-color-input"
                  value={val}
                  onChange={(e) => editTone(key, e.target.value)}
                />
                <span className="color-preview-circle" style={{ backgroundColor: val }} />
              </div>
              <div className="tone-info">
                <span className="tone-label">{label}</span>
                <span className="tone-hex">{val.toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Wheels */}
        <div className="wheel-row" title="Pinta só o aro das rodas. Pneus e vidros ficam protegidos.">
          <label className="wheel-check">
            <input
              type="checkbox"
              checked={wheelColor !== null}
              onChange={(e) => setWheelColor(e.target.checked ? "#1f1f22" : null)}
            />
            <span>Pintar rodas (aros)</span>
          </label>
          {wheelColor !== null && (
            <div className="color-picker-wrapper">
              <input
                type="color"
                className="native-color-input"
                value={wheelColor}
                onChange={(e) => setWheelColor(e.target.value)}
              />
              <span className="color-preview-circle" style={{ backgroundColor: wheelColor }} />
            </div>
          )}
        </div>

        {/* Actions Bar */}
        <div className="btn-group-row">
          <button
            className={`btn-action-tool ${picking ? "active" : ""}`}
            onClick={() => setPicking(!picking)}
            title="Clique sobre a lataria do carro na visualização 3D"
          >
            <IconPipette size={16} />
            <span>{picking ? "Clique no 3D…" : "Conta-gotas 3D"}</span>
          </button>

          <button
            className={`btn-action-tool ${brushOn ? "active" : ""}`}
            onClick={() => setBrushOn(!brushOn)}
            title="Pincel de isolamento de superfícies"
          >
            <IconBrush size={16} />
            <span>{brushOn ? "Pincel Ligado" : "Pincel de Proteção"}</span>
          </button>
        </div>

        {/* Brush Drawer if active */}
        {brushOn && (
          <div className="brush-drawer">
            <div className="brush-mode-toggle">
              <button
                className={`mode-btn ${brushMode === "protect" ? "active" : ""}`}
                onClick={() => setBrushMode("protect")}
              >
                Proteger
              </button>
              <button
                className={`mode-btn ${brushMode === "paint" ? "active" : ""}`}
                onClick={() => setBrushMode("paint")}
              >
                Pintar
              </button>
              <button className="mode-btn btn-danger-text" onClick={onClearBrush} title="Limpar todas as proteções">
                Limpar
              </button>
            </div>

            <div className="slider-control">
              <div className="slider-header">
                <span>Raio do Pincel</span>
                <span className="slider-value">{brushR}px</span>
              </div>
              <input
                type="range"
                min={6}
                max={90}
                value={brushR}
                className="custom-range"
                onChange={(e) => setBrushR(+e.target.value)}
              />
              <span className="form-hint">
                "Proteger" preserva vidros, rodas e lanternas originais. "Pintar" desfaz.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Finish Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <span className="card-title">Acabamento do Verniz</span>
            <span className="card-subtitle">Propriedades físicas do reflexo (PBR)</span>
          </div>
        </div>

        <div className="finish-grid">
          {FINISH_OPTIONS.map((f) => {
            const isSelected = finish === f.id;
            return (
              <button
                key={f.id}
                className={`finish-card ${isSelected ? "selected" : ""}`}
                onClick={() => setFinish(f.id)}
              >
                <div className="finish-card-top">
                  <span className="finish-name">{f.name}</span>
                  {isSelected && <IconCheck size={14} className="finish-check" />}
                </div>
                <span className="finish-desc">{f.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Tolerance Slider */}
        <div className="slider-control" style={{ marginTop: 12 }}>
          <div className="slider-header">
            <span>Tolerância de Cor na Lataria</span>
            <span className="slider-value">{tol}</span>
          </div>
          <input
            type="range"
            min={20}
            max={140}
            value={tol}
            className="custom-range"
            onChange={(e) => setTol(+e.target.value)}
          />
          <span className="form-hint">Controla a abrangência do tom sobre as sombras do modelo scanneado.</span>
        </div>
      </div>

      {/* Car Body Parts / Materials */}
      <div className="card collapsible-card">
        <button className="card-collapsible-header" onClick={() => setShowMats(!showMats)}>
          <div className="card-title-group">
            <div className="title-with-icon">
              <IconLayers size={16} />
              <span className="card-title">Partes e Materiais da Lataria</span>
            </div>
            <span className="card-subtitle">
              {selected.length} de {mats.length} componentes selecionados
            </span>
          </div>
          <span className="chevron-toggle">{showMats ? "▲" : "▼"}</span>
        </button>

        {showMats && (
          <div className="materials-list-container">
            <div className="materials-header-actions">
              <button className="link-button" onClick={onSelectAllMats}>
                Selecionar todas as partes
              </button>
            </div>
            <div className="materials-list">
              {mats.map((m) => {
                const checked = selected.includes(m.uuid);
                return (
                  <label key={m.uuid} className={`material-checkbox-item ${checked ? "checked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMat(m.uuid)}
                    />
                    <span className="material-name">{m.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Detected Palette from Photos */}
      {palette.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <div className="title-with-icon">
                <IconSparkles size={16} />
                <span className="card-title">Cores Detectadas nas Fotos</span>
              </div>
              <span className="card-subtitle">Identificadas por inteligência de visão</span>
            </div>
          </div>

          <button
            className="btn-secondary w-full"
            style={{ marginBottom: 10 }}
            onClick={() => {
              const t = tonesFromPalette(palette);
              if (t) pickTones(t);
            }}
          >
            Aplicar tons automáticos da foto
          </button>

          <div className="swatches-grid">
            {palette.map((s) => (
              <button
                key={s.hex}
                className="swatch-bubble"
                style={{ backgroundColor: s.hex }}
                title={`${s.hex} · ${Math.round(s.share * 100)}% de presença`}
                onClick={() => pick(s.hex)}
              >
                <span className="swatch-share">{Math.round(s.share * 100)}%</span>
              </button>
            ))}
          </div>

          <div className="section-divider" />
          <span className="field-label">Harmonias sugeridas</span>
          <div className="swatches-grid">
            {suggest(palette[0].hex).map((s) => (
              <button
                key={s.name}
                className="swatch-bubble"
                style={{ backgroundColor: s.hex }}
                title={`${s.name}: ${s.hex}`}
                onClick={() => pick(s.hex)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Curated Presets */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <span className="card-title">Cores Consagradas</span>
            <span className="card-subtitle">Presets de alto padrão automobilístico</span>
          </div>
        </div>

        <div className="presets-list">
          {PRESETS.map((s) => (
            <button
              key={s.hex}
              className="preset-pill"
              onClick={() =>
                s.base && s.highlight && s.shadow
                  ? pickTones({ base: s.base, highlight: s.highlight, shadow: s.shadow })
                  : pick(s.hex)
              }
              title={s.name}
            >
              <span className="preset-swatch" style={{ backgroundColor: s.hex }} />
              <span className="preset-title">{s.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* OEM Factory Colors */}
      <FactoryColors onPick={pickTones} />

      {/* Custom Palette */}
      <MyPalette current={tones} onPick={pickTones} />
    </div>
  );
}

