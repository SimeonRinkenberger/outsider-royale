import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useGameState } from '@/hooks/useGameState';
import { useCustomContent } from '@/hooks/useCustomContent';
import { getStoredUserId } from '@/lib/gameUtils';
import { toast } from 'sonner';
import { RotateCcw, DoorOpen, Settings, ChevronDown, User } from 'lucide-react';
import judgeFoxImg from '@/assets/judge_fox.png';

import { GameConfigPanel, GameConfig, getActiveModifierLabels } from '@/components/GameConfigPanel';
import { GameMode } from '@/types/game';
import GameHeader from '@/components/GameHeader';
import { useAudio } from '@/contexts/AudioContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { motion } from 'framer-motion';
import { getAvatarById } from '@/components/AvatarPicker';
import { User as UserIcon } from 'lucide-react';
import { useTransition } from '@/contexts/TransitionContext';
import { getCachedResultsData } from '@/lib/gamePreloadCache';

const Results = () => {
  const { lobbyId } = useParams();
  const navigate = useNavigate();
  
  // Try to get preloaded data first for instant render
  const cachedResultsData = lobbyId ? getCachedResultsData(lobbyId) : null;
  
  const { lobby, players, game, votes, secretWord, outsiders } = useGameState(lobbyId || null);
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
  
  const [isResetting, setIsResetting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const userId = getStoredUserId();
  const { setMusicState } = useAudio();
  const { startTransition, isTransitioning, markRevealReady, awaitingRevealId } = useTransition();
  
  // Guard refs for idempotency
  const playAgainInFlightRef = useRef(false);
  const hasNavigatedToNewGameRef = useRef<string | null>(null);
  const hasAnimatedResultRef = useRef<string | null>(null);

  const isHost = lobby?.host_user_id === userId;
  const outsiderPlayers = players.filter(p => outsiders.some(o => o.player_id === p.id));
  const maxImposters = Math.max(1, players.length - 1);

  // Load previous game settings from localStorage
  useEffect(() => {
    if (game?.id && !settingsLoaded) {
      const stored = localStorage.getItem(`game-config-${lobbyId}`);
      if (stored) {
        try {
          const savedConfig = JSON.parse(stored);
          setGameConfig(prev => ({
            ...prev,
            ...savedConfig,
            // Keep imposterCount within valid bounds
            imposterCount: Math.min(savedConfig.imposterCount || 1, maxImposters || 1)
          }));
        } catch (e) {
          console.error('Failed to parse game config:', e);
        }
      } else if (game) {
        // Fallback: use game object values
        setGameConfig(prev => ({
          ...prev,
          gameMode: game.game_mode as GameMode,
          roundCount: game.total_rounds,
          imposterCount: outsiders.length || 1,
        }));
      }
      setSettingsLoaded(true);
    }
  }, [game?.id, lobbyId, settingsLoaded, maxImposters, game, outsiders.length]);

  // Listen for new game transition broadcast (non-host players)
  useEffect(() => {
    if (!lobbyId || isHost) return;

    const channel = supabase.channel(`new-game-transition-${lobbyId}`)
      .on('broadcast', { event: 'new-game-starting' }, (payload) => {
        console.log('[Results] Received new-game-starting broadcast');
        const newGameId = payload.payload?.newGameId;
        
        // Guard: don't navigate twice to the same game
        if (hasNavigatedToNewGameRef.current === newGameId) {
          console.log('[Results] Already navigating to this game, skipping');
          return;
        }
        
        if (newGameId) {
          hasNavigatedToNewGameRef.current = newGameId;
        }
        
        // Use centralized transition for non-host
        startTransition(`/game/${lobbyId}`, {
          loadingText: 'Starting new game',
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lobbyId, isHost, startTransition]);

  // Fallback: if lobby status changes to in_progress and we haven't navigated yet (for late joiners)
  useEffect(() => {
    if (!lobby?.current_game_id || !lobbyId) return;
    
    // Only trigger if lobby is in_progress and we have a current game
    if (lobby.status === 'in_progress') {
      // Guard: don't trigger if host (host handles via playAgain) or already navigating
      if (isHost || playAgainInFlightRef.current || isTransitioning) {
        return;
      }
      
      // Guard: don't navigate to the same game we just finished
      if (lobby.current_game_id === game?.id) {
        return;
      }
      
      // Guard: don't navigate twice
      if (hasNavigatedToNewGameRef.current === lobby.current_game_id) {
        return;
      }
      
      console.log('[Results] Lobby status changed to in_progress, navigating to game');
      hasNavigatedToNewGameRef.current = lobby.current_game_id;
      
      startTransition(`/game/${lobbyId}`, {
        loadingText: 'Starting new game',
      });
    }
  }, [lobby?.status, lobby?.current_game_id, lobbyId, isHost, game?.id, isTransitioning, startTransition]);

  // Load game metadata to check if outsider guessed correctly
  const [gameMetadata, setGameMetadata] = useState<{
    outsiderGuessedCorrectly?: boolean;
    outsiderGuesser?: string;
  } | null>(null);
  
  useEffect(() => {
    if (game?.id) {
      // Load from localStorage first
      const stored = localStorage.getItem(`game-metadata-${game.id}`);
      if (stored) {
        try {
          setGameMetadata(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse game metadata:', e);
        }
      }
      
      // Also listen for real-time metadata updates (in case outsider guessed and broadcast)
      const channel = supabase
        .channel(`game-metadata-${game.id}`)
        .on('broadcast', { event: 'metadata' }, (payload) => {
          if (payload.payload?.metadata) {
            console.log('Received metadata on results page:', payload.payload.metadata);
            setGameMetadata(payload.payload.metadata);
            // Also save to localStorage for persistence
            localStorage.setItem(`game-metadata-${game.id}`, JSON.stringify(payload.payload.metadata));
          }
        })
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [game?.id]);

  const outsiderGuessedCorrectly = gameMetadata?.outsiderGuessedCorrectly ?? false;
  
  // Use cached data if available for instant first paint - MOVED UP before win calculations
  const effectiveGame = game || cachedResultsData?.game;
  const effectiveSecretWord = secretWord || cachedResultsData?.secretWord;
  const effectivePlayers = players.length > 0 ? players : (cachedResultsData?.players || []);
  const effectiveOutsiders = outsiders.length > 0 ? outsiders : (cachedResultsData?.outsiders || []);
  const effectiveVotes = votes.length > 0 ? votes : (cachedResultsData?.votes || []);
  
  // Recalculate outsider players with effective data
  const effectiveOutsiderPlayers = effectivePlayers.filter(p => effectiveOutsiders.some(o => o.player_id === p.id));
  
  // Check loading with cached data fallback
  const isLoading = !effectiveGame || !effectiveSecretWord || effectiveOutsiderPlayers.length === 0 || effectiveVotes.length === 0;

  // Calculate vote results using effective data
  const votesByPlayer = effectivePlayers.map(player => {
    const votesReceived = effectiveVotes.filter(v => v.suspected_outsider_player_id === player.id).length;
    return { player, votesReceived };
  });

  // For elimination mode: check if all outsiders are spectators (group wins) or if outsiders have majority
  const isEliminationMode = effectiveGame?.game_mode === 'elimination';
  const activePlayers = effectivePlayers.filter(p => !p.is_spectator);
  const activeOutsiders = effectiveOutsiders.filter(o => activePlayers.some(p => p.id === o.player_id));
  
  // Outsider wins if they guessed correctly, otherwise check votes
  const outsiderWins = outsiderGuessedCorrectly || (
    isEliminationMode 
      ? activeOutsiders.length >= activePlayers.length / 2 // Outsiders have majority
      : effectiveVotes.filter(v => effectiveOutsiders.some(o => o.player_id === v.suspected_outsider_player_id)).length < effectivePlayers.length / 2
  );
  
  const groupWins = !outsiderWins;
  
  // Mark results as ready once we have votes (or if outsider guessed correctly)
  const resultsReady = outsiderGuessedCorrectly || effectiveVotes.length > 0;


  // Music state is no longer changed on win/lose - stays on game music

  // Update user stats when results are ready
  useEffect(() => {
    const updateUserStats = async () => {
      if (!resultsReady || !game?.id || !userId) return;
      
      // Check if we already updated stats for this game
      const statsUpdatedKey = `stats-updated-${game.id}`;
      if (localStorage.getItem(statsUpdatedKey)) return;
      
      // Get current auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // Guest users don't track stats
      
      // Find current player
      const currentPlayer = players.find(p => p.user_id === userId);
      if (!currentPlayer) return;
      
      // Determine if this player was an outsider
      const wasOutsider = outsiders.some(o => o.player_id === currentPlayer.id);
      
      // Calculate if this player won
      const playerWon = wasOutsider ? outsiderWins : groupWins;
      
      // Calculate if this player voted correctly (for safe players)
      const playerVote = votes.find(v => v.voter_player_id === currentPlayer.id);
      const votedCorrectly = playerVote && outsiders.some(o => o.player_id === playerVote.suspected_outsider_player_id);
      
      // Get clues submitted by this player in this game
      const { data: playerClues } = await supabase
        .from('clues')
        .select('id')
        .eq('player_id', currentPlayer.id);
      
      const cluesCount = playerClues?.length || 0;
      
      // Fetch current stats
      const { data: currentStats } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      if (!currentStats) {
        // Create stats if they don't exist
        await supabase.from('user_stats').insert({ user_id: session.user.id });
      }
      
      // Calculate new streak
      const newCurrentStreak = playerWon 
        ? (currentStats?.current_win_streak || 0) + 1 
        : 0;
      const newBestStreak = Math.max(newCurrentStreak, currentStats?.best_win_streak || 0);
      
      // Update stats
      const { error } = await supabase
        .from('user_stats')
        .update({
          games_played: (currentStats?.games_played || 0) + 1,
          games_played_as_outsider: (currentStats?.games_played_as_outsider || 0) + (wasOutsider ? 1 : 0),
          games_played_as_safe: (currentStats?.games_played_as_safe || 0) + (wasOutsider ? 0 : 1),
          games_won_as_outsider: (currentStats?.games_won_as_outsider || 0) + (wasOutsider && playerWon ? 1 : 0),
          games_won_as_safe: (currentStats?.games_won_as_safe || 0) + (!wasOutsider && playerWon ? 1 : 0),
          current_win_streak: newCurrentStreak,
          best_win_streak: newBestStreak,
          total_clues_submitted: (currentStats?.total_clues_submitted || 0) + cluesCount,
          total_votes_cast: (currentStats?.total_votes_cast || 0) + (playerVote ? 1 : 0),
          total_correct_votes: (currentStats?.total_correct_votes || 0) + (votedCorrectly ? 1 : 0),
        })
        .eq('user_id', session.user.id);
      
      if (!error) {
        localStorage.setItem(statsUpdatedKey, 'true');
        console.log('Stats updated successfully');
      } else {
        console.error('Failed to update stats:', error);
      }
    };
    
    updateUserStats();
  }, [resultsReady, game?.id, userId, players, outsiders, outsiderWins, groupWins, votes]);


  const playAgain = async () => {
    // Idempotency guard - prevent double execution
    if (playAgainInFlightRef.current) {
      console.log('[PlayAgain] Blocked: already in flight');
      return;
    }
    
    if (!isHost || !lobbyId) return;

    const hasAnyCategory = gameConfig.selectedCategories.length > 0 || gameConfig.selectedCustomCategories.length > 0;
    if (!hasAnyCategory) {
      toast.error('Please select at least one category');
      return;
    }

    console.log('[PlayAgain] Starting');
    playAgainInFlightRef.current = true;
    setIsResetting(true);
    
    // Use centralized transition - all game reset logic in prepare()
    startTransition(`/game/${lobbyId}`, {
      loadingText: 'Starting new game',
      prepare: async () => {
        console.log('[PlayAgain] Prepare: starting game creation');
        
        // Broadcast to other players that new game is starting
        const channel = supabase.channel(`new-game-transition-${lobbyId}`);
        
        try {
          // Reset all spectators back to active players for the new game
          const { error: resetError } = await supabase
            .from('lobby_players')
            .update({ is_spectator: false })
            .eq('lobby_id', lobbyId);

          if (resetError) {
            console.error('Error resetting spectators:', resetError);
          }

          // Save game config to localStorage for persistence
          localStorage.setItem(`game-config-${lobbyId}`, JSON.stringify(gameConfig));

          // Build words from custom categories first (these are client-side)
          let allCustomWords: { id: string; text: string; category: string; isCustom: boolean }[] = [];
          
          // Add words from custom categories
          const selectedCustomCats = customCategories.filter(c => gameConfig.selectedCustomCategories.includes(c.id));
          for (const customCat of selectedCustomCats) {
            for (const word of customCat.words) {
              allCustomWords.push({
                id: `custom-${customCat.id}-${word}`,
                text: word,
                category: customCat.name,
                isCustom: true,
              });
            }
          }
          
          // Use RPC for server-side random word selection from built-in categories
          let selectedWord: { id: string; text: string; category: string; isCustom: boolean } | null = null;
          
          if (gameConfig.selectedCategories.length > 0 && allCustomWords.length === 0) {
            // Only built-in categories - use RPC to get one random word
            const { data: rpcWords, error: rpcError } = await supabase
              .rpc('get_random_words_from_categories', {
                p_categories: gameConfig.selectedCategories,
                p_count: 1
              });
            
            if (rpcError || !rpcWords?.length) {
              throw new Error('No words available for selected categories');
            }
            selectedWord = { ...rpcWords[0], isCustom: false };
          } else if (gameConfig.selectedCategories.length > 0 && allCustomWords.length > 0) {
            // Mix of built-in and custom - decide randomly which pool to use
            const useBuiltIn = Math.random() < 0.5;
            if (useBuiltIn) {
              const { data: rpcWords } = await supabase
                .rpc('get_random_words_from_categories', {
                  p_categories: gameConfig.selectedCategories,
                  p_count: 1
                });
              if (rpcWords?.length) {
                selectedWord = { ...rpcWords[0], isCustom: false };
              }
            }
          }
          
          // If no word selected yet (custom only or mixed chose custom), pick from custom words
          if (!selectedWord) {
            if (allCustomWords.length === 0) {
              throw new Error('No words available for selected categories');
            }
            selectedWord = allCustomWords[Math.floor(Math.random() * allCustomWords.length)];
          }

          const randomWord = selectedWord;

          // Get fresh player list after resetting spectators
          const { data: freshPlayers } = await supabase
            .from('lobby_players')
            .select('*')
            .eq('lobby_id', lobbyId);

          if (!freshPlayers || freshPlayers.length === 0) {
            throw new Error('No players in lobby');
          }

          // For custom words, we need to use a placeholder
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
          
          // For hidden_imposter mode, get a different word using RPC
          let imposterWordText: string | null = null;
          if (gameConfig.gameMode === 'hidden_imposter') {
            // Use RPC if not custom word
            if (!randomWord.isCustom) {
              const { data: imposterRpcWords } = await supabase
                .rpc('get_imposter_word', {
                  p_secret_word_id: randomWord.id,
                  p_categories: gameConfig.selectedCategories
                });
              
              if (imposterRpcWords?.length) {
                imposterWordId = imposterRpcWords[0].id;
                imposterWordText = imposterRpcWords[0].text;
              }
            }
            
            // If still no imposter word, try custom categories
            if (!imposterWordText) {
              const sameCategory = allCustomWords.filter(w => 
                w.category === randomWord.category && 
                w.id !== randomWord.id && 
                w.text.toLowerCase() !== randomWord.text.toLowerCase()
              );
              
              if (sameCategory.length > 0) {
                const imposterWord = sameCategory[Math.floor(Math.random() * sameCategory.length)];
                imposterWordText = imposterWord.text;
              } else {
                // Fallback: pick from any different word
                const differentWords = allCustomWords.filter(w => 
                  w.id !== randomWord.id && 
                  w.text.toLowerCase() !== randomWord.text.toLowerCase()
                );
                
                if (differentWords.length > 0) {
                  const imposterWord = differentWords[Math.floor(Math.random() * differentWords.length)];
                  imposterWordText = imposterWord.text;
                }
              }
            }
          }

          // Determine actual imposter count (random or selected)
          const actualImposterCount = gameConfig.randomImposters 
            ? Math.floor(Math.random() * maxImposters) + 1
            : gameConfig.imposterCount;

          // Pick random outsiders from fresh player list
          const shuffledPlayers = [...freshPlayers].sort(() => Math.random() - 0.5);
          const selectedOutsiders = shuffledPlayers.slice(0, actualImposterCount);

          // Create new game
          const { data: newGame, error: gameError } = await supabase
            .from('games')
            .insert({
              lobby_id: lobbyId,
              secret_word_id: secretWordId,
              outsider_player_id: selectedOutsiders[0]?.id || freshPlayers[0].id,
              imposter_word_id: imposterWordId,
              total_rounds: gameConfig.gameMode === 'elimination' ? 99 : gameConfig.roundCount,
              current_round_number: 1,
              status: 'clue_round',
              game_mode: gameConfig.gameMode
            })
            .select()
            .single();

          if (gameError) throw gameError;
          
          console.log('[PlayAgain] New game created:', newGame.id);

          // Store custom word and modifiers in localStorage for this game
          const selectedCustomModifiers = customModifiers.filter(m => 
            gameConfig.selectedModifiers.includes(m.id)
          ).map(m => ({ id: m.id, label: m.label, description: m.description }));
          
          // Use the imposter word text we already calculated above
          const imposterCustomWord = imposterWordText;
          
          const gameMetadata = {
            customWord: randomWord.isCustom ? randomWord.text : null,
            customCategory: randomWord.isCustom ? randomWord.category : null,
            modifiers: gameConfig.selectedModifiers,
            customModifiersData: selectedCustomModifiers,
            imposterCustomWord,
            showOutsiderCount: gameConfig.showOutsiderCount,
            votesPerPlayer: gameConfig.randomImposters ? players.length - 1 : gameConfig.votesPerPlayer,
            outsiderCount: selectedOutsiders.length,
            timedRoundDuration: gameConfig.timedRoundDuration,
          };
          
          localStorage.setItem(`game-metadata-${newGame.id}`, JSON.stringify(gameMetadata));

          // Insert all outsiders into game_outsiders table
          if (selectedOutsiders.length > 0) {
            const outsiderInserts = selectedOutsiders.map(outsider => ({
              game_id: newGame.id,
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
              game_id: newGame.id,
              round_number: 1,
              is_complete: false
            });

          if (roundError) throw roundError;

          // Update lobby
          const { error: lobbyError } = await supabase
            .from('lobbies')
            .update({
              status: 'in_progress',
              current_game_id: newGame.id
            })
            .eq('id', lobbyId);

          if (lobbyError) throw lobbyError;
          
          // Broadcast to other players with the new game ID
          await new Promise<void>((resolve) => {
            channel.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                channel.send({
                  type: 'broadcast',
                  event: 'new-game-starting',
                  payload: { newGameId: newGame.id }
                });
                resolve();
              }
            });
            // Timeout fallback
            setTimeout(resolve, 500);
          });

          console.log('[PlayAgain] All setup complete, navigating');
          toast.success('New game started!');
          
        } catch (error) {
          console.error('[PlayAgain] Error:', error);
          toast.error('Failed to start new game');
          playAgainInFlightRef.current = false;
          setIsResetting(false);
          throw error; // Re-throw to let transition handle it
        } finally {
          supabase.removeChannel(channel);
        }
      }
    });
  };

  const goHome = async () => {
    if (!userId || !lobbyId) return;

    try {
      await supabase
        .from('lobby_players')
        .delete()
        .eq('lobby_id', lobbyId)
        .eq('user_id', userId);

      navigate('/home');
    } catch (error) {
      console.error('Error leaving lobby:', error);
      toast.error('Failed to leave lobby');
    }
  };


  const hasData = !isLoading;

  // Mark reveal ready when we have data and can paint AND awaiting reveal
  const hasMarkedRevealRef = useRef(false);
  useLayoutEffect(() => {
    if (hasData && awaitingRevealId && !hasMarkedRevealRef.current) {
      hasMarkedRevealRef.current = true;
      markRevealReady(awaitingRevealId);
    }
  }, [hasData, awaitingRevealId, markRevealReady]);

  // Reset refs when game changes
  useEffect(() => {
    if (effectiveGame?.id) {
      hasMarkedRevealRef.current = false;
    }
  }, [effectiveGame?.id]);

  // CRITICAL: Don't show placeholder during transitions - let the overlay handle loading
  if (isLoading && !isTransitioning) {
    // Render inline skeleton within page shell - NOT a separate loading screen
    return (
      <div className="min-h-screen bg-background pb-24">
        <GameHeader 
          title="Game Results" 
          showBack={false} 
        />
        <main className="p-4 max-w-md mx-auto space-y-6 py-6">
          {/* Result card skeleton */}
          <Card className="p-6 shadow-card border-0 animate-pulse">
            <div className="h-36 w-36 bg-muted rounded-full mx-auto mb-3"></div>
            <div className="h-8 w-40 bg-muted rounded mx-auto mb-2"></div>
            <div className="h-4 w-56 bg-muted rounded mx-auto"></div>
          </Card>
          
          {/* Word reveal skeleton */}
          <Card className="p-4 shadow-card border-0 animate-pulse">
            <div className="h-4 w-24 bg-muted rounded mx-auto mb-2"></div>
            <div className="h-6 w-32 bg-muted rounded mx-auto"></div>
          </Card>
          
          {/* Vote breakdown skeleton */}
          <div className="space-y-3">
            <div className="h-5 w-32 bg-muted rounded animate-pulse"></div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card animate-pulse">
                <div className="h-10 w-10 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 w-24 bg-muted rounded mb-1"></div>
                  <div className="h-3 w-16 bg-muted rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }


  return (
    <>
      <div className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] overflow-x-hidden">
      
      <GameHeader 
        title="Game Results"
        showBack={false} 
        rightContent={
          <Button variant="ghost" size="sm" onClick={goHome} className="gap-1 text-muted-foreground">
            <DoorOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Leave</span>
          </Button>
        }
      />

      <main className="p-4 max-w-md mx-auto space-y-6 py-6">
        {(() => {
          const gameId = effectiveGame?.id ?? 'unknown';
          const shouldAnimate = hasAnimatedResultRef.current !== gameId;
          if (shouldAnimate) {
            hasAnimatedResultRef.current = gameId;
          }
          return (
            <div className="flex items-center gap-3 sm:gap-4 bg-card/80 backdrop-blur-sm border border-border rounded-xl p-3 sm:p-4 shadow-lg overflow-hidden">
              <motion.div
                initial={shouldAnimate ? { scale: 0, rotate: -180 } : false}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                className="flex-shrink-0"
              >
                <img src={judgeFoxImg} alt="Results" className="h-24 w-24 sm:h-32 sm:w-32 object-contain" />
              </motion.div>
              <div className="flex-1 space-y-2">
                <motion.div
                  initial={shouldAnimate ? { opacity: 0, y: -5 } : false}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                    The Secret Word Was
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-primary break-words">
                    {effectiveSecretWord?.text ?? 'Unknown'}
                  </p>
                  {effectiveSecretWord?.category && (
                    <p className="text-xs text-muted-foreground capitalize">
                      Category: {effectiveSecretWord.category}
                    </p>
                  )}
                </motion.div>
                <motion.div
                  initial={shouldAnimate ? { opacity: 0, y: 5 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="flex items-center gap-2 pt-1 border-t border-border/50"
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    {outsiderPlayers.length > 1 ? 'Outsiders' : 'Outsider'}:
                  </span>
                  <div className="flex flex-wrap gap-1 max-w-full">
                    {outsiderPlayers.map(p => (
                      <span key={p.id} className="text-xs font-semibold text-white bg-destructive px-2 py-0.5 rounded-full truncate max-w-[120px] sm:max-w-none">
                        {p.display_name}
                      </span>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          );
        })()}

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">
            Vote Results
          </h3>
          <div className="space-y-2">
            {votesByPlayer
              .sort((a, b) => b.votesReceived - a.votesReceived)
              .map(({ player, votesReceived }) => {
                const avatar = player.avatar_url ? getAvatarById(player.avatar_url) : null;
                // Get who voted for this player
                const votersForPlayer = effectiveVotes
                  .filter(v => v.suspected_outsider_player_id === player.id)
                  .map(v => effectivePlayers.find(p => p.id === v.voter_player_id))
                  .filter(Boolean);
                
                // If no votes, just render a simple card without collapsible
                if (votersForPlayer.length === 0) {
                  return (
                    <Card key={player.id} className="bg-gradient-card border-border">
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${avatar ? avatar.color : 'bg-muted'}`}>
                            {avatar ? avatar.emoji : <User className="h-4 w-4 text-muted-foreground" />}
                          </div>
                          <span className="font-medium">{player.display_name}</span>
                          {outsiders.some(o => o.player_id === player.id) && (
                            <span className="text-xs bg-destructive text-white px-2 py-1 rounded-full">
                              Outsider
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-right text-muted-foreground">
                          0 votes
                        </div>
                      </div>
                    </Card>
                  );
                }

                return (
                  <Collapsible key={player.id}>
                    <Card className="bg-gradient-card border-border overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${avatar ? avatar.color : 'bg-muted'}`}>
                              {avatar ? avatar.emoji : <User className="h-4 w-4 text-muted-foreground" />}
                            </div>
                            <span className="font-medium">{player.display_name}</span>
                            {outsiders.some(o => o.player_id === player.id) && (
                              <span className="text-xs bg-destructive text-white px-2 py-1 rounded-full">
                                Outsider
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-right">
                              <span className="font-bold text-primary">{votesReceived}</span>
                              <span className="text-muted-foreground"> vote{votesReceived !== 1 ? 's' : ''}</span>
                            </div>
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2 }}
                          className="px-4 pb-4 pt-0"
                        >
                          <div className="pt-2 border-t border-border/50">
                            <p className="text-xs text-muted-foreground mb-2">Voted by:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {votersForPlayer.map((voter, i) => {
                                const voterAvatar = voter?.avatar_url ? getAvatarById(voter.avatar_url) : null;
                                return (
                                  <motion.span 
                                    key={voter?.id}
                                    initial={{ opacity: 0, scale: 0.8, y: -5 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{ delay: i * 0.05, duration: 0.2 }}
                                    className="inline-flex items-center gap-1.5 text-xs bg-muted px-2.5 py-1 rounded-full"
                                  >
                                    {voterAvatar && (
                                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${voterAvatar.color}`}>
                                        {voterAvatar.emoji}
                                      </span>
                                    )}
                                    {voter?.display_name}
                                  </motion.span>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
          </div>
        </div>

        {/* Game Settings for Next Game (Host Only) */}
        {isHost && (
          <Collapsible open={showSettings} onOpenChange={setShowSettings}>
            <CollapsibleTrigger asChild>
              <Card className="p-4 bg-gradient-card border-border cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className={`h-5 w-5 text-primary transition-transform duration-300 ${showSettings ? 'rotate-180' : ''}`} />
                    <span className="font-medium">Next Game Settings</span>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${showSettings ? 'rotate-180' : ''}`} />
                </div>
              </Card>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <GameConfigPanel
                playerCount={players.length}
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
        )}

        <div className="space-y-3 pt-4">
          {isHost && (
            <>
              {gameConfig.selectedModifiers.length > 0 && (
                <div className="bg-card/90 backdrop-blur-sm rounded-lg p-2 text-center">
                  <p className="text-xs text-muted-foreground">
                    Active: {getActiveModifierLabels(gameConfig.selectedModifiers, customModifiers).join(', ')}
                  </p>
                </div>
              )}
              <Button
                onClick={playAgain}
                disabled={isResetting || (gameConfig.selectedCategories.length === 0 && gameConfig.selectedCustomCategories.length === 0)}
                className="w-full h-14 text-lg"
                size="lg"
              >
                <RotateCcw className="h-5 w-5 mr-2" />
                {isResetting ? 'Starting...' : 'Play Again'}
              </Button>
            </>
          )}
          <Button
            onClick={goHome}
            variant="outline"
            className="w-full h-12 text-base"
          >
            <DoorOpen className="h-5 w-5 mr-2" />
            Leave Lobby
          </Button>
        </div>
      </main>
    </div>
    </>
  );
};

export default Results;
