import { useState } from "react";
import { IconCheck, IconClose, IconSettings } from "./Icons";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasMeshy: boolean;
  hasImagin: boolean;
  hasPlate: boolean;
  onRefreshSettings: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  hasMeshy,
  hasImagin,
  hasPlate,
  onRefreshSettings,
}: SettingsModalProps) {
  const [meshyKey, setMeshyKey] = useState("");
  const [imaginKey, setImaginKey] = useState("");
  const [plateToken, setPlateToken] = useState("");
  const [status, setStatus] = useState<string>("");

  if (!isOpen) return null;

  const handleSaveMeshy = async () => {
    if (!meshyKey.trim()) return;
    await window.api.setMeshyKey(meshyKey.trim());
    setMeshyKey("");
    setStatus("Chave Meshy 3D atualizada!");
    onRefreshSettings();
    setTimeout(() => setStatus(""), 3000);
  };

  const handleSaveImagin = async () => {
    if (!imaginKey.trim()) return;
    await window.api.setImaginKey(imaginKey.trim());
    setImaginKey("");
    setStatus("Chave Imagin.studio atualizada!");
    onRefreshSettings();
    setTimeout(() => setStatus(""), 3000);
  };

  const handleSavePlate = async () => {
    if (!plateToken.trim()) return;
    await window.api.setPlateToken(plateToken.trim());
    setPlateToken("");
    setStatus("Token da API Placas atualizado!");
    onRefreshSettings();
    setTimeout(() => setStatus(""), 3000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <IconSettings size={20} className="modal-icon" />
            <div>
              <h3>Configurações de APIs</h3>
              <p className="modal-subtitle">Conecte serviços para habilitar IA, cores de montadoras e busca por placa.</p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Fechar">
            <IconClose size={18} />
          </button>
        </div>

        {status && <div className="modal-toast-success">{status}</div>}

        <div className="modal-content">
          {/* Meshy API */}
          <div className="setting-card">
            <div className="setting-header">
              <span className="setting-name">Meshy 3D AI</span>
              <span className={`badge ${hasMeshy ? "badge-success" : "badge-muted"}`}>
                {hasMeshy ? "Conectado" : "Não configurado"}
              </span>
            </div>
            <p className="setting-desc">Geração de malha 3D completa por IA a partir de fotos do carro.</p>
            <div className="input-group">
              <input
                type="password"
                placeholder={hasMeshy ? "Trocar chave da API Meshy…" : "Insira sua API Key da Meshy…"}
                value={meshyKey}
                onChange={(e) => setMeshyKey(e.target.value)}
              />
              <button className="btn-secondary" disabled={!meshyKey.trim()} onClick={handleSaveMeshy}>
                Salvar
              </button>
            </div>
          </div>

          {/* Imagin.studio */}
          <div className="setting-card">
            <div className="setting-header">
              <span className="setting-name">Imagin.studio (Cores de Fábrica)</span>
              <span className={`badge ${hasImagin ? "badge-success" : "badge-muted"}`}>
                {hasImagin ? "Conectado" : "Não configurado"}
              </span>
            </div>
            <p className="setting-desc">Catálogo oficial de códigos e tons de pintura de montadoras automotivas.</p>
            <div className="input-group">
              <input
                type="password"
                placeholder={hasImagin ? "Trocar chave da Imagin.studio…" : "Insira a customer key da Imagin.studio…"}
                value={imaginKey}
                onChange={(e) => setImaginKey(e.target.value)}
              />
              <button className="btn-secondary" disabled={!imaginKey.trim()} onClick={handleSaveImagin}>
                Salvar
              </button>
            </div>
          </div>

          {/* API Placas */}
          <div className="setting-card">
            <div className="setting-header">
              <span className="setting-name">API Consulta de Placas</span>
              <span className={`badge ${hasPlate ? "badge-success" : "badge-muted"}`}>
                {hasPlate ? "Conectado" : "Não configurado"}
              </span>
            </div>
            <p className="setting-desc">Identificação automática de cor oficial, marca, modelo e ano pela placa Mercosul.</p>
            <div className="input-group">
              <input
                type="password"
                placeholder={hasPlate ? "Trocar token da API Placas…" : "Insira seu token da API de Placas…"}
                value={plateToken}
                onChange={(e) => setPlateToken(e.target.value)}
              />
              <button className="btn-secondary" disabled={!plateToken.trim()} onClick={handleSavePlate}>
                Salvar
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}

