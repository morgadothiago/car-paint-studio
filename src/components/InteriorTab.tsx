import React from "react";
import { INTERIOR_LABELS, type InteriorCfg, type InteriorKey } from "../lib/CarViewer";
import { IconEye, IconXray, IconRotate360 } from "./Icons";

interface InteriorTabProps {
  interior: InteriorCfg;
  updateInterior: (cfg: InteriorCfg) => void;
  inside: boolean;
  onToggleInside: () => void;
  xray: boolean;
  onToggleXray: () => void;
}

export default function InteriorTab({
  interior,
  updateInterior,
  inside,
  onToggleInside,
  xray,
  onToggleXray,
}: InteriorTabProps) {
  const keys = Object.keys(INTERIOR_LABELS) as InteriorKey[];

  return (
    <div className="tab-pane">
      {/* Quick Viewport Navigation Shortcuts */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <span className="card-title">Câmera da Cabine</span>
            <span className="card-subtitle">Perspectivas para visualização interna</span>
          </div>
        </div>

        <div className="btn-group-row">
          <button
            className={`btn-action-tool ${inside ? "active" : ""}`}
            onClick={onToggleInside}
          >
            <IconEye size={16} />
            <span>{inside ? "Sair da Cabine" : "Entrar na Cabine"}</span>
          </button>

          <button
            className={`btn-action-tool ${xray ? "active" : ""}`}
            onClick={onToggleXray}
            title="Torna a lataria translúcida"
          >
            <IconXray size={16} />
            <span>{xray ? "Raio-X Ativo" : "Modo Raio-X"}</span>
          </button>
        </div>
      </div>

      {/* Interior Customization Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <span className="card-title">Componentes do Interior</span>
            <span className="card-subtitle">
              Peças procedurais inseridas no habitáculo interno do veículo
            </span>
          </div>
        </div>

        <div className="interior-list">
          {keys.map((k) => {
            const item = interior.items[k];
            return (
              <div key={k} className="interior-item-row">
                <label className="interior-item-toggle">
                  <input
                    type="checkbox"
                    checked={item.show}
                    onChange={(e) =>
                      updateInterior({
                        ...interior,
                        items: {
                          ...interior.items,
                          [k]: { ...item, show: e.target.checked },
                        },
                      })
                    }
                  />
                  <span className="interior-item-name">{INTERIOR_LABELS[k]}</span>
                </label>

                <div className="color-picker-wrapper small">
                  <input
                    type="color"
                    className="native-color-input"
                    value={item.color}
                    disabled={!item.show}
                    onChange={(e) =>
                      updateInterior({
                        ...interior,
                        items: {
                          ...interior.items,
                          [k]: { ...item, color: e.target.value },
                        },
                      })
                    }
                  />
                  <span
                    className={`color-preview-circle ${!item.show ? "disabled" : ""}`}
                    style={{ backgroundColor: item.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="section-divider" />

        {/* Invert Orientation Button */}
        <button
          className="btn-secondary w-full"
          onClick={() => updateInterior({ ...interior, flip: !interior.flip })}
          title="Inverte a orientação frontal do interior caso o modelo scanneado esteja voltado para trás"
        >
          <IconRotate360 size={16} />
          <span>Inverter Direção Frente/Trás {interior.flip ? "(Invertido)" : "(Padrão)"}</span>
        </button>
      </div>
    </div>
  );
}

