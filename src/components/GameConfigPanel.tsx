import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Settings, Gamepad2, Palette, Sparkles, ChevronDown } from 'lucide-react';
import { GameMode } from '@/types/game';
import { CustomCategoryManager } from '@/components/CustomCategoryManager';
import { GameModifiers } from '@/components/GameModifiers';
import { CustomCategory, CustomModifier, AVAILABLE_MODIFIERS } from '@/hooks/useCustomContent';
const CATEGORIES = [
  { value: 'animal', label: 'Animals' },
  { value: 'brand', label: 'Brands' },
  { value: 'food', label: 'Food' },
  { value: 'movie', label: 'Movies' },
  { value: 'person', label: 'People' },
  { value: 'place', label: 'Places' },
  { value: 'thing', label: 'Things' },
];

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
}: GameConfigPanelProps) => {
  const [gameModeOpen, setGameModeOpen] = useState(true);
  const [gameSettingsOpen, setGameSettingsOpen] = useState(true);
  const [customizeOpen, setCustomizeOpen] = useState(true);

  const maxImposters = Math.max(1, playerCount - 1);
  const recommendedImposters = playerCount <= 4 ? 1 
    : playerCount <= 7 ? 2 
    : playerCount <= 12 ? 3 
    : 4;

  const updateConfig = (updates: Partial<GameConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  const toggleCategory = (category: string) => {
    const newCategories = config.selectedCategories.includes(category)
      ? config.selectedCategories.filter(c => c !== category)
      : [...config.selectedCategories, category];
    updateConfig({ selectedCategories: newCategories });
  };

  const selectAllCategories = () => {
    updateConfig({
      selectedCategories: CATEGORIES.map(c => c.value),
      selectedCustomCategories: customCategories.map(c => c.id),
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


  return (
    <div className="space-y-4">
      {/* Game Mode */}
      <Collapsible open={gameModeOpen} onOpenChange={setGameModeOpen}>
        <Card className="p-4 bg-gradient-card border-border">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Gamepad2 className="h-4 w-4" />
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

      {/* Game Settings */}
      <Collapsible open={gameSettingsOpen} onOpenChange={setGameSettingsOpen}>
        <Card className="p-4 bg-gradient-card border-border">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Settings className="h-4 w-4" />
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
          <Slider
            value={[config.imposterCount]}
            onValueChange={([val]) => updateConfig({ imposterCount: val })}
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
              <Slider
                value={[config.votesPerPlayer]}
                onValueChange={([val]) => updateConfig({ votesPerPlayer: val })}
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

        {/* Round Count - hide for elimination mode */}
        {config.gameMode !== 'elimination' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Rounds</Label>
              <span className="text-sm font-bold text-primary">{config.roundCount}</span>
            </div>
            <Slider
              value={[config.roundCount]}
              onValueChange={([val]) => updateConfig({ roundCount: val })}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
          </div>
        )}

        {/* Category Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Categories</Label>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={selectAllCategories}
              className="text-xs h-7"
            >
              Select All
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => (
              <div 
                key={cat.value} 
                className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                onClick={() => toggleCategory(cat.value)}
              >
                <Checkbox
                  id={cat.value}
                  checked={config.selectedCategories.includes(cat.value)}
                  onCheckedChange={() => toggleCategory(cat.value)}
                />
                <label
                  htmlFor={cat.value}
                  className="text-sm font-medium cursor-pointer select-none"
                >
                  {cat.label}
                </label>
              </div>
            ))}
          
            {/* Custom Categories in same grid */}
            {customCategories.length > 0 && (
              <>
                <div className="col-span-2 border-t border-border my-2 pt-2">
                  <p className="text-xs text-muted-foreground mb-2">Custom Categories</p>
                </div>
                {customCategories.map((cat) => (
                  <div 
                    key={cat.id} 
                    className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleCustomCategory(cat.id)}
                  >
                    <Checkbox
                      id={cat.id}
                      checked={config.selectedCustomCategories.includes(cat.id)}
                      onCheckedChange={() => toggleCustomCategory(cat.id)}
                    />
                    <label
                      htmlFor={cat.id}
                      className="text-sm font-medium cursor-pointer select-none flex items-center gap-1"
                    >
                      <Sparkles className="h-3 w-3 text-primary" />
                      {cat.name}
                    </label>
                  </div>
                ))}
              </>
            )}
          </div>
          {config.selectedCategories.length === 0 && config.selectedCustomCategories.length === 0 && (
            <p className="text-xs text-destructive">Select at least one category</p>
          )}
        </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Customize Game */}
      <Collapsible open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <Card className="p-4 bg-gradient-card border-border">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Palette className="h-4 w-4" />
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
                  <Slider
                    value={[config.timedRoundDuration]}
                    onValueChange={([val]) => updateConfig({ timedRoundDuration: val })}
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
