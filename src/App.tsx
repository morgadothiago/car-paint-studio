import { useEffect, useRef, useState } from "react";
import { CarViewer, defaultInterior, type InteriorCfg } from "./lib/CarViewer";
import { collectImages, spread } from "./lib/media";
import { extractPalette, deriveTones, type Swatch, type Tones } from "./lib/colors";
import type { Finish, LibEntry, MaterialInfo } from "./lib/types";
import { usdzToGlb } from "./lib/usdz";

import Header, { type StudioTab } from "./components/Header";
import ViewportHUD, { type CameraView } from "./components/ViewportHUD";
import PaintTab from "./components/PaintTab";
import ModelTab from "./components/ModelTab";
import InteriorTab from "./components/InteriorTab";
import VehicleTab from "./components/VehicleTab";
import SettingsModal from "./components/SettingsModal";
import PhotorealModal from "./components/PhotorealModal";
import ElectricPanel from "./components/ElectricPanel";

const FINISH_LABELS: Record<Finish, string> = {
  gloss: "Brilhante",
  matte: "Fosco",
  metallic: "Metálico",
  pearl: "Perolado",
};

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<CarViewer | null>(null);

  // Studio UI state
  const [activeTab, setActiveTab] = useState<StudioTab>("paint");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [turntable, setTurntable] = useState(false);

  // Media & 3D generator state
  const [images, setImages] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [pgDetail, setPgDetail] = useState<"reduced" | "medium" | "full">("medium");
  const [pgMask, setPgMask] = useState(false);
  const [palette, setPalette] = useState<Swatch[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // API Key settings
  const [hasKey, setHasKey] = useState(false);
  const [hasImagin, setHasImagin] = useState(false);
  const [hasGemini, setHasGemini] = useState(false);
  const [pr, setPr] = useState<{ open: boolean; loading: boolean; shot: string | null; result: string | null; error: string }>({
    open: false,
    loading: false,
    shot: null,
    result: null,
    error: "",
  });
  const [hasPlate, setHasPlate] = useState(false);

  // Paint & Materials state
  const [mats, setMats] = useState<MaterialInfo[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [color, setColor] = useState("#c40d1e");
  const [hl, setHl] = useState(() => deriveTones("#c40d1e").highlight);
  const [sh, setSh] = useState(() => deriveTones("#c40d1e").shadow);
  const [finish, setFinish] = useState<Finish>("gloss");
  const [tol, setTol] = useState(60);
  const [picking, setPicking] = useState(false);
  const [inside, setInside] = useState(false);
  const [xray, setXray] = useState(false);
  const [brushOn, setBrushOn] = useState(false);
  const [brushMode, setBrushMode] = useState<"protect" | "paint">("protect");
  const [brushR, setBrushR] = useState(22);
  const [wheelColor, setWheelColorState] = useState<string | null>(null);
  const setWheelColor = (hex: string | null) => {
    setWheelColorState(hex);
    viewer.current?.setWheelColor(hex);
  };

  // Interior & Library
  const [interior, setInteriorState] = useState<InteriorCfg>(defaultInterior);
  const [lib, setLib] = useState<LibEntry[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const down = useRef<[number, number]>([0, 0]);

  const updateInterior = (cfg: InteriorCfg) => {
    setInteriorState(cfg);
    viewer.current?.setInterior(cfg);
  };

  const generatePhotoreal = async () => {
    if (!hasGemini) {
      setIsSettingsOpen(true);
      return;
    }
    const shot = viewer.current!.screenshot();
    setPr({ open: true, loading: true, shot, result: null, error: "" });
    try {
      const desc = `${FINISH_LABELS[finish]} finish, base color ${color.toUpperCase()}, highlight ${hl.toUpperCase()}, shadow ${sh.toUpperCase()}${wheelColor ? `, wheel rims ${wheelColor.toUpperCase()}` : ""}`;
      const result = await window.api.photorealGenerate(shot, desc);
      setPr((p) => ({ ...p, loading: false, result }));
    } catch (e) {
      setPr((p) => ({ ...p, loading: false, error: (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") }));
    }
  };

  const refreshSettings = () => {
    window.api.getSettings().then((s) => {
      setHasKey(s.hasMeshyKey);
      setHasImagin(s.hasImaginKey);
      setHasGemini(s.hasGeminiKey);
      setHasPlate(s.hasPlateToken);
    });
  };

  useEffect(() => {
    const v = new CarViewer(host.current!);
    v.loadProcedural();
    viewer.current = v;
    if (import.meta.env.DEV) (window as any).__viewer = v;
    refreshMaterials(v, true);
    refreshSettings();
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

  const pickTones = (t: Tones) => {
    setColor(t.base);
    setHl(t.highlight);
    setSh(t.shadow);
    applyPaint(t);
  };

  const onViewerClick = (e: React.MouseEvent) => {
    if (!picking) return;
    if (Math.hypot(e.clientX - down.current[0], e.clientY - down.current[1]) > 4) return;
    if (viewer.current!.pickBodyAt(e.clientX, e.clientY)) setPicking(false);
    else setError("Clique sobre a lataria do carro.");
  };

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
      setBusy("Analisando cores da lataria…");
      setPalette(await extractPalette(imgs));
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
    setBusy("");
  };

  const onClearFiles = () => {
    setFiles([]);
    setImages([]);
    setPalette([]);
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
    viewer.current!.setInterior(cfg);
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
      setWheelColor(entry.paint.wheel ?? null);
      viewer.current!.paint(all, t, entry.paint.finish, entry.paint.tol);
    }
    if (mask) {
      await viewer.current!.importMask(mask).catch(() => {});
    }
  };

  const generate = async () => {
    setError("");
    try {
      setBusy("Enviando imagens para o gerador 3D…");
      const chosen = spread(images, 4);
      const { entry, glb, cached } = await window.api.generateModel(chosen, await sha256(chosen));
      await showModel(entry, glb);
      if (!cached) {
        await new Promise((r) => setTimeout(r, 400));
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
        setError("Esse conjunto de fotos já foi reconstruído: modelo carregado da biblioteca.");
        return;
      }
      setBusy("Preparando fotos…");
      const maxSide = pgDetail === "reduced" ? 1400 : pgDetail === "medium" ? 1800 : 2400;
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

  useEffect(() => {
    if (!currentId) return;
    const t = setTimeout(() => {
      window.api
        .libraryUpdate(currentId, {
          paint: { hex: color, highlight: hl, shadow: sh, finish, tol, wheel: wheelColor },
          interior,
        })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [currentId, color, hl, sh, finish, tol, interior]);

  useEffect(() => {
    refreshLib();
  }, []);

  const toggleMat = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const onSelectAllMats = () => {
    setSelected(mats.map((m) => m.uuid));
  };

  const savePng = () => {
    const a = document.createElement("a");
    a.href = viewer.current!.screenshot();
    a.download = `car-paint-studio-${Date.now()}.png`;
    a.click();
  };

  const onToggleTurntable = () => {
    const next = !turntable;
    setTurntable(next);
    viewer.current?.setTurntable(next);
  };

  const onResetCamera = () => {
    viewer.current?.resetCamera();
  };

  const onSelectCameraView = (view: CameraView) => {
    viewer.current?.setCameraView(view);
  };

  const onUseBaseCar = () => {
    setInside(false);
    setXray(false);
    viewer.current!.loadProcedural();
    refreshMaterials(viewer.current!, true);
    setCurrentId(null);
  };

  const currentModelName = currentId ? lib.find((x) => x.id === currentId)?.name || "Modelo 3D" : "Carro Base Procedural";

  return (
    <div className="app-container">
      {/* Top Application Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentModelName={currentModelName}
        turntable={turntable}
        onToggleTurntable={onToggleTurntable}
        onResetCamera={onResetCamera}
        onExportPng={savePng}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {activeTab === "electric" && <ElectricPanel />}

      <div className="studio-workspace" style={activeTab === "electric" ? { display: "none" } : undefined}>
        {/* Left Sidebar Inspector */}
        <aside className="studio-sidebar">
          {activeTab === "paint" && (
            <PaintTab
              mats={mats}
              selected={selected}
              toggleMat={toggleMat}
              onSelectAllMats={onSelectAllMats}
              tones={tones}
              editTone={editTone}
              pickTones={pickTones}
              pick={pick}
              finish={finish}
              setFinish={(f) => {
                setFinish(f);
                applyPaint(tones, f);
              }}
              tol={tol}
              setTol={(t) => {
                setTol(t);
                applyPaint(tones, finish, selected, t);
              }}
              picking={picking}
              setPicking={(p) => {
                setError("");
                setPicking(p);
              }}
              brushOn={brushOn}
              setBrushOn={(on) => {
                if (on) applyPaint();
                setBrushOn(on);
                viewer.current!.setBrush(on);
                if (on) setPicking(false);
              }}
              brushMode={brushMode}
              setBrushMode={setBrushMode}
              brushR={brushR}
              setBrushR={setBrushR}
              onClearBrush={() => {
                viewer.current!.clearMask();
                if (currentId) window.api.libraryUpdate(currentId, { mask: null }).catch(() => {});
              }}
              onRestoreOriginal={() => viewer.current!.restore()}
              palette={palette}
              wheelColor={wheelColor}
              setWheelColor={setWheelColor}
            />
          )}

          {activeTab === "model" && (
            <ModelTab
              files={files}
              images={images}
              onFiles={onFiles}
              onClearFiles={onClearFiles}
              pgDetail={pgDetail}
              setPgDetail={setPgDetail}
              pgMask={pgMask}
              setPgMask={setPgMask}
              onGeneratePhoto={generatePhoto}
              onCancelPhoto={() => window.api.photoCancel()}
              hasKey={hasKey}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onGenerateMeshy={generate}
              onUseBaseCar={onUseBaseCar}
              busy={busy}
              lib={lib}
              currentId={currentId}
              onOpenEntry={openEntry}
              onRenameEntry={async (id, name) => {
                await window.api.libraryUpdate(id, { name });
                refreshLib();
              }}
              onDeleteEntry={async (id) => {
                await window.api.libraryDelete(id);
                if (id === currentId) setCurrentId(null);
                refreshLib();
              }}
            />
          )}

          {activeTab === "interior" && (
            <InteriorTab
              interior={interior}
              updateInterior={updateInterior}
              inside={inside}
              onToggleInside={() => {
                if (inside) viewer.current!.exitInterior();
                else viewer.current!.enterInterior();
                setInside(!inside);
              }}
              xray={xray}
              onToggleXray={() => {
                viewer.current!.setXray(!xray);
                setXray(!xray);
              }}
            />
          )}

          {activeTab === "vehicle" && (
            <VehicleTab
              onPickColor={pick}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}
        </aside>

        {/* 3D Viewport Area */}
        <main className="studio-canvas-area">
          <div
            ref={host}
            className="viewer-host"
            style={{ cursor: picking || brushOn ? "crosshair" : undefined }}
            onPointerDown={(e) => {
              down.current = [e.clientX, e.clientY];
              if (brushOn) {
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                viewer.current!.brushAt(e.clientX, e.clientY, brushMode, brushR);
              }
            }}
            onPointerMove={(e) => {
              if (brushOn && e.buttons === 1) {
                viewer.current!.brushAt(e.clientX, e.clientY, brushMode, brushR);
              }
            }}
            onPointerUp={() => {
              if (brushOn && currentId) {
                const m = viewer.current!.exportMask();
                window.api.libraryUpdate(currentId, { mask: m }).catch(() => {});
              }
            }}
            onClick={onViewerClick}
          />

          {/* Floating Heads-Up Display (HUD) */}
          <ViewportHUD
            inside={inside}
            onToggleInside={() => {
              if (inside) viewer.current!.exitInterior();
              else viewer.current!.enterInterior();
              setInside(!inside);
            }}
            xray={xray}
            onToggleXray={() => {
              viewer.current!.setXray(!xray);
              setXray(!xray);
            }}
            onPhotoreal={generatePhotoreal}
            turntable={turntable}
            onToggleTurntable={onToggleTurntable}
            onSelectCameraView={onSelectCameraView}
            picking={picking}
            onCancelPicking={() => setPicking(false)}
            brushOn={brushOn}
            brushMode={brushMode}
            brushR={brushR}
            onCloseBrush={() => {
              setBrushOn(false);
              viewer.current!.setBrush(false);
            }}
            currentTones={tones}
            currentFinish={finish}
            finishLabel={FINISH_LABELS[finish]}
            busy={busy}
            error={error}
            onClearToast={() => {
              setError("");
              setBusy("");
            }}
          />
        </main>
      </div>

      {pr.open && (
        <PhotorealModal
          loading={pr.loading}
          shot={pr.shot}
          result={pr.result}
          error={pr.error}
          onClose={() => setPr((p) => ({ ...p, open: false }))}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        hasMeshy={hasKey}
        hasImagin={hasImagin}
        hasGemini={hasGemini}
        hasPlate={hasPlate}
        onRefreshSettings={refreshSettings}
      />
    </div>
  );
}
