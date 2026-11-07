import { USDZLoader } from "three/examples/jsm/loaders/USDZLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import * as THREE from "three";

/** Converte o USDZ do Object Capture (geometria em texto) em GLB, o formato que o app usa. */
export async function usdzToGlb(bytes: Uint8Array): Promise<Uint8Array> {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const obj = await new USDZLoader().parse(buf);

  // espera as texturas decodificarem antes de exportar
  const maps: THREE.Texture[] = [];
  obj.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m) for (const t of [m.map, m.normalMap, m.aoMap, m.roughnessMap]) if (t) maps.push(t);
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    const ready = (t: THREE.Texture) => {
      const im = t.image as unknown as { complete?: boolean; naturalWidth?: number; width?: number } | undefined;
      if (!im) return false; // a imagem ainda nem começou a carregar
      if (typeof im.complete === "boolean") return im.complete && (im.naturalWidth ?? 0) > 0;
      return (im.width ?? 0) > 0;
    };
    if (maps.every(ready)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!maps.every((t) => !!t.image)) throw new Error("Texturas do modelo não carregaram");
  obj.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m?.map) m.map.colorSpace = THREE.SRGBColorSpace;
    if (m) m.side = THREE.FrontSide;
  });

  const glb = await new Promise<ArrayBuffer>((res, rej) =>
    new GLTFExporter().parse(obj, (r) => res(r as ArrayBuffer), rej, { binary: true, maxTextureSize: 4096 }),
  );
  return new Uint8Array(glb);
}
