import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AVAILABLE_MODIFIERS, CustomModifier } from '@/hooks/useCustomContent';
import { Sparkles, ChevronDown, Gamepad2, Shield, AlertCircle } from 'lucide-react';
import { GameMode } from '@/types/game';

const GAME_MODE_INFO: Record<GameMode, { label: string; description: string }> = {
  classic: { label: 'Classic', description: 'All rounds complete, then vote once to find the outsider.' },
  elimination: { label: 'Elimination', description: 'Vote after each round. Eliminated players become spectators.' },
  hidden_imposter: { label: 'Hidden Outsider', description: 'Nobody knows they\'re the outsider - they receive a different word.' },
};

// Track which modifiers are actually enforced by code
const ENFORCED_MODIFIERS = ['one-word', 'timed-round', 'speed-round', 'outsider-guess'];

interface ModifierData {
  id: string;
  label: string;
  description: string;
}

interface ActiveModifiersDisplayProps {
  modifiers: string[];
  customModifiers?: ModifierData[];
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

  const enforcedCount = activeModifiers.filter(m => ENFORCED_MODIFIERS.includes(m.id)).length;

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
            {gameModeInfo?.label || 'Classic'}{activeModifiers.length > 0 && ` + ${activeModifiers.length} rule${activeModifiers.length > 1 ? 's' : ''}`}
            {enforcedCount > 0 && <Shield className="h-3 w-3 text-green-500" />}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3 z-50 bg-popover border border-border shadow-lg" align="start" sideOffset={5}>
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Gamepad2 className="h-3 w-3 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground">Game Mode</p>
              </div>
              <Badge variant="default" className="text-xs">{gameModeInfo?.label || 'Classic'}</Badge>
              <p className="text-xs text-muted-foreground mt-1">{gameModeInfo?.description || 'All rounds complete, then vote once to find the outsider.'}</p>
            </div>
            
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Active Rules</p>
              {activeModifiers.length > 0 ? (
                <div className="space-y-2">
                  {activeModifiers.map(mod => {
                    const isEnforced = ENFORCED_MODIFIERS.includes(mod.id);
                    return (
                      <div key={mod.id} className={`rounded-md p-2 ${isEnforced ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted/50'}`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge variant="secondary" className="text-xs">
                            {mod.label}
                          </Badge>
                          {isEnforced ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded">
                              <Shield className="h-2.5 w-2.5" />
                              Enforced
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
                              <AlertCircle className="h-2.5 w-2.5" />
                              Honor
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{mod.description}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No special rules active</p>
              )}
            </div>

            {activeModifiers.length > 0 && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Shield className="h-2.5 w-2.5 text-green-500" />
                    Enforced = game validates
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <AlertCircle className="h-2.5 w-2.5 text-amber-500" />
                    Honor = player follows
                  </span>
                </div>
              </div>
            )}
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
            {activeModifiers.map(mod => {
              const isEnforced = ENFORCED_MODIFIERS.includes(mod.id);
              return (
                <div key={mod.id} className={`rounded p-2 ${isEnforced ? 'bg-green-500/10 border border-green-500/20' : 'bg-background/50'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs">{mod.label}</Badge>
                    {isEnforced ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded">
                        <Shield className="h-2.5 w-2.5" />
                        Enforced
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
                        <AlertCircle className="h-2.5 w-2.5" />
                        Honor
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{mod.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeModifiers.length > 0 && (
        <div className="pt-2 border-t border-primary/20">
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Shield className="h-2.5 w-2.5 text-green-500" />
              Enforced = game validates
            </span>
            <span className="inline-flex items-center gap-1">
              <AlertCircle className="h-2.5 w-2.5 text-amber-500" />
              Honor = player follows
            </span>
          </div>
        </div>
      )}
    </div>
  );
};