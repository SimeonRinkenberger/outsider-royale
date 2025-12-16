import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AVAILABLE_MODIFIERS, CustomModifier } from '@/hooks/useCustomContent';
import { CustomModifierManager } from '@/components/CustomModifierManager';
import { Sparkles, Shield, AlertTriangle } from 'lucide-react';

// IDs of modifiers that are actually enforced by the system
const ENFORCED_MODIFIER_IDS = ['one-word', 'timed-round', 'speed-round', 'outsider-guess'];

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
  const isEnforced = (modifierId: string) => ENFORCED_MODIFIER_IDS.includes(modifierId);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Game Modifiers</h4>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Shield className="h-3 w-3 text-green-500" />
          <span>Enforced by game</span>
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-amber-500" />
          <span>Honor system</span>
        </span>
      </div>
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
              <div className="flex items-center gap-2">
                <label htmlFor={modifier.id} className="text-sm font-medium cursor-pointer">
                  {modifier.label}
                </label>
                {isEnforced(modifier.id) ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-green-500/10 text-green-600 border-green-500/30">
                    <Shield className="h-2.5 w-2.5 mr-0.5" />
                    Enforced
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-500/30">
                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                    Honor
                  </Badge>
                )}
              </div>
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
                  <div className="flex items-center gap-2">
                    <label htmlFor={modifier.id} className="text-sm font-medium cursor-pointer flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-primary" />
                      {modifier.label}
                    </label>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-500/30">
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                      Honor
                    </Badge>
                  </div>
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
