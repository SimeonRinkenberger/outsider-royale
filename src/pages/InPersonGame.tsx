import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff, ArrowRight, RotateCcw, Trophy, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import GameHeader from '@/components/GameHeader';
import { useAudio } from '@/contexts/AudioContext';

interface InPersonGameConfig {
  players: string[];
  numOutsiders: number;
  currentPlayerIndex: number;
  currentVoterIndex: number;
  phase: 'word-reveal' | 'discussion' | 'voting' | 'results';
  secretWord?: string;
  outsiderIndices?: number[];
  votes?: Record<string, string>;
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
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for backward
  
  const { setMusicState } = useAudio();
  
  useEffect(() => {
    setMusicState('game_standard');
  }, [setMusicState]);

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
        // Fetch a random word
        const { data: words, error } = await supabase
          .from('words')
          .select('text')
          .limit(100);

        if (error || !words?.length) {
          toast.error('Failed to load words');
          navigate('/in-person');
          return;
        }

        const randomWord = words[Math.floor(Math.random() * words.length)].text;
        
        // Randomly select outsiders
        const playerIndices = gameConfig.players.map((_, i) => i);
        const shuffled = playerIndices.sort(() => Math.random() - 0.5);
        const outsiderIndices = shuffled.slice(0, gameConfig.numOutsiders);

        gameConfig.secretWord = randomWord;
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

  const playAgain = () => {
    localStorage.removeItem('inPersonGame');
    navigate('/in-person');
  };

  const exitGame = () => {
    localStorage.removeItem('inPersonGame');
    navigate('/menu');
  };

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
                
                <AnimatePresence mode="wait">
                  {!isWordVisible ? (
                    <motion.div
                      key="reveal-button"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    >
                      <Button
                        className="w-full h-16 text-lg"
                        onClick={() => setIsWordVisible(true)}
                      >
                        <Eye className="h-6 w-6 mr-2" />
                        Tap to See Your Word
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="word-display"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="space-y-4"
                    >
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 25 }}
                        className={`p-6 rounded-xl ${isCurrentPlayerOutsider ? 'bg-destructive/10 border-2 border-destructive' : 'bg-primary/10 border-2 border-primary'}`}
                      >
                        {isCurrentPlayerOutsider ? (
                          <div>
                            <p className="text-lg font-bold text-destructive mb-1">You are the OUTSIDER!</p>
                            <p className="text-sm text-muted-foreground">You don't know the word. Try to blend in!</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">The secret word is:</p>
                            <motion.p 
                              initial={{ opacity: 0, scale: 1.2 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                              className="text-3xl font-bold text-primary"
                            >
                              {config.secretWord}
                            </motion.p>
                          </div>
                        )}
                      </motion.div>
                      
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setIsWordVisible(false)}
                        >
                          <EyeOff className="h-4 w-4 mr-2" />
                          Hide Word
                        </Button>
                      </motion.div>
                      
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                      >
                        <Button className="w-full h-12" onClick={nextPlayer}>
                          <ArrowRight className="h-5 w-5 mr-2" />
                          {config.currentPlayerIndex + 1 >= config.players.length ? 'Start Discussion' : 'Next Player'}
                        </Button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
              
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
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-muted-foreground mb-4"
                >
                  Take turns giving one-word clues about the secret word.
                  Try to identify who doesn't know the word!
                </motion.p>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-sm text-muted-foreground"
                >
                  {config.numOutsiders} outsider{config.numOutsiders > 1 ? 's' : ''} among {config.players.length} players
                </motion.p>
              </Card>
              
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, type: "spring", stiffness: 300, damping: 25 }}
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
                        >
                          <Trophy className={`h-12 w-12 mx-auto mb-4 ${results.wasOutsiderCaught ? 'text-green-500' : 'text-destructive'}`} />
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
