import { useEffect, useState } from "react";
import { parseColor } from "../lib/parseColor";
import { deriveTones, type Tones } from "../lib/colors";

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

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* sem armazenamento: paleta vale só nesta sessão */
    }
  }, [items]);

  const apply = () => {
    const hex = parseColor(text);
    if (!hex) return setErr(`Cor não reconhecida: "${text}". Tente #c40d1e, rgb(196,13,30) ou "azul marinho".`);
    setErr("");
    onPick(deriveTones(hex));
  };

  const save = () => {
    const typed = parseColor(text);
    const t = typed ? deriveTones(typed) : current; // sem texto: salva os 3 tons atuais
    setItems((s) =>
      s.some((x) => x.hex === t.base && x.highlight === t.highlight && x.shadow === t.shadow)
        ? s
        : [...s, { name: name.trim() || t.base, hex: t.base, highlight: t.highlight, shadow: t.shadow }],
    );
    setName("");
  };

  return (
    <>
      <p className="muted">Digitar uma cor</p>
      <div className="row">
        <input
          style={{ flex: 1 }}
          placeholder="#c40d1e, rgb(…) ou azul marinho"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
        />
        <button onClick={apply} disabled={!text.trim()}>
          Aplicar
        </button>
      </div>
      {err && <p className="err">{err}</p>}

      <p className="muted">Minha paleta</p>
      <div className="row">
        <input style={{ flex: 1 }} placeholder="Nome (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
        <button onClick={save} title="Salva a cor digitada, ou os 3 tons atuais se o campo estiver vazio">
          + Salvar cor
        </button>
      </div>
      <div className="swatches">
        {items.map((s) => (
          <span key={`${s.hex}${s.highlight}${s.shadow}`} className="chip">
            <button
              title={`${s.name}\nBase ${s.hex} · Brilho ${s.highlight ?? "auto"} · Sombra ${s.shadow ?? "auto"}`}
              style={{ background: `linear-gradient(135deg, ${s.highlight ?? s.hex} 0 33%, ${s.hex} 33% 66%, ${s.shadow ?? s.hex} 66%)` }}
              onClick={() => {
                const d = deriveTones(s.hex);
                onPick({ base: s.hex, highlight: s.highlight ?? d.highlight, shadow: s.shadow ?? d.shadow });
              }}
            />
            <i title="Remover" onClick={() => setItems((x) => x.filter((y) => y !== s))}>
              ×
            </i>
          </span>
        ))}
        {!items.length && <span className="muted">Vazia. Escolha uma cor e clique em "+ Salvar cor".</span>}
      </div>
    </>
  );
}
