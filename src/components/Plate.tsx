import { useEffect, useState } from "react";

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

export default function Plate({ onColor }: { onColor: (hex: string) => void }) {
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
    <section>
      <h2>Consultar por placa</h2>
      {!hasToken && (
        <>
          <input type="password" placeholder="Token da API Placas" value={token} onChange={(e) => setToken(e.target.value)} />
          <button
            disabled={!token.trim()}
            onClick={async () => {
              await window.api.setPlateToken(token.trim());
              setToken("");
              setHasToken(true);
            }}
          >
            Salvar token
          </button>
        </>
      )}
      <div className="row">
        <input
          style={{ flex: 1 }}
          placeholder="ABC1D23"
          maxLength={8}
          value={plate}
          onChange={(e) => setPlate(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && plate && hasToken && search()}
        />
        <button className="primary" disabled={!plate || !hasToken || busy} onClick={search}>
          {busy ? "…" : "Buscar"}
        </button>
      </div>
      {error && <p className="err">{error}</p>}
      {info && (
        <dl className="info">
          <dt>Placa</dt>
          <dd>{info.placa}</dd>
          <dt>Marca</dt>
          <dd>{info.marca ?? "—"}</dd>
          <dt>Modelo</dt>
          <dd>{info.modelo ?? "—"}</dd>
          <dt>Ano</dt>
          <dd>{info.ano ?? "—"}</dd>
          <dt>Cor</dt>
          <dd>{info.cor ?? "—"}</dd>
        </dl>
      )}
    </section>
  );
}
