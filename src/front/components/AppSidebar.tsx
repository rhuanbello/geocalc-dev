import { Calculator, Layers3 } from "lucide-react";

export type GeoCalcModule = "water-balance" | "eups";

export function AppSidebar({
  activeModule,
  onModuleChange,
}: {
  activeModule: GeoCalcModule;
  onModuleChange: (module: GeoCalcModule) => void;
}) {
  return (
    <aside className="app-sidebar" aria-label="Navegação principal">
      <div className="sidebar-brand">
        <strong className="wordmark">GeoCalc</strong>
        <span>PPG Geoquímica / UFF</span>
      </div>

      <nav className="sidebar-nav">
        <button
          className={activeModule === "water-balance" ? "active" : undefined}
          type="button"
          aria-current={activeModule === "water-balance" ? "page" : undefined}
          onClick={() => onModuleChange("water-balance")}
        >
          <Calculator />
          <span>Balanço Hídrico</span>
        </button>
        <button
          className={activeModule === "eups" ? "active" : undefined}
          type="button"
          aria-current={activeModule === "eups" ? "page" : undefined}
          onClick={() => onModuleChange("eups")}
        >
          <Layers3 />
          <span>Perda de Solos (EUPS)</span>
        </button>
      </nav>
    </aside>
  );
}
