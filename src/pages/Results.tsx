import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useGameState } from '@/hooks/useGameState';
import { useCustomContent } from '@/hooks/useCustomContent';
import { getStoredUserId } from '@/lib/gameUtils';
import { toast } from 'sonner';
import { Trophy, XCircle, RotateCcw, DoorOpen, Settings, ChevronDown, User } from 'lucide-react';
import cryingFoxImg from '@/assets/crying_fox.png';
import happyFoxImg from '@/assets/happy_fox.png';
import Confetti from '@/components/Confetti';
import { GameConfigPanel, GameConfig, getActiveModifierLabels } from '@/components/GameConfigPanel';
import { GameMode } from '@/types/game';
import GameHeader from '@/components/GameHeader';
import { useAudio } from '@/contexts/AudioContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { motion } from 'framer-motion';
import { getAvatarById } from '@/components/AvatarPicker';
import { User as UserIcon } from 'lucide-react';
import { useTransition } from '@/contexts/TransitionContext';
import { DebugLoader } from '@/components/DebugLoader';

const Results = () => {
  const { lobbyId } = useParams();
  const navigate = useNavigate();
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
  const [showConfetti, setShowConfetti] = useState(false);
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
  
  // Track if results have been calculated (need votes to be loaded)
  const [resultsReady, setResultsReady] = useState(false);
  
  // Calculate vote results
  const votesByPlayer = players.map(player => {
    const votesReceived = votes.filter(v => v.suspected_outsider_player_id === player.id).length;
    return { player, votesReceived };
  });

  // For elimination mode: check if all outsiders are spectators (group wins) or if outsiders have majority
  const isEliminationMode = game?.game_mode === 'elimination';
  const activePlayers = players.filter(p => !p.is_spectator);
  const activeOutsiders = outsiders.filter(o => activePlayers.some(p => p.id === o.player_id));
  
  // Outsider wins if they guessed correctly, otherwise check votes
  const outsiderWins = outsiderGuessedCorrectly || (
    isEliminationMode 
      ? activeOutsiders.length >= activePlayers.length / 2 // Outsiders have majority
      : votes.filter(v => outsiders.some(o => o.player_id === v.suspected_outsider_player_id)).length < players.length / 2
  );
  
  const groupWins = !outsiderWins;

  // Mark results as ready once we have votes (or if outsider guessed correctly)
  useEffect(() => {
    if (outsiderGuessedCorrectly || votes.length > 0) {
      setResultsReady(true);
    }
  }, [outsiderGuessedCorrectly, votes.length]);

  useEffect(() => {
    if (resultsReady) {
      setMusicState(groupWins ? 'win_safe' : 'win_outsider');
    }
  }, [resultsReady, groupWins, setMusicState]);

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

  // Trigger confetti on group win - must be before early return
  useEffect(() => {
    if (resultsReady && groupWins && game && secretWord) {
      setShowConfetti(true);
    }
  }, [resultsReady, groupWins, game, secretWord]);

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
            throw new Error('No words available for selected categories');
          }

          const randomWord = allWords[Math.floor(Math.random() * allWords.length)];

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
          
          // For hidden_imposter mode, get a different word from the same category
          if (gameConfig.gameMode === 'hidden_imposter') {
            const sameCategory = allWords.filter(w => w.category === randomWord.category && w.id !== randomWord.id);
            if (sameCategory.length > 0) {
              const imposterWord = sameCategory[Math.floor(Math.random() * sameCategory.length)];
              if (!imposterWord.isCustom) {
                imposterWordId = imposterWord.id;
              }
            } else {
              const differentWords = allWords.filter(w => w.id !== randomWord.id && !w.isCustom);
              if (differentWords.length > 0) {
                imposterWordId = differentWords[Math.floor(Math.random() * differentWords.length)].id;
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
          
          let imposterCustomWord: string | null = null;
          if (gameConfig.gameMode === 'hidden_imposter' && randomWord.isCustom) {
            const sameCategory = allWords.filter(w => w.category === randomWord.category && w.id !== randomWord.id);
            if (sameCategory.length > 0) {
              const imposterWord = sameCategory[Math.floor(Math.random() * sameCategory.length)];
              if (imposterWord.isCustom) {
                imposterCustomWord = imposterWord.text;
              }
            }
          }
          
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


  const isLoading = !game || !secretWord || outsiderPlayers.length === 0 || !resultsReady;
  const hasData = !isLoading;

  // Mark reveal ready when we have data and can paint AND awaiting reveal - use useLayoutEffect for immediate notification
  const hasMarkedRevealRef = useRef(false);
  useLayoutEffect(() => {
    if (hasData && awaitingRevealId && !hasMarkedRevealRef.current) {
      hasMarkedRevealRef.current = true;
      console.log(`[RESULTS] useLayoutEffect: hasData=true, calling markRevealReady(${awaitingRevealId})`);
      markRevealReady(awaitingRevealId);
    }
  }, [hasData, awaitingRevealId, markRevealReady]);

  // Reset reveal marker when game changes
  useEffect(() => {
    if (game?.id) {
      hasMarkedRevealRef.current = false;
    }
  }, [game?.id]);

  // Log render state
  console.log('[RESULTS] render hasData=', hasData, 'isTransitioning=', isTransitioning);

  // NEVER return null - always render something
  // If loading, show lightweight placeholder (overlay will cover during transition)
  if (isLoading) {
    console.log('[RESULTS PLACEHOLDER] rendered - data not ready');
    return (
      <DebugLoader name="RESULTS_PLACEHOLDER" filePath="src/pages/Results.tsx">
        <div className="min-h-screen bg-background flex items-center justify-center relative">
          <span className="absolute top-2 left-2 text-[10px] text-muted-foreground/50 font-mono">RESULTS PLACEHOLDER</span>
          <div className="text-center space-y-4">
            <div className="animate-pulse">
              <div className="h-8 w-48 bg-muted rounded mx-auto mb-4"></div>
              <div className="h-4 w-32 bg-muted rounded mx-auto"></div>
            </div>
            <p className="text-muted-foreground">Preparing results...</p>
          </div>
        </div>
      </DebugLoader>
    );
  }

  console.log('[RESULTS] rendering full content');

  return (
    <>
      <div className="min-h-screen bg-background pb-24">
      <Confetti isActive={showConfetti} />
      
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
        {/* Only animate on first render for this game */}
        {(() => {
          const shouldAnimate = hasAnimatedResultRef.current !== game.id;
          if (shouldAnimate) {
            hasAnimatedResultRef.current = game.id;
          }
          return (
            <Card 
              key={game.id}
              className={`p-6 shadow-card border-0 text-center ${shouldAnimate ? 'animate-bounce-in' : ''} ${
                groupWins ? 'bg-primary/15 border border-primary/30' : 'bg-destructive/10 border-destructive/20'
              }`}
            >
              {groupWins ? (
                <>
                  <img 
                    src={cryingFoxImg} 
                    alt="Fox mascot" 
                    className={`h-36 w-36 mx-auto mb-3 object-contain ${shouldAnimate ? 'animate-float' : ''}`} 
                  />
                  <h2 className="text-2xl font-bold mb-2 text-primary">Group Wins!</h2>
                  <p className="text-muted-foreground">
                    You found the outsider! Great job detectives!
                  </p>
                </>
              ) : (
                <>
                  <img 
                    src={happyFoxImg} 
                    alt="Happy fox mascot" 
                    className={`h-36 w-36 mx-auto mb-3 object-contain ${shouldAnimate ? 'animate-float' : ''}`} 
                  />
                  <h2 className="text-2xl font-bold text-destructive mb-2">Outsider Wins!</h2>
                  <p className="text-muted-foreground">
                    {outsiderGuessedCorrectly 
                      ? `${gameMetadata?.outsiderGuesser || 'The outsider'} guessed the word correctly!`
                      : 'The outsider fooled everyone!'}
                  </p>
                </>
              )}
            </Card>
          );
        })()}

        <Card className="p-6 bg-gradient-card border-border">
          <div className="text-center mb-4">
            <p className="text-sm text-muted-foreground mb-1">The secret word was</p>
            <h3 className="text-3xl font-bold text-primary">{secretWord.text}</h3>
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-sm text-muted-foreground mb-1">
              {outsiderPlayers.length > 1 ? 'The outsiders were' : 'The outsider was'}
            </p>
            <h4 className="text-xl font-bold">
              {outsiderPlayers.map(p => p.display_name).join(', ')}
            </h4>
          </div>
        </Card>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">
            Vote Results
          </h3>
          <div className="space-y-2">
            {votesByPlayer
              .sort((a, b) => b.votesReceived - a.votesReceived)
              .map(({ player, votesReceived }) => {
                const avatar = player.avatar_url ? getAvatarById(player.avatar_url) : null;
                
                return (
                  <Card key={player.id} className="p-4 bg-gradient-card border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${avatar ? avatar.color : 'bg-muted'}`}>
                          {avatar ? avatar.emoji : <User className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <span className="font-medium">{player.display_name}</span>
                        {outsiders.some(o => o.player_id === player.id) && (
                          <span className="text-xs bg-destructive/20 text-destructive px-2 py-1 rounded-full">
                            Outsider
                          </span>
                        )}
                        {player.is_host && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                            Host
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm">
                          <span className="font-bold text-primary">{votesReceived}</span>
                          <span className="text-muted-foreground"> votes</span>
                        </div>
                      </div>
                    </div>
                  </Card>
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
