import { Checkbox } from '@/components/ui/checkbox';
import { AVAILABLE_MODIFIERS } from '@/hooks/useCustomContent';

interface GameModifiersProps {
  selectedModifiers: string[];
  onToggle: (modifierId: string) => void;
}

export const GameModifiers = ({ selectedModifiers, onToggle }: GameModifiersProps) => {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Game Modifiers</h4>
      <p className="text-xs text-muted-foreground">
        Optional rules to spice up the game (honor system)
      </p>
      <div className="grid grid-cols-1 gap-2">
        {AVAILABLE_MODIFIERS.map((modifier) => (
          <div
            key={modifier.id}
            className="flex items-start space-x-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
            onClick={() => onToggle(modifier.id)}
          >
            <Checkbox
              id={modifier.id}
              checked={selectedModifiers.includes(modifier.id)}
              onCheckedChange={() => onToggle(modifier.id)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <label htmlFor={modifier.id} className="text-sm font-medium cursor-pointer block">
                {modifier.label}
              </label>
              <p className="text-xs text-muted-foreground">{modifier.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
