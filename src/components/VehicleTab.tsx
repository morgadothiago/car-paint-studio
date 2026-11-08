import React from "react";
import Plate from "./Plate";
import Fipe from "./Fipe";

interface VehicleTabProps {
  onPickColor: (hex: string) => void;
  onOpenSettings: () => void;
}

export default function VehicleTab({ onPickColor, onOpenSettings }: VehicleTabProps) {
  return (
    <div className="tab-pane">
      <Plate onColor={onPickColor} onOpenSettings={onOpenSettings} />
      <Fipe />
    </div>
  );
}

