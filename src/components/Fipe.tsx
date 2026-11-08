import { useEffect, useState } from "react";
import { IconFileText } from "./Icons";

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

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-group">
          <div className="title-with-icon">
            <IconFileText size={16} />
            <span className="card-title">Tabela FIPE Oficial</span>
          </div>
          <span className="card-subtitle">Consulta de precificação e dados de mercado</span>
        </div>
      </div>

      <div className="form-cascade-grid">
        <div className="form-group">
          <label className="field-label">Marca</label>
          <select
            className="custom-select"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            disabled={!brands.length}
          >
            <option value="">Selecione a montadora…</option>
            {brands.map((i) => (
              <option key={i.codigo} value={i.codigo}>
                {i.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="field-label">Modelo</label>
          <select
            className="custom-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={!models.length}
          >
            <option value="">Selecione o modelo…</option>
            {models.map((i) => (
              <option key={i.codigo} value={i.codigo}>
                {i.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="field-label">Ano / Versão</label>
          <select
            className="custom-select"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            disabled={!years.length}
          >
            <option value="">Selecione o ano…</option>
            {years.map((i) => (
              <option key={i.codigo} value={i.codigo}>
                {i.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="form-error-box">{error}</div>}

      {(error || !brands.length) && (
        <div className="manual-form-box">
          <span className="field-label">Entrada manual de veículo</span>
          <div className="form-row">
            <input
              placeholder="Marca (ex.: Audi)"
              value={manual.marca}
              onChange={(e) => setManual({ ...manual, marca: e.target.value })}
            />
            <input
              placeholder="Modelo (ex.: RS6)"
              value={manual.modelo}
              onChange={(e) => setManual({ ...manual, modelo: e.target.value })}
            />
          </div>
          <div className="form-row">
            <input
              placeholder="Ano (ex.: 2024)"
              value={manual.ano}
              onChange={(e) => setManual({ ...manual, ano: e.target.value })}
            />
            <input
              placeholder="Placa (opcional)"
              value={manual.placa}
              onChange={(e) => setManual({ ...manual, placa: e.target.value.toUpperCase() })}
            />
          </div>
        </div>
      )}

      {result && (
        <div className="fipe-valuation-card">
          <div className="fipe-top">
            <div className="fipe-vehicle-info">
              <span className="fipe-car-name">
                {result.Marca} {result.Modelo}
              </span>
              <span className="fipe-car-sub">
                Ano {result.AnoModelo} • {result.Combustivel}
              </span>
            </div>
            <div className="fipe-price-badge">
              <span className="fipe-price-label">Preço Médio FIPE</span>
              <span className="fipe-price-value">{result.Valor}</span>
            </div>
          </div>

          <div className="fipe-meta-grid">
            <div className="fipe-meta-item">
              <span className="meta-k">Código FIPE:</span>
              <span className="meta-v">{result.CodigoFipe}</span>
            </div>
            <div className="fipe-meta-item">
              <span className="meta-k">Mês de Referência:</span>
              <span className="meta-v">{result.MesReferencia}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
