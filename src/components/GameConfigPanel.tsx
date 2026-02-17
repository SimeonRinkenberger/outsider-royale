import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { FluidSlider } from '@/components/ui/fluid-slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Settings, Gamepad2, Palette, Sparkles, ChevronDown, Lock, Crown, LayoutGrid } from 'lucide-react';
import { GameMode } from '@/types/game';
import { CustomCategoryManager } from '@/components/CustomCategoryManager';
import { GameModifiers } from '@/components/GameModifiers';
import { CustomCategory, CustomModifier, AVAILABLE_MODIFIERS } from '@/hooks/useCustomContent';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { canAccessCategory, getSortedCategories } from '@/lib/entitlements';
import { Paywall } from '@/components/Paywall';
import { getCachedWords } from '@/lib/categoryCache';
import { Badge } from '@/components/ui/badge';

// Categories are now loaded dynamically from the synced cache (DB-driven)

const GAME_MODES: { value: GameMode; label: string; description: string }[] = [
  { value: 'classic', label: 'Classic', description: 'Vote after all rounds. Find the outsider!' },
  { value: 'elimination', label: 'Elimination', description: 'Vote each round. Eliminated players become spectators.' },
  { value: 'hidden_imposter', label: 'Hidden Outsider', description: 'Nobody knows they are the outsider. Outsiders get a different word.' },
];

export interface GameConfig {
  selectedCategories: string[];
  selectedCustomCategories: string[];
  selectedModifiers: string[];
  imposterCount: number;
  randomImposters: boolean;
  roundCount: number;
  gameMode: GameMode;
  showOutsiderCount: boolean;
  votesPerPlayer: number;
  timedRoundDuration: number;
}

interface GameConfigPanelProps {
  playerCount: number;
  customCategories: CustomCategory[];
  customModifiers?: CustomModifier[];
  config: GameConfig;
  onConfigChange: (config: GameConfig) => void;
  onAddCategory: (name: string, words: string[]) => void;
  onUpdateCategory: (id: string, name: string, words: string[]) => void;
  onDeleteCategory: (id: string) => void;
  onAddModifier?: (label: string, description: string) => void;
  onUpdateModifier?: (id: string, label: string, description: string) => void;
  onDeleteModifier?: (id: string) => void;
  hideRounds?: boolean; // For in-person mode where rounds aren't used
}

export const GameConfigPanel = ({
  playerCount,
  customCategories,
  customModifiers = [],
  config,
  onConfigChange,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddModifier,
  onUpdateModifier,
  onDeleteModifier,
  hideRounds = false,
}: GameConfigPanelProps) => {
  const [gameModeOpen, setGameModeOpen] = useState(false);
  const [gameSettingsOpen, setGameSettingsOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  
  const { entitlement, isPro } = useEntitlement();
  const dynamicCategories = getSortedCategories();
  const cache = getCachedWords();

  const maxImposters = Math.max(1, playerCount - 1);
  const recommendedImposters = playerCount <= 4 ? 1 
    : playerCount <= 7 ? 2 
    : playerCount <= 12 ? 3 
    : 4;

  const updateConfig = (updates: Partial<GameConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  const toggleCategory = (category: string) => {
    if (!canAccessCategory(category, entitlement)) {
      setShowPaywall(true);
      return;
    }
    
    const newCategories = config.selectedCategories.includes(category)
      ? config.selectedCategories.filter(c => c !== category)
      : [...config.selectedCategories, category];
    updateConfig({ selectedCategories: newCategories });
  };

  const selectAllCategories = () => {
    const accessibleCategories = dynamicCategories
      .filter(c => canAccessCategory(c.id, entitlement))
      .map(c => c.id);
    
    updateConfig({
      selectedCategories: accessibleCategories,
      selectedCustomCategories: customCategories.map(c => c.id),
    });
  };

  const deselectAllCategories = () => {
    updateConfig({
      selectedCategories: [],
      selectedCustomCategories: [],
    });
  };

  const toggleCustomCategory = (categoryId: string) => {
    const newCustomCategories = config.selectedCustomCategories.includes(categoryId)
      ? config.selectedCustomCategories.filter(c => c !== categoryId)
      : [...config.selectedCustomCategories, categoryId];
    updateConfig({ selectedCustomCategories: newCustomCategories });
  };

  const toggleModifier = (modifierId: string) => {
    const newModifiers = config.selectedModifiers.includes(modifierId)
      ? config.selectedModifiers.filter(m => m !== modifierId)
      : [...config.selectedModifiers, modifierId];
    updateConfig({ selectedModifiers: newModifiers });
  };

  const totalSelectedCategories = config.selectedCategories.length + config.selectedCustomCategories.length;
  const totalWordCount = config.selectedCategories.reduce((sum, catId) => {
    return sum + (cache.categories[catId]?.length ?? 0);
  }, 0) + config.selectedCustomCategories.reduce((sum, catId) => {
    const custom = customCategories.find(c => c.id === catId);
    return sum + (custom?.words.length ?? 0);
  }, 0);

  return (
    <div className="space-y-4">
      {/* Game Mode */}
      <Collapsible open={gameModeOpen} onOpenChange={setGameModeOpen}>
        <Card className="p-4 bg-gradient-card border-border">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Gamepad2 className={`h-4 w-4 ${gameModeOpen ? 'animate-spin-cw' : 'animate-spin-ccw'}`} />
              Game Mode
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${gameModeOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 pt-4">
              {GAME_MODES.map((mode) => (
                <div 
                  key={mode.value}
                  onClick={() => updateConfig({ gameMode: mode.value })}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    config.gameMode === mode.value 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      config.gameMode === mode.value ? 'border-primary' : 'border-muted-foreground'
                    }`}>
                      {config.gameMode === mode.value && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <span className="font-medium">{mode.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-6">{mode.description}</p>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Categories - Own dedicated section */}
      <Collapsible open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <Card className="p-4 bg-gradient-card border-border">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <LayoutGrid className={`h-4 w-4 ${categoriesOpen ? 'animate-spin-cw' : 'animate-spin-ccw'}`} />
              Categories
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                {totalSelectedCategories} selected
              </Badge>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${categoriesOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 pt-4">
              {/* Header with select all/none and total words */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {totalWordCount} words in pool
                </p>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={selectAllCategories}
                    className="text-xs h-7 px-2"
                  >
                    All
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={deselectAllCategories}
                    className="text-xs h-7 px-2"
                  >
                    None
                  </Button>
                </div>
              </div>
              
              {/* Category grid */}
              <div className="grid grid-cols-1 gap-1.5">
                {dynamicCategories.map((cat) => {
                  const isLocked = cat.isPaid && !isPro;
                  const isSelected = config.selectedCategories.includes(cat.id);
                  const wordCount = cache.categories[cat.id]?.length ?? 0;
                  
                  return (
                    <div 
                      key={cat.id} 
                      className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary/10 border border-primary/30'
                          : isLocked 
                            ? 'hover:bg-muted/30 opacity-60 border border-transparent' 
                            : 'hover:bg-muted/50 border border-transparent'
                      }`}
                      onClick={() => toggleCategory(cat.id)}
                    >
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          id={cat.id}
                          checked={isSelected}
                          disabled={isLocked}
                          onCheckedChange={() => toggleCategory(cat.id)}
                        />
                        <span className="text-lg leading-none">{cat.emoji}</span>
                        <div className="flex flex-col">
                          <label
                            htmlFor={cat.id}
                            className={`text-sm font-medium cursor-pointer select-none ${
                              isLocked ? 'text-muted-foreground' : ''
                            }`}
                          >
                            {cat.name}
                          </label>
                          <span className="text-[11px] text-muted-foreground">
                            {wordCount} words
                          </span>
                        </div>
                      </div>
                      {isLocked && (
                        <div className="flex items-center gap-1 text-xs text-primary">
                          <Lock className="h-3 w-3" />
                          <span className="hidden sm:inline">PRO</span>
                        </div>
                      )}
                      {cat.isPaid && isPro && (
                        <Crown className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  );
                })}
              
                {/* Custom Categories */}
                {customCategories.length > 0 && (
                  <>
                    <div className="border-t border-border my-1 pt-2">
                      <p className="text-xs text-muted-foreground mb-1">Custom Categories</p>
                    </div>
                    {customCategories.map((cat) => {
                      const isSelected = config.selectedCustomCategories.includes(cat.id);
                      return (
                        <div 
                          key={cat.id} 
                          className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-primary/10 border border-primary/30'
                              : 'hover:bg-muted/50 border border-transparent'
                          }`}
                          onClick={() => toggleCustomCategory(cat.id)}
                        >
                          <div className="flex items-center gap-2.5">
                            <Checkbox
                              id={cat.id}
                              checked={isSelected}
                              onCheckedChange={() => toggleCustomCategory(cat.id)}
                            />
                            <Sparkles className="h-4 w-4 text-primary" />
                            <div className="flex flex-col">
                              <label
                                htmlFor={cat.id}
                                className="text-sm font-medium cursor-pointer select-none"
                              >
                                {cat.name}
                              </label>
                              <span className="text-[11px] text-muted-foreground">
                                {cat.words.length} words
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              {config.selectedCategories.length === 0 && config.selectedCustomCategories.length === 0 && (
                <p className="text-xs text-destructive">Select at least one category</p>
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Game Settings */}
      <Collapsible open={gameSettingsOpen} onOpenChange={setGameSettingsOpen}>
        <Card className="p-4 bg-gradient-card border-border">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Settings className={`h-4 w-4 ${gameSettingsOpen ? 'animate-spin-cw' : 'animate-spin-ccw'}`} />
              Game Settings
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${gameSettingsOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-5 pt-4">

        {/* Outsider Count */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Outsiders</Label>
            <span className="text-sm font-bold text-primary">
              {config.randomImposters ? '?' : config.imposterCount}
            </span>
          </div>
          <FluidSlider
            value={[config.imposterCount]}
            onValueChange={([val]) => updateConfig({ imposterCount: Math.round(val) })}
            min={1}
            max={maxImposters}
            step={1}
            className="w-full"
            disabled={config.randomImposters}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Recommended: {recommendedImposters} for {playerCount} players
            </p>
            <div 
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() => updateConfig({ randomImposters: !config.randomImposters })}
            >
              <Checkbox
                id="random-outsiders"
                checked={config.randomImposters}
                onCheckedChange={(checked) => updateConfig({ randomImposters: checked as boolean })}
              />
              <label htmlFor="random-outsiders" className="text-xs cursor-pointer">
                Random
              </label>
            </div>
          </div>
        </div>

        {/* Voting Settings */}
        <div className="space-y-3 border-t border-border pt-4">
          <Label className="text-sm text-muted-foreground">Voting Options</Label>
          
          {/* Show Outsider Count */}
          <div 
            className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer"
            onClick={() => updateConfig({ showOutsiderCount: !config.showOutsiderCount })}
          >
            <div>
              <p className="text-sm font-medium">Show Outsider Count</p>
              <p className="text-xs text-muted-foreground">Display how many outsiders there are during voting</p>
            </div>
            <Checkbox
              checked={config.showOutsiderCount}
              onCheckedChange={(checked) => updateConfig({ showOutsiderCount: checked as boolean })}
            />
          </div>
          
          {/* Votes Per Player */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Votes Per Player</p>
                <p className="text-xs text-muted-foreground">
                  {config.randomImposters 
                    ? "Auto-set to hide imposter count" 
                    : "How many players each person can vote for"}
                </p>
              </div>
              <span className="text-sm font-bold text-primary">
                {config.randomImposters ? playerCount - 1 : config.votesPerPlayer}
              </span>
            </div>
            {!config.randomImposters && (
              <FluidSlider
                value={[config.votesPerPlayer]}
                onValueChange={([val]) => updateConfig({ votesPerPlayer: Math.round(val) })}
                min={1}
                max={Math.max(1, playerCount - 1)}
                step={1}
                className="w-full"
              />
            )}
            {config.randomImposters && (
              <p className="text-xs text-muted-foreground italic">
                Everyone gets {playerCount - 1} votes so imposter count stays hidden
              </p>
            )}
          </div>
        </div>

        {/* Round Count - hide for elimination mode and in-person mode */}
        {config.gameMode !== 'elimination' && !hideRounds && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Rounds</Label>
              <span className="text-sm font-bold text-primary">{config.roundCount}</span>
            </div>
            <FluidSlider
              value={[config.roundCount]}
              onValueChange={([val]) => updateConfig({ roundCount: Math.round(val) })}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
          </div>
        )}

            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Customize Game */}
      <Collapsible open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <Card className="p-4 bg-gradient-card border-border">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Palette className={`h-4 w-4 ${customizeOpen ? 'animate-spin-cw' : 'animate-spin-ccw'}`} />
              Customize Game
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${customizeOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-5 pt-4">
              <GameModifiers
                selectedModifiers={config.selectedModifiers}
                onToggle={toggleModifier}
                customModifiers={customModifiers}
                onAddModifier={onAddModifier}
                onUpdateModifier={onUpdateModifier}
                onDeleteModifier={onDeleteModifier}
              />

              {/* Timed Round Duration - show when timed-round modifier is selected */}
              {config.selectedModifiers.includes('timed-round') && (
                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Time Per Clue</Label>
                    <span className="text-sm font-bold text-primary">{config.timedRoundDuration}s</span>
                  </div>
                  <FluidSlider
                    value={[config.timedRoundDuration]}
                    onValueChange={([val]) => updateConfig({ timedRoundDuration: Math.round(val) })}
                    min={10}
                    max={120}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Players have {config.timedRoundDuration} seconds to submit each clue
                  </p>
                </div>
              )}

              <div className="border-t border-border pt-4">
                <CustomCategoryManager
                  categories={customCategories}
                  onAdd={onAddCategory}
                  onUpdate={onUpdateCategory}
                  onDelete={onDeleteCategory}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      
      {/* Paywall Dialog */}
      <Paywall 
        isOpen={showPaywall} 
        onClose={() => setShowPaywall(false)} 
      />
    </div>
  );
};

export const getActiveModifierLabels = (modifierIds: string[], customModifiers: CustomModifier[] = []) => {
  const allModifiers = [
    ...AVAILABLE_MODIFIERS,
    ...customModifiers.map(m => ({ id: m.id, label: m.label, description: m.description })),
  ];
  return modifierIds
    .map(id => allModifiers.find(m => m.id === id)?.label)
    .filter(Boolean);
};
