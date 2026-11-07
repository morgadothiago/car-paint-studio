import { useEffect, useState } from "react";
import { deriveTones, type Tones } from "../lib/colors";
import type { ColorEntry } from "../lib/types";

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
    <section>
      <h2>Cores de fábrica</h2>
      {!hasKey && (
        <>
          <input type="password" placeholder="Chave (customer) da Imagin.studio" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
          <button
            disabled={!keyInput.trim()}
            onClick={async () => {
              await window.api.setImaginKey(keyInput.trim());
              setKeyInput("");
              setHasKey(true);
            }}
          >
            Salvar chave
          </button>
        </>
      )}
      <select value={make} onChange={(e) => setMake(e.target.value)}>
        <option value="">Todas as marcas</option>
        {allMakes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <div className="row">
        <input style={{ flex: 1 }} placeholder="Modelo (ex.: polo)" value={model} onChange={(e) => setModel(e.target.value)} />
        <input style={{ width: 70 }} placeholder="Ano" maxLength={4} value={year} onChange={(e) => setYear(e.target.value)} />
      </div>
      <button className="primary" disabled={!hasKey || !make || busy} onClick={sync} title="Baixa as cores da marca (ou do modelo/ano) e guarda na base local">
        {busy ? "Buscando…" : "Buscar e salvar na base"}
      </button>
      <label className="muted">
        Importar CSV (make,model,yearFrom,yearTo,code,name,base,highlight,shadow)
        <input type="file" accept=".csv,text/csv" onChange={(e) => importCsv(e.target.files?.[0])} />
      </label>
      {msg && <p className="muted">{msg}</p>}
      {err && <p className="err">{err}</p>}

      <input placeholder="Filtrar por nome ou código" value={text} onChange={(e) => setText(e.target.value)} />
      <p className="muted">{items.length ? `${items.length} cores na base` : "Base vazia. Busque uma marca ou importe um CSV."}</p>
      <div className="fc-list">
        {items.map((c, i) => {
          const t = toTones(c);
          return (
            <button key={i} className="fc" onClick={() => onPick(t)} title={`Base ${t.base} · Brilho ${t.highlight} · Sombra ${t.shadow}${c.source === "estimado" ? " · hex estimado" : ""}`}>
              <span style={{ background: `linear-gradient(135deg, ${t.highlight} 0 33%, ${t.base} 33% 66%, ${t.shadow} 66%)` }} />
              <b>{c.name}{c.source === "estimado" ? " ≈" : ""}</b>
              <small>
                {c.make}
                {c.model ? ` ${c.model}` : ""}
                {c.yearFrom ? ` ${c.yearFrom}${c.yearTo && c.yearTo !== c.yearFrom ? `–${c.yearTo}` : ""}` : ""} · {c.code}
              </small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
