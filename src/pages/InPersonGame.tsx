import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowRight, RotateCcw, Users, Settings, ChevronDown, ChevronUp, DoorOpen } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, useAnimation } from 'framer-motion';

import GameHeader from '@/components/GameHeader';
import { useAudio } from '@/contexts/AudioContext';
import { useTransition } from '@/contexts/TransitionContext';
import { ActiveModifiersDisplay } from '@/components/ActiveModifiersDisplay';
import { GameConfigPanel, GameConfig } from '@/components/GameConfigPanel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCustomContent } from '@/hooks/useCustomContent';
import cryingFoxImg from '@/assets/crying_fox.png';
import happyFoxImg from '@/assets/happy_fox.png';

interface InPersonGameConfig {
  players: string[];
  numOutsiders: number;
  currentPlayerIndex: number;
  currentVoterIndex: number;
  phase: 'word-reveal' | 'discussion' | 'voting' | 'results';
  secretWord?: string;
  outsiderWord?: string; // For hidden_imposter mode
  wordCategory?: string; // Category of the secret word
  outsiderIndices?: number[];
  votes?: Record<string, string>;
  // Game settings for play again
  gameMode?: string;
  roundCount?: number;
  selectedCategories?: string[];
  selectedCustomCategories?: string[];
  selectedModifiers?: string[];
  showOutsiderCount?: boolean;
  votesPerPlayer?: number;
  customCategories?: { id: string; name: string; words: string[] }[];
  customModifiers?: { id: string; label: string; description: string }[];
}

// Animation variants for smooth transitions
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

const springTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

const fadeScale = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

const staggerChildren = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const childVariant = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const InPersonGame = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<InPersonGameConfig | null>(null);
  const [isWordVisible, setIsWordVisible] = useState(false);
  const [hasViewedWord, setHasViewedWord] = useState(false);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for backward
  const [showSettings, setShowSettings] = useState(false);
  
  // Swipe card controls
  const dragY = useMotionValue(0);
  const cardControls = useAnimation();
  const coverOpacity = useTransform(dragY, [-150, 0], [0, 1]);
  const revealOpacity = useTransform(dragY, [-150, -50], [1, 0]);
  
  const { setMusicState } = useAudio();
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
  
  // Game config for play again with settings
  const [gameConfig, setGameConfig] = useState<GameConfig>({
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
  
  useEffect(() => {
    setMusicState('game_standard');
  }, [setMusicState]);
  
  // Load game config from stored config when it loads
  useEffect(() => {
    if (config) {
      setGameConfig(prev => ({
        ...prev,
        gameMode: (config.gameMode as GameConfig['gameMode']) || 'classic',
        roundCount: config.roundCount || 3,
        selectedCategories: config.selectedCategories || ['animal', 'food', 'movie'],
        selectedCustomCategories: config.selectedCustomCategories || [],
        selectedModifiers: config.selectedModifiers || [],
        showOutsiderCount: config.showOutsiderCount ?? true,
        votesPerPlayer: config.votesPerPlayer || 1,
        imposterCount: config.numOutsiders || 1,
      }));
    }
  }, [config]);

  useEffect(() => {
    const loadGame = async () => {
      const stored = localStorage.getItem('inPersonGame');
      if (!stored) {
        navigate('/in-person');
        return;
      }

      const gameConfig: InPersonGameConfig = JSON.parse(stored);
      
      // Initialize game if needed
      if (!gameConfig.secretWord) {
        // Get selected categories
        const selectedCats = gameConfig.selectedCategories || ['animal', 'food', 'movie'];
        const selectedCustomCats = gameConfig.selectedCustomCategories || [];
        const storedCustomCategories = gameConfig.customCategories || [];
        
        // Fetch words from selected categories
        let allWords: { text: string; category: string }[] = [];
        
        if (selectedCats.length > 0) {
          const { data: words, error } = await supabase
            .from('words')
            .select('text, category')
            .in('category', selectedCats as ('animal' | 'brand' | 'degenerate' | 'food' | 'movie' | 'person' | 'place' | 'thing')[]);

          if (error || !words?.length) {
            toast.error('Failed to load words');
            navigate('/in-person');
            return;
          }
          
          allWords = words.map(w => ({ text: w.text, category: w.category }));
        }
        
        // Add words from custom categories
        const selectedCustomCatData = storedCustomCategories.filter(c => selectedCustomCats.includes(c.id));
        for (const customCat of selectedCustomCatData) {
          for (const word of customCat.words) {
            allWords.push({ text: word, category: customCat.name });
          }
        }
        
        if (allWords.length === 0) {
          toast.error('No words available for selected categories');
          navigate('/in-person');
          return;
        }

        // Select random word
        const randomWordData = allWords[Math.floor(Math.random() * allWords.length)];
        
        // For hidden_imposter mode, select a different word for outsiders
        let outsiderWord: string | undefined;
        if (gameConfig.gameMode === 'hidden_imposter') {
          // Get a different word from the same category if possible
          const sameCategory = allWords.filter(w => w.category === randomWordData.category && w.text !== randomWordData.text);
          if (sameCategory.length > 0) {
            outsiderWord = sameCategory[Math.floor(Math.random() * sameCategory.length)].text;
          } else {
            // Fallback to any different word
            const differentWords = allWords.filter(w => w.text !== randomWordData.text);
            if (differentWords.length > 0) {
              outsiderWord = differentWords[Math.floor(Math.random() * differentWords.length)].text;
            }
          }
        }
        
        // Randomly select outsiders
        const playerIndices = gameConfig.players.map((_, i) => i);
        const shuffled = playerIndices.sort(() => Math.random() - 0.5);
        const outsiderIndices = shuffled.slice(0, gameConfig.numOutsiders);

        gameConfig.secretWord = randomWordData.text;
        gameConfig.wordCategory = randomWordData.category;
        gameConfig.outsiderWord = outsiderWord;
        gameConfig.outsiderIndices = outsiderIndices;
        gameConfig.votes = {};
        
        localStorage.setItem('inPersonGame', JSON.stringify(gameConfig));
      }

      setConfig(gameConfig);
    };

    loadGame();
  }, [navigate]);

  const updateConfig = (updates: Partial<InPersonGameConfig>) => {
    if (!config) return;
    const updated = { ...config, ...updates };
    setConfig(updated);
    localStorage.setItem('inPersonGame', JSON.stringify(updated));
  };

  const nextPlayer = () => {
    if (!config) return;
    setDirection(1);
    
    const nextIndex = config.currentPlayerIndex + 1;
    if (nextIndex >= config.players.length) {
      updateConfig({ phase: 'discussion', currentPlayerIndex: 0 });
    } else {
      updateConfig({ currentPlayerIndex: nextIndex });
    }
    setIsWordVisible(false);
    setHasViewedWord(false);
    cardControls.set({ y: 0 });
  };

  const startVoting = () => {
    setDirection(1);
    updateConfig({ phase: 'voting', currentVoterIndex: 0 });
    setSelectedVote(null);
  };

  const submitVote = () => {
    if (!config || !selectedVote) return;
    setDirection(1);
    
    const currentVoterIndex = config.currentVoterIndex ?? 0;
    const newVotes = { ...config.votes, [config.players[currentVoterIndex]]: selectedVote };
    
    if (currentVoterIndex + 1 >= config.players.length) {
      updateConfig({ phase: 'results', votes: newVotes });
      
    } else {
      updateConfig({ votes: newVotes, currentVoterIndex: currentVoterIndex + 1 });
      setSelectedVote(null);
    }
  };

  const playAgain = async () => {
    if (!config) return;
    
    // Keep the same player list but reset game state
    const validPlayers = config.players;
    
    const numOutsiders = gameConfig.randomImposters 
      ? Math.floor(Math.random() * Math.min(gameConfig.imposterCount, validPlayers.length - 1)) + 1
      : gameConfig.imposterCount;

    // Fetch words from selected categories
    let allWords: { text: string; category: string }[] = [];
    
    if (gameConfig.selectedCategories.length > 0) {
      const { data: words } = await supabase
        .from('words')
        .select('text, category')
        .in('category', gameConfig.selectedCategories as ('animal' | 'brand' | 'degenerate' | 'food' | 'movie' | 'person' | 'place' | 'thing')[]);
      
      if (words) {
        allWords = words.map(w => ({ text: w.text, category: w.category }));
      }
    }
    
    // Add words from custom categories
    const storedCustomCategories = config.customCategories || [];
    const selectedCustomCats = storedCustomCategories.filter(c => gameConfig.selectedCustomCategories.includes(c.id));
    for (const customCat of selectedCustomCats) {
      for (const word of customCat.words) {
        allWords.push({ text: word, category: customCat.name });
      }
    }
    
    if (allWords.length === 0) {
      toast.error('No words available for selected categories');
      return;
    }

    // Select random word
    const randomWordData = allWords[Math.floor(Math.random() * allWords.length)];
    
    // For hidden_imposter mode, select a different word for outsiders
    let outsiderWord: string | undefined;
    if (gameConfig.gameMode === 'hidden_imposter') {
      const sameCategory = allWords.filter(w => w.category === randomWordData.category && w.text !== randomWordData.text);
      if (sameCategory.length > 0) {
        outsiderWord = sameCategory[Math.floor(Math.random() * sameCategory.length)].text;
      } else {
        const differentWords = allWords.filter(w => w.text !== randomWordData.text);
        if (differentWords.length > 0) {
          outsiderWord = differentWords[Math.floor(Math.random() * differentWords.length)].text;
        }
      }
    }
    
    // Randomly select outsiders
    const playerIndices = validPlayers.map((_, i) => i);
    const shuffled = playerIndices.sort(() => Math.random() - 0.5);
    const outsiderIndices = shuffled.slice(0, numOutsiders);

    // Create new game config preserving settings
    const newGameConfig: InPersonGameConfig = {
      players: validPlayers,
      numOutsiders,
      currentPlayerIndex: 0,
      currentVoterIndex: 0,
      phase: 'word-reveal',
      secretWord: randomWordData.text,
      wordCategory: randomWordData.category,
      outsiderWord,
      outsiderIndices,
      votes: {},
      // Preserve game settings
      gameMode: gameConfig.gameMode,
      roundCount: gameConfig.roundCount,
      selectedCategories: gameConfig.selectedCategories,
      selectedCustomCategories: gameConfig.selectedCustomCategories,
      selectedModifiers: gameConfig.selectedModifiers,
      showOutsiderCount: gameConfig.showOutsiderCount,
      votesPerPlayer: gameConfig.votesPerPlayer,
      customCategories: storedCustomCategories,
      customModifiers: config.customModifiers,
    };
    
    localStorage.setItem('inPersonGame', JSON.stringify(newGameConfig));
    setConfig(newGameConfig);
    setSelectedVote(null);
    setIsWordVisible(false);
    setHasViewedWord(false);
    setShowSettings(false);
    cardControls.set({ y: 0 });
    toast.success('New game started!');
  };

  const { startTransition } = useTransition();
  
  const exitGame = (event?: React.MouseEvent) => {
    localStorage.removeItem('inPersonGame');
    if (event) {
      const rect = event.currentTarget.getBoundingClientRect();
      startTransition('/menu', {
        origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      });
    } else {
      startTransition('/menu');
    }
  };
  
  const maxImposters = config ? Math.max(1, config.players.length - 1) : 1;

  if (!config) {
    // Inline skeleton - TransitionOverlay is the only full-screen loader
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border p-4">
          <div className="max-w-md mx-auto">
            <div className="h-6 w-32 bg-muted rounded animate-pulse"></div>
          </div>
        </header>
        <main className="p-4 max-w-md mx-auto space-y-4">
          <div className="h-48 bg-muted rounded-lg animate-pulse"></div>
          <div className="h-12 bg-muted rounded animate-pulse"></div>
        </main>
      </div>
    );
  }

  const isCurrentPlayerOutsider = config.outsiderIndices?.includes(config.currentPlayerIndex);

  // Calculate results
  const getResults = () => {
    if (!config.votes || !config.outsiderIndices) return null;
    
    const voteCounts: Record<string, number> = {};
    Object.values(config.votes).forEach(vote => {
      voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    });

    const sortedVotes = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
    const totalVotes = Object.values(config.votes).length;
    const majorityThreshold = Math.ceil(totalVotes / 2); // 50% or more
    
    // Check if any outsider received a majority of votes
    let wasOutsiderCaught = false;
    let caughtOutsider: string | null = null;
    
    for (const [player, count] of sortedVotes) {
      const playerIndex = config.players.indexOf(player);
      if (config.outsiderIndices.includes(playerIndex) && count >= majorityThreshold) {
        wasOutsiderCaught = true;
        caughtOutsider = player;
        break;
      }
    }
    
    return {
      voteCounts,
      sortedVotes,
      wasOutsiderCaught,
      caughtOutsider,
      majorityThreshold
    };
  };

  // Create a unique key for player transitions within the same phase
  const getPhaseKey = () => {
    if (config.phase === 'word-reveal') {
      return `word-reveal-${config.currentPlayerIndex}`;
    }
    if (config.phase === 'voting') {
      return `voting-${config.currentVoterIndex}`;
    }
    return config.phase;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
      <GameHeader 
        title={
          config.phase === 'word-reveal' ? 'Pass the Device' :
          config.phase === 'discussion' ? 'Discussion Time' :
          config.phase === 'voting' ? 'Voting' : 'Results'
        }
        showBack={false}
        rightContent={
          <Button variant="ghost" size="sm" onClick={exitGame} className="gap-1 text-muted-foreground">
            <DoorOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Exit</span>
          </Button>
        }
      />

      <main className="flex-1 p-4 max-w-md mx-auto w-full flex flex-col justify-center">
        <AnimatePresence mode="wait" custom={direction}>
          {/* Word Reveal Phase */}
          {config.phase === 'word-reveal' && (
            <motion.div
              key={getPhaseKey()}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={springTransition}
              className="space-y-6"
            >
              <Card className="p-6 text-center overflow-hidden">
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-muted-foreground mb-2"
                >
                  Pass to
                </motion.p>
                <motion.h2 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 400, damping: 25 }}
                  className="text-3xl font-bold mb-6"
                >
                  {config.players[config.currentPlayerIndex]}
                </motion.h2>
                
                {/* Swipe Card Container */}
                <div className="relative h-44 mb-4">
                  {/* Role content underneath */}
                  <motion.div 
                    className={`absolute inset-0 p-6 rounded-xl flex items-center justify-center ${
                      isCurrentPlayerOutsider && config.gameMode !== 'hidden_imposter' 
                        ? 'bg-destructive/10 border-2 border-destructive' 
                        : 'bg-primary/10 border-2 border-primary'
                    }`}
                    style={{ opacity: revealOpacity }}
                  >
                    {isCurrentPlayerOutsider && config.gameMode !== 'hidden_imposter' ? (
                      <div>
                        <p className="text-lg font-bold text-destructive mb-1">You are the OUTSIDER!</p>
                        <p className="text-sm text-muted-foreground">You don't know the word. Try to blend in!</p>
                        {config.wordCategory && (
                          <p className="text-xs text-muted-foreground mt-2">Category: <span className="font-semibold capitalize">{config.wordCategory}</span></p>
                        )}
                      </div>
                    ) : (
                      <div>
                        {config.wordCategory && (
                          <p className="text-xs text-muted-foreground mb-1">Category: <span className="font-semibold capitalize">{config.wordCategory}</span></p>
                        )}
                        <p className="text-sm text-muted-foreground mb-1">The secret word is:</p>
                        <p className="text-3xl font-bold text-primary">
                          {/* In hidden_imposter mode, outsiders get a different word but don't know they're outsider */}
                          {isCurrentPlayerOutsider && config.gameMode === 'hidden_imposter' && config.outsiderWord
                            ? config.outsiderWord
                            : config.secretWord}
                        </p>
                      </div>
                    )}
                  </motion.div>
                  
                  {/* Draggable cover card */}
                  <motion.div
                    drag="y"
                    dragConstraints={{ top: -150, bottom: 0 }}
                    dragElastic={0.1}
                    style={{ y: dragY, opacity: coverOpacity }}
                    animate={cardControls}
                    onDrag={(_, info) => {
                      if (info.offset.y < -100 && !hasViewedWord) {
                        setHasViewedWord(true);
                      }
                    }}
                    onDragEnd={(_, info) => {
                      // Always spring back
                      cardControls.start({ 
                        y: 0, 
                        transition: { type: "spring", stiffness: 400, damping: 30 }
                      });
                    }}
                    className="absolute inset-0 bg-card border-2 border-border rounded-xl cursor-grab active:cursor-grabbing flex flex-col items-center justify-center shadow-lg touch-none"
                  >
                    <ChevronUp className="h-8 w-8 text-muted-foreground mb-2 animate-bounce" />
                    <p className="text-lg font-semibold">Swipe up to reveal</p>
                    <p className="text-sm text-muted-foreground">Release to hide</p>
                  </motion.div>
                </div>
                
                {/* Next button - only appears after viewing */}
                <AnimatePresence>
                  {hasViewedWord && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    >
                      <Button className="w-full h-12" onClick={nextPlayer}>
                        <ArrowRight className="h-5 w-5 mr-2" />
                        {config.currentPlayerIndex + 1 >= config.players.length ? 'Start Discussion' : 'Next Player'}
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
              
              {/* Rules summary */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <ActiveModifiersDisplay 
                  modifiers={config.selectedModifiers || []} 
                  customModifiers={config.customModifiers || []}
                  gameMode={(config.gameMode as 'classic' | 'elimination' | 'hidden_imposter') || 'classic'}
                  compact
                  allHonorSystem
                />
              </motion.div>
              
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-center text-sm text-muted-foreground"
              >
                Player {config.currentPlayerIndex + 1} of {config.players.length}
              </motion.p>
            </motion.div>
          )}

          {/* Discussion Phase */}
          {config.phase === 'discussion' && (
            <motion.div
              key="discussion"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={springTransition}
              className="space-y-6"
            >
              <Card className="p-6 text-center overflow-hidden">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                >
                  <Users className="h-12 w-12 mx-auto mb-4 text-primary" />
                </motion.div>
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl font-bold mb-2"
                >
                  Discussion Time!
                </motion.h2>
                {config.wordCategory && (
                  <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22 }}
                    className="text-sm text-primary font-semibold mb-2 capitalize"
                  >
                    Category: {config.wordCategory}
                  </motion.p>
                )}
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-muted-foreground mb-4"
                >
                  Take turns giving one-word clues about the secret word.
                  {config.gameMode === 'hidden_imposter' 
                    ? ' Someone has a different word!' 
                    : ' Try to identify who doesn\'t know the word!'}
                </motion.p>
                {config.showOutsiderCount !== false && (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-sm text-muted-foreground"
                  >
                    {config.numOutsiders} outsider{config.numOutsiders > 1 ? 's' : ''} among {config.players.length} players
                  </motion.p>
                )}
              </Card>
              
              {/* Turn Order */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Turn Order</h3>
                  <div className="flex flex-wrap gap-2">
                    {config.players.map((player, index) => (
                      <span 
                        key={index} 
                        className="px-3 py-1 bg-muted rounded-full text-sm"
                      >
                        {index + 1}. {player}
                      </span>
                    ))}
                  </div>
                </Card>
              </motion.div>
              
              {/* Rules summary */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <ActiveModifiersDisplay 
                  modifiers={config.selectedModifiers || []} 
                  customModifiers={config.customModifiers || []}
                  gameMode={(config.gameMode as 'classic' | 'elimination' | 'hidden_imposter') || 'classic'}
                  compact
                  allHonorSystem
                />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, type: "spring", stiffness: 300, damping: 25 }}
              >
                <Button className="w-full h-14 text-lg" onClick={startVoting}>
                  Start Voting
                </Button>
              </motion.div>
            </motion.div>
          )}

          {/* Voting Phase */}
          {config.phase === 'voting' && (
            <motion.div
              key={getPhaseKey()}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={springTransition}
              className="space-y-4"
            >
              <Card className="p-4 text-center overflow-hidden">
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-muted-foreground"
                >
                  Pass to
                </motion.p>
                <motion.h2 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 25 }}
                  className="text-2xl font-bold"
                >
                  {config.players[config.currentVoterIndex ?? 0]}
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="text-sm text-muted-foreground mt-2"
                >
                  Who do you think is the outsider?
                </motion.p>
              </Card>
              
              <motion.div 
                className="space-y-2"
                variants={staggerChildren}
                initial="initial"
                animate="animate"
              >
                {config.players.map((player, index) => {
                  const isCurrentVoter = index === (config.currentVoterIndex ?? 0);
                  return (
                    <motion.div
                      key={index}
                      variants={childVariant}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    >
                      <Button
                        variant={selectedVote === player ? 'default' : 'outline'}
                        className="w-full h-12 justify-start transition-all duration-200"
                        onClick={() => setSelectedVote(player)}
                        disabled={isCurrentVoter}
                      >
                        {player}
                        {isCurrentVoter && (
                          <span className="ml-auto text-xs text-muted-foreground">(You)</span>
                        )}
                      </Button>
                    </motion.div>
                  );
                })}
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + config.players.length * 0.08 }}
              >
                <Button
                  className="w-full h-12"
                  onClick={submitVote}
                  disabled={!selectedVote}
                >
                  Submit Vote
                </Button>
              </motion.div>
              
              {/* Rules summary */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + config.players.length * 0.08 }}
              >
                <ActiveModifiersDisplay 
                  modifiers={config.selectedModifiers || []} 
                  customModifiers={config.customModifiers || []}
                  gameMode={(config.gameMode as 'classic' | 'elimination' | 'hidden_imposter') || 'classic'}
                  compact
                  allHonorSystem
                />
              </motion.div>
            </motion.div>
          )}

          {/* Results Phase */}
          {config.phase === 'results' && (
            <motion.div
              key="results"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={springTransition}
              className="space-y-4"
            >
              {(() => {
                const results = getResults();
                if (!results) return null;
                
                return (
                  <motion.div
                    variants={staggerChildren}
                    initial="initial"
                    animate="animate"
                    className="space-y-4"
                  >
                    <motion.div variants={childVariant} transition={springTransition}>
                      <Card className={`p-6 text-center ${results.wasOutsiderCaught ? 'bg-green-500/10 border-green-500' : 'bg-destructive/10 border-destructive'}`}>
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.2 }}
                          className="flex justify-center mb-4"
                        >
                          <img 
                            src={results.wasOutsiderCaught ? cryingFoxImg : happyFoxImg} 
                            alt={results.wasOutsiderCaught ? 'Group wins' : 'Outsider wins'} 
                            className="h-20 w-20 object-contain"
                          />
                        </motion.div>
                        <motion.h2 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="text-2xl font-bold mb-2"
                        >
                          {results.wasOutsiderCaught ? 'Outsider Caught!' : 'Outsider Wins!'}
                        </motion.h2>
                        <motion.p 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4 }}
                          className="text-muted-foreground"
                        >
                          The secret word was: <span className="font-bold text-foreground">{config.secretWord}</span>
                        </motion.p>
                      </Card>
                    </motion.div>

                    <motion.div variants={childVariant} transition={springTransition}>
                      <Card className="p-4">
                        <h3 className="font-semibold mb-3">The Outsider{config.outsiderIndices!.length > 1 ? 's' : ''}:</h3>
                        <div className="space-y-2">
                          {config.outsiderIndices!.map((playerIndex, i) => (
                            <motion.div 
                              key={playerIndex} 
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.5 + i * 0.1 }}
                              className="p-3 bg-destructive/10 rounded-lg"
                            >
                              <span className="font-medium">{config.players[playerIndex]}</span>
                            </motion.div>
                          ))}
                        </div>
                      </Card>
                    </motion.div>

                    <motion.div variants={childVariant} transition={springTransition}>
                      <Card className="p-4">
                        <h3 className="font-semibold mb-3">Vote Results:</h3>
                        <div className="space-y-2">
                          {results.sortedVotes.map(([player, count], i) => (
                            <motion.div 
                              key={player} 
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.6 + i * 0.08 }}
                              className="flex justify-between items-center p-2 bg-muted rounded"
                            >
                              <span>{player}</span>
                              <span className="font-bold">{count} vote{count > 1 ? 's' : ''}</span>
                            </motion.div>
                          ))}
                        </div>
                      </Card>
                    </motion.div>

                    {/* Game Settings for Play Again */}
                    <motion.div variants={childVariant} transition={springTransition}>
                      <Collapsible open={showSettings} onOpenChange={setShowSettings}>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            <span className="flex items-center gap-2">
                              <Settings className="h-4 w-4" />
                              Game Settings
                            </span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-4">
                          <GameConfigPanel
                            playerCount={config.players.length}
                            customCategories={customCategories}
                            customModifiers={customModifiers}
                            config={gameConfig}
                            onConfigChange={setGameConfig}
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
                    </motion.div>

                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 }}
                      className="flex gap-3"
                    >
                      <Button variant="outline" className="flex-1" onClick={exitGame}>
                        Exit
                      </Button>
                      <Button className="flex-1" onClick={playAgain}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Play Again
                      </Button>
                    </motion.div>
                  </motion.div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default InPersonGame;
