import { useEffect, useState, useRef } from "react";
import { deriveTones, type Tones } from "../lib/colors";
import type { ColorEntry } from "../lib/types";
import { IconSearch, IconUpload, IconSparkles } from "./Icons";

// Slugs de marcas vendidas no Brasil (formato usado pela Imagin.studio).
const BR_MAKES = [
  "chevrolet", "fiat", "volkswagen", "ford", "toyota", "honda", "hyundai", "renault", "nissan", "jeep",
  "peugeot", "citroen", "mitsubishi", "kia", "bmw", "mercedes-benz", "audi", "volvo", "land-rover",
  "ram", "mini", "suzuki", "subaru", "lexus", "porsche", "byd", "chery", "jac",
];

/** CSV simples com aspas. Cabeçalho: make,model,yearFrom,yearTo,code,name,base,highlight,shadow */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [],
    f = "",
    q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (f += '"', i++);
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === ";") (cur.push(f), (f = ""));
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      cur.push(f);
      f = "";
      if (cur.some((x) => x.trim())) rows.push(cur);
      cur = [];
    } else f += c;
  }
  cur.push(f);
  if (cur.some((x) => x.trim())) rows.push(cur);
  const head = (rows.shift() ?? []).map((h) => h.trim());
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const toTones = (c: ColorEntry): Tones => {
  const d = deriveTones(c.base);
  return { base: c.base, highlight: c.highlight ?? d.highlight, shadow: c.shadow ?? d.shadow };
};

export default function FactoryColors({ onPick }: { onPick: (t: Tones) => void }) {
  const [hasKey, setHasKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [text, setText] = useState("");
  const [items, setItems] = useState<ColorEntry[]>([]);
  const [makes, setMakes] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const csvFileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const y = /^\d{4}$/.test(year) ? +year : undefined;
    setItems((await window.api.colorsList({ make: make || undefined, text, year: y })).slice(0, 200));
    setMakes(await window.api.colorsMakes());
  };

  useEffect(() => {
    window.api.getSettings().then((s) => setHasKey(s.hasImaginKey));
  }, []);
  useEffect(() => {
    refresh();
  }, [make, text, year]);

  const fail = (e: unknown) =>
    setErr(String((e as Error).message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));

  const sync = async () => {
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      const y = /^\d{4}$/.test(year) ? +year : undefined;
      const r = await window.api.colorsSync({ make, modelFamily: model.trim() || undefined, modelYear: model.trim() ? y : undefined });
      setMsg(`${r.total} cores: ${r.added} novas, ${r.updated} atualizadas.`);
      await refresh();
    } catch (e) {
      fail(e);
    }
    setBusy(false);
  };

  const importCsv = async (file?: File) => {
    if (!file) return;
    setErr("");
    setMsg("");
    try {
      const r = await window.api.colorsImport(parseCsv(await file.text()));
      setMsg(`CSV: ${r.added} novas, ${r.updated} atualizadas.` + (r.rejected.length ? ` Rejeitadas (${r.rejected.length}): ${r.rejected.slice(0, 5).join(", ")}` : ""));
      await refresh();
    } catch (e) {
      fail(e);
    }
  };

  const allMakes = [...new Set([...BR_MAKES, ...makes])];

  return (
    <div className="card collapsible-card">
      <button className="card-collapsible-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="card-title-group">
          <div className="title-with-icon">
            <IconSparkles size={16} />
            <span className="card-title">Cores Originais de Fábrica (OEM)</span>
          </div>
          <span className="card-subtitle">
            {items.length > 0 ? `${items.length} cores catalogadas` : "Catálogo oficial de montadoras"}
          </span>
        </div>
        <span className="chevron-toggle">{isExpanded ? "▲" : "▼"}</span>
      </button>

      {isExpanded && (
        <div className="factory-colors-body">
          {!hasKey && (
            <div className="alert-box">
              <span>Chave Imagin.studio necessária para sincronizar novas marcas.</span>
              <div className="input-group" style={{ marginTop: 8 }}>
                <input
                  type="password"
                  placeholder="Customer key da Imagin.studio…"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                />
                <button
                  className="btn-secondary"
                  disabled={!keyInput.trim()}
                  onClick={async () => {
                    await window.api.setImaginKey(keyInput.trim());
                    setKeyInput("");
                    setHasKey(true);
                  }}
                >
                  Salvar
                </button>
              </div>
            </div>
          )}

          {/* Filters Grid */}
          <div className="form-group">
            <label className="field-label">Montadora</label>
            <select className="custom-select" value={make} onChange={(e) => setMake(e.target.value)}>
              <option value="">Todas as montadoras</option>
              {allMakes.map((m) => (
                <option key={m} value={m}>
                  {m.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="field-label">Modelo (opcional)</label>
              <input
                placeholder="Ex.: Polo, Civic, 911"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="field-label">Ano</label>
              <input
                placeholder="Ex.: 2024"
                maxLength={4}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
          </div>

          <div className="btn-group-row">
            <button
              className="btn-primary"
              style={{ flex: 2 }}
              disabled={!hasKey || !make || busy}
              onClick={sync}
              title="Baixa as cores da montadora e armazena na base de dados local"
            >
              {busy ? "Sincronizando…" : "Buscar Cores da Marca"}
            </button>

            <button
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => csvFileRef.current?.click()}
              title="Importar planilha CSV com códigos de cores"
            >
              <IconUpload size={14} /> Importar CSV
            </button>
            <input
              type="file"
              ref={csvFileRef}
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={(e) => importCsv(e.target.files?.[0])}
            />
          </div>

          {msg && <div className="form-success-box">{msg}</div>}
          {err && <div className="form-error-box">{err}</div>}

          {/* Search in catalog */}
          <div className="search-input-wrapper">
            <IconSearch size={14} className="search-icon" />
            <input
              className="search-input"
              placeholder="Filtrar por nome ou código de tinta…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          {/* Color items list */}
          <div className="factory-colors-list">
            {items.map((c, i) => {
              const t = toTones(c);
              return (
                <button
                  key={i}
                  className="factory-color-item"
                  onClick={() => onPick(t)}
                  title={`Base ${t.base} · Brilho ${t.highlight} · Sombra ${t.shadow}${c.source === "estimado" ? " · hex estimado" : ""}`}
                >
                  <span
                    className="fc-swatch"
                    style={{
                      background: `linear-gradient(135deg, ${t.highlight} 0 33%, ${t.base} 33% 66%, ${t.shadow} 66%)`,
                    }}
                  />
                  <div className="fc-details">
                    <span className="fc-name">
                      {c.name}
                      {c.source === "estimado" && <span className="estimated-tag">≈</span>}
                    </span>
                    <span className="fc-sub">
                      {c.make?.toUpperCase()}
                      {c.model ? ` • ${c.model}` : ""}
                      {c.yearFrom ? ` • ${c.yearFrom}${c.yearTo && c.yearTo !== c.yearFrom ? `–${c.yearTo}` : ""}` : ""}{" "}
                      • Cód: {c.code}
                    </span>
                  </div>
                </button>
              );
            })}
            {!items.length && (
              <div className="empty-state-box">
                <span className="empty-state-text">
                  Nenhuma cor encontrada com os filtros atuais. Selecione uma montadora para sincronizar.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
