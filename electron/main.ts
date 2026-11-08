import { app, BrowserWindow, ipcMain } from "electron";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { spawn, execFile, ChildProcess } from "child_process";
import * as os from "os";

const MESHY = "https://api.meshy.ai/openapi/v1/multi-image-to-3d";
const FIPE = "https://parallelum.com.br/fipe/api/v1";
const DEV_URL = "http://localhost:5173";

const settingsFile = () => path.join(app.getPath("userData"), "settings.json");

function readSettings(): { meshyKey?: string; plateToken?: string; imaginKey?: string; geminiKey?: string } {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
  } catch {
    return {};
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#0f1115",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (app.isPackaged) win.loadFile(path.join(__dirname, "../dist/index.html"));
  else win.loadURL(DEV_URL);
}

ipcMain.handle("settings:get", () => ({
  hasMeshyKey: !!readSettings().meshyKey,
  hasPlateToken: !!readSettings().plateToken,
  hasImaginKey: !!readSettings().imaginKey,
  hasGeminiKey: !!readSettings().geminiKey,
}));

ipcMain.handle("settings:setImaginKey", (_e, key: string) => {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify({ ...readSettings(), imaginKey: key }), { mode: 0o600 });
});

ipcMain.handle("settings:setGeminiKey", (_e, key: string) => {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify({ ...readSettings(), geminiKey: key }), { mode: 0o600 });
});

// Foto realista: envia a captura do carro pintado ao Gemini (Nano Banana) e devolve a imagem gerada.
ipcMain.handle("photoreal:generate", async (_e, shot: string, desc: string) => {
  const key = readSettings().geminiKey;
  if (!key) throw new Error("Configure a chave do Gemini (Nano Banana) em Configurações.");
  const b64 = shot.replace(/^data:image\/\w+;base64,/, "");
  const prompt =
    `Turn this 3D render of a car into a photorealistic studio photograph. Keep exactly the same car: same shape, same camera angle, same framing. ` +
    `Paint: ${desc}. Do not change the paint color, and do not alter the wheels, tires, headlights, taillights, grille, badges, windows or license plate. ` +
    `Soft professional studio lighting, clean dark-gray backdrop, subtle floor reflection, natural glossy reflections. No text, no watermark.`;
  const model = "gemini-2.5-flash-image";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/png", data: b64 } }] }],
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ? `Gemini: ${json.error.message}` : `Gemini respondeu HTTP ${res.status}`);
  const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
  const img = parts.map((p) => p.inlineData ?? p.inline_data).find((d) => d?.data);
  if (!img) {
    const txt = parts.map((p) => p.text).filter(Boolean).join(" ");
    throw new Error(txt ? `Gemini não devolveu imagem: ${txt.slice(0, 200)}` : "Gemini não devolveu imagem (pode ter sido bloqueada).");
  }
  return `data:${img.mimeType ?? img.mime_type ?? "image/png"};base64,${img.data}`;
});

ipcMain.handle("settings:setPlateToken", (_e, token: string) => {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify({ ...readSettings(), plateToken: token }), {
    mode: 0o600,
  });
});

// Consulta placa na API Placas (wdapi2.com.br). Aceita placa antiga e Mercosul.
ipcMain.handle("plate:lookup", async (_e, plate: string) => {
  const p = String(plate).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p)) throw new Error("Placa inválida");
  const token = readSettings().plateToken;
  if (!token) throw new Error("Token da API de placas não configurado");
  const res = await fetch(`https://wdapi2.com.br/consulta/${p}/${encodeURIComponent(token)}`);
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok || data.error || data.erro || data.mensagem)
    throw new Error(String(data.message || data.mensagem || data.error || data.erro || `HTTP ${res.status}`));
  return {
    placa: p,
    marca: data.MARCA ?? data.marca,
    modelo: data.MODELO ?? data.modelo,
    ano: data.anoModelo ?? data.ano,
    cor: data.cor,
  };
});

ipcMain.handle("settings:setMeshyKey", (_e, key: string) => {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify({ ...readSettings(), meshyKey: key }), {
    mode: 0o600,
  });
});

ipcMain.handle("fipe:get", async (_e, route: string) => {
  if (!/^[a-z0-9/_-]+$/i.test(route)) throw new Error("Rota FIPE inválida");
  const res = await fetch(`${FIPE}/${route}`);
  if (!res.ok) throw new Error(`FIPE ${res.status}`);
  return res.json();
});


// ---------- Biblioteca local de modelos (evita gastar créditos da Meshy) ----------
interface Paint { hex: string; finish: string; tol: number }
interface Interior { flip: boolean; items: Record<string, { show: boolean; color: string }> }
interface Entry {
  id: string;
  name: string;
  hash: string;
  createdAt: number;
  thumb?: string;
  paint?: Paint;
  interior?: Interior;
}
const libDir = () => path.join(app.getPath("userData"), "library");
const indexFile = () => path.join(libDir(), "index.json");
const glbFile = (id: string) => path.join(libDir(), `${id}.glb`);
const maskFile = (id: string) => path.join(libDir(), `${id}.mask.png`);
const UUID = /^[0-9a-f-]{36}$/;

function readIndex(): Entry[] {
  try {
    return JSON.parse(fs.readFileSync(indexFile(), "utf8"));
  } catch {
    return [];
  }
}
function atomicWrite(file: string, data: string | Uint8Array) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}
const writeIndex = (e: Entry[]) => atomicWrite(indexFile(), JSON.stringify(e, null, 1));
const checkId = (id: string) => {
  if (!UUID.test(id)) throw new Error("ID inválido");
  return id;
};

ipcMain.handle("library:list", () => readIndex().sort((a, b) => b.createdAt - a.createdAt));

ipcMain.handle("library:load", (_e, id: string) => {
  const entry = readIndex().find((x) => x.id === checkId(id));
  if (!entry) throw new Error("Modelo não encontrado");
  const mask = fs.existsSync(maskFile(id))
    ? `data:image/png;base64,${fs.readFileSync(maskFile(id)).toString("base64")}`
    : undefined;
  return { entry, glb: new Uint8Array(fs.readFileSync(glbFile(id))), mask };
});

ipcMain.handle("library:update", (_e, id: string, patch: Partial<Pick<Entry, "name" | "thumb" | "paint" | "interior">> & { mask?: string | null }) => {
  const all = readIndex();
  const entry = all.find((x) => x.id === checkId(id));
  if (!entry) throw new Error("Modelo não encontrado");
  if (typeof patch.name === "string") entry.name = patch.name.slice(0, 80);
  if (typeof patch.thumb === "string" && patch.thumb.startsWith("data:image/")) entry.thumb = patch.thumb;
  if (patch.paint) entry.paint = patch.paint;
  const it = patch.interior;
  if (it && typeof it.flip === "boolean" && it.items && Object.values(it.items).every((x) => typeof x?.show === "boolean" && /^#[0-9a-f]{6}$/i.test(x?.color)))
    entry.interior = it;
  if (patch.mask === null) fs.rmSync(maskFile(id), { force: true });
  else if (typeof patch.mask === "string" && patch.mask.startsWith("data:image/png;base64,"))
    atomicWrite(maskFile(id), Buffer.from(patch.mask.slice(22), "base64"));
  writeIndex(all);
});

ipcMain.handle("library:delete", (_e, id: string) => {
  writeIndex(readIndex().filter((x) => x.id !== checkId(id)));
  fs.rmSync(glbFile(id), { force: true });
  fs.rmSync(maskFile(id), { force: true });
});

// ---------- Base local de cores de fábrica ----------
interface ColorEntry {
  make: string;
  model?: string;
  yearFrom?: number;
  yearTo?: number;
  code: string;
  name: string;
  base: string;
  highlight?: string;
  shadow?: string;
  source: string;
}
const colorsFile = () => path.join(app.getPath("userData"), "colors-db.json");
const IMAGIN = process.env.IMAGIN_BASE_URL || "https://cdn.imagin.studio";
const HEX = /^#[0-9a-f]{6}$/i;

function readColors(): ColorEntry[] {
  try {
    return JSON.parse(fs.readFileSync(colorsFile(), "utf8"));
  } catch {
    return [];
  }
}
const colorKey = (c: ColorEntry) => [c.make, c.model ?? "", c.yearFrom ?? "", c.yearTo ?? "", c.code].join("|").toLowerCase();

function mergeColors(incoming: ColorEntry[]): { added: number; updated: number } {
  const all = readColors();
  const idx = new Map(all.map((c, i) => [colorKey(c), i]));
  let added = 0,
    updated = 0;
  for (const c of incoming) {
    const k = colorKey(c);
    if (idx.has(k)) (all[idx.get(k)!] = c, updated++);
    else (idx.set(k, all.push(c) - 1), added++);
  }
  atomicWrite(colorsFile(), JSON.stringify(all));
  return { added, updated };
}

const humanize = (s: string) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const lumOf = (h: string) => 0.299 * parseInt(h.slice(1, 3), 16) + 0.587 * parseInt(h.slice(3, 5), 16) + 0.114 * parseInt(h.slice(5, 7), 16);
const mixHex = (a: string, b: string) =>
  "#" + [1, 3, 5].map((i) => Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2).toString(16).padStart(2, "0")).join("");

async function imaginGet(endpoint: string, params: Record<string, string>) {
  const key = readSettings().imaginKey;
  if (!key) throw new Error("Chave (customer) da Imagin.studio não configurada");
  const url = new URL(`${IMAGIN}/${endpoint}`);
  url.searchParams.set("customer", key);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (res.status === 401 || res.status === 403) throw new Error("Imagin.studio recusou a chave (customer)");
  if (!res.ok) throw new Error(`Imagin.studio respondeu HTTP ${res.status}`);
  return (await res.json()) as any;
}

ipcMain.handle("colors:sync", async (_e, q: { make: string; modelFamily?: string; modelYear?: number }) => {
  const make = String(q.make || "").toLowerCase().trim();
  if (!/^[a-z0-9-]+$/.test(make)) throw new Error("Marca inválida");
  const target = q.modelFamily ? "car" : "make";
  const data = await imaginGet("getPaints", {
    target,
    make,
    modelFamily: q.modelFamily ? String(q.modelFamily).toLowerCase() : "",
    modelYear: q.modelYear ? String(q.modelYear) : "",
  });
  const combos = data?.paintData?.paintCombinations ?? data?.paintCombinations ?? {};
  // código OEM -> nome + tons do getPaints (fallback)
  const found = new Map<string, { name: string; hi?: string; lo?: string }>();
  for (const combo of Object.values<any>(combos)) {
    const sw = combo?.paintSwatch?.primary;
    for (const [code, info] of Object.entries<any>(combo?.mapped ?? {}))
      if (!found.has(code)) found.set(code, { name: humanize(String(info?.paintDescription ?? code)), hi: sw?.highLight, lo: sw?.lowLight });
  }
  if (!found.size) throw new Error("A Imagin.studio não retornou cores para essa consulta");

  // base + brilho reais via getPaintSwatches (em lotes)
  const swatches: Record<string, any> = {};
  const codes = [...found.keys()];
  for (let i = 0; i < codes.length; i += 30) {
    const r = await imaginGet("getPaintSwatches", { make, paints: codes.slice(i, i + 30).join(",") }).catch(() => null);
    Object.assign(swatches, r?.paints ?? {});
  }

  const entries: ColorEntry[] = [];
  for (const [code, f] of found) {
    const sc = swatches[code]?.primarySprayCan;
    let base: string | undefined = sc?.primarySprayCanRGB;
    let highlight: string | undefined = sc?.primarySprayCanHighLightRGB;
    let shadow: string | undefined;
    if (!base || !HEX.test(base)) {
      // sem swatch: usa os dois tons do getPaints (mais claro = brilho, mais escuro = sombra)
      if (!f.hi || !f.lo || !HEX.test(f.hi) || !HEX.test(f.lo)) continue;
      const [light, dark] = lumOf(f.hi) >= lumOf(f.lo) ? [f.hi, f.lo] : [f.lo, f.hi];
      base = mixHex(light, dark);
      highlight = light;
      shadow = dark;
    }
    entries.push({
      make,
      model: q.modelFamily?.toLowerCase(),
      yearFrom: q.modelYear,
      yearTo: q.modelYear,
      code,
      name: swatches[code]?.paintDescription ? humanize(String(swatches[code].paintDescription)) : f.name,
      base: base.toLowerCase(),
      highlight: highlight && HEX.test(highlight) ? highlight.toLowerCase() : undefined,
      shadow,
      source: "imagin.studio",
    });
  }
  return { ...mergeColors(entries), total: entries.length };
});

ipcMain.handle("colors:import", (_e, rows: Record<string, string>[]) => {
  const ok: ColorEntry[] = [];
  const bad: string[] = [];
  rows.forEach((r, i) => {
    const hex = (v?: string) => (v && HEX.test(v.trim()) ? v.trim().toLowerCase() : undefined);
    const base = hex(r.base);
    if (!r.make?.trim() || !r.name?.trim() || !base) return void bad.push(`linha ${i + 2}`);
    const num = (v?: string) => (v && /^\d{4}$/.test(v.trim()) ? +v.trim() : undefined);
    ok.push({
      make: r.make.trim().toLowerCase(),
      model: r.model?.trim().toLowerCase() || undefined,
      yearFrom: num(r.yearFrom),
      yearTo: num(r.yearTo),
      code: (r.code ?? "").trim() || r.name.trim().toLowerCase(),
      name: r.name.trim(),
      base,
      highlight: hex(r.highlight),
      shadow: hex(r.shadow),
      source: r.source?.trim() || "csv",
    });
  });
  return { ...mergeColors(ok), rejected: bad };
});

ipcMain.handle("colors:list", (_e, q: { make?: string; text?: string; year?: number }) => {
  const t = q.text?.toLowerCase().trim();
  return readColors().filter(
    (c) =>
      (!q.make || c.make === q.make) &&
      (!q.year || ((c.yearFrom ?? 0) <= q.year && q.year <= (c.yearTo ?? 9999))) &&
      (!t || `${c.name} ${c.code} ${c.model ?? ""}`.toLowerCase().includes(t)),
  );
});

ipcMain.handle("colors:makes", () => [...new Set(readColors().map((c) => c.make))].sort());

// ---------- Fotogrametria local (Object Capture da Apple, via ferramenta nativa) ----------
const pgBinary = () =>
  app.isPackaged ? path.join(process.resourcesPath, "photogrammetry") : path.join(app.getAppPath(), "native/photogrammetry/photogrammetry");
let pgChild: ChildProcess | null = null;
let userCancelled = false;
const run = (cmd: string, args: string[], cwd?: string) =>
  new Promise<void>((res, rej) => execFile(cmd, args, { cwd, maxBuffer: 1 << 26 }, (err) => (err ? rej(err) : res())));

ipcMain.handle("photo:cancel", () => {
  userCancelled = true;
  pgChild?.kill("SIGTERM");
});

ipcMain.handle("photo:run", async (e, opts: { images: string[]; detail: string; mask: boolean }) => {
  if (process.platform !== "darwin") throw new Error("A fotogrametria local só funciona no macOS");
  if (!fs.existsSync(pgBinary())) throw new Error("Ferramenta de fotogrametria não encontrada. Compile com: npm run build:native");
  if (pgChild) throw new Error("Já existe uma reconstrução em andamento");
  if (!Array.isArray(opts.images) || opts.images.length < 10) throw new Error("Envie pelo menos 10 fotos (o ideal é 30 a 80 ao redor do carro)");
  const detail = ["reduced", "medium", "full"].includes(opts.detail) ? opts.detail : "medium";
  const send = (p: number, s: string) => e.sender.send("model:progress", { progress: p, status: s });

  userCancelled = false;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cps-photo-"));
  const inDir = path.join(tmp, "in");
  const outDir = path.join(tmp, "out");
  fs.mkdirSync(inDir);
  try {
    opts.images.forEach((d, i) => {
      const m = /^data:image\/jpeg;base64,/.exec(d);
      if (!m) throw new Error("Imagem inválida (esperado JPEG)");
      fs.writeFileSync(path.join(inDir, `img_${String(i).padStart(4, "0")}.jpg`), Buffer.from(d.slice(m[0].length), "base64"));
    });
    send(0, "Fotogrametria: iniciando");

    const usdz = await new Promise<string>((resolve, reject) => {
      const child = spawn(pgBinary(), [inDir, outDir, detail, "normal", opts.mask ? "mask" : "nomask"]);
      pgChild = child;
      let buf = "",
        done = "",
        err = "";
      child.stdout.on("data", (d) => {
        buf += d.toString();
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          try {
            const j = JSON.parse(line);
            if (typeof j.progress === "number") send(Math.round(j.progress * 100), "Fotogrametria");
            else if (j.status) send(-1, `Fotogrametria: ${j.status}`);
            else if (j.done) done = j.done;
            else if (j.error) err = j.error;
          } catch {
            /* linha parcial */
          }
        }
      });
      child.on("error", reject);
      child.on("close", (code, sig) => {
        pgChild = null;
        if (done) resolve(done);
        else if (userCancelled) reject(new Error("Reconstrução cancelada"));
        else if (sig) reject(new Error(`O sistema encerrou a reconstrução (${sig}), quase certamente por falta de memória. Feche outros apps, use menos fotos ou o detalhe "rápido".`));
        else reject(new Error(err || `Fotogrametria falhou (código ${code}). Tente o detalhe "rápido" ou menos fotos.`));
      });
    });

    // USDZ binário -> USDZ com geometria em texto (o three.js não lê o formato binário)
    send(100, "Convertendo modelo");
    const unz = path.join(tmp, "unz");
    fs.mkdirSync(unz);
    await run("/usr/bin/unzip", ["-o", "-q", usdz, "-d", unz]);
    const usdc = fs.readdirSync(unz).find((f) => f.endsWith(".usdc"));
    if (!usdc) throw new Error("Modelo gerado sem geometria");
    await run("/usr/bin/usdcat", [path.join(unz, usdc), "--out", path.join(unz, "model.usda")]);
    fs.rmSync(path.join(unz, usdc));
    const out = path.join(tmp, "ascii.usdz");
    const entries = fs.readdirSync(unz).filter((f) => f !== ".DS_Store");
    await run("/usr/bin/zip", ["-q", "-0", "-r", out, ...entries], unz);
    return new Uint8Array(fs.readFileSync(out));
  } finally {
    pgChild = null;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

ipcMain.handle("library:addGlb", (_e, glb: Uint8Array, hash: string, name: string) => {
  const entry: Entry = { id: randomUUID(), name: String(name).slice(0, 80), hash, createdAt: Date.now() };
  atomicWrite(glbFile(entry.id), glb);
  writeIndex([...readIndex(), entry]);
  return entry;
});

// Gera GLB via Meshy (multi-image-to-3d, máx. 4 imagens). Progresso enviado por evento.
ipcMain.handle("model:generate", async (e, images: string[], hash: string) => {
  const cached = readIndex().find((x) => x.hash === hash && fs.existsSync(glbFile(x.id)));
  if (cached)
    return { entry: cached, glb: new Uint8Array(fs.readFileSync(glbFile(cached.id))), cached: true };

  const key = readSettings().meshyKey;
  if (!key) throw new Error("Chave da API Meshy não configurada");
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const send = (p: number, s: string) => e.sender.send("model:progress", { progress: p, status: s });

  send(0, "Enviando imagens");
  const start = await fetch(MESHY, {
    method: "POST",
    headers,
    body: JSON.stringify({
      image_urls: images.slice(0, 4),
      should_texture: true,
      enable_pbr: true,
    }),
  });
  if (!start.ok) throw new Error(`Meshy ${start.status}: ${await start.text()}`);
  const { result: id } = (await start.json()) as { result: string };

  for (;;) {
    await new Promise((r) => setTimeout(r, 5000));
    const poll = await fetch(`${MESHY}/${id}`, { headers });
    if (!poll.ok) throw new Error(`Meshy ${poll.status}`);
    const t = (await poll.json()) as {
      status: string;
      progress: number;
      model_urls?: { glb?: string };
      task_error?: { message?: string };
    };
    send(t.progress ?? 0, t.status);
    if (t.status === "FAILED" || t.status === "CANCELED")
      throw new Error(t.task_error?.message || `Tarefa ${t.status}`);
    if (t.status === "SUCCEEDED") {
      const url = t.model_urls?.glb;
      if (!url) throw new Error("Meshy não retornou GLB");
      const res = await fetch(url);
      const glb = new Uint8Array(await res.arrayBuffer());
      const entry: Entry = {
        id: randomUUID(),
        name: `Carro ${new Date().toLocaleString("pt-BR")}`,
        hash,
        createdAt: Date.now(),
      };
      atomicWrite(glbFile(entry.id), glb); // grava antes de qualquer outra coisa
      writeIndex([...readIndex(), entry]);
      return { entry, glb, cached: false };
    }
  }
});

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
