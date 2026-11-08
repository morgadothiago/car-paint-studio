import React from "react";
import Fipe from "./Fipe";

interface VehicleTabProps {
  onPickColor: (hex: string) => void;
  onOpenSettings: () => void;
}

/** Dados do veículo pela tabela FIPE (gratuita, sem chave). Consulta por placa foi removida: exige API paga. */
export default function VehicleTab(_props: VehicleTabProps) {
  return (
    <div className="tab-pane">
      <Fipe />
    </div>
  );
}
