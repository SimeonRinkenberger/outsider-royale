import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AVAILABLE_MODIFIERS, CustomModifier } from '@/hooks/useCustomContent';
import { Sparkles, ChevronDown, Gamepad2 } from 'lucide-react';
import { GameMode } from '@/types/game';

const GAME_MODE_INFO: Record<GameMode, { label: string; description: string }> = {
  classic: { label: 'Classic', description: 'All rounds complete, then vote once to find the outsider.' },
  elimination: { label: 'Elimination', description: 'Vote after each round. Eliminated players become spectators.' },
  hidden_imposter: { label: 'Hidden Outsider', description: 'Nobody knows they\'re the outsider - they receive a different word.' },
};

interface ActiveModifiersDisplayProps {
  modifiers: string[];
  customModifiers?: CustomModifier[];
  gameMode?: GameMode;
  compact?: boolean;
}

export const ActiveModifiersDisplay = ({ modifiers, customModifiers = [], gameMode, compact = false }: ActiveModifiersDisplayProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Combine built-in and custom modifiers
  const allModifierDefs = [
    ...AVAILABLE_MODIFIERS,
    ...customModifiers.map(m => ({ id: m.id, label: m.label, description: m.description })),
  ];
  
  const activeModifiers = allModifierDefs.filter(m => modifiers.includes(m.id));
  const gameModeInfo = gameMode ? GAME_MODE_INFO[gameMode] : null;
  
  const hasContent = modifiers.length > 0 || gameMode;
  if (!hasContent) return null;

  if (compact) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 gap-1 text-xs text-primary hover:text-primary"
          >
            <Sparkles className="h-3 w-3" />
            {gameModeInfo?.label}{modifiers.length > 0 && ` + ${modifiers.length} rule${modifiers.length > 1 ? 's' : ''}`}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="end">
          <div className="space-y-3">
            {gameModeInfo && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Gamepad2 className="h-3 w-3 text-primary" />
                  <p className="text-xs font-semibold text-muted-foreground">Game Mode</p>
                </div>
                <Badge variant="default" className="text-xs">{gameModeInfo.label}</Badge>
                <p className="text-xs text-muted-foreground mt-1">{gameModeInfo.description}</p>
              </div>
            )}
            {activeModifiers.length > 0 && (
              <div className={gameModeInfo ? 'pt-2 border-t border-border' : ''}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Active Rules</p>
                <div className="space-y-2">
                  {activeModifiers.map(mod => (
                    <div key={mod.id}>
                      <Badge variant="secondary" className="text-xs">
                        {mod.label}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              Honor system - follow the rules!
            </p>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 animate-fade-in space-y-3">
      {gameModeInfo && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Gamepad2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Game Mode</span>
          </div>
          <Badge variant="default" className="text-xs mb-1">{gameModeInfo.label}</Badge>
          <p className="text-xs text-muted-foreground">{gameModeInfo.description}</p>
        </div>
      )}
      
      {activeModifiers.length > 0 && (
        <div className={gameModeInfo ? 'pt-2 border-t border-primary/20' : ''}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Active Rules</span>
          </div>
          <div className="space-y-2">
            {activeModifiers.map(mod => (
              <div key={mod.id} className="bg-background/50 rounded p-2">
                <Badge variant="secondary" className="text-xs mb-1">{mod.label}</Badge>
                <p className="text-xs text-muted-foreground">{mod.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground pt-2 border-t border-primary/20">Honor system - follow the rules!</p>
    </div>
  );
};
