export interface Slot {
  id: string;
  kind: "fuse" | "relay";
  label: string; // número do fusível ou nome do relé (F12, R7…)
  amp?: number;
  desc: string;
  via?: string; // id do relé que comanda este fusível (opcional)
  x?: number; // posição na foto da caixa (% da largura)
  y?: number; // (% da altura)
}

export interface FuseBox {
  id: string;
  name: string;
  cols: number; // colunas do painel gerado
  image?: string; // foto/diagrama da caixa (data URL)
  slots: Slot[];
}

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  data: string; // data URL (imagem ou PDF)
  pins?: { id: string; x: number; y: number; slot: string }[]; // pontos clicáveis ligados a fusíveis/relés (imagens)
}

export interface Vehicle {
  id: string;
  name: string;
  notes?: string;
  boxes: FuseBox[];
  schematics: Attachment[];
  updatedAt: number;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Cores padrão dos fusíveis de lâmina (ISO 8820). */
export const AMP_COLORS: Record<number, string> = {
  1: "#4a4a4a",
  2: "#8a8f94",
  3: "#a07ad0",
  4: "#e58bb5",
  5: "#c9a672",
  7.5: "#8c5a2b",
  10: "#d63b3b",
  15: "#3d8bff",
  20: "#f2c230",
  25: "#e8ecef",
  30: "#38b25a",
  35: "#4cc6c0",
  40: "#f08a2e",
  50: "#d63b3b",
  60: "#3d8bff",
};
export const ampColor = (a?: number) => (a ? AMP_COLORS[a] ?? "#9aa3ad" : "#9aa3ad");

const f = (label: string, amp: number | undefined, desc: string): Slot => ({ id: uid(), kind: "fuse", label, amp, desc });
const r = (label: string, desc: string): Slot => ({ id: uid(), kind: "relay", label, desc });

/** Exemplo: VW Santana 1993. Confira sempre com o manual do proprietário do seu carro. */
export function seedSantana(): Vehicle {
  const v = seedSantanaRaw();
  const slots = v.boxes[0].slots;
  const link = (relay: string, fuses: string[]) => {
    const rl = slots.find((x) => x.label === relay);
    if (rl) slots.filter((x) => fuses.includes(x.label) && x.kind === "fuse").forEach((x) => (x.via = rl.id));
  };
  link("R7", ["3"]); // buzina
  link("R10", ["13", "13G"]); // bomba de combustível
  link("R9", ["15"]); // limpador/lavador
  link("R11", ["12"]); // setas e pisca-alerta
  return v;
}

function seedSantanaRaw(): Vehicle {
  return {
    id: uid(),
    name: "Volkswagen Santana 1993 (exemplo)",
    notes:
      "Dados de exemplo baseados em tabelas públicas de fusíveis do Santana 1993. Podem variar por versão e mercado: confira com o manual do seu carro e edite livremente.",
    updatedAt: Date.now(),
    schematics: [],
    boxes: [
      {
        id: uid(),
        name: "Caixa de fusíveis e relés (painel)",
        cols: 8,
        slots: [
          f("1", 15, "Farol de neblina"),
          f("2", 15, "Aviso de farol aceso e temporizador"),
          f("3", 25, "Buzina, luz de freio, antena elétrica"),
          f("4", 10, "Rádio, relógio, luz do porta-malas, luz interna, espelho de cortesia, luz de leitura"),
          f("5", 20, "Ventilador do radiador (com climatização)"),
          f("6", 3, "Luz do compartimento do motor, lanterna dianteira/traseira direita"),
          f("7", 3, "Lanterna dianteira/traseira esquerda"),
          f("8", 10, "Farol alto direito, indicador de farol alto"),
          f("9", 10, "Farol alto esquerdo"),
          f("10", 10, "Farol baixo direito"),
          f("11", 10, "Farol baixo esquerdo"),
          f("12", 10, "Relé do ventilador traseiro, lâmpada do interruptor de luz, indicador do câmbio automático, velocímetro, marcha lenta, temporizador do desembaçador, setas"),
          f("13", 15, "Bomba de combustível, injeção eletrônica (álcool)"),
          f("13G", 5, "Bomba de combustível, injeção eletrônica (gasolina)"),
          f("14", 15, "Luzes da placa e internas, iluminação dos interruptores, farol de neblina, pisca-alerta"),
          f("15", 25, "Limpador e lavador do para-brisa"),
          f("16", 30, "Desembaçador do vidro traseiro"),
          f("17", 15, "Ventilação"),
          f("18", 30, "Acendedor de cigarros"),
          f("19", 30, "Ventilador do radiador"),
          f("20", 30, "Ventilador do radiador, 1ª velocidade (climatização)"),
          f("21", 15, "Ventilação, 4ª velocidade (climatização)"),
          f("23", 10, "Sistema de injeção eletrônica"),
          f("24", 10, "Travas elétricas das portas"),
          f("25", 10, "Teto solar"),
          f("26", 20, "Antena elétrica"),
          f("27", 3, "Ventilador (ar-condicionado, 2 velocidades)"),
          f("28", 3, "Retrovisores elétricos"),
          f("29", 10, "Reserva"),
          f("30", 15, "Reserva"),
          f("31", 30, "Reserva"),
          f("32", 10, "Reserva"),
          f("33", undefined, "Freios ABS"),
          r("R5", "Relé estabilizador (função X)"),
          r("R7", "Relé da buzina"),
          r("R8", "Ponte entre os terminais 36 e 38"),
          r("R9", "Relé temporizador do limpador/lavador"),
          r("R10", "Relé da bomba de combustível"),
          r("R11", "Relé de setas e pisca-alerta"),
        ],
      },
    ],
  };
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const matches = (s: Slot, q: string) => !q || norm(`${s.label} ${s.desc} ${s.amp ?? ""}A ${s.kind === "relay" ? "rele" : "fusivel"}`).includes(norm(q));

/** CSV simples: tipo;numero;amperagem;descricao (separador ; ou ,). tipo = fusivel | rele. */
export function parseSlotsCsv(text: string): Slot[] {
  const out: Slot[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const sep = t.includes(";") ? ";" : ",";
    const [tipo, label, amp, ...rest] = t.split(sep).map((x) => x.trim());
    if (/^tipo$/i.test(tipo)) continue;
    const kind = /rel/i.test(tipo) ? "relay" : "fuse";
    const a = parseFloat((amp || "").replace(",", "."));
    out.push({ id: uid(), kind, label: label || "?", amp: Number.isFinite(a) ? a : undefined, desc: rest.join(sep) });
  }
  return out;
}

/** Consumidores de um fusível: a descrição separada por vírgulas ("Farol baixo, Buzina" -> 2 itens). */
export const loadsOf = (s: Slot): string[] =>
  s.desc
    .split(/,|;/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x[0].toUpperCase() + x.slice(1));
