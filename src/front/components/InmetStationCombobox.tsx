import { Check, ChevronsUpDown, RadioTower, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/shadcn/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shadcn/components/ui/command";
import { Label } from "@/shadcn/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shadcn/components/ui/popover";
import { cn } from "@/shadcn/lib/utils/utils";
import {
  inmetStationLabel,
  searchInmetStations,
  type InmetNormalPeriod,
  type InmetNormalStation,
} from "$/inmet-normals";

type InmetStationComboboxProps = {
  period: InmetNormalPeriod;
  value: InmetNormalStation | null;
  onChange: (station: InmetNormalStation | null) => void;
  onPreviewChange: (station: InmetNormalStation | null) => void;
};

export function InmetStationCombobox({
  period,
  value,
  onChange,
  onPreviewChange,
}: InmetStationComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = useMemo(() => searchInmetStations(query, period), [query, period]);
  const hasSelection = Boolean(value);

  return (
    <div className="location-combobox">
      <Label htmlFor="inmet-station-combobox">Estação INMET</Label>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);

          if (!nextOpen) {
            onPreviewChange(null);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id="inmet-station-combobox"
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("location-combobox-trigger", !hasSelection && "is-empty")}
          >
            <span className="location-combobox-value">
              <RadioTower />
              {value ? inmetStationLabel(value) : "Buscar estação por nome, UF ou código"}
            </span>
            <span className="location-combobox-actions">
              {hasSelection ? (
                <X
                  aria-label="Limpar estação selecionada"
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(null);
                    onPreviewChange(null);
                    setQuery("");
                  }}
                />
              ) : null}
              <ChevronsUpDown />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="location-combobox-popover">
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={(value) => {
                setQuery(value);
                onPreviewChange(null);
              }}
              placeholder="Ex.: Brasília, DF ou 83377"
            />
            <CommandList onMouseLeave={() => onPreviewChange(null)}>
              {options.length > 0 ? (
                <CommandGroup>
                  {options.map((station) => {
                    const isSelected = value?.code === station.code;

                    return (
                      <CommandItem
                        key={station.code}
                        value={station.code}
                        onFocus={() => onPreviewChange(station)}
                        onMouseEnter={() => onPreviewChange(station)}
                        onSelect={() => {
                          onChange(station);
                          onPreviewChange(null);
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <div className="location-option">
                          <strong>{station.name}</strong>
                          <span>
                            {station.code} · {station.uf} · {station.status}
                          </span>
                          <small>
                            {formatCoordinate(station.latitude)},{" "}
                            {formatCoordinate(station.longitude)}
                          </small>
                        </div>
                        <Check className={isSelected ? "is-selected" : ""} />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ) : null}
              <CommandEmpty>Nenhuma estação completa encontrada.</CommandEmpty>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function formatCoordinate(value: number): string {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 4,
  });
}
