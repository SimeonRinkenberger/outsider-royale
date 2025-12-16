import { Checkbox } from '@/components/ui/checkbox';
import { AVAILABLE_MODIFIERS, CustomModifier } from '@/hooks/useCustomContent';
import { CustomModifierManager } from '@/components/CustomModifierManager';
import { Sparkles } from 'lucide-react';

interface GameModifiersProps {
  selectedModifiers: string[];
  onToggle: (modifierId: string) => void;
  customModifiers?: CustomModifier[];
  onAddModifier?: (label: string, description: string) => void;
  onUpdateModifier?: (id: string, label: string, description: string) => void;
  onDeleteModifier?: (id: string) => void;
}

export const GameModifiers = ({ 
  selectedModifiers, 
  onToggle,
  customModifiers = [],
  onAddModifier,
  onUpdateModifier,
  onDeleteModifier,
}: GameModifiersProps) => {
  const allModifiers = [
    ...AVAILABLE_MODIFIERS,
    ...customModifiers.map(m => ({ id: m.id, label: m.label, description: m.description })),
  ];

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Game Modifiers</h4>
      <p className="text-xs text-muted-foreground">
        Optional rules to spice up the game
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
        
        {/* Custom Modifiers */}
        {customModifiers.length > 0 && (
          <>
            <div className="border-t border-border my-2 pt-2">
              <p className="text-xs text-muted-foreground mb-2">Custom Modifiers</p>
            </div>
            {customModifiers.map((modifier) => (
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
                  <label htmlFor={modifier.id} className="text-sm font-medium cursor-pointer block flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                    {modifier.label}
                  </label>
                  <p className="text-xs text-muted-foreground">{modifier.description}</p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      
      {/* Custom Modifier Manager */}
      {onAddModifier && onUpdateModifier && onDeleteModifier && (
        <div className="border-t border-border pt-4 mt-4">
          <CustomModifierManager
            customModifiers={customModifiers}
            onAdd={onAddModifier}
            onUpdate={onUpdateModifier}
            onDelete={onDeleteModifier}
          />
        </div>
      )}
    </div>
  );
};
