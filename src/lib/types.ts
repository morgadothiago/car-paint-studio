export interface Api {
  getSettings(): Promise<{ hasMeshyKey: boolean; hasPlateToken: boolean; hasImaginKey: boolean }>;
  setImaginKey(key: string): Promise<void>;
  colorsSync(q: { make: string; modelFamily?: string; modelYear?: number }): Promise<{ added: number; updated: number; total: number }>;
  colorsImport(rows: Record<string, string>[]): Promise<{ added: number; updated: number; rejected: string[] }>;
  colorsList(q: { make?: string; text?: string; year?: number }): Promise<ColorEntry[]>;
  colorsMakes(): Promise<string[]>;
  setPlateToken(token: string): Promise<void>;
  lookupPlate(plate: string): Promise<{ placa: string; marca?: string; modelo?: string; ano?: string; cor?: string }>;
  setMeshyKey(key: string): Promise<void>;
  fipe(route: string): Promise<any>;
  generateModel(images: string[], hash: string): Promise<{ entry: LibEntry; glb: Uint8Array; cached: boolean }>;
  photoRun(opts: { images: string[]; detail: "reduced" | "medium" | "full"; mask: boolean }): Promise<Uint8Array>;
  photoCancel(): Promise<void>;
  libraryAddGlb(glb: Uint8Array, hash: string, name: string): Promise<LibEntry>;
  libraryList(): Promise<LibEntry[]>;
  libraryLoad(id: string): Promise<{ entry: LibEntry; glb: Uint8Array; mask?: string }>;
  libraryUpdate(id: string, patch: Partial<Pick<LibEntry, "name" | "thumb" | "paint" | "interior">> & { mask?: string | null }): Promise<void>;
  libraryDelete(id: string): Promise<void>;
  onProgress(cb: (p: { progress: number; status: string }) => void): () => void;
}

declare global {
  interface Window {
    api: Api;
  }
}

import type { InteriorCfg } from "./CarViewer";

export interface LibEntry {
  id: string;
  name: string;
  hash: string;
  createdAt: number;
  thumb?: string;
  paint?: { hex: string; highlight?: string; shadow?: string; finish: Finish; tol: number };
  interior?: InteriorCfg;
}

export interface ColorEntry {
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

export type Finish = "gloss" | "matte" | "metallic" | "pearl";

export interface MaterialInfo {
  uuid: string;
  name: string;
}
