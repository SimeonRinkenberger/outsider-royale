import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useGameState } from '@/hooks/useGameState';
import { useCustomContent } from '@/hooks/useCustomContent';
import { getStoredUserId } from '@/lib/gameUtils';
import { toast } from 'sonner';
import { Copy, Users, Crown, Play, X, Settings, ChevronDown } from 'lucide-react';
import { GameMode } from '@/types/game';
import { GameConfigPanel, GameConfig, getActiveModifierLabels } from '@/components/GameConfigPanel';
import GameHeader from '@/components/GameHeader';
import { copyToClipboard } from '@/lib/platform';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getAvatarById } from '@/components/AvatarPicker';
import { usePageTransition } from '@/components/PageTransition';
import { useBackTransition } from '@/components/BackTransition';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

const Lobby = () => {
  const { lobbyId } = useParams();
  const navigate = useNavigate();
  const { navigateWithTransitionFromCoords } = usePageTransition();
  const { navigateBack } = useBackTransition();
  const { lobby, players } = useGameState(lobbyId || null);
  const pendingTransitionRef = useRef<{ x: number; y: number } | null>(null);
  const {
    customCategories,
    customModifiers,
    presets,
    addCategory,
    updateCategory,
    deleteCategory,
    addModifier,
    updateModifier,
    deleteModifier,
    addPreset,
    deletePreset,
    exportPreset,
    importPreset,
    saveImported,
  } = useCustomContent();
  
  const [isStarting, setIsStarting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playerAvatars, setPlayerAvatars] = useState<Record<string, string | null>>({});
  const [previousPlayers, setPreviousPlayers] = useState<Map<string, string>>(new Map());
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [gameConfig, setGameConfig] = useState<GameConfig>({
    selectedCategories: ['animal', 'brand', 'food', 'movie', 'person', 'place', 'thing'],
    selectedCustomCategories: [],
    selectedModifiers: [],
    imposterCount: 1,
    randomImposters: false,
    roundCount: 3,
    gameMode: 'classic',
    showOutsiderCount: false,
    votesPerPlayer: 1,
    timedRoundDuration: 30,
  });
  const userId = getStoredUserId();

  // Reduced motion preference
  const prefersReducedMotion = useMemo(() => 
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // Animation variants for player cards
  const playerCardVariants = {
    initial: prefersReducedMotion 
      ? { opacity: 0 }
      : { x: -56, opacity: 0, scale: 0.97, filter: 'blur(4px)' },
    animate: { 
      x: 0, 
      opacity: 1, 
      scale: 1, 
      filter: 'blur(0px)'
    },
    exit: prefersReducedMotion 
      ? { opacity: 0 }
      : { 
          x: 56, 
          opacity: 0, 
          scale: 0.97, 
          filter: 'blur(4px)'
        }
  };

  // Animation timing
  const enterTransition = {
    duration: 0.6,
    ease: [0.2, 0.8, 0.2, 1] as const
  };
  
  const exitTransition = {
    duration: 0.7,
    ease: [0.2, 0.8, 0.2, 1] as const
  };

  // Container variants for stagger effect
  const containerVariants = {
    animate: {
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.03
      }
    }
  };

  // Animation durations
  const animationDuration = 0.6;
  const exitDuration = 0.7;

  // Track player joins/leaves and show toasts
  useEffect(() => {
    if (players.length === 0 && previousPlayers.size === 0) return;

    const currentPlayersMap = new Map(players.map(p => [p.id, p.display_name]));
    
    // Skip toast on initial load
    if (isInitialLoad) {
      setPreviousPlayers(currentPlayersMap);
      setIsInitialLoad(false);
      return;
    }

    // Find new players (joined)
    const joinedPlayers = players.filter(p => !previousPlayers.has(p.id));
    
    // Find removed players (left)
    const leftPlayers: { id: string; name: string }[] = [];
    previousPlayers.forEach((name, id) => {
      if (!currentPlayersMap.has(id)) {
        leftPlayers.push({ id, name });
      }
    });

    // Show toasts for joins (skip if it's the current user)
    joinedPlayers.forEach(player => {
      if (player.user_id !== userId) {
        toast.success(`${player.display_name} joined the lobby`);
      }
    });

    // Show toasts for leaves
    leftPlayers.forEach(player => {
      toast.info(`${player.name} left the lobby`);
    });

    setPreviousPlayers(currentPlayersMap);
  }, [players, userId, isInitialLoad]);

  // Fetch avatars for all players
  useEffect(() => {
    const fetchAvatars = async () => {
      if (players.length === 0) return;
      
      const userIds = players.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, avatar_url')
        .in('id', userIds);
      
      if (profiles) {
        const avatarMap: Record<string, string | null> = {};
        profiles.forEach(p => {
          avatarMap[p.id] = p.avatar_url;
        });
        setPlayerAvatars(avatarMap);
      }
    };
    
    fetchAvatars();
  }, [players]);

  const isHost = lobby?.host_user_id === userId;
  const canStart = players.length >= 3;
  const maxImposters = Math.max(1, players.length - 1);

  // Load saved game config from localStorage
  useEffect(() => {
    if (lobbyId) {
      const stored = localStorage.getItem(`game-config-${lobbyId}`);
      if (stored) {
        try {
          const savedConfig = JSON.parse(stored);
          setGameConfig(prev => ({
            ...prev,
            ...savedConfig,
          }));
        } catch (e) {
          console.error('Failed to parse game config:', e);
        }
      }
    }
  }, [lobbyId]);

  // Update imposter count to stay within valid range when players change
  useEffect(() => {
    if (players.length > 0) {
      const newMax = Math.max(1, players.length - 1);
      setGameConfig(prev => ({
        ...prev,
        imposterCount: Math.min(prev.imposterCount, newMax)
      }));
    }
  }, [players.length]);

  useEffect(() => {
    if (lobby?.current_game_id) {
      if (pendingTransitionRef.current) {
        navigateWithTransitionFromCoords(`/game/${lobbyId}`, pendingTransitionRef.current.x, pendingTransitionRef.current.y);
        pendingTransitionRef.current = null;
      } else {
        navigate(`/game/${lobbyId}`);
      }
    }
  }, [lobby?.current_game_id, lobbyId, navigate, navigateWithTransitionFromCoords]);

  const copyCode = async () => {
    if (lobby?.code) {
      const success = await copyToClipboard(lobby.code);
      if (success) {
        toast.success('Code copied!');
      } else {
        toast.error('Failed to copy code');
      }
    }
  };

  const leaveLobby = async () => {
    if (!userId || !lobbyId) return;

    try {
      await supabase
        .from('lobby_players')
        .delete()
        .eq('lobby_id', lobbyId)
        .eq('user_id', userId);

      toast.success('Left lobby');
      navigateBack('/home');
    } catch (error) {
      console.error('Error leaving lobby:', error);
      toast.error('Failed to leave lobby');
    }
  };

  const startGame = async (event?: React.MouseEvent<HTMLButtonElement>) => {
    if (!isHost || !lobbyId || !canStart) return;

    // Capture button position before async
    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      pendingTransitionRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }

    const hasAnyCategory = gameConfig.selectedCategories.length > 0 || gameConfig.selectedCustomCategories.length > 0;
    if (!hasAnyCategory) {
      toast.error('Please select at least one category');
      return;
    }

    setIsStarting(true);
    try {
      // Save game config to localStorage for persistence
      localStorage.setItem(`game-config-${lobbyId}`, JSON.stringify(gameConfig));

      // Get words from built-in categories
      let allWords: { id: string; text: string; category: string; isCustom?: boolean }[] = [];
      
      if (gameConfig.selectedCategories.length > 0) {
        const { data: words } = await supabase
          .from('words')
          .select('*')
          .in('category', gameConfig.selectedCategories as ('animal' | 'brand' | 'degenerate' | 'food' | 'movie' | 'person' | 'place' | 'thing')[]);
        
        if (words) {
          allWords = words.map(w => ({ ...w, isCustom: false }));
        }
      }
      
      // Add words from custom categories
      const selectedCustomCats = customCategories.filter(c => gameConfig.selectedCustomCategories.includes(c.id));
      for (const customCat of selectedCustomCats) {
        for (const word of customCat.words) {
          allWords.push({
            id: `custom-${customCat.id}-${word}`,
            text: word,
            category: customCat.name,
            isCustom: true,
          });
        }
      }
      
      if (allWords.length === 0) {
        toast.error('No words available for selected categories');
        setIsStarting(false);
        return;
      }

      const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
      
      // For custom words, we need to insert them into the database first or use an existing word
      let secretWordId = randomWord.id;
      let imposterWordId = null;
      
      if (randomWord.isCustom) {
        const { data: placeholderWord } = await supabase
          .from('words')
          .select('id')
          .limit(1)
          .single();
        
        if (placeholderWord) {
          secretWordId = placeholderWord.id;
        }
      }
      
      // For hidden_imposter mode, get a different word from the same category
      let imposterWordText: string | null = null;
      if (gameConfig.gameMode === 'hidden_imposter') {
        // Filter by both ID and text to ensure the imposter word is always different
        const sameCategory = allWords.filter(w => 
          w.category === randomWord.category && 
          w.id !== randomWord.id && 
          w.text.toLowerCase() !== randomWord.text.toLowerCase()
        );
        
        if (sameCategory.length > 0) {
          const imposterWord = sameCategory[Math.floor(Math.random() * sameCategory.length)];
          imposterWordText = imposterWord.text;
          if (!imposterWord.isCustom) {
            imposterWordId = imposterWord.id;
          }
        } else {
          // Fallback: pick from any different word (different text)
          const differentWords = allWords.filter(w => 
            w.id !== randomWord.id && 
            w.text.toLowerCase() !== randomWord.text.toLowerCase()
          );
          
          if (differentWords.length > 0) {
            const imposterWord = differentWords[Math.floor(Math.random() * differentWords.length)];
            imposterWordText = imposterWord.text;
            if (!imposterWord.isCustom) {
              imposterWordId = imposterWord.id;
            }
          }
        }
        
        // If no different word could be found, show error
        if (!imposterWordText || imposterWordText.toLowerCase() === randomWord.text.toLowerCase()) {
          toast.error('Need at least 2 different words for Hidden Outsider mode');
          setIsStarting(false);
          return;
        }
        
        // If imposterWordId is still null but we have a text, use placeholder
        if (imposterWordId === null && imposterWordText) {
          const { data: placeholderWord } = await supabase
            .from('words')
            .select('id')
            .limit(1)
            .single();
          if (placeholderWord) {
            imposterWordId = placeholderWord.id;
          }
        }
      }

      // Determine actual imposter count (random or selected)
      const actualImposterCount = gameConfig.randomImposters 
        ? Math.floor(Math.random() * maxImposters) + 1
        : gameConfig.imposterCount;

      // Pick random outsiders
      const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
      const selectedOutsiders = shuffledPlayers.slice(0, actualImposterCount);

      // Create game
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          lobby_id: lobbyId,
          secret_word_id: secretWordId,
          outsider_player_id: selectedOutsiders[0]?.id || players[0].id,
          imposter_word_id: imposterWordId,
          total_rounds: gameConfig.gameMode === 'elimination' ? 99 : gameConfig.roundCount,
          current_round_number: 1,
          status: 'clue_round',
          game_mode: gameConfig.gameMode
        })
        .select()
        .single();

      if (gameError) throw gameError;
      
      // Store custom word and modifiers in localStorage for this game
      // Always store metadata to capture game settings
      // Include full custom modifier data so non-hosts can see them
      const selectedCustomModifiers = customModifiers.filter(m => 
        gameConfig.selectedModifiers.includes(m.id)
      ).map(m => ({ id: m.id, label: m.label, description: m.description }));
      
      const gameMetadata = {
        customWord: randomWord.isCustom ? randomWord.text : null,
        customCategory: randomWord.isCustom ? randomWord.category : null,
        modifiers: gameConfig.selectedModifiers,
        customModifiersData: selectedCustomModifiers,
        imposterCustomWord: imposterWordText,
        showOutsiderCount: gameConfig.showOutsiderCount,
        votesPerPlayer: gameConfig.randomImposters ? players.length - 1 : gameConfig.votesPerPlayer,
        outsiderCount: selectedOutsiders.length,
        timedRoundDuration: gameConfig.timedRoundDuration,
      };
      
      localStorage.setItem(`game-metadata-${game.id}`, JSON.stringify(gameMetadata));

      // Insert all outsiders into game_outsiders table
      if (selectedOutsiders.length > 0) {
        const outsiderInserts = selectedOutsiders.map(outsider => ({
          game_id: game.id,
          player_id: outsider.id
        }));

        const { error: outsidersError } = await supabase
          .from('game_outsiders')
          .insert(outsiderInserts);

        if (outsidersError) throw outsidersError;
      }

      // Create first round
      const { error: roundError } = await supabase
        .from('rounds')
        .insert({
          game_id: game.id,
          round_number: 1,
          is_complete: false
        });

      if (roundError) throw roundError;

      // Update lobby
      const { error: lobbyError } = await supabase
        .from('lobbies')
        .update({
          status: 'in_progress',
          current_game_id: game.id
        })
        .eq('id', lobbyId);

      if (lobbyError) throw lobbyError;

      toast.success('Game started!');
    } catch (error) {
      console.error('Error starting game:', error);
      toast.error('Failed to start game');
      setIsStarting(false);
    }
  };

  if (!lobby) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-48" style={{ scrollbarGutter: 'stable' }}>
      <GameHeader title="Lobby" showBack={true} onBack={leaveLobby} />

      <main className="p-4 max-w-md mx-auto space-y-6 py-6">
        {/* Lobby Code Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <Card className="p-6 bg-gradient-primary text-white shadow-card border-0">
            <div className="text-center space-y-4">
              <div>
                <p className="text-white/80 text-sm mb-1">Lobby Code</p>
                <div className="flex items-center justify-center gap-3">
                  <h2 className="text-4xl font-bold font-mono tracking-wider">
                    {lobby.code}
                  </h2>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={copyCode}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-white/90 text-sm">
                Share this code with friends to join
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Players + Game Settings in same layout scope */}
        <LayoutGroup>
          {/* Players Section */}
          <motion.div
            layout
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="space-y-3"
          >
            <motion.div 
              className="flex items-center justify-between px-1"
              layout
            >
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Players ({players.length})
              </h3>
              <AnimatePresence mode="wait">
                {!canStart && (
                  <motion.p
                    key="need-more"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="text-xs text-muted-foreground"
                  >
                    Need {3 - players.length} more
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div 
              className="space-y-2" 
              layout
              variants={containerVariants}
              animate="animate"
            >
              <AnimatePresence initial={false} mode="popLayout">
                {players.map((player) => {
                  const avatarId = playerAvatars[player.user_id];
                  const avatar = avatarId ? getAvatarById(avatarId) : null;
                  
                  return (
                    <motion.div
                      key={player.id}
                      layout
                      initial={playerCardVariants.initial}
                      animate={playerCardVariants.animate}
                      exit={playerCardVariants.exit}
                      transition={{
                        duration: exitDuration,
                        ease: [0.2, 0.8, 0.2, 1] as const,
                        layout: { duration: animationDuration, ease: [0.2, 0.8, 0.2, 1] as const }
                      }}
                    >
                      <Card className="p-4 bg-gradient-card border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${avatar ? avatar.color : 'bg-primary/10'}`}>
                              {avatar ? avatar.emoji : <Users className="h-5 w-5 text-primary" />}
                            </div>
                            <div>
                              <p className="font-medium">{player.display_name}</p>
                              {player.is_host && (
                                <p className="text-xs text-primary flex items-center gap-1">
                                  <Crown className="h-3 w-3" />
                                  Host
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {player.is_connected ? (
                              <motion.div 
                                className="w-2 h-2 rounded-full bg-green-500"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2 }}
                              />
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-gray-400" />
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </motion.div>

          {/* Game Settings (Host Only) */}
          {isHost && (
            <motion.div
              layout
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.5, 
                delay: 0.2, 
                ease: [0.25, 0.46, 0.45, 0.94],
                layout: { duration: animationDuration, ease: [0.2, 0.8, 0.2, 1] as const }
              }}
            >
              <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                <CollapsibleTrigger asChild>
                  <Card className="p-4 bg-gradient-card border-border cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" />
                        <span className="font-medium">Game Settings</span>
                      </div>
                      <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </Card>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <GameConfigPanel
                    playerCount={Math.max(3, players.length)}
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
                  />
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          )}
        </LayoutGroup>

        {/* Start Game Button (Host Only) */}
        {isHost && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed bottom-6 left-0 right-0 px-4 max-w-md mx-auto space-y-3"
          >
            <AnimatePresence>
              {gameConfig.selectedModifiers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-card/90 backdrop-blur-sm rounded-lg p-2 text-center"
                >
                  <p className="text-xs text-muted-foreground">
                    Active: {getActiveModifierLabels(gameConfig.selectedModifiers, customModifiers).join(', ')}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            <Button
              onClick={(e) => startGame(e)}
              disabled={!canStart || isStarting || (gameConfig.selectedCategories.length === 0 && gameConfig.selectedCustomCategories.length === 0)}
              className="w-full h-14 text-lg shadow-lg"
              size="lg"
            >
              <Play className="h-5 w-5 mr-2" />
              {isStarting ? 'Starting...' : 'Start Game'}
            </Button>
            <AnimatePresence>
              {!canStart && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-sm text-muted-foreground"
                >
                  At least 3 players needed (4+ recommended)
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Lobby;
