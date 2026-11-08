import { useEffect, useState } from "react";
import { parseColor } from "../lib/parseColor";
import { deriveTones, type Tones } from "../lib/colors";
import { IconSparkles, IconClose } from "./Icons";

interface Saved {
  name: string;
  hex: string; // tom base
  highlight?: string;
  shadow?: string;
}
const KEY = "carpaint.myPalette";

function load(): Saved[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => x && /^#[0-9a-f]{6}$/i.test(x.hex)) : [];
  } catch {
    return [];
  }
}

export default function MyPalette({ current, onPick }: { current: Tones; onPick: (t: Tones) => void }) {
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [items, setItems] = useState<Saved[]>(load);
  const [err, setErr] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* sem armazenamento */
    }
  }, [items]);

  const apply = () => {
    const hex = parseColor(text);
    if (!hex) return setErr(`Cor não reconhecida: "${text}". Exemplos: #c40d1e, rgb(196,13,30) ou "azul marinho".`);
    setErr("");
    onPick(deriveTones(hex));
  };

  const save = () => {
    const typed = parseColor(text);
    const t = typed ? deriveTones(typed) : current;
    setItems((s) =>
      s.some((x) => x.hex === t.base && x.highlight === t.highlight && x.shadow === t.shadow)
        ? s
        : [...s, { name: name.trim() || t.base.toUpperCase(), hex: t.base, highlight: t.highlight, shadow: t.shadow }],
    );
    setName("");
  };

  return (
    <div className="card collapsible-card">
      <button className="card-collapsible-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="card-title-group">
          <div className="title-with-icon">
            <IconSparkles size={16} />
            <span className="card-title">Minha Paleta & Cores Personalizadas</span>
          </div>
          <span className="card-subtitle">
            {items.length} {items.length === 1 ? "cor salva" : "cores salvas"}
          </span>
        </div>
        <span className="chevron-toggle">{isExpanded ? "▲" : "▼"}</span>
      </button>

      {isExpanded && (
        <div className="palette-body">
          {/* Natural language color input */}
          <div className="form-group">
            <label className="field-label">Digitar cor por nome, hex ou RGB</label>
            <div className="input-group">
              <input
                placeholder="Ex.: #c40d1e, rgb(196,13,30) ou azul petróleo"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && apply()}
              />
              <button className="btn-secondary" onClick={apply} disabled={!text.trim()}>
                Aplicar
              </button>
            </div>
          </div>
          {err && <div className="form-error-box">{err}</div>}

          <div className="section-divider" />

          {/* Save current color */}
          <div className="form-group">
            <label className="field-label">Salvar cor na minha coleção</label>
            <div className="input-group">
              <input
                placeholder="Rótulo da cor (opcional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
              <button
                className="btn-primary"
                onClick={save}
                title="Salva a cor digitada ou a cor atual do carro se o campo estiver vazio"
              >
                + Salvar
              </button>
            </div>
          </div>

          {/* Saved Swatches chips */}
          <div className="saved-chips-grid">
            {items.map((s) => (
              <div key={`${s.hex}${s.highlight}${s.shadow}`} className="palette-chip-item">
                <button
                  className="palette-chip-btn"
                  title={`${s.name}\nBase: ${s.hex} · Brilho: ${s.highlight ?? "auto"} · Sombra: ${s.shadow ?? "auto"}`}
                  onClick={() => {
                    const d = deriveTones(s.hex);
                    onPick({ base: s.hex, highlight: s.highlight ?? d.highlight, shadow: s.shadow ?? d.shadow });
                  }}
                >
                  <span
                    className="chip-swatch-circle"
                    style={{
                      background: `linear-gradient(135deg, ${s.highlight ?? s.hex} 0 33%, ${s.hex} 33% 66%, ${s.shadow ?? s.hex} 66%)`,
                    }}
                  />
                  <span className="chip-name">{s.name}</span>
                </button>
                <button
                  className="chip-delete-btn"
                  title="Remover cor"
                  onClick={(e) => {
                    e.stopPropagation();
                    setItems((x) => x.filter((y) => y !== s));
                  }}
                >
                  <IconClose size={12} />
                </button>
              </div>
            ))}
            {!items.length && (
              <div className="empty-state-box">
                <span className="empty-state-text">
                  Nenhuma cor salva na sua paleta ainda. Escolha ou digite uma cor e clique em "+ Salvar".
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
