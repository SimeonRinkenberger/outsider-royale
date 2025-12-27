import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Play, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import GameHeader from '@/components/GameHeader';
import { GameConfigPanel, GameConfig } from '@/components/GameConfigPanel';
import { useCustomContent } from '@/hooks/useCustomContent';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const InPersonSetup = () => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<string[]>(['', '', '']);
  const [showConfig, setShowConfig] = useState(false);
  
  const {
    customCategories,
    customModifiers,
    addCategory,
    updateCategory,
    deleteCategory,
    addModifier,
    updateModifier,
    deleteModifier,
  } = useCustomContent();

  const [config, setConfig] = useState<GameConfig>({
    selectedCategories: ['animal', 'food', 'movie'],
    selectedCustomCategories: [],
    selectedModifiers: [],
    imposterCount: 1,
    randomImposters: false,
    roundCount: 3,
    gameMode: 'classic',
    showOutsiderCount: true,
    votesPerPlayer: 1,
    timedRoundDuration: 30,
  });

  const addPlayer = () => {
    if (players.length >= 20) {
      toast.error('Maximum 20 players allowed');
      return;
    }
    setPlayers([...players, '']);
  };

  const removePlayer = (index: number) => {
    if (players.length <= 2) {
      toast.error('Minimum 2 players required');
      return;
    }
    setPlayers(players.filter((_, i) => i !== index));
  };

  const updatePlayer = (index: number, name: string) => {
    const updated = [...players];
    updated[index] = name;
    setPlayers(updated);
  };

  const startGame = () => {
    const validPlayers = players.filter(p => p.trim().length > 0);
    
    if (validPlayers.length < 3) {
      toast.error('Need at least 3 players to start');
      return;
    }

    const numOutsiders = config.randomImposters 
      ? Math.floor(Math.random() * Math.min(config.imposterCount, validPlayers.length - 1)) + 1
      : config.imposterCount;

    if (numOutsiders >= validPlayers.length) {
      toast.error('Too many outsiders for the number of players');
      return;
    }

    if (config.selectedCategories.length === 0 && config.selectedCustomCategories.length === 0) {
      toast.error('Please select at least one category');
      return;
    }

    // Store game config and navigate to in-person game
    const gameConfig = {
      players: validPlayers,
      numOutsiders,
      currentPlayerIndex: 0,
      phase: 'word-reveal',
      gameMode: config.gameMode,
      roundCount: config.roundCount,
      selectedCategories: config.selectedCategories,
      selectedCustomCategories: config.selectedCustomCategories,
      selectedModifiers: config.selectedModifiers,
      showOutsiderCount: config.showOutsiderCount,
      votesPerPlayer: config.randomImposters ? validPlayers.length - 1 : config.votesPerPlayer,
      customCategories: customCategories.filter(c => config.selectedCustomCategories.includes(c.id)),
      customModifiers: customModifiers.filter(m => config.selectedModifiers.includes(m.id)),
    };
    
    localStorage.setItem('inPersonGame', JSON.stringify(gameConfig));
    navigate('/in-person/game');
  };

  const validPlayerCount = players.filter(p => p.trim().length > 0).length;
  const recommendedOutsiders = validPlayerCount <= 4 ? 1 : validPlayerCount <= 7 ? 2 : validPlayerCount <= 12 ? 3 : 4;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden pb-[env(safe-area-inset-bottom)]">
      <GameHeader title="In Person Setup" showBack={true} backPath="/menu" />

      <main className="p-4 max-w-md mx-auto space-y-6">
        {/* Players Section */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Players ({validPlayerCount})</h2>
            </div>
            <Button variant="outline" size="sm" onClick={addPlayer}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          <div className="space-y-3">
            <AnimatePresence>
              {players.map((player, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex gap-2"
                >
                  <Input
                    placeholder={`Player ${index + 1}`}
                    value={player}
                    onChange={(e) => updatePlayer(index, e.target.value)}
                    maxLength={30}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePlayer(index)}
                    disabled={players.length <= 2}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Card>

        {/* Game Configuration */}
        <Collapsible open={showConfig} onOpenChange={setShowConfig}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              Game Settings
              {showConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <GameConfigPanel
              playerCount={validPlayerCount || 3}
              customCategories={customCategories}
              customModifiers={customModifiers}
              config={config}
              onConfigChange={setConfig}
              onAddCategory={addCategory}
              onUpdateCategory={updateCategory}
              onDeleteCategory={deleteCategory}
              onAddModifier={addModifier}
              onUpdateModifier={updateModifier}
              onDeleteModifier={deleteModifier}
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Start Game Button */}
        <Button
          className="w-full h-14 text-lg"
          onClick={startGame}
          disabled={validPlayerCount < 3}
        >
          <Play className="h-5 w-5 mr-2" />
          Start Game
        </Button>

        {validPlayerCount < 3 && (
          <p className="text-center text-sm text-muted-foreground">
            Need at least 3 players to start
          </p>
        )}
      </main>
    </div>
  );
};

export default InPersonSetup;