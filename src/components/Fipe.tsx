import { useEffect, useState } from "react";

interface Item {
  codigo: string | number;
  nome: string;
}
interface Result {
  Valor: string;
  Marca: string;
  Modelo: string;
  AnoModelo: number;
  Combustivel: string;
  CodigoFipe: string;
  MesReferencia: string;
}

export default function Fipe() {
  const [brands, setBrands] = useState<Item[]>([]);
  const [models, setModels] = useState<Item[]>([]);
  const [years, setYears] = useState<Item[]>([]);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [manual, setManual] = useState({ marca: "", modelo: "", ano: "", placa: "" });

  const run = async <T,>(route: string, set: (v: T) => void) => {
    setError("");
    try {
      set(await window.api.fipe(route));
    } catch (e) {
      setError("FIPE indisponível no momento. Use a entrada manual abaixo.");
    }
  };

  useEffect(() => {
    run<Item[]>("carros/marcas", setBrands);
  }, []);

  useEffect(() => {
    setModel("");
    setYear("");
    setResult(null);
    if (brand) run<{ modelos: Item[] }>(`carros/marcas/${brand}/modelos`, (d) => setModels(d.modelos));
  }, [brand]);

  useEffect(() => {
    setYear("");
    setResult(null);
    if (model) run<Item[]>(`carros/marcas/${brand}/modelos/${model}/anos`, setYears);
  }, [model]);

  useEffect(() => {
    setResult(null);
    if (year) run<Result>(`carros/marcas/${brand}/modelos/${model}/anos/${year}`, setResult);
  }, [year]);

  const sel = (v: string, set: (s: string) => void, items: Item[], ph: string) => (
    <select value={v} onChange={(e) => set(e.target.value)} disabled={!items.length}>
      <option value="">{ph}</option>
      {items.map((i) => (
        <option key={i.codigo} value={i.codigo}>
          {i.nome}
        </option>
      ))}
    </select>
  );

  return (
    <section>
      <h2>Dados do veículo (FIPE)</h2>
      {sel(brand, setBrand, brands, "Marca")}
      {sel(model, setModel, models, "Modelo")}
      {sel(year, setYear, years, "Ano")}
      {error && <p className="err">{error}</p>}
      {(error || !brands.length) && (
        <div className="manual">
          <p className="muted">Entrada manual</p>
          <input placeholder="Marca" value={manual.marca} onChange={(e) => setManual({ ...manual, marca: e.target.value })} />
          <input placeholder="Modelo" value={manual.modelo} onChange={(e) => setManual({ ...manual, modelo: e.target.value })} />
          <input placeholder="Ano" value={manual.ano} onChange={(e) => setManual({ ...manual, ano: e.target.value })} />
          <input placeholder="Placa (opcional)" value={manual.placa} onChange={(e) => setManual({ ...manual, placa: e.target.value.toUpperCase() })} />
        </div>
      )}
      {result && (
        <dl className="info">
          <dt>Veículo</dt>
          <dd>
            {result.Marca} {result.Modelo}
          </dd>
          <dt>Ano</dt>
          <dd>{result.AnoModelo}</dd>
          <dt>Combustível</dt>
          <dd>{result.Combustivel}</dd>
          <dt>Código FIPE</dt>
          <dd>{result.CodigoFipe}</dd>
          <dt>Valor</dt>
          <dd>{result.Valor}</dd>
          <dt>Referência</dt>
          <dd>{result.MesReferencia}</dd>
        </dl>
      )}
    </section>
  );
}
