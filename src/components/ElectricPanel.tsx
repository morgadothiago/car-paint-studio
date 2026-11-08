import { useEffect, useMemo, useRef, useState } from "react";
import {
  type Attachment,
  type FuseBox,
  type Slot,
  type Vehicle,
  ampColor,
  loadsOf,
  matches,
  parseSlotsCsv,
  seedSantana,
  uid,
} from "../lib/electric";
import { IconClose, IconSearch, IconTrash, IconUpload } from "./Icons";

const readFile = (file: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Falha ao ler o arquivo"));
    r.readAsDataURL(file);
  });

const download = (name: string, text: string, mime = "application/json") => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

/** Painel elétrico: caixa de fusíveis e relés interativa + esquemas elétricos anexados. */
export default function ElectricPanel() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vid, setVid] = useState("");
  const [bi, setBi] = useState(0);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState("");
  const [edit, setEdit] = useState(false);
  const [view, setView] = useState<"fuses" | "circuits" | "schematic">("fuses");
  const [photo, setPhoto] = useState(false);
  const [si, setSi] = useState(0);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      let list = await window.api.electricList();
      if (!list.length) {
        const s = seedSantana();
        await window.api.electricSave(s);
        list = [s];
      }
      setVehicles(list);
      setVid(list[0].id);
    })().catch((e) => setMsg(String(e.message ?? e)));
  }, []);

  const v = vehicles.find((x) => x.id === vid);
  const box: FuseBox | undefined = v?.boxes[Math.min(bi, (v?.boxes.length ?? 1) - 1)];
  const slot = box?.slots.find((s) => s.id === sel);
  const flash = (t: string) => {
    setMsg(t);
    setTimeout(() => setMsg(""), 3500);
  };

  const commit = (nv: Vehicle) => {
    const saved = { ...nv, updatedAt: Date.now() };
    setVehicles((all) => all.map((x) => (x.id === saved.id ? saved : x)));
    window.api.electricSave(saved).catch((e) => flash(String(e.message ?? e)));
  };
  const patchBox = (p: Partial<FuseBox>) => v && box && commit({ ...v, boxes: v.boxes.map((b) => (b.id === box.id ? { ...b, ...p } : b)) });
  const patchSlot = (id: string, p: Partial<Slot>) => box && patchBox({ slots: box.slots.map((s) => (s.id === id ? { ...s, ...p } : s)) });

  const newVehicle = async () => {
    const name = window.prompt("Nome do veículo (ex.: Gol G4 2008):");
    if (!name?.trim()) return;
    const nv: Vehicle = {
      id: uid(),
      name: name.trim(),
      boxes: [{ id: uid(), name: "Caixa de fusíveis", cols: 8, slots: [] }],
      schematics: [],
      updatedAt: Date.now(),
    };
    await window.api.electricSave(nv);
    setVehicles((a) => [nv, ...a]);
    setVid(nv.id);
    setBi(0);
    setEdit(true);
  };

  const delVehicle = async () => {
    if (!v || !window.confirm(`Apagar "${v.name}" com todas as caixas e esquemas?`)) return;
    await window.api.electricDelete(v.id);
    const rest = vehicles.filter((x) => x.id !== v.id);
    setVehicles(rest);
    setVid(rest[0]?.id ?? "");
  };

  const addBox = () => {
    const name = window.prompt("Nome da caixa (ex.: Compartimento do motor):");
    if (!v || !name?.trim()) return;
    commit({ ...v, boxes: [...v.boxes, { id: uid(), name: name.trim(), cols: 8, slots: [] }] });
    setBi(v.boxes.length);
  };

  const addSlot = (kind: Slot["kind"]) => {
    if (!box) return;
    const n = box.slots.filter((s) => s.kind === kind).length + 1;
    const s: Slot = { id: uid(), kind, label: kind === "relay" ? `R${n}` : String(n), amp: kind === "fuse" ? 10 : undefined, desc: "" };
    patchBox({ slots: [...box.slots, s] });
    setSel(s.id);
    setEdit(true);
  };

  const delSlot = (id: string) => {
    if (!box) return;
    patchBox({ slots: box.slots.filter((s) => s.id !== id) });
    setSel("");
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    patchBox({ image: await readFile(f) });
    setPhoto(true);
    flash("Foto da caixa salva. No modo Editar, clique na foto para posicionar o item selecionado.");
  };

  const onAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!v || !files.length) return;
    const add: Attachment[] = [];
    for (const f of files) add.push({ id: uid(), name: f.name, mime: f.type || "application/octet-stream", data: await readFile(f) });
    commit({ ...v, schematics: [...v.schematics, ...add] });
    setSi(v.schematics.length);
    setView("schematic");
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const text = await f.text();
      if (/\.json$/i.test(f.name)) {
        const nv = JSON.parse(text) as Vehicle;
        if (!Array.isArray(nv.boxes)) throw new Error("JSON inválido");
        const imp = { ...nv, id: uid(), updatedAt: Date.now(), schematics: nv.schematics ?? [] };
        await window.api.electricSave(imp);
        setVehicles((a) => [imp, ...a]);
        setVid(imp.id);
        flash(`Importado: ${imp.name}`);
      } else if (box) {
        const rows = parseSlotsCsv(text);
        patchBox({ slots: [...box.slots, ...rows] });
        flash(`${rows.length} itens importados do CSV na caixa atual.`);
      }
    } catch (err) {
      flash(`Erro ao importar: ${(err as Error).message}`);
    }
  };

  const photoClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!edit || !slot) return;
    const r = e.currentTarget.getBoundingClientRect();
    patchSlot(slot.id, { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  const shown = useMemo(() => box?.slots ?? [], [box]);
  const hits = shown.filter((s) => matches(s, q));
  const att = v?.schematics[Math.min(si, (v?.schematics.length ?? 1) - 1)];

  if (!v)
    return (
      <div className="elec-root">
        <div className="elec-empty">{msg || "Carregando…"}</div>
      </div>
    );

  return (
    <div className="elec-root">
      <aside className="elec-side">
        <div className="elec-row">
          <select value={vid} onChange={(e) => (setVid(e.target.value), setBi(0), setSel(""))}>
            {vehicles.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <div className="elec-row elec-btns">
          <button className="btn-secondary" onClick={newVehicle}>
            + Veículo
          </button>
          <button className="btn-secondary" onClick={() => download(`${v.name}.json`, JSON.stringify(v, null, 1))} title="Exporta o veículo com caixas e esquemas">
            Exportar
          </button>
          <label className="btn-secondary elec-file" title="Importa um veículo (.json) ou itens da caixa atual (.csv: tipo;numero;amperagem;descricao)">
            Importar
            <input type="file" accept=".json,.csv,.txt" onChange={onImport} hidden />
          </label>
          <button className="btn-secondary" onClick={delVehicle} title="Apagar veículo">
            <IconTrash size={14} />
          </button>
        </div>
        {v.notes && <p className="form-hint">{v.notes}</p>}

        <div className="elec-search">
          <IconSearch size={14} />
          <input placeholder="Buscar: farol, buzina, 15A, relé…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button className="hud-toast-close" onClick={() => setQ("")}>
              <IconClose size={12} />
            </button>
          )}
        </div>
        <div className="elec-count">
          {hits.length} de {shown.length} itens
        </div>

        <div className="elec-list">
          {hits.map((s) => (
            <button key={s.id} className={`elec-item ${s.id === sel ? "on" : ""}`} onClick={() => (setSel(s.id), view === "schematic" ? setView("circuits") : undefined)}>
              <span className={`elec-chip ${s.kind}`} style={s.kind === "fuse" ? { background: ampColor(s.amp) } : undefined}>
                {s.label}
              </span>
              <span className="elec-item-text">
                {s.kind === "fuse" && s.amp ? `${s.amp}A · ` : s.kind === "relay" ? "Relé · " : ""}
                {s.desc || "—"}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="elec-main">
        <div className="elec-toolbar">
          <div className="elec-tabs">
            <button className={view === "fuses" ? "on" : ""} onClick={() => setView("fuses")}>
              Fusíveis e relés
            </button>
            <button className={view === "circuits" ? "on" : ""} onClick={() => setView("circuits")}>
              Circuitos (dinâmico)
            </button>
            <button className={view === "schematic" ? "on" : ""} onClick={() => setView("schematic")}>
              Esquemas anexos {v.schematics.length ? `(${v.schematics.length})` : ""}
            </button>
          </div>
          {view === "fuses" && (
            <div className="elec-tools">
              <button className={`btn-secondary ${edit ? "on" : ""}`} onClick={() => setEdit(!edit)}>
                {edit ? "Concluir edição" : "Editar"}
              </button>
              {edit && (
                <>
                  <button className="btn-secondary" onClick={() => addSlot("fuse")}>
                    + Fusível
                  </button>
                  <button className="btn-secondary" onClick={() => addSlot("relay")}>
                    + Relé
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {view === "fuses" && box && (
          <>
            <div className="elec-boxbar">
              {v.boxes.map((b, i) => (
                <button key={b.id} className={i === bi ? "on" : ""} onClick={() => setBi(i)}>
                  {b.name}
                </button>
              ))}
              <button onClick={addBox}>+ Caixa</button>
              {edit && (
                <button
                  onClick={() => {
                    const n = window.prompt("Renomear caixa:", box.name);
                    if (n?.trim()) patchBox({ name: n.trim() });
                  }}
                >
                  Renomear
                </button>
              )}
              <span className="elec-spacer" />
              {box.image && (
                <div className="elec-seg">
                  <button className={!photo ? "on" : ""} onClick={() => setPhoto(false)}>
                    Painel
                  </button>
                  <button className={photo ? "on" : ""} onClick={() => setPhoto(true)}>
                    Foto
                  </button>
                </div>
              )}
              {edit && (
                <label className="elec-file elec-link">
                  <IconUpload size={13} /> {box.image ? "Trocar foto" : "Adicionar foto da caixa"}
                  <input type="file" accept="image/*" onChange={onPhoto} hidden />
                </label>
              )}
              {edit && !photo && (
                <label className="elec-cols">
                  Colunas
                  <input type="number" min={2} max={14} value={box.cols} onChange={(e) => patchBox({ cols: Math.max(2, Math.min(14, +e.target.value || 8)) })} />
                </label>
              )}
            </div>

            <div className="elec-stage">
              {!photo || !box.image ? (
                <div className="elec-board" style={{ gridTemplateColumns: `repeat(${box.cols}, minmax(52px, 1fr))` }}>
                  {shown.length === 0 && <div className="elec-empty">Caixa vazia. Clique em Editar e adicione fusíveis e relés, ou importe um CSV.</div>}
                  {shown.map((s) => {
                    const hit = matches(s, q);
                    return (
                      <button
                        key={s.id}
                        className={`elec-slot ${s.kind} ${s.id === sel ? "on" : ""} ${hit ? "" : "dim"} ${q && hit ? "hit" : ""}`}
                        onClick={() => setSel(s.id)}
                        title={s.desc}
                      >
                        {s.kind === "fuse" ? (
                          <span className="elec-blade" style={{ background: ampColor(s.amp) }}>
                            <i />
                            <i />
                          </span>
                        ) : (
                          <span className="elec-relay">
                            <b />
                          </span>
                        )}
                        <span className="elec-slot-label">{s.label}</span>
                        <span className="elec-slot-amp">{s.kind === "fuse" ? (s.amp ? `${s.amp}A` : "—") : "relé"}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className={`elec-photo ${edit && slot ? "place" : ""}`} onClick={photoClick}>
                  <img src={box.image} alt={box.name} draggable={false} />
                  {shown
                    .filter((s) => s.x !== undefined && s.y !== undefined)
                    .map((s) => (
                      <button
                        key={s.id}
                        className={`elec-pin ${s.kind} ${s.id === sel ? "on" : ""} ${matches(s, q) ? "" : "dim"}`}
                        style={{ left: `${s.x}%`, top: `${s.y}%`, background: s.kind === "fuse" ? ampColor(s.amp) : "#222" }}
                        onClick={(e) => (e.stopPropagation(), setSel(s.id))}
                        title={`${s.label} · ${s.desc}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  {edit && <div className="elec-photo-hint">{slot ? `Clique na foto para posicionar "${slot.label}"` : "Selecione um item na lista e clique na foto para posicioná-lo"}</div>}
                </div>
              )}
            </div>

            <div className="elec-detail">
              {!slot && <span className="elec-muted">Clique num fusível ou relé para ver a função.</span>}
              {slot && !edit && (
                <>
                  <span className={`elec-chip big ${slot.kind}`} style={slot.kind === "fuse" ? { background: ampColor(slot.amp) } : undefined}>
                    {slot.label}
                  </span>
                  <div>
                    <strong>{slot.kind === "relay" ? "Relé" : `Fusível${slot.amp ? ` ${slot.amp}A` : ""}`}</strong>
                    <p>{slot.desc || "Sem descrição."}</p>
                  </div>
                </>
              )}
              {slot && edit && (
                <div className="elec-form">
                  <select value={slot.kind} onChange={(e) => patchSlot(slot.id, { kind: e.target.value as Slot["kind"] })}>
                    <option value="fuse">Fusível</option>
                    <option value="relay">Relé</option>
                  </select>
                  <input value={slot.label} onChange={(e) => patchSlot(slot.id, { label: e.target.value })} placeholder="Nº / nome" style={{ width: 90 }} />
                  {slot.kind === "fuse" && (
                    <input
                      type="number"
                      step="0.5"
                      value={slot.amp ?? ""}
                      onChange={(e) => patchSlot(slot.id, { amp: e.target.value ? +e.target.value : undefined })}
                      placeholder="A"
                      style={{ width: 70 }}
                    />
                  )}
                  <input value={slot.desc} onChange={(e) => patchSlot(slot.id, { desc: e.target.value })} placeholder="Função: separe os consumidores por vírgula" style={{ flex: 1, minWidth: 220 }} />
                  {slot.kind === "fuse" && box && box.slots.some((x) => x.kind === "relay") && (
                    <select value={slot.via ?? ""} onChange={(e) => patchSlot(slot.id, { via: e.target.value || undefined })} title="Relé que comanda este circuito">
                      <option value="">Sem relé</option>
                      {box.slots
                        .filter((x) => x.kind === "relay")
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            via {x.label}
                          </option>
                        ))}
                    </select>
                  )}
                  {slot.x !== undefined && (
                    <button className="btn-secondary" onClick={() => patchSlot(slot.id, { x: undefined, y: undefined })}>
                      Tirar da foto
                    </button>
                  )}
                  <button className="btn-secondary" onClick={() => delSlot(slot.id)}>
                    <IconTrash size={14} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {view === "circuits" && box && (
          <div className="elec-circuits">
            {(slot ? [slot, ...hits.filter((x) => x.id !== slot.id)] : hits).slice(0, 40).map((x) => (
              <Circuit key={x.id} slot={x} box={box} focus={x.id === sel} onPick={setSel} />
            ))}
            {hits.length === 0 && <div className="elec-empty">Nada encontrado para essa busca.</div>}
          </div>
        )}

        {view === "schematic" && (
          <div className="elec-schem">
            <div className="elec-boxbar">
              {v.schematics.map((a, i) => (
                <button key={a.id} className={i === si ? "on" : ""} onClick={() => setSi(i)}>
                  {a.name}
                </button>
              ))}
              <label className="elec-file elec-link">
                <IconUpload size={13} /> Anexar esquema (PDF ou imagem)
                <input type="file" accept="image/*,application/pdf" multiple onChange={onAttach} hidden />
              </label>
              {att && (
                <button
                  onClick={() => {
                    if (!window.confirm(`Remover "${att.name}"?`)) return;
                    commit({ ...v, schematics: v.schematics.filter((x) => x.id !== att.id) });
                    setSi(0);
                  }}
                >
                  Remover
                </button>
              )}
            </div>
            {!att && (
              <div className="elec-empty">
                Nenhum esquema anexado. Anexe o esquema elétrico do seu carro (do manual de oficina, em PDF ou imagem). Eles ficam salvos neste computador.
              </div>
            )}
            {att && att.mime === "application/pdf" && <embed className="elec-pdf" src={att.data} type="application/pdf" />}
            {att && att.mime.startsWith("image/") && (
              <ZoomImage
                key={att.id}
                src={att.data}
                alt={att.name}
                pins={(att.pins ?? []).map((p) => ({ ...p, s: box?.slots.find((x) => x.id === p.slot) }))}
                canPlace={!!slot}
                slotLabel={slot?.label}
                onPlace={(x, y) => {
                  if (!slot) return;
                  const pins = [...(att.pins ?? []).filter((p) => p.slot !== slot.id), { id: uid(), x, y, slot: slot.id }];
                  commit({ ...v, schematics: v.schematics.map((a) => (a.id === att.id ? { ...a, pins } : a)) });
                }}
                onRemove={(pid) => commit({ ...v, schematics: v.schematics.map((a) => (a.id === att.id ? { ...a, pins: (a.pins ?? []).filter((p) => p.id !== pid) } : a)) })}
                onSelect={(sid) => (setSel(sid), setView("circuits"))}
              />
            )}
          </div>
        )}
        {msg && <div className="elec-toast">{msg}</div>}
      </section>
    </div>
  );
}

/** Esquema anexo com zoom (roda do mouse), arraste e pontos clicáveis ligados aos fusíveis/relés. */
function ZoomImage({
  src,
  alt,
  pins,
  canPlace,
  slotLabel,
  onPlace,
  onRemove,
  onSelect,
}: {
  src: string;
  alt: string;
  pins: { id: string; x: number; y: number; slot: string; s?: Slot }[];
  canPlace: boolean;
  slotLabel?: string;
  onPlace: (x: number, y: number) => void;
  onRemove: (id: string) => void;
  onSelect: (slot: string) => void;
}) {
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const [place, setPlace] = useState(false);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  return (
    <div
      className="elec-zoom"
      onWheel={(e) => {
        const k = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        setT((p) => ({ ...p, s: Math.max(0.2, Math.min(12, p.s * k)) }));
      }}
      onMouseDown={(e) => (drag.current = { x: e.clientX - t.x, y: e.clientY - t.y, moved: false })}
      onMouseMove={(e) => {
        if (!drag.current) return;
        drag.current.moved = true;
        setT((p) => ({ ...p, x: e.clientX - drag.current!.x, y: e.clientY - drag.current!.y }));
      }}
      onMouseUp={() => (drag.current = null)}
      onMouseLeave={() => (drag.current = null)}
    >
      <div
        className={`elec-zoom-inner ${place ? "place" : ""}`}
        style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})` }}
        onClick={(e) => {
          if (!place || !canPlace || drag.current?.moved) return;
          const r = e.currentTarget.getBoundingClientRect();
          onPlace(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
          setPlace(false);
        }}
      >
        <img src={src} alt={alt} draggable={false} />
        {pins.map((p) => (
          <button
            key={p.id}
            className={`elec-pin ${p.s?.kind ?? "fuse"}`}
            style={{ left: `${p.x}%`, top: `${p.y}%`, background: p.s?.kind === "relay" ? "#222" : ampColor(p.s?.amp), transform: `translate(-50%, -50%) scale(${1 / t.s})` }}
            title={`${p.s?.label ?? "?"} · ${p.s?.desc ?? ""} (Shift+clique remove)`}
            onClick={(e) => {
              e.stopPropagation();
              if (e.shiftKey) onRemove(p.id);
              else if (p.s) onSelect(p.slot);
            }}
          >
            {p.s?.label ?? "?"}
          </button>
        ))}
      </div>
      <div className="elec-zoom-btns">
        <button
          className={place ? "on" : ""}
          disabled={!canPlace}
          style={{ width: "auto", padding: "0 12px" }}
          onClick={() => setPlace(!place)}
          title="Selecione um fusível/relé na lista e clique no esquema para marcar onde ele aparece"
        >
          {place ? `Clique no esquema (${slotLabel})…` : canPlace ? `Marcar ${slotLabel}` : "Selecione um item na lista"}
        </button>
        <button onClick={() => setT((p) => ({ ...p, s: Math.min(12, p.s * 1.3) }))}>+</button>
        <button onClick={() => setT((p) => ({ ...p, s: Math.max(0.2, p.s / 1.3) }))}>−</button>
        <button onClick={() => setT({ s: 1, x: 0, y: 0 })}>1:1</button>
      </div>
    </div>
  );
}

/** Circuito gerado dos dados: bateria → fusível → (relé) → consumidores. Simula fusível queimado. */
function Circuit({ slot, box, focus, onPick }: { slot: Slot; box: FuseBox; focus: boolean; onPick: (id: string) => void }) {
  const [blown, setBlown] = useState(false);
  const relay = slot.kind === "fuse" ? box.slots.find((x) => x.id === slot.via) : undefined;
  const inputs = slot.kind === "relay" ? box.slots.filter((x) => x.via === slot.id) : [];
  const loads = slot.kind === "relay" ? [slot.desc || "Relé"] : loadsOf(slot).length ? loadsOf(slot) : ["(sem consumidores cadastrados)"];
  const rowH = 34;
  const H = Math.max(120, loads.length * rowH + 44, inputs.length * rowH + 44);
  const mid = H / 2;
  const col = slot.kind === "fuse" ? ampColor(slot.amp) : "#8a93a6";
  const live = !blown;
  const ly = (i: number, n: number) => (n === 1 ? mid : 22 + (i * (H - 44)) / (n - 1));
  const wire = (d: string, on: boolean) => <path d={d} className={`elec-wire ${on ? "live" : "dead"}`} />;
  return (
    <div className={`elec-circuit ${focus ? "focus" : ""}`}>
      <div className="elec-circuit-head">
        <button className="elec-link-btn" onClick={() => onPick(slot.id)}>
          <span className={`elec-chip ${slot.kind}`} style={slot.kind === "fuse" ? { background: col } : undefined}>
            {slot.label}
          </span>
        </button>
        <span className="elec-circuit-title">
          {slot.kind === "fuse" ? `Fusível${slot.amp ? ` ${slot.amp}A` : ""}` : "Relé"} · {loadsOf(slot)[0] ?? "—"}
          {loadsOf(slot).length > 1 ? ` +${loadsOf(slot).length - 1}` : ""}
        </span>
        {slot.kind === "fuse" && (
          <button className={`btn-secondary ${blown ? "on" : ""}`} onClick={() => setBlown(!blown)}>
            {blown ? "Fusível queimado" : "Simular queima"}
          </button>
        )}
      </div>
      <svg viewBox={`0 0 760 ${H}`} className="elec-svg">
        {/* bateria */}
        <rect x="6" y={mid - 26} width="70" height="52" rx="8" fill="#232731" stroke="#454b58" />
        <text x="41" y={mid - 3} textAnchor="middle" className="elec-t">
          Bateria
        </text>
        <text x="41" y={mid + 14} textAnchor="middle" className="elec-t sm">
          +12 V
        </text>
        {slot.kind === "relay" ? (
          <>
            {inputs.length === 0 && wire(`M76 ${mid} H300`, true)}
            {inputs.map((x, i) => {
              const y = ly(i, inputs.length);
              return (
                <g key={x.id} onClick={() => onPick(x.id)} style={{ cursor: "pointer" }}>
                  {wire(`M76 ${mid} H120 V${y} H170`, true)}
                  <rect x="170" y={y - 13} width="86" height="26" rx="5" fill={ampColor(x.amp)} />
                  <text x="213" y={y + 4} textAnchor="middle" className="elec-t dark">
                    {x.label} · {x.amp ? `${x.amp}A` : "—"}
                  </text>
                  {wire(`M256 ${y} H300 V${mid}`, true)}
                </g>
              );
            })}
          </>
        ) : (
          <>
            {wire(`M76 ${mid} H170`, true)}
            <g>
              <rect x="170" y={mid - 15} width="92" height="30" rx="6" fill={live ? col : "#3a3f4a"} />
              <text x="216" y={mid + 5} textAnchor="middle" className="elec-t dark">
                {slot.label} · {slot.amp ? `${slot.amp}A` : "—"}
              </text>
              {!live && <path d={`M232 ${mid - 8} l-32 16 M200 ${mid - 8} l32 16`} stroke="#ff5a5a" strokeWidth="3" />}
            </g>
            {wire(`M262 ${mid} H${relay ? 330 : 400}`, live)}
            {relay && (
              <g onClick={() => onPick(relay.id)} style={{ cursor: "pointer" }}>
                <rect x="330" y={mid - 20} width="64" height="40" rx="6" fill="#111" stroke="#5b6275" strokeWidth="2" />
                <text x="362" y={mid + 5} textAnchor="middle" className="elec-t">
                  {relay.label}
                </text>
                {wire(`M394 ${mid} H430`, live)}
              </g>
            )}
          </>
        )}
        {/* consumidores */}
        {slot.kind === "fuse" &&
          loads.map((l, i) => {
            const y = ly(i, loads.length);
            const x0 = relay ? 430 : 400;
            return (
              <g key={i}>
                {wire(`M${x0} ${mid} H${x0 + 24} V${y} H${x0 + 48}`, live)}
                <rect x={x0 + 48} y={y - 13} width={760 - x0 - 54} height="26" rx="13" fill={live ? "#1f3a2a" : "#2a2d34"} stroke={live ? "#38b25a" : "#454b58"} />
                <text x={x0 + 60} y={y + 4} className="elec-t">
                  {live ? "● " : "○ "}
                  {l.length > 44 ? l.slice(0, 43) + "…" : l}
                </text>
              </g>
            );
          })}
        {slot.kind === "relay" && (
          <g>
            <rect x="300" y={mid - 20} width="64" height="40" rx="6" fill="#111" stroke="#5b6275" strokeWidth="2" />
            <text x="332" y={mid + 5} textAnchor="middle" className="elec-t">
              {slot.label}
            </text>
            {wire(`M364 ${mid} H420`, true)}
            <rect x="420" y={mid - 13} width="320" height="26" rx="13" fill="#1f3a2a" stroke="#38b25a" />
            <text x="432" y={mid + 4} className="elec-t">
              ● {loads[0].length > 40 ? loads[0].slice(0, 39) + "…" : loads[0]}
            </text>
          </g>
        )}
      </svg>
      {!live && <div className="elec-circuit-note">Com este fusível queimado, os consumidores acima ficam sem energia.</div>}
    </div>
  );
}
