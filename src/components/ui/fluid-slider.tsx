import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

interface FluidSliderProps extends Omit<React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>, 'onValueChange'> {
  onValueChange?: (value: number[]) => void;
  onValueCommit?: (value: number[]) => void;
}

const FluidSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  FluidSliderProps
>(({ className, value, onValueChange, onValueCommit, step = 1, min = 0, max = 100, ...props }, ref) => {
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
    // Update the displayed number during drag
    onValueChange?.(newValue);
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

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      value={visualValue}
      onValueChange={handleValueChange}
      onValueCommit={handleValueCommit}
      onPointerDown={handlePointerDown}
      step={0.1} // Use fine step for smooth dragging
      min={min}
      max={max}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-primary transition-all duration-75" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb 
        className={cn(
          "block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          "transition-transform duration-150",
          isDragging && "scale-110"
        )}
      />
    </SliderPrimitive.Root>
  );
});

FluidSlider.displayName = "FluidSlider";

export { FluidSlider };
