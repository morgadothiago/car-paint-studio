import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Finish, MaterialInfo } from "./types";
import type { Tones } from "./colors";

type PBR = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;

const FINISH_BASE: Partial<THREE.MeshPhysicalMaterialParameters> = {
  metalness: 0,
  roughness: 0.5,
  clearcoat: 0,
  clearcoatRoughness: 0,
  iridescence: 0,
  sheen: 0,
  specularIntensity: 1,
  envMapIntensity: 1,
};
const FINISHES: Record<Finish, Partial<THREE.MeshPhysicalMaterialParameters>> = {
  // tinta lisa com verniz espelhado
  gloss: { ...FINISH_BASE, metalness: 0.05, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.72 },
  // sem verniz, reflexo difuso e suave
  matte: { ...FINISH_BASE, metalness: 0, roughness: 0.92, specularIntensity: 0.35, envMapIntensity: 0.55 },
  // partículas de alumínio sob o verniz (grão via normal do verniz)
  metallic: { ...FINISH_BASE, metalness: 0.88, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.85 },
  // reflexo que muda de tom com o ângulo (película fina) + brilho de borda
  pearl: {
    ...FINISH_BASE,
    metalness: 0.35,
    roughness: 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    iridescence: 0.5,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [180, 520],
    sheen: 0.15,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(0xffffff),
    envMapIntensity: 0.75,
  },
};

/** Desfoque de caixa separável (soma deslizante) em um canal por vez. */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / n;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / n;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

let flakeTex: THREE.Texture | null = null;
/** Normal map de grão fino (flocos de alumínio) usado no verniz do acabamento metálico. */
function flakeNormal(): THREE.Texture {
  if (flakeTex) return flakeTex;
  const N = 256;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const nx = (Math.random() - 0.5) * 0.9,
      ny = (Math.random() - 0.5) * 0.9;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    img.data[i * 4] = (nx * 0.5 + 0.5) * 255;
    img.data[i * 4 + 1] = (ny * 0.5 + 0.5) * 255;
    img.data[i * 4 + 2] = (nz * 0.5 + 0.5) * 255;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(40, 40);
  flakeTex = t;
  return t;
}

interface TexState {
  orig: ImageData;
  canvas: HTMLCanvasElement;
  tex: THREE.Texture;
  body: [number, number, number];
  q?: { tol: number; lo: number; hi: number }; // percentis 5/95 do brilho da lataria no scan
  mask: Uint8Array; // 255 = pode receber tinta, 0 = protegido (rodas, frisos, vidros)
  posMap?: { P: number; pos: Float32Array; has: Uint8Array }; // posição 3D de cada ponto da textura (para o pincel)
  rim?: Uint8Array; // 255 = aro da roda (recebe a cor das rodas); detectado automaticamente
  partsDone?: boolean;
  blur?: { rgb: Float32Array[]; lum: Float32Array }; // cor suavizada (classificar a lataria) e luminância suave (sombreado sem granulado)
}

const rgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Cor dominante ponderada pela área na superfície 3D (o atlas de textura tem muito preenchimento). */
function detectBody(samples: number[][]): [number, number, number] {
  const k = 6;
  const pts = samples;
  let c = Array.from({ length: k }, (_, i) => pts[Math.floor((i * pts.length) / k)].slice(0, 3));
  const as = new Array<number>(pts.length).fill(0);
  for (let it = 0; it < 12; it++) {
    pts.forEach((p, i) => {
      let b = 0,
        bd = Infinity;
      c.forEach((q, qi) => {
        const dd = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
        if (dd < bd) ((bd = dd), (b = qi));
      });
      as[i] = b;
    });
    const sum = c.map(() => [0, 0, 0, 0]);
    pts.forEach((p, i) => {
      const t = sum[as[i]];
      t[0] += p[0] * p[3];
      t[1] += p[1] * p[3];
      t[2] += p[2] * p[3];
      t[3] += p[3];
    });
    c = c.map((q, i) => (sum[i][3] ? sum[i].slice(0, 3).map((v) => v / sum[i][3]) : q));
  }
  const wt = c.map(() => 0);
  pts.forEach((p, i) => (wt[as[i]] += p[3]));
  return c[wt.indexOf(Math.max(...wt))] as [number, number, number];
}

export type InteriorKey = "seats" | "dash" | "console" | "wheel" | "doors" | "carpet";
export interface InteriorCfg {
  flip: boolean; // inverte a frente do carro (o scan pode vir virado para qualquer lado)
  items: Record<InteriorKey, { show: boolean; color: string }>;
}
export const INTERIOR_LABELS: Record<InteriorKey, string> = {
  seats: "Bancos",
  dash: "Painel",
  console: "Console central",
  wheel: "Volante",
  doors: "Portas",
  carpet: "Tapete",
};
export const defaultInterior = (): InteriorCfg => ({
  flip: false,
  items: {
    seats: { show: true, color: "#2b2b2e" },
    dash: { show: true, color: "#1d1d20" },
    console: { show: true, color: "#26262a" },
    wheel: { show: true, color: "#141416" },
    doors: { show: true, color: "#2a2a30" },
    carpet: { show: true, color: "#1a1a1c" },
  },
});

export class CarViewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  private controls: OrbitControls;
  private model: THREE.Object3D | null = null;
  private materials = new Map<string, PBR>();
  private originals = new Map<
    string,
    {
      color: THREE.Color;
      map: THREE.Texture | null;
      metalness?: number;
      roughness?: number;
      metalnessMap?: THREE.Texture | null;
      roughnessMap?: THREE.Texture | null;
    }
  >();
  private raf = 0;
  private ro: ResizeObserver;
  private tex = new Map<string, TexState>();
  private last: { uuids: string[]; tones: Tones; finish: Finish; tol: number } | null = null;
  private pending = 0;
  private wheelColor: string | null = null; // cor das rodas (null = mantém a original)
  private raycaster = new THREE.Raycaster();
  private interior: THREE.Group | null = null;
  private intParts: Partial<Record<InteriorKey, THREE.Group>> = {};
  private intMats = {} as Record<InteriorKey, THREE.MeshStandardMaterial>;
  private intCfg: InteriorCfg = defaultInterior();
  private eyeLocal = new THREE.Vector3(0, 1.1, -0.4);
  private builtFlip = false;
  private clip: THREE.Plane[] = [];
  private saved: {
    pos: THREE.Vector3;
    target: THREE.Vector3;
    near: number;
    fov: number;
    sides: Map<string, THREE.Side>;
  } | null = null;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.toneMapping = THREE.NeutralToneMapping; // preserva a cor escolhida (ACES dessatura)
    this.renderer.localClippingEnabled = true; // recorta peças do interior no limite da cabine
    container.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.background = new THREE.Color(0x14171c);
    this.scene.environmentIntensity = 0.7; // reflexo menos estourado no capô e teto

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(6, 64),
      new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    this.camera.position.set(5, 2.2, 6);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.target.set(0, 0.7, 0);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private setModel(obj: THREE.Object3D) {
    this.xrayOrig.clear(); // materiais antigos saem de cena
    this.exitInterior();
    if (this.model) this.scene.remove(this.model);
    this.materials.clear();
    this.originals.clear();
    this.tex.clear();
    this.last = null;
    // Normaliza: ~4.4 m de comprimento, apoiado no chão, centralizado.
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    obj.scale.multiplyScalar(4.4 / Math.max(size.x, size.z));
    const b2 = new THREE.Box3().setFromObject(obj);
    const c = b2.getCenter(new THREE.Vector3());
    obj.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z));
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const m = mesh.material as PBR | PBR[] | undefined;
      if (!m) return;
      // MeshPhysicalMaterial é necessário para verniz (clearcoat), iridescência e brilho de borda
      const up = (x: PBR): PBR => {
        if ((x as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) return x;
        const p = new THREE.MeshPhysicalMaterial();
        THREE.MeshStandardMaterial.prototype.copy.call(p, x as THREE.MeshStandardMaterial); // só campos padrão
        p.name = x.name;
        return p;
      };
      const list = (Array.isArray(m) ? m : [m]).map(up);
      mesh.material = Array.isArray(m) ? list : list[0];
      for (const mat of list) {
        this.materials.set(mat.uuid, mat);
        this.originals.set(mat.uuid, {
          color: mat.color.clone(),
          map: mat.map,
          metalness: mat.metalness,
          roughness: mat.roughness,
          metalnessMap: mat.metalnessMap,
          roughnessMap: mat.roughnessMap,
        });
      }
    });
    this.scene.add(obj);
    this.model = obj;
    this.buildInterior();
  }

  async loadGLB(bytes: Uint8Array) {
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(0) as ArrayBuffer, "");
    this.setModel(gltf.scene);
  }

  /** Carro procedural simples: funciona offline e serve de modelo base. */
  loadProcedural() {
    const g = new THREE.Group();
    const body = new THREE.MeshPhysicalMaterial({ color: 0xc40d1e, name: "Carroceria" });
    Object.assign(body, FINISHES.gloss);
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x0a1218,
      roughness: 0.05,
      metalness: 0.1,
      name: "Vidros",
    });
    const tire = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, name: "Pneus" });
    const rim = new THREE.MeshStandardMaterial({
      color: 0xbfc3c9,
      metalness: 1,
      roughness: 0.2,
      name: "Rodas",
    });

    const prof = new THREE.Shape();
    prof.moveTo(-2.2, 0.35);
    prof.lineTo(-2.2, 0.85);
    prof.quadraticCurveTo(-2.1, 0.98, -1.7, 1.0);
    prof.lineTo(-0.9, 1.05);
    prof.quadraticCurveTo(-0.55, 1.5, 0.1, 1.5);
    prof.lineTo(0.75, 1.5);
    prof.quadraticCurveTo(1.15, 1.45, 1.4, 1.05);
    prof.lineTo(2.0, 0.98);
    prof.quadraticCurveTo(2.25, 0.9, 2.2, 0.55);
    prof.lineTo(2.2, 0.35);
    prof.closePath();
    const geo = new THREE.ExtrudeGeometry(prof, {
      depth: 1.5,
      bevelEnabled: true,
      bevelSize: 0.12,
      bevelThickness: 0.12,
      bevelSegments: 6,
      curveSegments: 24,
    });
    geo.translate(0, 0, -0.75);
    g.add(new THREE.Mesh(geo, body));

    const gl = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.38, 1.46), glass);
    gl.position.set(0.05, 1.2, 0);
    g.add(gl);

    for (const [x, z] of [
      [-1.4, 0.85],
      [-1.4, -0.85],
      [1.4, 0.85],
      [1.4, -0.85],
    ]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32), tire);
      t.rotation.x = Math.PI / 2;
      t.position.set(x, 0.4, z);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.32, 24), rim);
      r.rotation.x = Math.PI / 2;
      r.position.copy(t.position);
      g.add(t, r);
    }
    g.rotation.y = Math.PI; // frente para +x
    this.setModel(g);
  }

  listMaterials(): MaterialInfo[] {
    return [...this.materials.values()].map((m, i) => ({
      uuid: m.uuid,
      name: m.name || `Material ${i + 1}`,
    }));
  }

  private texState(m: PBR): TexState | null {
    const cached = this.tex.get(m.uuid);
    if (cached) return cached;
    const orig = this.originals.get(m.uuid)?.map;
    const img = orig?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
    if (!orig || !img || !img.width) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const tex = orig.clone();
    tex.image = canvas;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const st: TexState = {
      orig: data,
      canvas,
      tex,
      body: this.sampleBody(m, data, orig.flipY),
      mask: new Uint8Array(data.width * data.height).fill(255),
    };
    this.tex.set(m.uuid, st);
    return st;
  }

  /** Amostra a textura no centro de cada triângulo, ponderando pela área do triângulo. */
  private sampleBody(m: PBR, data: ImageData, flipY: boolean): [number, number, number] {
    const samples: number[][] = [];
    const [w, h] = [data.width, data.height];
    const a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3();
    this.model?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const mm = mesh.material;
      if (!mesh.isMesh || !(mm === m || (Array.isArray(mm) && mm.includes(m)))) return;
      const pos = mesh.geometry.getAttribute("position");
      const uv = mesh.geometry.getAttribute("uv");
      if (!pos || !uv) return;
      const idx = mesh.geometry.index;
      const tris = idx ? idx.count / 3 : pos.count / 3;
      const step = Math.max(1, Math.floor(tris / 20000));
      for (let t = 0; t < tris; t += step) {
        const i0 = idx ? idx.getX(t * 3) : t * 3;
        const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
        const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
        a.fromBufferAttribute(pos, i0);
        b.fromBufferAttribute(pos, i1);
        c.fromBufferAttribute(pos, i2);
        const area = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
        const u = (uv.getX(i0) + uv.getX(i1) + uv.getX(i2)) / 3;
        const v = (uv.getY(i0) + uv.getY(i1) + uv.getY(i2)) / 3;
        const x = Math.min(w - 1, Math.max(0, Math.floor(u * w)));
        const y = Math.min(h - 1, Math.max(0, Math.floor((flipY ? 1 - v : v) * h)));
        const p = (y * w + x) * 4;
        samples.push([data.data[p], data.data[p + 1], data.data[p + 2], area]);
      }
    });
    return samples.length ? detectBody(samples) : [128, 128, 128];
  }

  /**
   * Recolore só os pixels da lataria usando 3 tons: o brilho do scan (relativo à cor original) é
   * mapeado em sombra (percentil 5) → base (mediana) → brilho máximo (percentil 95).
   */
  private recolor(st: TexState, t: Tones, tol: number) {
    const [br, bg, bb] = st.body;
    const bl = Math.max(20, lum(br, bg, bb));
    const src = st.orig.data;
    const soft = tol * 1.5;
    const keepDark = bl >= 60; // carro não escuro: preto quase puro é pneu, vidro ou friso, nunca lataria
    // O scan tem sujeira e granulado: classificar e sombrear sobre a imagem suavizada deixa a tinta lisa e sem manchas.
    if (!st.blur) {
      const w = st.orig.width,
        h = st.orig.height;
      const ch = [0, 1, 2].map((c) => {
        const a = new Float32Array(w * h);
        for (let p = 0; p < a.length; p++) a[p] = src[p * 4 + c];
        return a;
      });
      const L = new Float32Array(w * h);
      for (let p = 0; p < L.length; p++) L[p] = lum(ch[0][p], ch[1][p], ch[2][p]);
      st.blur = {
        rgb: ch.map((a) => boxBlur(a, w, h, Math.max(2, Math.round(w / 700)))),
        lum: boxBlur(L, w, h, Math.max(3, Math.round(w / 320))),
      };
    }
    const { rgb: cb, lum: lb } = st.blur;
    const GAIN = 0.4; // o sombreado "assado" no scan vira só parte da variação: o resto vem da luz 3D (tinta limpa)
    const ratio = (i: number) => 1 + (lb[i >> 2] / bl - 1) * GAIN;
    const near = (i: number) => {
      const p = i >> 2;
      if (keepDark && lum(cb[0][p], cb[1][p], cb[2][p]) < 26) return -1;
      const d = Math.sqrt((cb[0][p] - br) ** 2 + (cb[1][p] - bg) ** 2 + (cb[2][p] - bb) ** 2);
      return d >= soft ? -1 : d <= tol ? 1 : 1 - (d - tol) / (soft - tol);
    };

    if (!st.q || st.q.tol !== tol) {
      const bins = new Uint32Array(400); // razão de luminosidade 0..2
      let n = 0;
      for (let i = 0; i < src.length; i += 4 * 3) {
        if (near(i) < 1) continue;
        const r = ratio(i);
        bins[Math.min(399, Math.floor(r * 200))]++;
        n++;
      }
      const pct = (p: number) => {
        let acc = 0;
        for (let k = 0; k < 400; k++) if ((acc += bins[k]) >= n * p) return (k + 0.5) / 200;
        return 1;
      };
      st.q = { tol, lo: Math.min(0.97, pct(0.05)), hi: Math.max(1.03, pct(0.95)) };
    }
    const { lo, hi } = st.q;
    const B = rgb(t.base),
      H = rgb(t.highlight),
      S = rgb(t.shadow);

    const out = new ImageData(new Uint8ClampedArray(src), st.orig.width, st.orig.height);
    const o = out.data;
    const mask = st.mask;
    const rim = st.rim && this.wheelColor ? st.rim : null;
    let rl = 100;
    if (rim) {
      const ls: number[] = [];
      for (let i = 0; i < src.length; i += 16) if (rim[i >> 2]) ls.push(lum(src[i], src[i + 1], src[i + 2]));
      ls.sort((a, b) => a - b);
      rl = Math.max(40, ls[Math.floor(ls.length * 0.9)] ?? 100); // percentil 90 = cor cheia da roda
    }
    const RC = this.wheelColor ? rgb(this.wheelColor) : [0, 0, 0];
    for (let i = 0; i < src.length; i += 4) {
      if (rim && rim[i >> 2]) {
        const f = Math.min(1.08, Math.max(0.3, lum(src[i], src[i + 1], src[i + 2]) / rl));
        for (let j = 0; j < 3; j++) o[i + j] = Math.max(0, Math.min(255, RC[j] * f));
        continue;
      }
      const mk = mask[i >> 2];
      if (mk === 0) continue; // região protegida: mantém a textura original
      const w0 = near(i);
      if (w0 < 0) continue;
      const w = mk === 255 ? w0 : (w0 * mk) / 255;
      const r = ratio(i);
      let c: number[];
      if (r >= 1) {
        const k = Math.pow(Math.min(1, (r - 1) / (hi - 1)), 1.3) * 0.8;
        const over = r > hi ? r / hi : 1; // detalhe além do brilho máximo
        c = [0, 1, 2].map((j) => (B[j] + (H[j] - B[j]) * k) * over);
      } else {
        const k = Math.pow(Math.min(1, (1 - r) / (1 - lo)), 1.3) * 0.8;
        const under = r < lo ? r / lo : 1; // detalhe além da sombra
        c = [0, 1, 2].map((j) => (B[j] + (S[j] - B[j]) * k) * under);
      }
      for (let j = 0; j < 3; j++) o[i + j] = src[i + j] + (Math.max(0, Math.min(255, c[j])) - src[i + j]) * w;
    }
    st.canvas.getContext("2d")!.putImageData(out, 0, 0);
    st.tex.needsUpdate = true;
  }

  /** Pinta. Em modelos escaneados só recolore os pixels da lataria; no carro base usa cor sólida. */
  paint(uuids: string[], tones: Tones, finish: Finish, tol = 60) {
    this.last = { uuids, tones, finish, tol };
    if (this.pending) return;
    this.pending = requestAnimationFrame(() => {
      this.pending = 0;
      this.apply();
    });
  }

  /** Vidros, pneus, rodas, faróis e cromados não são lataria: nunca recebem a cor. */
  private isProtected(m: PBR): boolean {
    if (/glass|window|windshield|vidro|parabrisa|tire|tyre|pneu|wheel|rim\b|roda|rubber|borracha|light|lamp|farol|lanterna|chrome|cromad|trim|friso|grill|mirror|espelho/i.test(m.name || "")) return true;
    if (m.transparent || m.opacity < 0.95 || ((m as THREE.MeshPhysicalMaterial).transmission ?? 0) > 0.05) return true;
    if (!this.originals.get(m.uuid)?.map) {
      const o = this.originals.get(m.uuid)!.color;
      const l = lum(o.r * 255, o.g * 255, o.b * 255);
      if (l < 30) return [...this.originals.values()].some((x) => !x.map && lum(x.color.r * 255, x.color.g * 255, x.color.b * 255) >= 30);
    }
    return false;
  }

  /** Aplica o acabamento. Mapas de metal/rugosidade do scan são ignorados para o acabamento valer em todo o carro. */
  private applyFinish(m: PBR, finish: Finish) {
    const p = m as THREE.MeshPhysicalMaterial;
    p.metalnessMap = null;
    p.roughnessMap = null;
    Object.assign(p, FINISHES[finish]);
    if (finish === "metallic") {
      p.clearcoatNormalMap = flakeNormal();
      p.clearcoatNormalScale = new THREE.Vector2(0.35, 0.35);
    } else p.clearcoatNormalMap = null;
  }

  private apply() {
    if (!this.last) return;
    const { uuids, tones, finish, tol } = this.last;
    for (const id of uuids) {
      const m = this.materials.get(id);
      if (!m) continue;
      if (this.isProtected(m)) {
        const o = this.originals.get(id)!;
        m.color.copy(o.color);
        m.map = o.map ?? null;
        m.needsUpdate = true;
        continue;
      }
      const st = this.texState(m);
      if (st) {
        if (!st.partsDone) this.detectParts(st, m);
        this.recolor(st, tones, tol);
        m.map = st.tex;
        m.color.set(0xffffff);
      } else m.color.set(tones.base);
      this.applyFinish(m, finish);
      m.needsUpdate = true;
    }
  }

  /**
   * Acha as rodas no scan: agrupa os pontos escuros (pneus) rente ao chão de cada lado, estima centro e raio
   * de cada roda e separa o aro (centro, recebe a cor das rodas) do pneu (anel externo, sempre protegido).
   */
  private detectParts(st: TexState, m: PBR) {
    st.partsDone = true;
    const flip = this.originals.get(m.uuid)?.map?.flipY ?? true;
    if (!st.posMap) this.buildPosMap(st, m, flip);
    const { P, pos, has } = st.posMap!;
    const W = st.orig.width,
      H = st.orig.height;
    const d = st.orig.data;
    const ks: number[] = [];
    let mn = [Infinity, Infinity, Infinity],
      mx = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < P * P; k++) {
      if (!has[k]) continue;
      ks.push(k);
      for (let a = 0; a < 3; a++) {
        mn[a] = Math.min(mn[a], pos[k * 3 + a]);
        mx[a] = Math.max(mx[a], pos[k * 3 + a]);
      }
    }
    if (ks.length < 100) return;
    const ext = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
    const lg = ext[0] >= ext[2] ? 0 : 2; // eixo do comprimento
    const lt = lg === 0 ? 2 : 0; // eixo lateral
    const hh = ext[1];
    const midLt = (mn[lt] + mx[lt]) / 2;
    // pneus tocam o chão: os pontos mais baixos de cada lado formam uma mancha de contato por roda
    const floor = mn[1] + hh * 0.07;
    const R = hh * 0.2; // raio típico do conjunto roda+pneu em relação à altura do carro
    const wheels: { side: number; cl: number; cy: number; r: number }[] = [];
    for (const side of [1, -1]) {
      const cand = ks.filter((k) => pos[k * 3 + 1] < floor && (pos[k * 3 + lt] - midLt) * side > ext[lt] * 0.15);
      if (cand.length < 40) continue;
      cand.sort((a, b) => pos[a * 3 + lg] - pos[b * 3 + lg]);
      const groups: number[][] = [[cand[0]]];
      for (let i = 1; i < cand.length; i++) {
        const gap = pos[cand[i] * 3 + lg] - pos[cand[i - 1] * 3 + lg];
        if (gap > ext[lg] * 0.08) groups.push([]);
        groups[groups.length - 1].push(cand[i]);
      }
      groups
        .sort((a, b) => b.length - a.length)
        .slice(0, 2)
        .filter((g) => g.length > cand.length * 0.15)
        .forEach((g) => {
          const L = g.map((k) => pos[k * 3 + lg]).sort((a, b) => a - b);
          wheels.push({ side, cl: L[Math.floor(L.length / 2)], cy: mn[1] + R, r: R });
        });
    }
    if (!wheels.length) return;
    const rim = new Uint8Array(W * H);
    const sx = W / P,
      sy = H / P;
    const tireK = new Set<number>();
    for (const k of ks) {
      const l = pos[k * 3 + lg],
        y = pos[k * 3 + 1],
        s2 = pos[k * 3 + lt] - midLt;
      for (const w of wheels) {
        if (s2 * w.side < ext[lt] * 0.12) continue;
        const dd = Math.hypot(l - w.cl, y - w.cy);
        if (dd < w.r * 0.74) {
          for (let yy = Math.floor(Math.floor(k / P) * sy); yy < Math.min(H, Math.ceil((Math.floor(k / P) + 1) * sy)); yy++)
            for (let xx = Math.floor((k % P) * sx); xx < Math.min(W, Math.ceil(((k % P) + 1) * sx)); xx++) rim[yy * W + xx] = 255;
          break;
        } else if (dd < w.r * 1.08) {
          tireK.add(k);
          break;
        }
      }
    }
    st.rim = rim;
    for (const k of tireK)
      for (let yy = Math.floor(Math.floor(k / P) * sy); yy < Math.min(H, Math.ceil((Math.floor(k / P) + 1) * sy)); yy++)
        for (let xx = Math.floor((k % P) * sx); xx < Math.min(W, Math.ceil(((k % P) + 1) * sx)); xx++) {
          const j = yy * W + xx;
          if (!rim[j]) st.mask[j] = 0; // pneu: protegido
        }
  }

  /** Cor das rodas (null = não pintar as rodas). */
  setWheelColor(hex: string | null) {
    this.wheelColor = hex;
    if (this.last) this.paint(this.last.uuids, this.last.tones, this.last.finish, this.last.tol);
  }

  hasWheels(): boolean {
    for (const st of this.tex.values()) if (st.rim) return true;
    return false;
  }

  /** Clique no carro: define como "cor da lataria" o pixel clicado. Retorna true se acertou. */
  pickBodyAt(clientX: number, clientY: number): boolean {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    if (!this.model) return false;
    const hit = this.raycaster.intersectObject(this.model, true).find((h) => h.uv);
    if (!hit?.uv) return false;
    const mat = (hit.object as THREE.Mesh).material as PBR | PBR[];
    const m = Array.isArray(mat) ? mat[hit.face?.materialIndex ?? 0] : mat;
    const st = this.texState(m);
    if (!st) return false;
    const w = st.orig.width,
      h = st.orig.height;
    const map = this.originals.get(m.uuid)!.map!;
    const px = Math.min(w - 1, Math.max(0, Math.floor(hit.uv.x * w)));
    const py = Math.min(h - 1, Math.max(0, Math.floor((map.flipY ? 1 - hit.uv.y : hit.uv.y) * h)));
    let sr = 0,
      sg = 0,
      sb = 0,
      n = 0;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const x = Math.min(w - 1, Math.max(0, px + dx)),
          y = Math.min(h - 1, Math.max(0, py + dy));
        const i = (y * w + x) * 4;
        sr += st.orig.data[i];
        sg += st.orig.data[i + 1];
        sb += st.orig.data[i + 2];
        n++;
      }
    st.body = [sr / n, sg / n, sb / n];
    st.q = undefined;
    if (this.last) this.paint(this.last.uuids, this.last.tones, this.last.finish, this.last.tol);
    return true;
  }

  /** Liga o pincel: desativa a órbita da câmera para arrastar sobre o carro. */
  setBrush(on: boolean) {
    this.controls.enabled = !on;
  }

  private maskState(): TexState | null {
    for (const m of this.materials.values()) {
      const st = this.texState(m);
      if (st) return st;
    }
    return null;
  }

  /** Mapeia cada ponto da textura para a posição 3D no carro (rasteriza os triângulos no espaço UV). */
  private buildPosMap(st: TexState, m: PBR, flipY: boolean) {
    const P = 512;
    const pos = new Float32Array(P * P * 3);
    const has = new Uint8Array(P * P);
    const A = new THREE.Vector3(),
      B = new THREE.Vector3(),
      C = new THREE.Vector3();
    this.model?.updateMatrixWorld(true);
    this.model?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const mm = mesh.material;
      if (!mesh.isMesh || !(mm === m || (Array.isArray(mm) && mm.includes(m)))) return;
      const pa = mesh.geometry.getAttribute("position");
      const ua = mesh.geometry.getAttribute("uv");
      if (!pa || !ua) return;
      const idx = mesh.geometry.index;
      const tris = idx ? idx.count / 3 : pa.count / 3;
      for (let t = 0; t < tris; t++) {
        const i0 = idx ? idx.getX(t * 3) : t * 3,
          i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1,
          i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
        const px = [i0, i1, i2].map((i) => ua.getX(i) * P);
        const py = [i0, i1, i2].map((i) => (flipY ? 1 - ua.getY(i) : ua.getY(i)) * P);
        const minX = Math.max(0, Math.floor(Math.min(...px)) - 1),
          maxX = Math.min(P - 1, Math.ceil(Math.max(...px)) + 1);
        const minY = Math.max(0, Math.floor(Math.min(...py)) - 1),
          maxY = Math.min(P - 1, Math.ceil(Math.max(...py)) + 1);
        const den = (py[1] - py[2]) * (px[0] - px[2]) + (px[2] - px[1]) * (py[0] - py[2]);
        if (Math.abs(den) < 1e-9) continue;
        A.fromBufferAttribute(pa, i0).applyMatrix4(mesh.matrixWorld);
        B.fromBufferAttribute(pa, i1).applyMatrix4(mesh.matrixWorld);
        C.fromBufferAttribute(pa, i2).applyMatrix4(mesh.matrixWorld);
        for (let y = minY; y <= maxY; y++)
          for (let x = minX; x <= maxX; x++) {
            const cx = x + 0.5,
              cy = y + 0.5;
            const w0 = ((py[1] - py[2]) * (cx - px[2]) + (px[2] - px[1]) * (cy - py[2])) / den;
            const w1 = ((py[2] - py[0]) * (cx - px[2]) + (px[0] - px[2]) * (cy - py[2])) / den;
            const w2 = 1 - w0 - w1;
            if (w0 < -0.05 || w1 < -0.05 || w2 < -0.05) continue; // pequena folga fecha frestas entre triângulos
            const k = y * P + x;
            has[k] = 1;
            pos[k * 3] = A.x * w0 + B.x * w1 + C.x * w2;
            pos[k * 3 + 1] = A.y * w0 + B.y * w1 + C.y * w2;
            pos[k * 3 + 2] = A.z * w0 + B.z * w1 + C.z * w2;
          }
      }
    });
    st.posMap = { P, pos, has };
  }

  /**
   * Pinta a máscara no ponto do carro sob o cursor. O raio vem da tela (px) e vale no espaço 3D, então
   * partes vizinhas na textura mas distantes no carro não são afetadas.
   * mode "protect" = não pintar aqui; "paint" = voltar a pintar.
   */
  brushAt(clientX: number, clientY: number, mode: "protect" | "paint", radiusPx: number): boolean {
    if (!this.model) return false;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.model, true).find((h) => h.uv);
    if (!hit?.uv) return false;
    const mat = (hit.object as THREE.Mesh).material as PBR | PBR[];
    const m = Array.isArray(mat) ? mat[hit.face?.materialIndex ?? 0] : mat;
    const st = this.texState(m);
    if (!st) return false;
    const flip = this.originals.get(m.uuid)!.map!.flipY;
    if (!st.posMap) this.buildPosMap(st, m, flip);
    const { P, pos, has } = st.posMap!;
    const dist = this.camera.position.distanceTo(hit.point);
    const wr = (radiusPx * 2 * dist * Math.tan((this.camera.fov * Math.PI) / 360)) / r.height;
    const wr2 = wr * wr;
    const val = mode === "protect" ? 0 : 255;
    const W = st.orig.width,
      H = st.orig.height;
    const sx = W / P,
      sy = H / P;
    const hp = hit.point;
    for (let y = 0; y < P; y++)
      for (let x = 0; x < P; x++) {
        const k = y * P + x;
        if (!has[k]) continue;
        const dx = pos[k * 3] - hp.x,
          dy = pos[k * 3 + 1] - hp.y,
          dz = pos[k * 3 + 2] - hp.z;
        if (dx * dx + dy * dy + dz * dz > wr2) continue;
        for (let yy = Math.floor(y * sy); yy < Math.min(H, Math.ceil((y + 1) * sy)); yy++)
          for (let xx = Math.floor(x * sx); xx < Math.min(W, Math.ceil((x + 1) * sx)); xx++) st.mask[yy * W + xx] = val;
      }
    if (this.last) this.paint(this.last.uuids, this.last.tones, this.last.finish, this.last.tol);
    return true;
  }

  clearMask() {
    const st = this.maskState();
    if (!st) return;
    st.mask.fill(255);
    st.partsDone = false; // "Limpar" volta ao estado automático: pneus protegidos de novo
    if (this.last) this.paint(this.last.uuids, this.last.tones, this.last.finish, this.last.tol);
  }

  /** Máscara como PNG (data URL) ou null se não houver textura / nada protegido. */
  exportMask(): string | null {
    const st = this.maskState();
    if (!st || !st.mask.includes(0)) return null;
    const c = document.createElement("canvas");
    c.width = st.orig.width;
    c.height = st.orig.height;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(c.width, c.height);
    for (let i = 0; i < st.mask.length; i++) {
      const v = st.mask[i];
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  }

  async importMask(dataUrl: string) {
    const st = this.maskState();
    if (!st) return;
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Máscara inválida"));
      img.src = dataUrl;
    });
    const c = document.createElement("canvas");
    c.width = st.orig.width;
    c.height = st.orig.height;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < st.mask.length; i++) st.mask[i] = d[i * 4] < 128 ? 0 : 255;
    if (this.last) this.paint(this.last.uuids, this.last.tones, this.last.finish, this.last.tol);
  }

  restore() {
    this.last = null;
    for (const [id, o] of this.originals) {
      const m = this.materials.get(id)!;
      m.color.copy(o.color);
      m.map = o.map;
      const p = m as THREE.MeshPhysicalMaterial;
      Object.assign(p, FINISH_BASE);
      p.clearcoatNormalMap = null;
      if (o.metalness !== undefined) p.metalness = o.metalness;
      if (o.roughness !== undefined) p.roughness = o.roughness;
      p.metalnessMap = o.metalnessMap ?? null;
      p.roughnessMap = o.roughnessMap ?? null;
      m.needsUpdate = true;
    }
  }

  /** Mede a cabine do scan com raios (piso, teto, laterais, para-brisa, traseira). */
  private measureCabin(O: THREE.Vector3, f: THREE.Vector3, right: THREE.Vector3, H: number, L: number, W: number) {
    this.model!.updateMatrixWorld(true);
    const up = new THREE.Vector3(0, 1, 0);
    const sides = new Map<THREE.Material, THREE.Side>();
    for (const m of this.materials.values()) (sides.set(m, m.side), (m.side = THREE.DoubleSide));
    const ray = new THREE.Raycaster();
    const pt = (a: number, b: number, hf: number) => O.clone().addScaledVector(f, a).addScaledVector(right, b).addScaledVector(up, hf * H);
    const cast = (o: THREE.Vector3, d: THREE.Vector3) => {
      ray.set(o, d);
      const h = ray.intersectObject(this.model!, true);
      return h.length ? h[0].distance : null;
    };
    const nums = (v: (number | null)[]) => v.filter((x): x is number => x !== null);
    const median = (v: number[], d: number) => (v.length ? [...v].sort((a, b) => a - b)[v.length >> 1] : d);
    const max = (v: number[], d: number) => (v.length ? Math.max(...v) : d);
    const min = (v: number[], d: number) => (v.length ? Math.min(...v) : d);
    const bs = [-0.2 * W, 0, 0.2 * W];
    const as = [-0.1 * L, 0, 0.1 * L];
    const neg = (v: THREE.Vector3) => v.clone().negate();

    // para-brisa: mede na altura do vidro (0,78H e 0,9H) e extrapola a inclinação até a base (0,62H);
    // medir na altura do painel faria o raio passar por baixo do vidro e achar a grade do carro.
    const d78 = median(nums(bs.map((b) => cast(pt(0, b, 0.78), f))), 0.2 * L);
    const d90 = median(nums(bs.map((b) => cast(pt(0, b, 0.9), f))), d78);
    const slope = Math.max(0, (d78 - d90) / (0.12 * H));
    const fwdDash = d78 + Math.min(0.12, slope * 0.06 * H) - 0.04;
    const fwdMax = fwdDash + 0.02;
    const back = median(nums([0.4, 0.55, 0.7].flatMap((h) => bs.map((b) => cast(pt(0, b, h), neg(f))))), 0.25 * L);
    const wallR = median(nums(as.map((a) => cast(pt(a, 0, 0.5), right))), 0.4 * W);
    const wallL = median(nums(as.map((a) => cast(pt(a, 0, 0.5), neg(right)))), 0.4 * W);
    const roofY = O.y + 0.5 * H + max(nums(as.flatMap((a) => bs.map((b) => cast(pt(a, b, 0.5), up)))), 0.4 * H);
    const floorY = O.y + 0.5 * H - min(nums(as.flatMap((a) => bs.map((b) => cast(pt(a, b, 0.5), neg(up))))), 0.4 * H);
    for (const [m, sd] of sides) ((m as THREE.MeshStandardMaterial).side = sd);
    const cl = (v: number, hi: number) => Math.max(0.1, Math.min(v, hi));
    return {
      fwdDash: cl(fwdDash, 0.6 * L),
      fwdMax: cl(fwdMax, 0.6 * L),
      back: cl(back, 0.6 * L),
      wallR: cl(wallR, 0.6 * W),
      wallL: cl(wallL, 0.6 * W),
      roofY,
      floorY: Math.min(floorY, O.y + 0.3 * H),
    };
  }

  /** Interior ajustado à cabine medida do scan. Unidades locais em metros (grupo escalado por comprimento/4,4). */
  private buildInterior() {
    if (this.interior) this.scene.remove(this.interior);
    this.interior = null;
    this.intParts = {};
    if (!this.model) return;
    this.builtFlip = this.intCfg.flip;
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const alongX = size.x >= size.z;
    const len = alongX ? size.x : size.z;
    const wid = alongX ? size.z : size.x;
    const up = new THREE.Vector3(0, 1, 0);
    const f = (alongX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1)).multiplyScalar(this.intCfg.flip ? -1 : 1);
    const right = f.clone().cross(up);
    const O = new THREE.Vector3(c.x, box.min.y, c.z);
    const m = this.measureCabin(O, f, right, size.y, len, wid);
    const s = len / 4.4;

    // medidas em metros locais (origem: centro xz do carro, piso medido)
    const k = 1 / s;
    const fwdD = m.fwdDash * k;
    const backD = m.back * k;
    const zc = ((m.wallR - m.wallL) / 2) * k; // desvio lateral do centro da cabine
    const cw = (m.wallR + m.wallL) * k; // largura interna
    const ch = (m.roofY - m.floorY) * k; // altura interna
    const floor = (m.floorY - O.y) * k;

    const tone = (hex: string, d: number) => {
      const col = new THREE.Color(hex);
      const hsl = { h: 0, s: 0, l: 0 };
      col.getHSL(hsl);
      return col.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + d)));
    };
    const mat = (key: InteriorKey, rough: number, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
      (this.intMats[key] = new THREE.MeshPhysicalMaterial({ color: this.intCfg.items[key].color, roughness: rough, metalness: 0.03, ...extra }));
    const seatM = mat("seats", 0.92, { sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x555566) });
    const dashM = mat("dash", 0.75);
    const consM = mat("console", 0.6);
    const wheelM = mat("wheel", 0.5, { clearcoat: 0.2 });
    const doorM = mat("doors", 0.7);
    const carpetM = mat("carpet", 1);
    const piano = new THREE.MeshPhysicalMaterial({ color: 0x07070a, roughness: 0.15, metalness: 0.2, clearcoat: 1 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.25, metalness: 1 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x0b1d33, emissive: 0x2a7fff, emissiveIntensity: 0.9, roughness: 0.3 });
    const glowRed = new THREE.MeshStandardMaterial({ color: 0x220808, emissive: 0xff4a2a, emissiveIntensity: 0.8 });
    const accent = (key: InteriorKey) => () => tone(this.intCfg.items[key].color, 0.1);
    void accent;

    const rb = (w: number, h: number, d: number, mt: THREE.Material, r = 0.03) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mt);
    const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => (o.position.set(x, y, z), o);
    const cyl = (r: number, h: number, mt: THREE.Material, rz = 0, rx = 0) => {
      const g = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), mt);
      g.rotation.z = rz;
      g.rotation.x = rx;
      return g;
    };
    // x = frente, y = cima, z = direita
    const driverZ = zc - Math.min(0.4, cw * 0.22);
    const passZ = zc + Math.min(0.4, cw * 0.22);
    const dashDepth = Math.min(0.42, fwdD * 0.16);
    const dashX = fwdD - dashDepth / 2 - 0.04;
    const dashTop = floor + Math.min(0.92, ch * 0.56);
    const wheelX = dashX - dashDepth / 2 - 0.2;
    const seatX = wheelX - 0.62;
    const rearX = Math.max(-backD + 0.35, seatX - 0.9);
    const seatY = floor + 0.25;
    const seatW = Math.min(0.52, cw * 0.28);

    // ---- bancos: assento com laterais, encosto com recorte, apoio de cabeça e costuras ----
    const seats = new THREE.Group();
    const accentM = new THREE.MeshPhysicalMaterial({ color: tone(this.intCfg.items.seats.color, 0.12), roughness: 0.95 });
    const seat = (x: number, z: number, w: number, heads: number[]) => {
      seats.add(at(rb(0.52, 0.11, w, seatM, 0.05), x, seatY, z)); // almofada
      for (const sgn of [-1, 1]) seats.add(at(rb(0.5, 0.05, 0.07, seatM, 0.025), x, seatY + 0.07, z + sgn * (w / 2 - 0.04))); // laterais
      seats.add(at(rb(0.4, 0.04, w - 0.2, accentM, 0.015), x + 0.02, seatY + 0.065, z)); // inserto central
      const back = at(rb(0.11, 0.6, w, seatM, 0.05), x - 0.25, seatY + 0.36, z);
      back.rotation.z = 0.22;
      seats.add(back);
      const ins = at(rb(0.03, 0.44, w - 0.2, accentM, 0.012), x - 0.2, seatY + 0.36, z);
      ins.rotation.z = 0.22;
      seats.add(ins);
      for (const hz of heads) {
        const hd = at(rb(0.09, 0.16, 0.2, seatM, 0.04), x - 0.34, seatY + 0.78, hz);
        hd.rotation.z = 0.22;
        seats.add(hd, at(cyl(0.008, 0.12, chrome), x - 0.33, seatY + 0.68, hz - 0.05), at(cyl(0.008, 0.12, chrome), x - 0.33, seatY + 0.68, hz + 0.05));
      }
    };
    seat(seatX, driverZ, seatW, [driverZ]);
    seat(seatX, passZ, seatW, [passZ]);
    const rw = Math.max(0.6, cw - 0.3);
    seat(rearX, zc, rw, [zc - rw * 0.3, zc, zc + rw * 0.3]);

    // ---- painel: topo macio, faixa inferior, saídas de ar, quadro de instrumentos e multimídia ----
    const dash = new THREE.Group();
    const dw = Math.max(0.8, cw - 0.1);
    dash.add(at(rb(dashDepth, 0.14, dw, dashM, 0.05), dashX, dashTop - 0.07, zc)); // topo
    dash.add(at(rb(dashDepth * 0.8, 0.22, dw * 0.96, dashM, 0.05), dashX - 0.04, dashTop - 0.24, zc)); // parte inferior
    dash.add(at(rb(dashDepth * 0.7, 0.04, dw * 0.9, piano, 0.015), dashX - 0.08, dashTop - 0.16, zc)); // friso
    const hood = at(rb(0.24, 0.12, 0.5, dashM, 0.05), dashX - dashDepth * 0.4, dashTop + 0.01, driverZ); // capota do quadro
    dash.add(hood);
    dash.add(at(rb(0.02, 0.1, 0.38, glow, 0.012), dashX - dashDepth * 0.35 - 0.13, dashTop, driverZ)); // display do quadro
    for (const dz of [-0.17, 0.17]) dash.add(at(cyl(0.05, 0.012, glowRed, Math.PI / 2), dashX - dashDepth * 0.35 - 0.135, dashTop, driverZ + dz));
    dash.add(at(rb(0.03, 0.17, 0.3, glow, 0.015), dashX - dashDepth / 2 - 0.02, dashTop - 0.13, zc + 0.12)); // multimídia
    for (const vz of [-0.4, 0.28, 0.5]) dash.add(at(rb(0.02, 0.05, 0.12, piano, 0.01), dashX - dashDepth / 2 - 0.02, dashTop - 0.08, zc + vz)); // saídas de ar
    dash.add(at(rb(0.03, 0.04, 0.2, chrome, 0.01), dashX - dashDepth / 2 - 0.02, dashTop - 0.28, zc + 0.12)); // comandos

    // ---- console central: túnel, apoio de braço, câmbio e porta-copos ----
    const cons = new THREE.Group();
    const cx = (seatX + dashX) / 2;
    const cLen = Math.max(0.5, dashX - dashDepth / 2 - seatX + 0.3);
    cons.add(at(rb(cLen, 0.22, 0.22, consM, 0.05), cx, floor + 0.3, zc));
    cons.add(at(rb(0.3, 0.07, 0.2, consM, 0.03), seatX - 0.02, floor + 0.46, zc)); // apoio de braço
    cons.add(at(cyl(0.012, 0.16, chrome), cx + 0.1, floor + 0.5, zc), at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), piano), cx + 0.1, floor + 0.6, zc));
    for (const dz of [-0.04, 0.04]) cons.add(at(cyl(0.032, 0.02, piano), cx + 0.28, floor + 0.415, zc + dz));

    // ---- volante: aro, miolo, raios e coluna ----
    const wheel = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 14, 48), wheelM);
    ring.rotation.y = Math.PI / 2;
    const hub = cyl(0.055, 0.045, wheelM, Math.PI / 2);
    const logo = cyl(0.025, 0.012, chrome, Math.PI / 2);
    logo.position.x = -0.026;
    wheel.add(ring, hub, logo);
    for (const [ang, ln] of [
      [Math.PI / 2 + 1.5, 0.15],
      [Math.PI / 2 - 1.5, 0.15],
      [Math.PI, 0.12],
    ] as const) {
      const sp = rb(0.02, 0.025, ln, wheelM, 0.008);
      sp.position.set(0, Math.sin(ang) * -ln * 0.5 * (ang === Math.PI ? -1 : 1) * 0.6, Math.cos(ang) * ln * 0.5 * 1.0);
      sp.rotation.x = ang === Math.PI ? Math.PI / 2 : 0;
      if (ang !== Math.PI) sp.rotation.x = ang > Math.PI / 2 ? 0.1 : -0.1;
      wheel.add(sp);
    }
    wheel.position.set(wheelX, dashTop - 0.08, driverZ);
    wheel.rotation.z = 0.4;
    const col = cyl(0.04, 0.3, piano, Math.PI / 2 - 0.4);
    col.position.set(wheelX + 0.14, dashTop - 0.2, driverZ);

    // ---- portas: painéis, apoio de braço e maçaneta ao longo das laterais ----
    const doors = new THREE.Group();
    for (const side of [-1, 1]) {
      const wz = zc + side * (cw / 2 - 0.03);
      doors.add(at(rb(Math.min(1.9, rearX - seatX + 2.1), 0.5, 0.05, doorM, 0.02), (seatX + rearX) / 2 + 0.05, floor + 0.55, wz));
      doors.add(at(rb(0.7, 0.06, 0.08, piano, 0.025), seatX + 0.05, floor + 0.62, wz - side * 0.03));
      doors.add(at(rb(0.16, 0.025, 0.04, chrome, 0.01), seatX - 0.1, floor + 0.56, wz - side * 0.045));
    }

    // ---- tapete ----
    const carpet = new THREE.Group();
    const cpLen = fwdD - dashDepth - 0.15 + backD - 0.3;
    carpet.add(at(rb(cpLen, 0.02, cw - 0.3, carpetM, 0.008), (fwdD - dashDepth - 0.15 - backD + 0.3) / 2, floor + 0.015, zc));

    const g = new THREE.Group();
    g.add(seats, dash, cons, wheel, col, doors, carpet);
    this.intParts = { seats, dash, console: cons, wheel, doors, carpet };
    // a coluna acompanha o volante
    this.intParts.wheel = new THREE.Group().add(wheel, col) as THREE.Group;
    g.remove(wheel, col);
    g.add(this.intParts.wheel);
    this.interior = g;
    g.position.copy(O);
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f, up, right));
    g.scale.setScalar(s);
    this.scene.add(g);

    // olho do motorista (local) e recorte de segurança no limite medido da cabine
    this.eyeLocal.set(seatX + 0.02, Math.min(seatY + 0.62, (m.roofY - O.y) * k - 0.18), driverZ); // olho abaixo do teto
    const P = (a: number, b: number, y: number) => O.clone().addScaledVector(f, a).addScaledVector(right, b).setY(y);
    const planes: [THREE.Vector3, THREE.Vector3][] = [
      [f.clone().negate(), P(m.fwdMax - 0.02, 0, O.y)],
      [f.clone(), P(-m.back + 0.02, 0, O.y)],
      [right.clone().negate(), P(0, m.wallR - 0.02, O.y)],
      [right.clone(), P(0, -m.wallL + 0.02, O.y)],
      [up.clone().negate(), new THREE.Vector3(O.x, m.roofY - 0.02, O.z)],
      [up.clone(), new THREE.Vector3(O.x, m.floorY - 0.02, O.z)],
    ];
    this.clip = planes.map(([n, p]) => new THREE.Plane().setFromNormalAndCoplanarPoint(n, p));
    g.traverse((o) => {
      const mm = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (mm) mm.clippingPlanes = this.clip;
    });
    this.applyInterior();
  }

  private applyInterior() {
    if (!this.interior) return;
    (Object.keys(this.intParts) as InteriorKey[]).forEach((key) => {
      this.intParts[key]!.visible = this.intCfg.items[key].show;
      this.intMats[key].color.set(this.intCfg.items[key].color);
    });
  }

  setInterior(cfg: InteriorCfg) {
    const flipChanged = cfg.flip !== this.builtFlip;
    this.intCfg = cfg;
    if (flipChanged && this.model) this.buildInterior();
    else this.applyInterior();
    if (this.saved && flipChanged) {
      this.exitInterior();
      this.enterInterior();
    }
  }

  private xrayOrig = new Map<string, { t: boolean; o: number; d: boolean }>();
  get xray() {
    return this.xrayOrig.size > 0;
  }

  /** Raio-X: lataria translúcida para ver o interior por fora. */
  setXray(on: boolean) {
    if (on && !this.xrayOrig.size) {
      for (const [id, m] of this.materials) {
        this.xrayOrig.set(id, { t: m.transparent, o: m.opacity, d: m.depthWrite });
        m.transparent = true;
        m.opacity = 0.28;
        m.depthWrite = false;
        m.needsUpdate = true;
      }
    } else if (!on) {
      for (const [id, o] of this.xrayOrig) {
        const m = this.materials.get(id);
        if (m) Object.assign(m, { transparent: o.t, opacity: o.o, depthWrite: o.d, needsUpdate: true });
      }
      this.xrayOrig.clear();
    }
  }

  get inside() {
    return !!this.saved;
  }

  /** Câmera no banco do motorista; arrastar gira a cabeça. Faces internas passam a ser desenhadas. */
  enterInterior() {
    if (!this.model || this.saved) return;
    let eye: THREE.Vector3;
    let dir: THREE.Vector3;
    if (this.interior) {
      this.interior.updateMatrixWorld(true);
      eye = this.interior.localToWorld(this.eyeLocal.clone());
      dir = new THREE.Vector3(1, 0, 0).applyQuaternion(this.interior.quaternion).setY(0).normalize();
    } else {
      const box = new THREE.Box3().setFromObject(this.model);
      eye = box.getCenter(new THREE.Vector3()).setY(box.min.y + box.getSize(new THREE.Vector3()).y * 0.62);
      dir = new THREE.Vector3(1, 0, 0);
    }
    this.saved = {
      pos: this.camera.position.clone(),
      target: this.controls.target.clone(),
      near: this.camera.near,
      fov: this.camera.fov,
      sides: new Map([...this.materials].map(([id, m]) => [id, m.side])),
    };
    for (const m of this.materials.values()) {
      m.side = THREE.DoubleSide;
      m.needsUpdate = true;
    }
    const r = 0.05;
    this.camera.near = 0.02;
    this.camera.fov = 75;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = r;
    this.controls.maxDistance = r;
    this.controls.enablePan = false;
    this.controls.maxPolarAngle = Math.PI - 0.05;
    this.controls.target.copy(eye);
    this.camera.position.copy(eye).addScaledVector(dir, -r); // olhando para a frente
    this.controls.update();
  }

  exitInterior() {
    const s = this.saved;
    if (!s) return;
    this.saved = null;
    for (const [id, side] of s.sides) {
      const m = this.materials.get(id);
      if (m) ((m.side = side), (m.needsUpdate = true));
    }
    this.camera.near = s.near;
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = 0;
    this.controls.maxDistance = Infinity;
    this.controls.enablePan = true;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.target.copy(s.target);
    this.camera.position.copy(s.pos);
    this.controls.update();
  }

  setTurntable(on: boolean) {
    this.controls.autoRotate = on;
    this.controls.autoRotateSpeed = 2.0;
  }

  isTurntable(): boolean {
    return this.controls.autoRotate;
  }

  resetCamera() {
    this.setCameraView("perspective");
  }

  setCameraView(view: "perspective" | "front" | "side" | "rear" | "top") {
    if (this.saved) this.exitInterior();
    const target = new THREE.Vector3(0, 0.7, 0);
    this.controls.target.copy(target);
    this.controls.minDistance = 0;
    this.controls.maxDistance = Infinity;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;

    switch (view) {
      case "perspective":
        this.camera.position.set(4.8, 2.0, 5.4);
        break;
      case "front":
        this.camera.position.set(0, 1.2, 5.8);
        break;
      case "side":
        this.camera.position.set(5.8, 1.2, 0);
        break;
      case "rear":
        this.camera.position.set(0, 1.2, -5.8);
        break;
      case "top":
        this.controls.maxPolarAngle = Math.PI / 2;
        this.camera.position.set(0.01, 7.5, 0.01);
        break;
    }
    this.controls.update();
  }

  screenshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
