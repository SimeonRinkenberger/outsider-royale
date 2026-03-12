import { useEffect, useState, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useGameState } from '@/hooks/useGameState';
import { useCustomContent } from '@/hooks/useCustomContent';
import { getStoredUserId } from '@/lib/gameUtils';
import { toast } from 'sonner';
import { Send, Eye, EyeOff, Users, CheckCircle2, DoorOpen, FastForward, ArrowRight, Lightbulb, User, Check } from 'lucide-react';
import { ActiveModifiersDisplay } from '@/components/ActiveModifiersDisplay';
import { MusicControls } from '@/components/MusicControls';
import { SpeedRoundTimer } from '@/components/SpeedRoundTimer';
import { getAvatarById } from '@/components/AvatarPicker';
import { useAudio } from '@/contexts/AudioContext';
import { useTransition } from '@/contexts/TransitionContext';
import { motion, AnimatePresence } from 'framer-motion';
import { getCachedGameData, preloadResultsData } from '@/lib/gamePreloadCache';
import { KickPlayerDialog } from '@/components/KickPlayerDialog';
interface CustomModifierData {
  id: string;
  label: string;
  description: string;
}
interface GameMetadata {
  customWord: string | null;
  customCategory: string | null;
  modifiers: string[];
  customModifiersData?: CustomModifierData[]; // Full custom modifier data for non-hosts
  imposterCustomWord: string | null;
  showOutsiderCount?: boolean;
  votesPerPlayer?: number;
  outsiderCount?: number;
  timedRoundDuration?: number;
}

// Seeded random shuffle - ensures all clients get the same order for a given seed
const seededShuffle = <T,>(array: T[], seed: string): T[] => {
  const shuffled = [...array];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  for (let i = shuffled.length - 1; i > 0; i--) {
    hash = (hash << 5) - hash + i;
    hash |= 0;
    const j = Math.abs(hash) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Get shuffled players for a game (same order all rounds)
const getShuffledPlayersForGame = <T,>(players: T[], gameId: string): T[] => {
  return seededShuffle(players, gameId);
};
const Game = () => {
  const {
    lobbyId
  } = useParams();
  const navigate = useNavigate();
  const {
    startTransition,
    markRevealReady,
    isTransitioning,
    awaitingRevealId
  } = useTransition();

  // Try to get preloaded data first for instant render
  const cachedGameData = lobbyId ? getCachedGameData(lobbyId) : null;
  const {
    lobby,
    players,
    game,
    currentRound,
    clues,
    allClues,
    votes,
    secretWord,
    imposterWord,
    outsiders
  } = useGameState(lobbyId || null);
  const [clueInput, setClueInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedVotes, setSelectedVotes] = useState<string[]>([]);
  const [skipVote, setSkipVote] = useState(false);
  const [votesSubmitted, setVotesSubmitted] = useState(false);
  const [gameMetadata, setGameMetadata] = useState<GameMetadata | null>(null);
  const [guessInput, setGuessInput] = useState('');
  const [showGuessInput, setShowGuessInput] = useState(false);
  const [hasGuessed, setHasGuessed] = useState(false);
  // Ref to track if we've already navigated to results (for non-host players)
  const hasNavigatedToResultsRef = useRef(false);
  // Ref to track if host is currently moving to results (prevent double trigger)
  const moveToResultsInProgressRef = useRef(false);
  const {
    customModifiers
  } = useCustomContent();
  const userId = getStoredUserId();
  const {
    setMusicState
  } = useAudio();
  const votingAnimatedRef = useRef(false);

  // Track displayed status for exit/enter animations between game phases
  const [displayedStatus, setDisplayedStatus] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const prevStatusRef = useRef<string | null>(null);

  // Track round changes for fly-off/fly-on animations
  const prevRoundRef = useRef<number | null>(null);
  const [isRoundTransitioning, setIsRoundTransitioning] = useState(false);
  const roundAnimationKey = game?.current_round_number ?? 1;

  // Handle transitions between game statuses with exit animations
  useEffect(() => {
    if (!game?.status) return;

    // Initial load - set status immediately
    if (displayedStatus === null) {
      setDisplayedStatus(game.status);
      prevStatusRef.current = game.status;
      return;
    }

    // Status changed - trigger exit animation then update
    if (game.status !== prevStatusRef.current) {
      prevStatusRef.current = game.status;
      setIsExiting(true);
      // Wait for exit animation, then show new status
      const timer = setTimeout(() => {
        setDisplayedStatus(game.status);
        setIsExiting(false);
      }, 300); // Reduced for snappier transitions
      return () => clearTimeout(timer);
    }
  }, [game?.status]);

  // Track when we first enter voting to only animate once
  useEffect(() => {
    if (game?.status === 'voting') {
      // Allow initial animation, then mark as animated after they complete
      const timer = setTimeout(() => {
        votingAnimatedRef.current = true;
      }, 800);
      return () => clearTimeout(timer);
    } else {
      votingAnimatedRef.current = false;
    }
  }, [game?.status]);

  // Listen for skip transition broadcast (non-hosts react to status change via realtime subscription)

  // Detect round changes for smooth transitions
  useEffect(() => {
    if (game?.current_round_number && prevRoundRef.current !== null) {
      if (prevRoundRef.current !== game.current_round_number) {
        setIsRoundTransitioning(true);
        // Reset transition state after animations complete (match the animation duration)
        const timer = setTimeout(() => setIsRoundTransitioning(false), 500);
        return () => clearTimeout(timer);
      }
    }
    prevRoundRef.current = game?.current_round_number ?? null;
  }, [game?.current_round_number]);
  useEffect(() => {
    const isTimedRound = gameMetadata?.modifiers?.includes('timed-round') ?? false;
    setMusicState(isTimedRound ? 'game_timed' : 'game_standard');
  }, [gameMetadata?.modifiers, setMusicState]);

  // Load game metadata (modifiers, custom words) from localStorage
  useEffect(() => {
    if (game?.id) {
      const stored = localStorage.getItem(`game-metadata-${game.id}`);
      if (stored) {
        try {
          setGameMetadata(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse game metadata:', e);
        }
      }
    }
  }, [game?.id]);
  const leaveLobby = async () => {
    if (!userId || !lobbyId) return;
    try {
      await supabase.from('lobby_players').delete().eq('lobby_id', lobbyId).eq('user_id', userId);
      navigate('/home');
    } catch (error) {
      console.error('Error leaving lobby:', error);
      toast.error('Failed to leave lobby');
    }
  };

  // Filter out spectators for active players
  const activePlayers = useMemo(() => {
    return players.filter(p => !p.is_spectator);
  }, [players]);

  // Shuffle players based on game ID - same order for all rounds
  const shuffledPlayers = useMemo(() => {
    if (!game?.id || activePlayers.length === 0) return activePlayers;
    return getShuffledPlayersForGame(activePlayers, game.id);
  }, [game?.id, activePlayers]);
  const currentPlayer = players.find(p => p.user_id === userId);
  const isSpectator = currentPlayer?.is_spectator ?? false;
  const isHost = currentPlayer?.is_host ?? false;

  // Track previous spectator state to detect mid-game kicks
  const wasSpectatorRef = useRef(isSpectator);
  useEffect(() => {
    // If the player just became a spectator (was not spectator before), they were kicked
    if (isSpectator && !wasSpectatorRef.current && currentPlayer) {
      toast.error('You were removed from the game by the host');
      navigate('/home');
    }
    wasSpectatorRef.current = isSpectator;
  }, [isSpectator, currentPlayer, navigate]);

  // Also detect full removal from the player list (e.g. lobby kick during game)
  useEffect(() => {
    if (players.length > 0 && userId && !players.some(p => p.user_id === userId)) {
      toast.error('You were removed from the lobby by the host');
      navigate('/home');
    }
  }, [players, userId, navigate]);

  // Check if current player is an outsider (using outsiders array)
  const isOutsider = outsiders.some(o => o.player_id === currentPlayer?.id);
  // Check if player has submitted a clue for the CURRENT round only
  const hasSubmittedClue = clues.some(c => c.player_id === currentPlayer?.id && c.round_id === currentRound?.id);
  const hasVoted = votes.some(v => v.voter_player_id === currentPlayer?.id);

  // Host broadcasts metadata to all players, non-hosts listen for it
  useEffect(() => {
    if (!game?.id || !currentPlayer) return;
    const channel = supabase.channel(`game-metadata-${game.id}`);

    // Listen for metadata broadcast
    channel.on('broadcast', {
      event: 'metadata'
    }, payload => {
      if (payload.payload?.metadata) {
        if (import.meta.env.DEV) console.log('Received game metadata from host:', payload.payload.metadata);
        setGameMetadata(payload.payload.metadata);
      }
    });

    // Non-hosts request metadata when joining
    channel.on('broadcast', {
      event: 'request-metadata'
    }, () => {
      // Host responds to metadata requests
      if (currentPlayer.is_host && gameMetadata) {
        channel.send({
          type: 'broadcast',
          event: 'metadata',
          payload: {
            metadata: gameMetadata
          }
        });
      }
    });
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        // If host has metadata, broadcast it immediately
        if (currentPlayer.is_host && gameMetadata) {
          setTimeout(() => {
            channel.send({
              type: 'broadcast',
              event: 'metadata',
              payload: {
                metadata: gameMetadata
              }
            });
          }, 300);
        } else if (!currentPlayer.is_host) {
          // Non-hosts request metadata
          setTimeout(() => {
            channel.send({
              type: 'broadcast',
              event: 'request-metadata',
              payload: {}
            });
          }, 500);
        }
      }
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id, currentPlayer?.is_host, currentPlayer?.id, gameMetadata]);

  // Calculate whose turn it is based on clues submitted THIS ROUND (only active players)
  const currentTurnIndex = clues.length;
  const currentTurnPlayer = shuffledPlayers[currentTurnIndex];
  const isMyTurn = currentTurnPlayer?.id === currentPlayer?.id && !isSpectator;

  // Determine what word to show based on game mode
  const displayWord = useMemo(() => {
    if (!game || !secretWord) return null;
    if (game.game_mode === 'hidden_imposter') {
      // In hidden_imposter mode, everyone sees a word but imposters see a different word
      if (isOutsider) {
        // Prefer custom imposter word from metadata, fallback to DB imposter word
        if (gameMetadata?.imposterCustomWord) {
          return {
            ...secretWord,
            text: gameMetadata.imposterCustomWord
          };
        }
        return imposterWord || secretWord;
      }
      return secretWord;
    }

    // In classic and elimination modes, outsiders don't see the word
    return isOutsider ? null : secretWord;
  }, [game?.game_mode, secretWord, imposterWord, isOutsider, gameMetadata?.imposterCustomWord]);

  // Track if all clues are submitted for this round
  const allCluesSubmitted = clues.length === shuffledPlayers.length;
  const isLastRound = game?.game_mode === 'elimination' ? false : game?.current_round_number === game?.total_rounds;
  const isEliminationMode = game?.game_mode === 'elimination';
  const isHiddenImposterMode = game?.game_mode === 'hidden_imposter';

  // For elimination mode: check win conditions
  const outsiderCount = outsiders.length;
  const nonOutsiderCount = activePlayers.length - outsiders.filter(o => activePlayers.some(p => p.id === o.player_id)).length;
  const outsidersWinByMajority = outsiderCount >= activePlayers.length / 2;
  useEffect(() => {
    if (!game || !currentPlayer) return;

    // Only host handles vote results transition
    if (!currentPlayer.is_host) return;

    // Count unique voters (not total votes, since votesPerPlayer can be > 1)
    const uniqueVoters = new Set(votes.map(v => v.voter_player_id)).size;
    if (import.meta.env.DEV) console.log('Vote check:', {
      gameStatus: game.status,
      votesCount: votes.length,
      uniqueVoters,
      shuffledPlayersCount: shuffledPlayers.length,
      activePlayersCount: activePlayers.length,
      playersCount: players.length,
      isEliminationMode,
      isHost: currentPlayer.is_host
    });
    const timer = setTimeout(async () => {
      // Check if all votes submitted (for non-elimination modes)
      // Use unique voters count since votesPerPlayer can be > 1
      const nonSpectatorCount = players.filter(p => !p.is_spectator).length;
      if (!isEliminationMode && game.status === 'voting' && uniqueVoters === nonSpectatorCount) {
        if (import.meta.env.DEV) console.log('Moving to results - classic mode');
        moveToResults();
      }

      // For elimination mode: check if all active players voted (including skips)
      if (isEliminationMode && game.status === 'voting' && uniqueVoters === activePlayers.length) {
        if (import.meta.env.DEV) console.log('Processing elimination votes');
        await processEliminationVotes();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [votes.length, shuffledPlayers.length, activePlayers.length, players.length, game, currentPlayer, isEliminationMode]);
  const startNextRound = async () => {
    if (!currentRound || !game || !currentPlayer?.is_host) return;
    try {
      // Mark current round as complete
      await supabase.from('rounds').update({
        is_complete: true
      }).eq('id', currentRound.id);

      // For elimination mode, always go to voting after each round
      if (isEliminationMode) {
        await supabase.from('games').update({
          status: 'voting'
        }).eq('id', game.id);
        toast.success('Moving to voting!');
        return;
      }
      if (game.current_round_number < game.total_rounds) {
        const nextRound = game.current_round_number + 1;
        const {
          data: newRound
        } = await supabase.from('rounds').insert({
          game_id: game.id,
          round_number: nextRound,
          is_complete: false
        }).select().single();
        if (newRound) {
          await supabase.from('games').update({
            current_round_number: nextRound
          }).eq('id', game.id);
        }
        toast.success(`Round ${nextRound} started!`);
      } else {
        await supabase.from('games').update({
          status: 'voting'
        }).eq('id', game.id);
        toast.success('Moving to voting!');
      }
    } catch (error) {
      console.error('Error starting next round:', error);
      toast.error('Failed to start next round');
    }
  };
  const processEliminationVotes = async () => {
    if (!game || !currentPlayer?.is_host) return;

    // Count votes for each player (excluding skip votes - where voter voted for themselves)
    const voteCounts: Record<string, number> = {};
    votes.forEach(v => {
      // Skip votes are marked by voting for yourself
      if (v.suspected_outsider_player_id !== v.voter_player_id) {
        voteCounts[v.suspected_outsider_player_id] = (voteCounts[v.suspected_outsider_player_id] || 0) + 1;
      }
    });

    // Find player with most votes (if they have majority)
    const majorityThreshold = Math.ceil(activePlayers.length / 2);
    let eliminatedPlayerId: string | null = null;
    Object.entries(voteCounts).forEach(([playerId, count]) => {
      if (count >= majorityThreshold) {
        eliminatedPlayerId = playerId;
      }
    });
    if (eliminatedPlayerId) {
      // Eliminate this player (make them spectator)
      await supabase.from('lobby_players').update({
        is_spectator: true
      }).eq('id', eliminatedPlayerId);
      const eliminatedPlayer = players.find(p => p.id === eliminatedPlayerId);
      toast.success(`${eliminatedPlayer?.display_name} has been eliminated!`);

      // Check if outsider was eliminated or if game should end
      const wasOutsider = outsiders.some(o => o.player_id === eliminatedPlayerId);
      const remainingActivePlayers = activePlayers.filter(p => p.id !== eliminatedPlayerId);
      const remainingOutsiders = outsiders.filter(o => remainingActivePlayers.some(p => p.id === o.player_id));

      // Check end conditions
      if (remainingOutsiders.length === 0) {
        // All outsiders eliminated - group wins
        await supabase.from('games').update({
          status: 'results'
        }).eq('id', game.id);
        await supabase.from('lobbies').update({
          status: 'results'
        }).eq('id', lobbyId);
        return;
      }
      if (remainingOutsiders.length >= remainingActivePlayers.length / 2) {
        // Outsiders have majority - outsiders win
        await supabase.from('games').update({
          status: 'results'
        }).eq('id', game.id);
        await supabase.from('lobbies').update({
          status: 'results'
        }).eq('id', lobbyId);
        return;
      }
    }

    // Continue to next round - clear votes and start new round
    await supabase.from('votes').delete().eq('game_id', game.id);
    const nextRound = game.current_round_number + 1;
    const {
      data: newRound
    } = await supabase.from('rounds').insert({
      game_id: game.id,
      round_number: nextRound,
      is_complete: false
    }).select().single();
    if (newRound) {
      await supabase.from('games').update({
        current_round_number: nextRound,
        status: 'clue_round'
      }).eq('id', game.id);
    }
    setSelectedVotes([]);
    setSkipVote(false);
    setVotesSubmitted(false);
    toast.success(`Round ${nextRound} started!`);
  };
  const moveToResults = async () => {
    if (!game || !lobbyId) return;

    // Guard: prevent double trigger
    if (moveToResultsInProgressRef.current || hasNavigatedToResultsRef.current) {
      if (import.meta.env.DEV) console.log('[Game] moveToResults blocked - already in progress');
      return;
    }
    moveToResultsInProgressRef.current = true;
    hasNavigatedToResultsRef.current = true;
    if (import.meta.env.DEV) console.log('[Game] Host initiating moveToResults with startTransition');

    // Use startTransition with prepare() - single atomic transition
    startTransition(`/results/${lobbyId}`, {
      loadingText: 'Tallying votes',
      reason: 'voting-complete',
      prepare: async () => {
        await supabase.from('games').update({
          status: 'results'
        }).eq('id', game.id);
        await supabase.from('lobbies').update({
          status: 'results'
        }).eq('id', lobbyId);
        await preloadResultsData(lobbyId!, game.id);
      }
    });
  };
  const skipToVoting = async () => {
    if (!game || !currentPlayer?.is_host || !currentRound) return;
    try {
      // Mark current round as complete
      await supabase.from('rounds').update({
        is_complete: true
      }).eq('id', currentRound.id);

      // Skip directly to voting
      await supabase.from('games').update({
        status: 'voting'
      }).eq('id', game.id);
      toast.success('Skipped to voting!');
    } catch (error) {
      console.error('Error skipping to voting:', error);
      toast.error('Failed to skip to voting');
    }
  };
  const submitClue = async () => {
    if (!currentPlayer || !currentRound || !clueInput.trim() || !game) return;
    const clueText = clueInput.trim();

    // Enforce one-word clues rule
    const isOneWordRequired = gameMetadata?.modifiers?.includes('one-word') ?? false;
    if (isOneWordRequired) {
      const wordCount = clueText.split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount !== 1) {
        toast.error('One-word clues only! Your clue must be exactly one word.');
        return;
      }
    }
    setIsSubmitting(true);
    try {
      // Server-side validation: get clue count for CURRENT ROUND ONLY
      const {
        count
      } = await supabase.from('clues').select('*', {
        count: 'exact',
        head: true
      }).eq('round_id', currentRound.id);

      // Get shuffled order for this game (same for all rounds) - use active players only (exclude spectators)
      const gameShuffledPlayers = getShuffledPlayersForGame(players.filter(p => !p.is_spectator), game.id);
      const currentTurn = count || 0;
      const expectedPlayer = gameShuffledPlayers[currentTurn];
      if (expectedPlayer?.id !== currentPlayer.id) {
        toast.error("It's not your turn!");
        setIsSubmitting(false);
        return;
      }
      await supabase.from('clues').insert({
        round_id: currentRound.id,
        player_id: currentPlayer.id,
        clue_text: clueText
      });
      setClueInput('');
      toast.success('Clue submitted!');
    } catch (error) {
      console.error('Error submitting clue:', error);
      toast.error('Failed to submit clue');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle speed round timer expiry - auto-submit with "..." or skip
  const handleSpeedRoundTimeUp = useCallback(async () => {
    if (!currentPlayer || !currentRound || !game || hasSubmittedClue || !isMyTurn) return;

    // For one-word rule, only submit if valid or use default emoji
    const isOneWordRequired = gameMetadata?.modifiers?.includes('one-word') ?? false;
    let clueToSubmit = clueInput.trim() || '⏱️';
    if (isOneWordRequired && clueToSubmit !== '⏱️') {
      const wordCount = clueToSubmit.split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount !== 1) {
        clueToSubmit = '⏱️'; // Default to emoji if clue doesn't meet one-word requirement
      }
    }
    try {
      await supabase.from('clues').insert({
        round_id: currentRound.id,
        player_id: currentPlayer.id,
        clue_text: clueToSubmit
      });
      setClueInput('');
      toast.warning("Time's up! Auto-submitted.");
    } catch (error) {
      console.error('Error auto-submitting clue:', error);
      toast.error('Failed to auto-submit clue');
    }
  }, [currentPlayer, currentRound, game, hasSubmittedClue, isMyTurn, clueInput, gameMetadata?.modifiers]);

  // Check if timed round modifier is active (support both old 'speed-round' and new 'timed-round')
  const isTimedRound = gameMetadata?.modifiers?.includes('timed-round') || gameMetadata?.modifiers?.includes('speed-round') || false;
  const timedRoundDuration = gameMetadata?.timedRoundDuration ?? 30;
  const canOutsiderGuess = gameMetadata?.modifiers?.includes('outsider-guess') ?? false;

  // Outsider guess submission
  const submitGuess = async () => {
    if (!currentPlayer || !game || hasGuessed || !guessInput.trim()) return;
    setIsSubmitting(true);
    try {
      // Use server-side RPC to validate guess (prevents DevTools cheating)
      const { data: isCorrect, error: guessError } = await supabase
        .rpc('check_outsider_guess', {
          p_game_id: game.id,
          p_guess: guessInput.trim()
        });
      
      if (guessError) {
        console.error('Error checking guess:', guessError);
        toast.error('Failed to check guess');
        return;
      }
      
      if (isCorrect) {
        // Outsider wins! Move directly to results
        toast.success("Correct! You've won the game!");

        // Store the win reason in localStorage
        const updatedMetadata = {
          ...(gameMetadata || {}),
          outsiderGuessedCorrectly: true,
          outsiderGuesser: currentPlayer.display_name
        };
        localStorage.setItem(`game-metadata-${game.id}`, JSON.stringify(updatedMetadata));

        // Broadcast the updated metadata to all players so they see the win reason
        const channel = supabase.channel(`outsider-guess-broadcast-${game.id}`);
        try {
          await channel.subscribe();
          await channel.send({
            type: 'broadcast',
            event: 'metadata',
            payload: {
              metadata: updatedMetadata
            }
          });
        } finally {
          // Always clean up broadcast channel after send
          supabase.removeChannel(channel);
        }

        // Update game status to results
        await supabase.from('games').update({
          status: 'results'
        }).eq('id', game.id);
        await supabase.from('lobbies').update({
          status: 'results'
        }).eq('id', lobbyId);
      } else {
        toast.error("Wrong guess! Keep playing...");
        setHasGuessed(true);
      }
      setGuessInput('');
      setShowGuessInput(false);
    } catch (error) {
      console.error('Error submitting guess:', error);
      toast.error('Failed to submit guess');
    } finally {
      setIsSubmitting(false);
    }
  };
  const maxVotes = gameMetadata?.votesPerPlayer ?? 1;
  const canVoteForPlayer = (playerId: string) => {
    return !selectedVotes.includes(playerId) && selectedVotes.length < maxVotes;
  };
  const toggleVoteSelection = (playerId: string) => {
    if (selectedVotes.includes(playerId)) {
      setSelectedVotes(prev => prev.filter(id => id !== playerId));
    } else if (selectedVotes.length < maxVotes) {
      setSelectedVotes(prev => [...prev, playerId]);
    }
  };
  const submitVotes = async () => {
    if (!currentPlayer || !game || votesSubmitted || selectedVotes.length === 0) return;
    setIsSubmitting(true);
    try {
      // Insert all selected votes
      const voteInserts = selectedVotes.map(playerId => ({
        game_id: game.id,
        voter_player_id: currentPlayer.id,
        suspected_outsider_player_id: playerId === 'skip' ? currentPlayer.id : playerId
      }));
      await supabase.from('votes').insert(voteInserts);
      setVotesSubmitted(true);
      setSkipVote(selectedVotes.includes('skip'));
      toast.success(selectedVotes.includes('skip') ? 'Vote skipped!' : `${selectedVotes.length} vote(s) submitted!`);
    } catch (error) {
      console.error('Error submitting votes:', error);
      toast.error('Failed to submit votes');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Navigate to results when game status changes (for NON-HOST players only)
  // Host handles this via moveToResults() with startTransition
  useEffect(() => {
    // Only non-hosts react to status change
    if (!currentPlayer?.is_host && game?.status === 'results' && !hasNavigatedToResultsRef.current && lobbyId) {
      hasNavigatedToResultsRef.current = true;
      if (import.meta.env.DEV) console.log('[Game] Non-host: Status changed to results, using startTransition');
      startTransition(`/results/${lobbyId}`, {
        loadingText: 'Tallying votes',
        reason: 'status-change-nonhost',
        prepare: async () => {
          // Preload results data for non-host too
          if (import.meta.env.DEV) console.log('[Game] Non-host: Preloading results data');
          await preloadResultsData(lobbyId, game.id);
        }
      });
    }
  }, [game?.status, game?.id, lobbyId, startTransition, currentPlayer?.is_host]);

  // Use cached data if available, otherwise use live data - moved up for hasData calculation
  const effectiveGame = game || cachedGameData?.game;
  const effectiveSecretWord = secretWord || cachedGameData?.secretWord;
  const effectiveCurrentRound = currentRound || cachedGameData?.currentRound;

  // Determine if we have data ready to paint (using effective values with cache fallback)
  const hasData = !!(effectiveGame && effectiveSecretWord && effectiveCurrentRound);

  // Mark reveal ready when we have data AND awaiting reveal
  const hasMarkedRevealRef = useRef(false);
  useLayoutEffect(() => {
    if (hasData && awaitingRevealId && !hasMarkedRevealRef.current) {
      hasMarkedRevealRef.current = true;
      markRevealReady(awaitingRevealId);
    }
  }, [hasData, awaitingRevealId, markRevealReady]);

  // Reset refs when game changes
  useEffect(() => {
    if (game?.id) {
      hasMarkedRevealRef.current = false;
    }
  }, [game?.id]);

  // Inline skeleton - renders page shell immediately, shows skeleton content if data not ready
  // CRITICAL: Don't show skeleton during active transition - let the overlay handle loading
  const showSkeleton = (!effectiveGame || !effectiveSecretWord || !effectiveCurrentRound) && !isTransitioning;
  if (showSkeleton) {
    // Render inline skeleton within page shell - NOT a separate loading screen
    return <div className="min-h-screen bg-background overflow-x-hidden pb-[env(safe-area-inset-bottom)]">
        {/* Header skeleton */}
        <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex-1">
              <div className="h-4 w-20 bg-muted rounded mx-auto mb-2 animate-pulse"></div>
              <div className="h-6 w-32 bg-muted rounded mx-auto animate-pulse"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-9 bg-muted rounded animate-pulse"></div>
              <div className="h-9 w-9 bg-muted rounded animate-pulse"></div>
            </div>
          </div>
        </header>
        
        {/* Content skeleton */}
        <main className="p-4 max-w-md mx-auto space-y-6 py-6">
          {/* Word card skeleton */}
          <div className="p-6 rounded-lg border border-border bg-card animate-pulse">
            <div className="h-4 w-24 bg-muted rounded mx-auto mb-4"></div>
            <div className="h-8 w-40 bg-muted rounded mx-auto mb-2"></div>
            <div className="h-3 w-20 bg-muted rounded mx-auto"></div>
          </div>
          
          {/* Turn order skeleton */}
          <div className="space-y-3">
            <div className="h-5 w-28 bg-muted rounded animate-pulse"></div>
            {[1, 2, 3, 4].map(i => <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card animate-pulse">
                <div className="h-10 w-10 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 w-24 bg-muted rounded mb-1"></div>
                  <div className="h-3 w-32 bg-muted rounded"></div>
                </div>
              </div>)}
          </div>
        </main>
      </div>;
  }

  // Clue Round View
  if (displayedStatus === 'clue_round') {
    return <>
        <div className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] overflow-x-hidden">
        <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="text-center flex-1">
              <p className="text-sm text-muted-foreground">
                {isEliminationMode ? `Round ${game.current_round_number}` : `Round ${game.current_round_number} of ${game.total_rounds}`}
              </p>
              
            </div>
            <div className="flex items-center gap-2">
              {currentPlayer?.is_host && <Button variant="ghost" size="sm" onClick={skipToVoting} className="gap-1 text-muted-foreground">
                  <FastForward className="h-4 w-4" />
                  <span className="hidden sm:inline">Skip</span>
                </Button>}
              {isHost && lobbyId && (
                <KickPlayerDialog players={players} lobbyId={lobbyId} useSpectatorMode />
              )}
              <MusicControls />
              <Button variant="ghost" size="icon" onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                startTransition('/stats', {
                  origin: {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                  }
                });
              }}>
                <User className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={leaveLobby} className="gap-1 text-muted-foreground">
                <DoorOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Leave</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="p-4 max-w-md mx-auto space-y-6 py-6 overflow-hidden">
          <motion.div 
            key={`round-content-${roundAnimationKey}`} 
            initial={{ opacity: 0, y: 20 }}
            animate={isExiting ? {
              opacity: 0,
              x: -100
            } : {
              opacity: 1,
              y: 0,
              x: 0
            }} 
            transition={{
              duration: 0.35,
              ease: [0.4, 0, 0.2, 1]
            }} 
            className="space-y-6">
          <motion.div initial={{
              opacity: 0,
              y: 15
            }} animate={{
              opacity: 1,
              y: 0
            }} transition={{
              duration: 0.3,
              ease: [0.4, 0, 0.2, 1]
            }}>
            {isSpectator ? <Card className="p-6 bg-muted/50 border-border">
                <div className="text-center space-y-2">
                  <Eye className="h-12 w-12 text-muted-foreground mx-auto" />
                  <h2 className="text-xl font-bold text-muted-foreground">You're a Spectator</h2>
                  <p className="text-sm text-muted-foreground">
                    You've been eliminated. Watch the game unfold!
                  </p>
                  <p className="text-lg font-bold text-primary mt-4">Secret Word: {secretWord?.text ?? 'Loading...'}</p>
                  <p className="text-xs text-muted-foreground">
                    Category: {gameMetadata?.customCategory || secretWord?.category || 'Unknown'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Outsider{outsiders.length > 1 ? 's' : ''}: {players.filter(p => outsiders.some(o => o.player_id === p.id)).map(p => p.display_name).join(', ')}
                  </p>
                </div>
              </Card> : isHiddenImposterMode ? <Card className="p-6 bg-gradient-primary text-white shadow-card border-0">
                <div className="text-center space-y-2">
                  <Eye className="h-8 w-8 mx-auto" />
                  <p className="text-white/80 text-sm">Your Word</p>
                  <h2 className="text-4xl font-bold">{displayWord?.text ?? 'Loading...'}</h2>
                  <p className="text-white/70 text-xs uppercase tracking-wider mt-1">
                    Category: {gameMetadata?.customCategory || secretWord?.category || 'Unknown'}
                  </p>
                  <p className="text-white/90 text-sm">
                    Give a clue that relates to this word
                  </p>
                </div>
              </Card> : isOutsider ? <Card className="p-6 bg-destructive/10 border-destructive/20">
                <div className="text-center space-y-2">
                  <EyeOff className="h-12 w-12 text-destructive mx-auto" />
                  <h2 className="text-xl font-bold text-destructive">You're the Outsider!</h2>
                  <p className="text-sm text-muted-foreground">
                    You don't know the secret word. Try to blend in by guessing what it might be from others' clues!
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Category: <span className="font-semibold">{gameMetadata?.customCategory || secretWord?.category || 'Unknown'}</span>
                  </p>
                  
                  {/* Outsider Guess Feature */}
                  {canOutsiderGuess && !hasGuessed && <div className="mt-4 pt-4 border-t border-destructive/20">
                      {!showGuessInput ? <Button variant="outline" size="sm" onClick={() => setShowGuessInput(true)} className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10">
                          <Lightbulb className="h-4 w-4" />
                          Guess the Word (Win Instantly!)
                        </Button> : <div className="space-y-2">
                          <Input placeholder="Enter your guess..." value={guessInput} onChange={e => setGuessInput(e.target.value)} className="text-center w-full" onKeyDown={e => e.key === 'Enter' && submitGuess()} autoFocus />
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => {
                          setShowGuessInput(false);
                          setGuessInput('');
                        }} className="flex-1">
                              Cancel
                            </Button>
                            <Button variant="destructive" size="sm" onClick={submitGuess} disabled={isSubmitting || !guessInput.trim()} className="flex-1">
                              Submit Guess
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            ⚠️ You only get one guess!
                          </p>
                        </div>}
                    </div>}
                  {canOutsiderGuess && hasGuessed && <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-destructive/20">
                      ❌ You've already used your guess
                    </p>}
                </div>
              </Card> : <Card className="p-6 bg-gradient-primary text-white shadow-card border-0">
                <div className="text-center space-y-2">
                  <Eye className="h-8 w-8 mx-auto" />
                  <p className="text-white/80 text-sm">Secret Word</p>
                  <h2 className="text-4xl font-bold">{secretWord?.text ?? 'Loading...'}</h2>
                  <p className="text-white/70 text-xs uppercase tracking-wider mt-1">
                    Category: {gameMetadata?.customCategory || secretWord?.category || 'Unknown'}
                  </p>
                  <p className="text-white/90 text-sm">
                    Give a clue that relates to this word
                  </p>
                </div>
              </Card>}
          </motion.div>

          {/* Turn indicator */}
          {/* Turn indicator - slides based on whose turn */}
          <AnimatePresence mode="wait">
            {!hasSubmittedClue && currentTurnPlayer && <motion.div key={`turn-indicator-${isMyTurn ? 'my-turn' : 'waiting'}`} initial={{
                opacity: 0,
                y: -20
              }} animate={{
                opacity: 1,
                y: 0
              }} exit={{
                opacity: 0,
                y: -20
              }} transition={{
                duration: 0.3,
                ease: [0.4, 0, 0.2, 1]
              }}>
                <Card className={`p-4 ${isMyTurn ? 'bg-primary/10 border-primary' : 'bg-muted/50 border-border'}`}>
                  <div className="text-center">
                    {isMyTurn ? <p className="font-semibold text-primary">It's your turn to give a clue!</p> : <p className="text-muted-foreground">
                        Waiting for <span className="font-semibold text-foreground">{currentTurnPlayer.display_name}</span> to submit their clue...
                      </p>}
                  </div>
                </Card>
              </motion.div>}
          </AnimatePresence>

          {/* Clue input / Submitted card - flies in/out */}
          <AnimatePresence mode="wait">
            {!isSpectator && !hasSubmittedClue && isMyTurn && <motion.div key="clue-input" initial={{
                opacity: 0,
                x: 100,
                scale: 0.95
              }} animate={{
                opacity: 1,
                x: 0,
                scale: 1
              }} exit={{
                opacity: 0,
                x: -100,
                scale: 0.95
              }} transition={{
                duration: 0.4,
                ease: [0.4, 0, 0.2, 1]
              }} className="space-y-4">
                {/* Timed Round Timer */}
                {isTimedRound && <SpeedRoundTimer key={`timer-${currentTurnPlayer?.id}-${game.current_round_number}-${clues.length}`} isActive={isMyTurn && !hasSubmittedClue} duration={timedRoundDuration} onTimeUp={handleSpeedRoundTimeUp} />}
                
                <motion.div className="space-y-2" initial={{
                  opacity: 0,
                  y: 20
                }} animate={{
                  opacity: 1,
                  y: 0
                }} transition={{
                  delay: 0.1,
                  duration: 0.3
                }}>
                  <label className="text-sm font-medium">Your Clue</label>
                  <Input placeholder="Enter a one-word clue" value={clueInput} onChange={e => setClueInput(e.target.value)} maxLength={30} className={`h-12 text-base w-full ${isTimedRound ? 'border-primary focus:ring-primary' : ''}`} onKeyDown={e => e.key === 'Enter' && submitClue()} autoFocus={isTimedRound} />
                  <p className="text-xs text-muted-foreground pb-2">
                    {isTimedRound ? 'Quick! Submit before time runs out!' : 'Keep it short and relevant!'}
                  </p>
                </motion.div>
                <motion.div initial={{
                  opacity: 0,
                  y: 20
                }} animate={{
                  opacity: 1,
                  y: 0
                }} transition={{
                  delay: 0.2,
                  duration: 0.3
                }}>
                  <Button onClick={submitClue} disabled={isSubmitting || !clueInput.trim()} className="w-full h-12">
                    <Send className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Submitting...' : 'Submit Clue'}
                  </Button>
                </motion.div>
              </motion.div>}
            
            {!isSpectator && hasSubmittedClue && <motion.div key="clue-submitted" initial={{
                opacity: 0,
                x: 100,
                scale: 0.95
              }} animate={{
                opacity: 1,
                x: 0,
                scale: 1
              }} exit={{
                opacity: 0,
                x: -100,
                scale: 0.95
              }} transition={{
                duration: 0.4,
                ease: [0.4, 0, 0.2, 1]
              }}>
                <Card className="p-6 bg-gradient-card border-border text-center space-y-4">
                  <motion.div initial={{
                    scale: 0
                  }} animate={{
                    scale: 1
                  }} transition={{
                    delay: 0.2,
                    type: "spring",
                    stiffness: 200
                  }}>
                    <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-2" />
                  </motion.div>
                  <motion.div initial={{
                    opacity: 0,
                    y: 10
                  }} animate={{
                    opacity: 1,
                    y: 0
                  }} transition={{
                    delay: 0.3
                  }}>
                    <h3 className="font-bold text-lg mb-1">Clue Submitted!</h3>
                    <p className="text-sm text-muted-foreground">
                      {allCluesSubmitted ? "All clues submitted! Waiting for host..." : `Waiting for ${shuffledPlayers.length - clues.length} other player(s)...`}
                    </p>
                  </motion.div>
                  {currentPlayer?.is_host && allCluesSubmitted && <motion.div initial={{
                    opacity: 0,
                    y: 10
                  }} animate={{
                    opacity: 1,
                    y: 0
                  }} transition={{
                    delay: 0.4
                  }}>
                      <Button onClick={startNextRound} className="w-full h-12">
                        <ArrowRight className="h-4 w-4 mr-2" />
                        {isEliminationMode ? 'Go to Voting' : isLastRound ? 'Go to Voting' : 'Next Round'}
                      </Button>
                    </motion.div>}
                </Card>
              </motion.div>}
          </AnimatePresence>

          <motion.div layout initial={{
              opacity: 0,
              y: 15
            }} animate={{
              opacity: 1,
              y: 0
            }} transition={{
              duration: 0.3,
              ease: [0.4, 0, 0.2, 1],
              layout: {
                duration: 0.25,
                ease: [0.4, 0, 0.2, 1]
              }
            }} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground px-1 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Turn Order ({clues.length}/{shuffledPlayers.length} this round)
            </h3>
            <motion.div layout className="space-y-2">
              {shuffledPlayers.map((player, index) => {
                  const playerClue = clues.find(c => c.player_id === player.id);
                  const isCurrentTurn = index === currentTurnIndex && !playerClue;
                  const avatar = player.avatar_url ? getAvatarById(player.avatar_url) : null;
                  return <motion.div key={player.id} layout initial={false} animate={{
                    opacity: 1,
                    x: 0
                  }} transition={{
                    duration: 0.25,
                    ease: [0.4, 0, 0.2, 1],
                    layout: {
                      duration: 0.25
                    }
                  }} className="relative">
                    {/* Spotlight glow effect */}
                    <motion.div className="absolute inset-0 rounded-lg bg-primary/20 blur-sm" initial={{
                      opacity: 0
                    }} animate={{
                      opacity: isCurrentTurn ? 1 : 0
                    }} transition={{
                      duration: 0.5,
                      ease: "easeInOut"
                    }} />
                    <div className={`relative p-4 rounded-lg border transition-all duration-400 ${isCurrentTurn ? 'bg-primary/10 border-primary scale-[1.02]' : 'bg-card border-border scale-100'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-base ${avatar ? avatar.color : 'bg-muted'}`}>
                            {avatar ? avatar.emoji : <User className="h-4 w-4 text-muted-foreground" />}
                          </div>
                          <span className="font-medium">
                            {player.display_name}
                            {player.id === currentPlayer?.id && ' (You)'}
                          </span>
                          <AnimatePresence mode="wait">
                            {isCurrentTurn && <motion.span initial={{
                              opacity: 0,
                              scale: 0.8
                            }} animate={{
                              opacity: 1,
                              scale: 1
                            }} exit={{
                              opacity: 0,
                              scale: 0.8
                            }} transition={{
                              duration: 0.3
                            }} className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                                Turn
                              </motion.span>}
                          </AnimatePresence>
                        </div>
                        {playerClue ? <motion.span initial={{
                          opacity: 0,
                          x: 10
                        }} animate={{
                          opacity: 1,
                          x: 0
                        }} className="text-primary font-medium">
                            "{playerClue.clue_text}"
                          </motion.span> : <span className="text-muted-foreground text-sm">
                            {isCurrentTurn ? 'Thinking...' : 'Waiting...'}
                          </span>}
                      </div>
                    </div>
                  </motion.div>;
                })}
            </motion.div>
          </motion.div>

          {/* Active rules dropdown below player names */}
          <motion.div layout initial={{
              opacity: 0,
              y: 20
            }} animate={{
              opacity: 1,
              y: 0
            }} transition={{
              duration: 0.4,
              ease: [0.4, 0, 0.2, 1],
              layout: {
                duration: 0.3
              }
            }}>
            <ActiveModifiersDisplay modifiers={gameMetadata?.modifiers || []} customModifiers={gameMetadata?.customModifiersData || customModifiers} gameMode={game.game_mode} compact />
          </motion.div>
          </motion.div>
        </main>
        </div>
      </>;
  }

  // Voting View
  if (displayedStatus === 'voting') {
    const votablePlayers = isEliminationMode ? activePlayers : players;
    return <>
        <div className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] overflow-x-hidden">
        <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="text-center flex-1">
              <h1 className="text-xl font-bold">
                {isEliminationMode ? `Round ${game.current_round_number} Voting` : 'Vote for the Outsider'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isHiddenImposterMode ? `Who had a different word?` : `Who do you think is the outsider?`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isHost && lobbyId && (
                <KickPlayerDialog players={players} lobbyId={lobbyId} useSpectatorMode />
              )}
              <MusicControls />
              <Button variant="ghost" size="icon" onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                startTransition('/stats', {
                  origin: {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                  }
                });
              }}>
                <User className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={leaveLobby} className="gap-1 text-muted-foreground">
                <DoorOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Leave</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="p-4 max-w-md mx-auto space-y-6 py-6 overflow-hidden">
          <motion.div key="voting-content" initial={{
            opacity: 0,
            x: 100
          }} animate={{
            opacity: 1,
            x: 0
          }} transition={{
            duration: 0.4,
            ease: [0.4, 0, 0.2, 1]
          }} className="space-y-6">
          {isSpectator ? <Card className="p-6 bg-muted/50 border-border text-center">
              <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <h3 className="font-bold text-lg mb-1">Spectating Voting</h3>
              <p className="text-sm text-muted-foreground">
                Watch as the remaining players vote.
              </p>
              <p className="text-lg font-bold text-primary mt-4">Secret Word: {secretWord?.text ?? 'Loading...'}</p>
              <p className="text-sm text-muted-foreground">
                Outsider{outsiders.length > 1 ? 's' : ''}: {players.filter(p => outsiders.some(o => o.player_id === p.id)).map(p => p.display_name).join(', ')}
              </p>
            </Card> : <>
              <AnimatePresence mode="wait">
                {!votesSubmitted ? <motion.div key="voting-ui" initial={{
                  opacity: 0,
                  x: 100
                }} animate={{
                  opacity: 1,
                  x: 0
                }} exit={{
                  opacity: 0,
                  x: -100
                }} transition={{
                  duration: 0.4,
                  ease: [0.4, 0, 0.2, 1],
                  delay: 0.1
                }} className="space-y-3">
                    {/* Show outsider count if enabled */}
                    {gameMetadata?.showOutsiderCount && <motion.div initial={{
                    opacity: 0,
                    y: 20
                  }} animate={{
                    opacity: 1,
                    y: 0
                  }} transition={{
                    duration: 0.3,
                    delay: 0.2
                  }}>
                        <Card className="p-3 bg-muted/50 border-border text-center">
                          <p className="text-sm text-muted-foreground">
                            There {outsiders.length === 1 ? 'is' : 'are'} <span className="font-bold text-primary">{outsiders.length}</span> outsider{outsiders.length !== 1 ? 's' : ''} to find
                          </p>
                        </Card>
                      </motion.div>}
                    
                    <motion.h3 className="text-sm font-semibold text-muted-foreground px-1" initial={{
                    opacity: 0,
                    y: 10
                  }} animate={{
                    opacity: 1,
                    y: 0
                  }} transition={{
                    duration: 0.3,
                    delay: 0.25
                  }}>
                      {maxVotes > 1 ? `Select up to ${maxVotes} players (${selectedVotes.length}/${maxVotes})` : `Select a player${isEliminationMode ? ' (or skip)' : ''}`}:
                    </motion.h3>
                    <div className="space-y-2">
                      {votablePlayers.map((player, index) => {
                      const isSelected = selectedVotes.includes(player.id);
                      const canSelect = player.id !== currentPlayer?.id && !player.is_spectator && (isSelected || selectedVotes.length < maxVotes);
                      const avatar = player.avatar_url ? getAvatarById(player.avatar_url) : null;
                      return <motion.div key={player.id} initial={{
                        opacity: 0,
                        x: 30
                      }} animate={{
                        opacity: 1,
                        x: 0
                      }} transition={{
                        duration: 0.3,
                        delay: 0.3 + index * 0.06
                      }}>
                            <Button onClick={() => toggleVoteSelection(player.id)} disabled={isSubmitting || player.id === currentPlayer?.id || player.is_spectator || !isSelected && !canSelect} variant={isSelected ? 'default' : 'outline'} className="w-full min-h-[56px] h-auto py-3 text-base justify-between px-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${avatar ? avatar.color : 'bg-muted'}`}>
                                  {avatar ? avatar.emoji : <User className="h-4 w-4 text-muted-foreground" />}
                                </div>
                                <span>
                                  {player.display_name}
                                  {player.id === currentPlayer?.id && ' (You)'}
                                  {player.is_spectator && ' (Spectator)'}
                                </span>
                              </div>
                              <AnimatePresence>
                                {isSelected && <motion.div initial={{
                              scale: 0,
                              opacity: 0
                            }} animate={{
                              scale: 1,
                              opacity: 1
                            }} exit={{
                              scale: 0,
                              opacity: 0
                            }} transition={{
                              type: 'spring',
                              stiffness: 500,
                              damping: 30
                            }}>
                                    <Check className="h-5 w-5" />
                                  </motion.div>}
                              </AnimatePresence>
                            </Button>
                          </motion.div>;
                    })}
                      {isEliminationMode && <motion.div initial={{
                      opacity: 0,
                      x: 30
                    }} animate={{
                      opacity: 1,
                      x: 0
                    }} transition={{
                      duration: 0.3,
                      delay: 0.3 + votablePlayers.length * 0.06
                    }}>
                          <Button onClick={() => toggleVoteSelection('skip')} disabled={isSubmitting} variant={selectedVotes.includes('skip') ? 'default' : 'outline'} className="w-full min-h-[56px] h-auto py-3 text-base justify-between px-4 text-muted-foreground">
                            <span>Skip vote (no elimination)</span>
                            <AnimatePresence>
                              {selectedVotes.includes('skip') && <motion.div initial={{
                            scale: 0,
                            opacity: 0
                          }} animate={{
                            scale: 1,
                            opacity: 1
                          }} exit={{
                            scale: 0,
                            opacity: 0
                          }} transition={{
                            type: 'spring',
                            stiffness: 500,
                            damping: 30
                          }}>
                                  <Check className="h-5 w-5" />
                                </motion.div>}
                            </AnimatePresence>
                          </Button>
                        </motion.div>}
                    </div>
                    
                    <AnimatePresence>
                      {selectedVotes.length > 0 && <motion.div initial={{
                      opacity: 0,
                      y: 20,
                      height: 0
                    }} animate={{
                      opacity: 1,
                      y: 0,
                      height: 'auto'
                    }} exit={{
                      opacity: 0,
                      y: 20,
                      height: 0
                    }} transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 30
                    }}>
                          <Button onClick={submitVotes} disabled={isSubmitting || selectedVotes.length === 0} className="w-full h-12 mt-4">
                            {isSubmitting ? 'Submitting...' : `Submit ${selectedVotes.length} Vote${selectedVotes.length > 1 ? 's' : ''}`}
                          </Button>
                        </motion.div>}
                    </AnimatePresence>
                  </motion.div> : <motion.div key="votes-submitted" initial={{
                  opacity: 0,
                  x: 100,
                  scale: 0.95
                }} animate={{
                  opacity: 1,
                  x: 0,
                  scale: 1
                }} transition={{
                  duration: 0.4,
                  ease: [0.4, 0, 0.2, 1]
                }}>
                     <Card className="p-6 bg-gradient-card border-border text-center">
                      <motion.div initial={{
                      scale: 0
                    }} animate={{
                      scale: 1
                    }} transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 20,
                      delay: 0.2
                    }}>
                        <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-2" />
                      </motion.div>
                      <h3 className="font-bold text-lg mb-1">Votes Submitted!</h3>
                      <p className="text-sm text-muted-foreground">
                        Waiting for other players...
                      </p>
                    </Card>

                    {/* Vote status tracker */}
                    <Card className="p-4 mt-4 border-border">
                      <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Vote Status
                      </h4>
                      <div className="space-y-2">
                        {(isEliminationMode ? activePlayers : players).filter(p => !p.is_spectator).map(player => {
                          const playerHasVoted = votes.some(v => v.voter_player_id === player.id);
                          const avatar = player.avatar_url ? getAvatarById(player.avatar_url) : null;
                          return (
                            <div key={player.id} className="flex items-center justify-between py-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${avatar ? avatar.color : 'bg-muted'}`}>
                                  {avatar ? avatar.emoji : <User className="h-3 w-3 text-muted-foreground" />}
                                </div>
                                <span className="text-sm">{player.display_name}{player.id === currentPlayer?.id && ' (You)'}</span>
                              </div>
                              {playerHasVoted ? (
                                <span className="text-xs text-primary flex items-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Voted
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Waiting...</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </motion.div>}
              </AnimatePresence>
            </>}

          {/* Active rules dropdown below content */}
          <motion.div initial={{
              opacity: 0,
              y: 20
            }} animate={{
              opacity: 1,
              y: 0
            }} transition={{
              duration: 0.4,
              delay: 0.5
            }}>
            <ActiveModifiersDisplay modifiers={gameMetadata?.modifiers || []} customModifiers={gameMetadata?.customModifiersData || customModifiers} gameMode={game.game_mode} compact />
          </motion.div>
          </motion.div>
        </main>
      </div>
      </>;
  }
  return null;
};
export default Game;