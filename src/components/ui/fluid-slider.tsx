import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";

interface FluidSliderProps extends Omit<React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>, 'onValueChange'> {
  onValueChange?: (value: number[]) => void;
  onValueCommit?: (value: number[]) => void;
  showButtons?: boolean;
}

const FluidSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  FluidSliderProps
>(({ className, value, onValueChange, onValueCommit, step = 1, min = 0, max = 100, showButtons = true, disabled, ...props }, ref) => {
  // Track the visual position during drag (continuous)
  const [visualValue, setVisualValue] = React.useState<number[]>(value || [0]);
  const [isDragging, setIsDragging] = React.useState(false);

  // Sync visual value with prop when not dragging
  React.useEffect(() => {
    if (!isDragging && value) {
      setVisualValue(value);
    }
  }, [value, isDragging]);

  const handleValueChange = (newValue: number[]) => {
    setVisualValue(newValue);
    // Update the displayed number during drag (rounded for display)
    const rounded = newValue.map(v => Math.round(v / step) * step);
    onValueChange?.(rounded);
  };

  const handleValueCommit = (newValue: number[]) => {
    // Snap to step on release
    const snappedValue = newValue.map(v => {
      const steppedValue = Math.round(v / step) * step;
      return Math.min(max, Math.max(min, steppedValue));
    });
    setVisualValue(snappedValue);
    onValueCommit?.(snappedValue);
    onValueChange?.(snappedValue);
    setIsDragging(false);
  };

  const handlePointerDown = () => {
    setIsDragging(true);
  };

  const increment = () => {
    if (disabled) return;
    const currentVal = value?.[0] ?? min;
    const newVal = Math.min(max, currentVal + step);
    const newValue = [newVal];
    setVisualValue(newValue);
    onValueChange?.(newValue);
  };

  const decrement = () => {
    if (disabled) return;
    const currentVal = value?.[0] ?? min;
    const newVal = Math.max(min, currentVal - step);
    const newValue = [newVal];
    setVisualValue(newValue);
    onValueChange?.(newValue);
  };

  return (
    <div className="flex items-center gap-3">
      {showButtons && (
        <button
          type="button"
          onClick={decrement}
          disabled={disabled || (value?.[0] ?? min) <= min}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full border border-border",
            "bg-background hover:bg-muted transition-colors duration-150",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "active:scale-95"
          )}
        >
          <Minus className="h-4 w-4" />
        </button>
      )}
      
      <SliderPrimitive.Root
        ref={ref}
        className={cn("relative flex w-full touch-none select-none items-center flex-1", className)}
        value={visualValue}
        onValueChange={handleValueChange}
        onValueCommit={handleValueCommit}
        onPointerDown={handlePointerDown}
        step={0.01} // Ultra fine step for buttery smooth dragging
        min={min}
        max={max}
        disabled={disabled}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
          <SliderPrimitive.Range className={cn(
            "absolute h-full bg-primary",
            isDragging ? "transition-none" : "transition-all duration-200 ease-out"
          )} />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb 
          className={cn(
            "block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
            isDragging ? "transition-transform duration-100 scale-110" : "transition-all duration-200 ease-out"
          )}
        />
      </SliderPrimitive.Root>

      {showButtons && (
        <button
          type="button"
          onClick={increment}
          disabled={disabled || (value?.[0] ?? max) >= max}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full border border-border",
            "bg-background hover:bg-muted transition-colors duration-150",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "active:scale-95"
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
});

FluidSlider.displayName = "FluidSlider";

export { FluidSlider };
