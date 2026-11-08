import { useEffect, useState } from "react";
import { IconSearch } from "./Icons";

const COLOR_HEX: Record<string, string> = {
  BRANCA: "#f2f1ec",
  PRETA: "#0b0b0d",
  PRATA: "#a9adb3",
  CINZA: "#6b6f75",
  VERMELHA: "#c40d1e",
  AZUL: "#1d3f8f",
  VERDE: "#12392b",
  AMARELA: "#f4c20d",
  LARANJA: "#e8591a",
  MARROM: "#4a2f20",
  BEGE: "#cdbd9b",
  VINHO: "#5a1020",
  DOURADA: "#b08d3c",
};

interface Info {
  placa: string;
  marca?: string;
  modelo?: string;
  ano?: string;
  cor?: string;
}

interface PlateProps {
  onColor: (hex: string) => void;
  onOpenSettings?: () => void;
}

export default function Plate({ onColor, onOpenSettings }: PlateProps) {
  const [plate, setPlate] = useState("");
  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.api.getSettings().then((s) => setHasToken(s.hasPlateToken));
  }, []);

  const search = async () => {
    if (!plate.trim()) return;
    setError("");
    setInfo(null);
    setBusy(true);
    try {
      const r = await window.api.lookupPlate(plate);
      setInfo(r);
      const hex = r.cor && COLOR_HEX[r.cor.toUpperCase().trim()];
      if (hex) onColor(hex);
    } catch (e) {
      setError(String((e as Error).message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    }
    setBusy(false);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-group">
          <span className="card-title">Consulta de Placa Mercosul</span>
          <span className="card-subtitle">Identificação de montadora, modelo e cor original</span>
        </div>
      </div>

      {!hasToken && (
        <div className="alert-box">
          <div className="alert-text">
            <span>Token da API de Placas não configurado.</span>
            {onOpenSettings && (
              <button className="link-button" onClick={onOpenSettings}>
                Configurar em Ajustes
              </button>
            )}
          </div>
          <div className="input-group" style={{ marginTop: 8 }}>
            <input
              type="password"
              placeholder="Inserir token diretamente…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button
              className="btn-secondary"
              disabled={!token.trim()}
              onClick={async () => {
                await window.api.setPlateToken(token.trim());
                setToken("");
                setHasToken(true);
              }}
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* Styled Mercosul Plate Input Box */}
      <div className="mercosul-plate-box">
        <div className="mercosul-header">
          <span className="mercosul-flag">🇧🇷</span>
          <span className="mercosul-title">BRASIL</span>
          <span className="mercosul-br">BR</span>
        </div>
        <div className="mercosul-body">
          <input
            className="mercosul-input"
            placeholder="ABC1D23"
            maxLength={8}
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && plate && hasToken && search()}
          />
          <button
            className="btn-primary"
            disabled={!plate || !hasToken || busy}
            onClick={search}
          >
            <IconSearch size={16} />
            <span>{busy ? "Buscando…" : "Consultar"}</span>
          </button>
        </div>
      </div>

      {error && <div className="form-error-box">{error}</div>}

      {info && (
        <div className="vehicle-result-card">
          <div className="vehicle-result-header">
            <span className="vehicle-plate-badge">{info.placa}</span>
            {info.cor && (
              <div className="vehicle-color-pill">
                <span
                  className="color-dot"
                  style={{ backgroundColor: COLOR_HEX[info.cor.toUpperCase().trim()] || "#888" }}
                />
                <span>{info.cor}</span>
              </div>
            )}
          </div>
          <div className="vehicle-specs-grid">
            <div className="spec-item">
              <span className="spec-label">Marca</span>
              <span className="spec-val">{info.marca ?? "—"}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Modelo</span>
              <span className="spec-val">{info.modelo ?? "—"}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Ano Modelo</span>
              <span className="spec-val">{info.ano ?? "—"}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Cor Oficial</span>
              <span className="spec-val">{info.cor ?? "—"}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
