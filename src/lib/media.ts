const MAX_SIDE = 1024;

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error(`Não foi possível abrir a imagem "${file.name}". HEIC não é suportado: converta para JPG/PNG.`));
    img.src = url;
  });
}

function toDataUrl(src: CanvasImageSource, w: number, h: number, maxSide = MAX_SIDE): string {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.88);
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error("Tempo esgotado ao ler o vídeo")), 8000);
    video.onseeked = () => (clearTimeout(timer), res());
    video.currentTime = t;
  });
}

/** Extrai `count` frames igualmente espaçados de um vídeo. */
async function videoFrames(file: File, count: number, maxSide = MAX_SIDE): Promise<string[]> {
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.src = URL.createObjectURL(file);
  try {
    await new Promise<void>((res, rej) => {
      video.onloadedmetadata = () => res();
      video.onerror = () =>
        rej(new Error(`Não foi possível abrir o vídeo "${file.name}". Formato/codec não suportado (ex.: HEVC). Converta para MP4 H.264.`));
    });
    // webm gravado no navegador reporta duration = Infinity: força o cálculo real.
    if (!isFinite(video.duration)) {
      await seek(video, 1e101);
      await seek(video, 0);
    }
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      await seek(video, (video.duration * (i + 0.5)) / count);
      out.push(toDataUrl(video, video.videoWidth, video.videoHeight, maxSide));
    }
    return out;
  } finally {
    URL.revokeObjectURL(video.src);
  }
}

/** Converte fotos e vídeos em uma lista de imagens JPEG (data URL). */
export async function collectImages(files: File[], framesPerVideo = 12, maxSide = MAX_SIDE): Promise<string[]> {
  const out: string[] = [];
  for (const f of files) {
    if (f.type.startsWith("video/")) out.push(...(await videoFrames(f, framesPerVideo, maxSide)));
    else if (f.type.startsWith("image/")) {
      const img = await fileToImage(f);
      out.push(toDataUrl(img, img.naturalWidth, img.naturalHeight, maxSide));
    }
  }
  return out;
}

/** Escolhe n itens espalhados uniformemente (cobre ângulos diferentes). */
export function spread<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  return Array.from({ length: n }, (_, i) => items[Math.floor(((i + 0.5) * items.length) / n)]);
}
