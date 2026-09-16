import { Check, ChevronsUpDown } from "lucide-react";
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

export type StaticComboboxOption<TValue extends string | number> = {
  value: TValue;
  label: string;
  description?: string;
};

export function StaticCombobox<TValue extends string | number>({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = "Selecionar",
  className,
  popoverClassName,
}: {
  id: string;
  label: string;
  value: TValue;
  options: Array<StaticComboboxOption<TValue>>;
  onChange: (value: TValue) => void;
  placeholder?: string;
  className?: string;
  popoverClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  return (
    <div className={cn("static-combobox", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="static-combobox-trigger"
          >
            <span className="static-combobox-value">
              {selectedOption?.label ?? placeholder}
            </span>
            <ChevronsUpDown />
          </Button>
        </PopoverTrigger>
        <PopoverContent className={cn("static-combobox-popover", popoverClassName)}>
          <Command>
            <CommandInput placeholder="Filtrar opções" />
            <CommandList>
              <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = option.value === value;

                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                    >
                      <div className="static-option">
                        <strong>{option.label}</strong>
                        {option.description ? <span>{option.description}</span> : null}
                      </div>
                      <Check className={isSelected ? "is-selected" : ""} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
