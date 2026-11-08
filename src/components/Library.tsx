import React from "react";
import type { LibEntry } from "../lib/types";
import { IconCube, IconTrash } from "./Icons";

interface Props {
  items: LibEntry[];
  currentId: string | null;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export default function Library({ items, currentId, onOpen, onRename, onDelete }: Props) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-group">
          <div className="title-with-icon">
            <IconCube size={16} />
            <span className="card-title">Biblioteca de Modelos 3D</span>
          </div>
          <span className="card-subtitle">
            {items.length === 0
              ? "Nenhum modelo salvo"
              : `${items.length} ${items.length === 1 ? "modelo armazenado" : "modelos armazenados"}`}
          </span>
        </div>
      </div>

      {!items.length ? (
        <div className="empty-state-box">
          <span className="empty-state-text">
            Nenhum modelo reconstruído na biblioteca. Seus scans salvos ficarão aqui para reutilização imediata sem gastar créditos.
          </span>
        </div>
      ) : (
        <div className="library-grid">
          {items.map((it) => {
            const isActive = it.id === currentId;
            return (
              <div key={it.id} className={`lib-card ${isActive ? "active" : ""}`}>
                <div className="lib-thumb-box">
                  {it.thumb ? (
                    <img src={it.thumb} alt={it.name} className="lib-thumb-img" />
                  ) : (
                    <div className="lib-thumb-placeholder">
                      <IconCube size={24} />
                    </div>
                  )}
                  {isActive && <div className="lib-active-badge">ATIVO NO ESTÚDIO</div>}
                </div>

                <div className="lib-meta">
                  <input
                    className="lib-title-input"
                    defaultValue={it.name}
                    key={it.name}
                    title="Clique para renomear"
                    onBlur={(e) =>
                      e.target.value.trim() &&
                      e.target.value !== it.name &&
                      onRename(it.id, e.target.value.trim())
                    }
                  />

                  <div className="lib-actions-row">
                    <button
                      className={`btn-open-model ${isActive ? "btn-already-open" : ""}`}
                      onClick={() => onOpen(it.id)}
                      disabled={isActive}
                    >
                      {isActive ? "Em exibição" : "Abrir"}
                    </button>
                    <button
                      className="btn-delete-model"
                      title="Excluir modelo"
                      onClick={() => {
                        if (
                          confirm(
                            `Excluir "${it.name}"? O arquivo 3D será removido permanentemente.`,
                          )
                        ) {
                          onDelete(it.id);
                        }
                      }}
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
