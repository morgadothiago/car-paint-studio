export interface Swatch {
  hex: string;
  share: number; // 0..1
}

const hex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

/** K-means sobre pixels da região central (onde normalmente está o carro). */
export async function extractPalette(images: string[], k = 6): Promise<Swatch[]> {
  const pts: number[][] = [];
  for (const src of images) {
    const img = await load(src);
    const c = document.createElement("canvas");
    c.width = c.height = 48;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const sw = img.naturalWidth * 0.5;
    const sh = img.naturalHeight * 0.5;
    ctx.drawImage(img, img.naturalWidth * 0.25, img.naturalHeight * 0.25, sw, sh, 0, 0, 48, 48);
    const d = ctx.getImageData(0, 0, 48, 48).data;
    for (let i = 0; i < d.length; i += 4) pts.push([d[i], d[i + 1], d[i + 2]]);
  }
  if (!pts.length) return [];

  let cent = Array.from({ length: k }, (_, i) => pts[Math.floor((i * pts.length) / k)].slice());
  const assign = new Array<number>(pts.length).fill(0);
  for (let it = 0; it < 12; it++) {
    pts.forEach((p, i) => {
      let best = 0,
        bd = Infinity;
      cent.forEach((c, ci) => {
        const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (dd < bd) ((bd = dd), (best = ci));
      });
      assign[i] = best;
    });
    const sum = cent.map(() => [0, 0, 0, 0]);
    pts.forEach((p, i) => {
      const s = sum[assign[i]];
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
      s[3]++;
    });
    cent = cent.map((c, i) => (sum[i][3] ? sum[i].slice(0, 3).map((v) => v / sum[i][3]) : c));
  }
  const counts = cent.map((_, i) => assign.filter((a) => a === i).length);
  return cent
    .map((c, i) => ({ hex: hex(c[0], c[1], c[2]), share: counts[i] / pts.length }))
    .filter((s) => s.share > 0)
    .sort((a, b) => b.share - a.share);
}

export function hexToHsl(h: string): [number, number, number] {
  const r = parseInt(h.slice(1, 3), 16) / 255,
    g = parseInt(h.slice(3, 5), 16) / 255,
    b = parseInt(h.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const hh =
    max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(hh * 60 + 360) % 360, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return hex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/** Sugestões a partir da cor atual: análogas, complementar, tríade, versões escura/clara. */
export function suggest(base: string): { name: string; hex: string }[] {
  const [h, s, l] = hexToHsl(base);
  const rot = (d: number) => hslToHex((h + d + 360) % 360, s, l);
  return [
    { name: "Complementar", hex: rot(180) },
    { name: "Análoga +30°", hex: rot(30) },
    { name: "Análoga −30°", hex: rot(-30) },
    { name: "Tríade +120°", hex: rot(120) },
    { name: "Tríade −120°", hex: rot(-120) },
    { name: "Mais escura", hex: hslToHex(h, s, Math.max(0.05, l - 0.18)) },
    { name: "Mais clara", hex: hslToHex(h, s, Math.min(0.92, l + 0.18)) },
  ];
}

export interface Tones {
  base: string; // tom base (cor predominante)
  highlight: string; // brilho máximo (luz direta)
  shadow: string; // áreas de sombra (curvas e vincos)
}

/** Gera brilho e sombra a partir do tom base (±13% de luminosidade, mesma matiz e saturação). */
export function deriveTones(base: string): Tones {
  const [h, s, l] = hexToHsl(base);
  return {
    base,
    highlight: hslToHex(h, s, Math.min(0.97, l + 0.13)),
    shadow: hslToHex(h, s, Math.max(0.03, l - 0.14)),
  };
}

export const lumHex = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

/** Tons reais a partir das cores detectadas nas fotos: mais clara e mais escura próximas do tom base. */
export function tonesFromPalette(palette: Swatch[]): Tones | null {
  if (!palette.length) return null;
  const base = palette[0].hex;
  const lb = lumHex(base);
  const dist = (a: string, b: string) =>
    Math.hypot(...[1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)));
  const near = palette.slice(1).filter((x) => dist(x.hex, base) < 110);
  const hi = near.filter((x) => lumHex(x.hex) > lb + 4).sort((a, b) => lumHex(b.hex) - lumHex(a.hex))[0];
  const lo = near.filter((x) => lumHex(x.hex) < lb - 4).sort((a, b) => lumHex(a.hex) - lumHex(b.hex))[0];
  const d = deriveTones(base);
  return { base, highlight: hi?.hex ?? d.highlight, shadow: lo?.hex ?? d.shadow };
}

export interface Preset extends Partial<Tones> {
  name: string;
  hex: string;
}

export const PRESETS: Preset[] = [
  { name: "Prata Gelo", hex: "#c2c6c7", base: "#c2c6c7", highlight: "#e1e4e6", shadow: "#9fa3a6" },
  { name: "Preto Profundo", hex: "#0b0b0d" },
  { name: "Branco Pérola", hex: "#f2f1ec" },
  { name: "Prata Metálico", hex: "#a9adb3" },
  { name: "Grafite", hex: "#3a3d42" },
  { name: "Vermelho Ferrari", hex: "#c40d1e" },
  { name: "Azul Marinho", hex: "#10244d" },
  { name: "Verde Britânico", hex: "#12392b" },
  { name: "Amarelo Sol", hex: "#f4c20d" },
  { name: "Laranja", hex: "#e8591a" },
  { name: "Vinho", hex: "#5a1020" },
];
