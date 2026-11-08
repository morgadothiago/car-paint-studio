import { IconClose } from "./Icons";

interface Props {
  loading: boolean;
  shot: string | null; // captura 3D enviada
  result: string | null; // foto gerada
  error: string;
  onClose: () => void;
}

/** Mostra a foto realista gerada (ou o progresso) e deixa salvar o PNG. */
export default function PhotorealModal({ loading, shot, result, error, onClose }: Props) {
  const save = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = `foto-realista-${Date.now()}.png`;
    a.click();
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="photoreal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="photoreal-head">
          <strong>Foto realista (Nano Banana)</strong>
          <button className="hud-toast-close" onClick={onClose} title="Fechar">
            <IconClose size={14} />
          </button>
        </div>
        <div className="photoreal-body">
          <figure>
            {shot && <img src={shot} alt="Captura 3D" />}
            <figcaption>Captura 3D</figcaption>
          </figure>
          <figure>
            {loading && (
              <div className="photoreal-wait">
                <div className="hud-spinner" />
                <span>Gerando… pode levar de 10 a 40 s</span>
              </div>
            )}
            {!loading && error && <div className="photoreal-wait photoreal-error">{error}</div>}
            {!loading && result && <img src={result} alt="Foto realista" />}
            <figcaption>Foto realista</figcaption>
          </figure>
        </div>
        <div className="photoreal-foot">
          <span className="form-hint">A IA pode alterar detalhes. Confira cor, rodas e faróis antes de usar.</span>
          <button className="btn-secondary" disabled={!result} onClick={save}>
            Salvar PNG
          </button>
        </div>
      </div>
    </div>
  );
}
