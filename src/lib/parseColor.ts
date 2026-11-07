import { PRESETS } from "./colors";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

const PT: Record<string, string> = {
  preto: "#0b0b0d", branco: "#f2f1ec", prata: "#a9adb3", cinza: "#6b6f75", grafite: "#3a3d42",
  vermelho: "#c40d1e", azul: "#1d3f8f", "azul marinho": "#10244d", "azul claro": "#5aa9e6",
  verde: "#1f7a3a", "verde escuro": "#12392b", "verde claro": "#6fcf6f", amarelo: "#f4c20d",
  laranja: "#e8591a", marrom: "#4a2f20", bege: "#cdbd9b", vinho: "#5a1020", roxo: "#5b2a86",
  rosa: "#e85d9b", dourado: "#b08d3c", bronze: "#8c5a2b", turquesa: "#1aa6a6", champagne: "#d8c9a3",
};
for (const p of PRESETS) PT[norm(p.name)] = p.hex;

const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

/** Aceita "#f00", "ff0000", "rgb(255,0,0)", "255 0 0", nomes em PT ("azul marinho") ou CSS ("tomato"). */
export function parseColor(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  let m = /^#?([0-9a-f]{3})$/i.exec(t);
  if (m) return "#" + [...m[1]].map((c) => c + c).join("").toLowerCase();
  m = /^#?([0-9a-f]{6})$/i.exec(t);
  if (m) return "#" + m[1].toLowerCase();
  m = /^(?:rgb\()?\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)?$/i.exec(t);
  if (m) return +m[1] > 255 || +m[2] > 255 || +m[3] > 255 ? null : toHex(+m[1], +m[2], +m[3]);
  const pt = PT[norm(t)];
  if (pt) return pt;
  // nomes CSS em inglês: valida pelo próprio navegador
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.fillStyle = "#010203";
  ctx.fillStyle = t;
  const out = ctx.fillStyle as string;
  if (out === "#010203" && norm(t) !== "#010203") return null;
  return /^#[0-9a-f]{6}$/i.test(out) ? out : null;
}
