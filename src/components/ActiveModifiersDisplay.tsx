import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AVAILABLE_MODIFIERS } from '@/hooks/useCustomContent';
import { Sparkles, ChevronDown } from 'lucide-react';

interface ActiveModifiersDisplayProps {
  modifiers: string[];
  compact?: boolean;
}

export const ActiveModifiersDisplay = ({ modifiers, compact = false }: ActiveModifiersDisplayProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (modifiers.length === 0) return null;

  const activeModifiers = AVAILABLE_MODIFIERS.filter(m => modifiers.includes(m.id));

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
            {modifiers.length} modifier{modifiers.length > 1 ? 's' : ''}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="end">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Active Rules</p>
            {activeModifiers.map(mod => (
              <div key={mod.id} className="flex items-start gap-2">
                <Badge variant="secondary" className="text-xs shrink-0">
                  {mod.label}
                </Badge>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-1 border-t">
              Honor system - follow the rules!
            </p>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Active Rules</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {activeModifiers.map(mod => (
          <Badge key={mod.id} variant="secondary" className="text-xs">
            {mod.label}
          </Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">Honor system - follow the rules!</p>
    </div>
  );
};
