import { useEffect, useRef, useState } from "react";
import { CarViewer, defaultInterior, INTERIOR_LABELS, type InteriorCfg, type InteriorKey } from "./lib/CarViewer";
import { collectImages, spread } from "./lib/media";
import { extractPalette, suggest, deriveTones, tonesFromPalette, PRESETS, type Swatch, type Tones } from "./lib/colors";
import type { Finish, LibEntry, MaterialInfo } from "./lib/types";
import Library from "./components/Library";
import { usdzToGlb } from "./lib/usdz";
import MyPalette from "./components/MyPalette";
import Fipe from "./components/Fipe";
import Plate from "./components/Plate";
import FactoryColors from "./components/FactoryColors";

const FINISH_LABELS: Record<Finish, string> = {
  gloss: "Brilhante",
  matte: "Fosco",
  metallic: "Metálico",
  pearl: "Perolado",
};

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<CarViewer | null>(null);

  const [images, setImages] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [pgDetail, setPgDetail] = useState<"reduced" | "medium" | "full">("medium");
  const [pgMask, setPgMask] = useState(false);
  const [palette, setPalette] = useState<Swatch[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");

  const [mats, setMats] = useState<MaterialInfo[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [color, setColor] = useState("#c40d1e"); // tom base
  const [hl, setHl] = useState(() => deriveTones("#c40d1e").highlight); // brilho máximo
  const [sh, setSh] = useState(() => deriveTones("#c40d1e").shadow); // sombra
  const [finish, setFinish] = useState<Finish>("gloss");
  const [tol, setTol] = useState(60);
  const [picking, setPicking] = useState(false);
  const [inside, setInside] = useState(false);
  const [xray, setXray] = useState(false);
  const [brushOn, setBrushOn] = useState(false);
  const [brushMode, setBrushMode] = useState<"protect" | "paint">("protect");
  const [brushR, setBrushR] = useState(22);
  const [interior, setInteriorState] = useState<InteriorCfg>(defaultInterior);
  const updateInterior = (cfg: InteriorCfg) => {
    setInteriorState(cfg);
    viewer.current?.setInterior(cfg);
  };
  const [lib, setLib] = useState<LibEntry[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const down = useRef<[number, number]>([0, 0]);

  useEffect(() => {
    const v = new CarViewer(host.current!);
    v.loadProcedural();
    viewer.current = v;
    if (import.meta.env.DEV) (window as any).__viewer = v;
    refreshMaterials(v, true);
    window.api.getSettings().then((s) => setHasKey(s.hasMeshyKey));
    const off = window.api.onProgress((p) => setBusy(`Gerando modelo 3D: ${p.status} ${p.progress}%`));
    return () => {
      off();
      v.dispose();
    };
  }, []);

  const refreshMaterials = (v: CarViewer, autoSelect = false) => {
    const list = v.listMaterials();
    setMats(list);
    if (autoSelect) setSelected(list.filter((m) => /carroceria/i.test(m.name)).map((m) => m.uuid));
  };

  const tones: Tones = { base: color, highlight: hl, shadow: sh };

  const applyPaint = (t: Tones = tones, f = finish, sel = selected, tl = tol) => {
    viewer.current?.paint(sel, t, f, tl);
  };

  /** Define os 3 tons de uma vez e pinta. */
  const pickTones = (t: Tones) => {
    setColor(t.base);
    setHl(t.highlight);
    setSh(t.shadow);
    applyPaint(t);
  };

  const onViewerClick = (e: React.MouseEvent) => {
    if (!picking) return;
    if (Math.hypot(e.clientX - down.current[0], e.clientY - down.current[1]) > 4) return; // foi arrasto
    if (viewer.current!.pickBodyAt(e.clientX, e.clientY)) setPicking(false);
    else setError("Clique sobre a lataria do carro.");
  };

  /** Só o tom base: brilho e sombra são gerados a partir dele. */
  const pick = (hex: string) => pickTones(deriveTones(hex));

  const editTone = (key: keyof Tones, hex: string) => {
    if (key === "base") return pick(hex);
    const t = { ...tones, [key]: hex };
    key === "highlight" ? setHl(hex) : setSh(hex);
    applyPaint(t);
  };

  const onFiles = async (picked: FileList | null) => {
    if (!picked?.length) return;
    setError("");
    setBusy("Lendo fotos e vídeos…");
    try {
      setFiles([...picked]);
      const imgs = await collectImages([...picked]);
      setImages(imgs);
      setBusy("Analisando cores…");
      setPalette(await extractPalette(imgs));
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
    setBusy("");
  };

  const sha256 = async (parts: string[]) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts.join("|")));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const thumb = () => {
    const src = new Image();
    return new Promise<string>((res) => {
      src.onload = () => {
        const c = document.createElement("canvas");
        c.width = 192;
        c.height = Math.round((192 * src.height) / src.width);
        c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.8));
      };
      src.src = viewer.current!.screenshot();
    });
  };

  const refreshLib = async () => setLib(await window.api.libraryList());

  const showModel = async (entry: LibEntry, glb: Uint8Array, mask?: string) => {
    setBrushOn(false);
    viewer.current!.setBrush(false);
    setInside(false);
    setXray(false);
    const d0 = defaultInterior();
    const cfg: InteriorCfg = entry.interior
      ? { flip: entry.interior.flip, items: { ...d0.items, ...entry.interior.items } }
      : d0;
    setInteriorState(cfg);
    viewer.current!.setInterior(cfg); // antes de carregar, para o interior nascer na orientação certa
    await viewer.current!.loadGLB(glb);
    refreshMaterials(viewer.current!);
    const all = viewer.current!.listMaterials().map((m) => m.uuid);
    setSelected(all);
    setCurrentId(entry.id);
    if (entry.paint) {
      const d = deriveTones(entry.paint.hex);
      const t: Tones = {
        base: entry.paint.hex,
        highlight: entry.paint.highlight ?? d.highlight,
        shadow: entry.paint.shadow ?? d.shadow,
      };
      setColor(t.base);
      setHl(t.highlight);
      setSh(t.shadow);
      setFinish(entry.paint.finish);
      setTol(entry.paint.tol);
      viewer.current!.paint(all, t, entry.paint.finish, entry.paint.tol);
    }
    if (mask) {
      await viewer.current!.importMask(mask).catch(() => {});
    }
  };

  const generate = async () => {
    setError("");
    try {
      setBusy("Enviando imagens…");
      const chosen = spread(images, 4);
      const { entry, glb, cached } = await window.api.generateModel(chosen, await sha256(chosen));
      await showModel(entry, glb);
      if (!cached) {
        await new Promise((r) => setTimeout(r, 400)); // deixa renderizar antes da miniatura
        await window.api.libraryUpdate(entry.id, { thumb: await thumb() });
      } else setError("Modelo já estava na biblioteca: nenhum crédito gasto.");
      await refreshLib();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
    setBusy("");
  };

  const generatePhoto = async () => {
    setError("");
    try {
      const meta = files.map((f) => `${f.name}:${f.size}:${f.lastModified}`);
      const hash = "pg:" + (await sha256([...meta, pgDetail, String(pgMask)]));
      const cached = lib.find((x) => x.hash === hash);
      if (cached) {
        await openEntry(cached.id);
        setError("Esse conjunto de fotos já foi reconstruído: abri da biblioteca.");
        return;
      }
      setBusy("Preparando fotos…");
      const maxSide = pgDetail === "reduced" ? 1400 : pgDetail === "medium" ? 1800 : 2400; // menos pixels = menos memória
      const imgs = await collectImages(files, 30, maxSide);
      if (imgs.length < 10) throw new Error("Envie pelo menos 10 fotos (ideal: 30 a 80 ao redor do carro).");
      const usdz = await window.api.photoRun({ images: imgs, detail: pgDetail, mask: pgMask });
      setBusy("Convertendo para 3D…");
      const glb = await usdzToGlb(usdz);
      const entry = await window.api.libraryAddGlb(glb, hash, `Fotogrametria ${new Date().toLocaleString("pt-BR")}`);
      await showModel(entry, glb);
      await new Promise((r) => setTimeout(r, 400));
      await window.api.libraryUpdate(entry.id, { thumb: await thumb() });
      await refreshLib();
    } catch (e) {
      setError(String((e as Error).message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    }
    setBusy("");
  };

  const openEntry = async (id: string) => {
    setError("");
    try {
      const { entry, glb, mask } = await window.api.libraryLoad(id);
      await showModel(entry, glb, mask);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  };

  // Salva a pintura do modelo aberto (com atraso, para não gravar a cada movimento do seletor).
  useEffect(() => {
    if (!currentId) return;
    const t = setTimeout(() => {
      window.api.libraryUpdate(currentId, { paint: { hex: color, highlight: hl, shadow: sh, finish, tol }, interior }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [currentId, color, hl, sh, finish, tol, interior]);

  useEffect(() => {
    refreshLib();
  }, []);

  const saveKey = async () => {
    await window.api.setMeshyKey(keyInput.trim());
    setKeyInput("");
    setHasKey(true);
  };

  const toggleMat = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const savePng = () => {
    const a = document.createElement("a");
    a.href = viewer.current!.screenshot();
    a.download = "carro-pintado.png";
    a.click();
  };

  return (
    <div className="app">
      <aside>
        <h1>Car Paint Studio</h1>

        <section>
          <h2>1. Fotos e vídeos</h2>
          <input type="file" multiple accept="image/*,video/*" onChange={(e) => onFiles(e.target.files)} />
          {images.length > 0 && (
            <>
              <div className="thumbs">
                {images.slice(0, 12).map((src, i) => (
                  <img key={i} src={src} />
                ))}
              </div>
              <p className="muted">{images.length} imagens (4 enviadas ao gerador 3D)</p>
            </>
          )}
        </section>

        <section>
          <h2>2. Modelo 3D</h2>
          {!hasKey && (
            <>
              <input
                type="password"
                placeholder="Chave da API Meshy"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
              />
              <button onClick={saveKey} disabled={!keyInput.trim()}>
                Salvar chave
              </button>
            </>
          )}
          <button className="primary" onClick={generate} disabled={!hasKey || images.length < 1 || !!busy}>
            Gerar modelo 3D
          </button>
          <div className="pg-box">
            <p className="muted">Fotogrametria local (Mac, grátis): reconstrói o carro real a partir de 30 a 80 fotos ao redor dele.</p>
            <div className="row">
              <select value={pgDetail} onChange={(e) => setPgDetail(e.target.value as "reduced" | "medium" | "full")}>
                <option value="reduced">Detalhe rápido</option>
                <option value="medium">Detalhe médio</option>
                <option value="full">Detalhe alto (muita memória)</option>
              </select>
            </div>
            <label className="int-row">
              <input type="checkbox" checked={pgMask} onChange={(e) => setPgMask(e.target.checked)} />
              <span>Recortar fundo e chão automaticamente</span>
            </label>
            <button className="primary" onClick={generatePhoto} disabled={files.length < 1 || !!busy}>
              Gerar 3D por fotogrametria
            </button>
            {busy && busy.startsWith("Gerando modelo 3D: Fotogrametria") && (
              <button onClick={() => window.api.photoCancel()}>Cancelar reconstrução</button>
            )}
          </div>
          <button onClick={() => (setInside(false), setXray(false), viewer.current!.loadProcedural(), refreshMaterials(viewer.current!, true), setCurrentId(null))}>
            Usar carro base
          </button>
          {hasKey && (
            <button className="link" onClick={() => setHasKey(false)}>
              Trocar chave
            </button>
          )}
        </section>

        <section>
          <h2>3. Pintura</h2>
          <p className="muted">Partes a pintar</p>
          <div className="mats">
            {mats.map((m) => (
              <label key={m.uuid}>
                <input type="checkbox" checked={selected.includes(m.uuid)} onChange={() => toggleMat(m.uuid)} />
                {m.name}
              </label>
            ))}
          </div>

          <div className="tones">
            {(
              [
                ["base", "Tom base", "cor predominante"],
                ["highlight", "Brilho máximo", "onde bate luz direta"],
                ["shadow", "Sombra", "curvas e vincos da lataria"],
              ] as const
            ).map(([k, label, hint]) => (
              <label key={k} title={hint}>
                <input type="color" value={tones[k]} onChange={(e) => editTone(k, e.target.value)} />
                <span>
                  {label}
                  <small>{tones[k].toUpperCase()}</small>
                </span>
              </label>
            ))}
          </div>
          {palette.length > 0 && (
            <button onClick={() => pickTones(tonesFromPalette(palette)!)}>Usar tons detectados nas fotos</button>
          )}
          <div className="row">
            <select
              value={finish}
              onChange={(e) => {
                const f = e.target.value as Finish;
                setFinish(f);
                applyPaint(tones, f);
              }}
            >
              {Object.entries(FINISH_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button onClick={() => viewer.current!.restore()}>Original</button>
          </div>
          <button className={picking ? "primary" : ""} onClick={() => (setError(""), setPicking(!picking))}>
            {picking ? "Clique na lataria do carro…" : "Escolher lataria no 3D"}
          </button>
          <div className="brush-box">
            <button
              className={brushOn ? "primary" : ""}
              onClick={() => {
                const on = !brushOn;
                if (on) applyPaint(); // garante uma cor aplicada para o pincel mostrar o efeito
                setBrushOn(on);
                viewer.current!.setBrush(on);
                if (on) setPicking(false);
              }}
            >
              {brushOn ? "Pincel ligado (arraste no carro)" : "Pincel de proteção"}
            </button>
            {brushOn && (
              <>
                <div className="row">
                  <button className={brushMode === "protect" ? "primary" : ""} onClick={() => setBrushMode("protect")}>
                    Proteger
                  </button>
                  <button className={brushMode === "paint" ? "primary" : ""} onClick={() => setBrushMode("paint")}>
                    Pintar
                  </button>
                  <button
                    onClick={() => {
                      viewer.current!.clearMask();
                      if (currentId) window.api.libraryUpdate(currentId, { mask: null }).catch(() => {});
                    }}
                  >
                    Limpar
                  </button>
                </div>
                <label className="muted">
                  Tamanho do pincel ({brushR})
                  <input type="range" min={6} max={90} value={brushR} style={{ width: "100%" }} onChange={(e) => setBrushR(+e.target.value)} />
                </label>
                <p className="muted">"Proteger" mantém a cor original (rodas, frisos, vidros). "Pintar" desfaz.</p>
              </>
            )}
          </div>
          <label className="muted">
            Tolerância da cor ({tol})
            <input
              type="range"
              min={20}
              max={140}
              value={tol}
              style={{ width: "100%" }}
              onChange={(e) => {
                const t = +e.target.value;
                setTol(t);
                applyPaint(tones, finish, selected, t);
              }}
            />
          </label>

          {palette.length > 0 && (
            <>
              <p className="muted">Cores detectadas nas fotos</p>
              <div className="swatches">
                {palette.map((s) => (
                  <button key={s.hex} title={`${s.hex} · ${Math.round(s.share * 100)}%`} style={{ background: s.hex }} onClick={() => pick(s.hex)} />
                ))}
              </div>
              <p className="muted">Sugestões a partir de {palette[0].hex}</p>
              <div className="swatches">
                {suggest(palette[0].hex).map((s) => (
                  <button key={s.name} title={`${s.name} ${s.hex}`} style={{ background: s.hex }} onClick={() => pick(s.hex)} />
                ))}
              </div>
            </>
          )}

          <p className="muted">Cores prontas</p>
          <div className="swatches">
            {PRESETS.map((s) => (
              <button
                key={s.hex}
                title={s.name}
                style={{ background: s.hex }}
                onClick={() => (s.base && s.highlight && s.shadow ? pickTones({ base: s.base, highlight: s.highlight, shadow: s.shadow }) : pick(s.hex))}
              />
            ))}
          </div>
          <FactoryColors onPick={pickTones} />
          <MyPalette current={tones} onPick={pickTones} />
          <button onClick={savePng}>Salvar imagem PNG</button>
        </section>

        <section>
          <h2>4. Interior</h2>
          <p className="muted">O scan gera só a casca do carro. Estas peças são adicionadas por dentro.</p>
          {(Object.keys(INTERIOR_LABELS) as InteriorKey[]).map((k) => (
            <label key={k} className="int-row">
              <input
                type="checkbox"
                checked={interior.items[k].show}
                onChange={(e) => updateInterior({ ...interior, items: { ...interior.items, [k]: { ...interior.items[k], show: e.target.checked } } })}
              />
              <span>{INTERIOR_LABELS[k]}</span>
              <input
                type="color"
                value={interior.items[k].color}
                onChange={(e) => updateInterior({ ...interior, items: { ...interior.items, [k]: { ...interior.items[k], color: e.target.value } } })}
              />
            </label>
          ))}
          <button onClick={() => updateInterior({ ...interior, flip: !interior.flip })}>
            Inverter frente do carro {interior.flip ? "(invertida)" : ""}
          </button>
        </section>

        <Library
          items={lib}
          currentId={currentId}
          onOpen={openEntry}
          onRename={async (id, name) => (await window.api.libraryUpdate(id, { name }), refreshLib())}
          onDelete={async (id) => {
            await window.api.libraryDelete(id);
            if (id === currentId) setCurrentId(null);
            refreshLib();
          }}
        />

        <Plate onColor={pick} />
        <Fipe />
      </aside>

      <main>
        <div
          ref={host}
          className="viewer"
          style={{ cursor: picking || brushOn ? "crosshair" : undefined }}
          onPointerDown={(e) => {
            down.current = [e.clientX, e.clientY];
            if (brushOn) {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              viewer.current!.brushAt(e.clientX, e.clientY, brushMode, brushR);
            }
          }}
          onPointerMove={(e) => {
            if (brushOn && e.buttons === 1) viewer.current!.brushAt(e.clientX, e.clientY, brushMode, brushR);
          }}
          onPointerUp={() => {
            if (brushOn && currentId) {
              const m = viewer.current!.exportMask();
              window.api.libraryUpdate(currentId, { mask: m }).catch(() => {});
            }
          }}
          onClick={onViewerClick}
        />
        <button
          className={`view-btn ${inside ? "primary" : ""}`}
          onClick={() => {
            if (inside) viewer.current!.exitInterior();
            else viewer.current!.enterInterior();
            setInside(!inside);
          }}
        >
          {inside ? "↩ Voltar para fora" : "👁 Ver por dentro"}
        </button>
        <button
          className={`view-btn xray-btn ${xray ? "primary" : ""}`}
          onClick={() => {
            viewer.current!.setXray(!xray);
            setXray(!xray);
          }}
          title="Deixa a lataria translúcida para ver o interior por fora"
        >
          {xray ? "Raio-X ligado" : "Raio-X"}
        </button>
        {inside && <div className="hint">Arraste o mouse para olhar ao redor</div>}
        {(busy || error) && <div className={error ? "toast err" : "toast"}>{error || busy}</div>}
      </main>
    </div>
  );
}
