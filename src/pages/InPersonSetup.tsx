import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Play, Users, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import GameHeader from '@/components/GameHeader';
import { GameConfigPanel, GameConfig } from '@/components/GameConfigPanel';
import { useCustomContent } from '@/hooks/useCustomContent';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortablePlayerItemProps {
  id: string;
  index: number;
  player: string;
  onUpdate: (value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}

const SortablePlayerItem = ({ id, index, player, onUpdate, onRemove, canRemove }: SortablePlayerItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="flex gap-2 items-center"
    >
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 p-2 cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Input
        placeholder={`Player ${index + 1}`}
        value={player}
        onChange={(e) => onUpdate(e.target.value)}
        maxLength={30}
        className="flex-1"
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={!canRemove}
        className="shrink-0"
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </motion.div>
  );
};

const InPersonSetup = () => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([
    { id: '1', name: '' },
    { id: '2', name: '' },
    { id: '3', name: '' },
  ]);
  const [showConfig, setShowConfig] = useState(false);
  const [nextId, setNextId] = useState(4);
  
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPlayers((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addPlayer = () => {
    if (players.length >= 20) {
      toast.error('Maximum 20 players allowed');
      return;
    }
    setPlayers([...players, { id: String(nextId), name: '' }]);
    setNextId(nextId + 1);
  };

  const removePlayer = (id: string) => {
    if (players.length <= 2) {
      toast.error('Minimum 2 players required');
      return;
    }
    setPlayers(players.filter((p) => p.id !== id));
  };

  const updatePlayer = (id: string, name: string) => {
    setPlayers(players.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const startGame = () => {
    const validPlayers = players.filter(p => p.name.trim().length > 0).map(p => p.name);
    
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

  const validPlayerCount = players.filter(p => p.name.trim().length > 0).length;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden pb-[env(safe-area-inset-bottom)]">
      <GameHeader title="One Phone Setup" showBack={true} backPath="/menu" />

      <main className="p-4 max-w-md mx-auto space-y-6">
        {/* Players Section */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Players ({validPlayerCount})</h2>
          </div>

          <div className="space-y-3">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={players.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <AnimatePresence>
                  {players.map((player, index) => (
                    <SortablePlayerItem
                      key={player.id}
                      id={player.id}
                      index={index}
                      player={player.name}
                      onUpdate={(value) => updatePlayer(player.id, value)}
                      onRemove={() => removePlayer(player.id)}
                      canRemove={players.length > 2}
                    />
                  ))}
                </AnimatePresence>
              </SortableContext>
            </DndContext>
            
            <Button variant="outline" size="sm" onClick={addPlayer} className="w-full">
              <Plus className="h-4 w-4 mr-1" />
              Add Player
            </Button>
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
              hideRounds
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
