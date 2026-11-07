import type { LibEntry } from "../lib/types";

interface Props {
  items: LibEntry[];
  currentId: string | null;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export default function Library({ items, currentId, onOpen, onRename, onDelete }: Props) {
  return (
    <section>
      <h2>Biblioteca de modelos</h2>
      {!items.length && <p className="muted">Nenhum modelo salvo. Os modelos gerados ficam aqui e não gastam créditos de novo.</p>}
      {items.map((it) => (
        <div key={it.id} className={`lib ${it.id === currentId ? "cur" : ""}`}>
          {it.thumb ? <img src={it.thumb} /> : <div className="ph" />}
          <div className="meta">
            <input
              defaultValue={it.name}
              key={it.name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== it.name && onRename(it.id, e.target.value.trim())}
            />
            <div className="row">
              <button onClick={() => onOpen(it.id)}>Abrir</button>
              <button
                onClick={() => {
                  if (confirm(`Excluir "${it.name}"? O arquivo 3D será apagado e gerar de novo gasta créditos.`)) onDelete(it.id);
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
