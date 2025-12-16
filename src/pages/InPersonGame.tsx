import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, EyeOff, ArrowRight, RotateCcw, Trophy, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from '@/components/Confetti';
import GameHeader from '@/components/GameHeader';

interface InPersonGameConfig {
  players: string[];
  numOutsiders: number;
  currentPlayerIndex: number;
  phase: 'word-reveal' | 'discussion' | 'voting' | 'results';
  secretWord?: string;
  outsiderIndices?: number[];
  votes?: Record<string, string>;
}

const InPersonGame = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<InPersonGameConfig | null>(null);
  const [isWordVisible, setIsWordVisible] = useState(false);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [currentVoter, setCurrentVoter] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

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
    
    const nextIndex = config.currentPlayerIndex + 1;
    if (nextIndex >= config.players.length) {
      updateConfig({ phase: 'discussion', currentPlayerIndex: 0 });
    } else {
      updateConfig({ currentPlayerIndex: nextIndex });
    }
    setIsWordVisible(false);
  };

  const startVoting = () => {
    updateConfig({ phase: 'voting' });
    setCurrentVoter(0);
    setSelectedVote(null);
  };

  const submitVote = () => {
    if (!config || !selectedVote) return;
    
    const newVotes = { ...config.votes, [config.players[currentVoter]]: selectedVote };
    updateConfig({ votes: newVotes });
    
    if (currentVoter + 1 >= config.players.length) {
      updateConfig({ phase: 'results', votes: newVotes });
      setShowConfetti(true);
    } else {
      setCurrentVoter(currentVoter + 1);
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showConfetti && <Confetti isActive={showConfetti} />}
      
      <GameHeader 
        title={
          config.phase === 'word-reveal' ? 'Pass the Device' :
          config.phase === 'discussion' ? 'Discussion Time' :
          config.phase === 'voting' ? 'Voting' : 'Results'
        }
        showBack={false}
      />

      <main className="flex-1 p-4 max-w-md mx-auto w-full flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {/* Word Reveal Phase */}
          {config.phase === 'word-reveal' && (
            <motion.div
              key="word-reveal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-6"
            >
              <Card className="p-6 text-center">
                <p className="text-muted-foreground mb-2">Pass to</p>
                <h2 className="text-3xl font-bold mb-6">{config.players[config.currentPlayerIndex]}</h2>
                
                {!isWordVisible ? (
                  <Button
                    className="w-full h-16 text-lg"
                    onClick={() => setIsWordVisible(true)}
                  >
                    <Eye className="h-6 w-6 mr-2" />
                    Tap to See Your Word
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className={`p-6 rounded-xl ${isCurrentPlayerOutsider ? 'bg-destructive/10 border-2 border-destructive' : 'bg-primary/10 border-2 border-primary'}`}>
                      {isCurrentPlayerOutsider ? (
                        <div>
                          <p className="text-lg font-bold text-destructive mb-1">You are the OUTSIDER!</p>
                          <p className="text-sm text-muted-foreground">You don't know the word. Try to blend in!</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">The secret word is:</p>
                          <p className="text-3xl font-bold text-primary">{config.secretWord}</p>
                        </div>
                      )}
                    </div>
                    
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setIsWordVisible(false)}
                    >
                      <EyeOff className="h-4 w-4 mr-2" />
                      Hide Word
                    </Button>
                    
                    <Button className="w-full h-12" onClick={nextPlayer}>
                      <ArrowRight className="h-5 w-5 mr-2" />
                      {config.currentPlayerIndex + 1 >= config.players.length ? 'Start Discussion' : 'Next Player'}
                    </Button>
                  </div>
                )}
              </Card>
              
              <p className="text-center text-sm text-muted-foreground">
                Player {config.currentPlayerIndex + 1} of {config.players.length}
              </p>
            </motion.div>
          )}

          {/* Discussion Phase */}
          {config.phase === 'discussion' && (
            <motion.div
              key="discussion"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <Card className="p-6 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h2 className="text-2xl font-bold mb-2">Discussion Time!</h2>
                <p className="text-muted-foreground mb-4">
                  Take turns giving one-word clues about the secret word.
                  Try to identify who doesn't know the word!
                </p>
                <p className="text-sm text-muted-foreground">
                  {config.numOutsiders} outsider{config.numOutsiders > 1 ? 's' : ''} among {config.players.length} players
                </p>
              </Card>
              
              <Button className="w-full h-14 text-lg" onClick={startVoting}>
                Start Voting
              </Button>
            </motion.div>
          )}

          {/* Voting Phase */}
          {config.phase === 'voting' && (
            <motion.div
              key="voting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <Card className="p-4 text-center">
                <p className="text-muted-foreground">Pass to</p>
                <h2 className="text-2xl font-bold">{config.players[currentVoter]}</h2>
                <p className="text-sm text-muted-foreground mt-2">Who do you think is the outsider?</p>
              </Card>
              
              <div className="space-y-2">
                {config.players.map((player, index) => (
                  <Button
                    key={index}
                    variant={selectedVote === player ? 'default' : 'outline'}
                    className="w-full h-12 justify-start"
                    onClick={() => setSelectedVote(player)}
                    disabled={player === config.players[currentVoter]}
                  >
                    {player}
                    {player === config.players[currentVoter] && (
                      <span className="ml-auto text-xs text-muted-foreground">(You)</span>
                    )}
                  </Button>
                ))}
              </div>
              
              <Button
                className="w-full h-12"
                onClick={submitVote}
                disabled={!selectedVote}
              >
                Submit Vote
              </Button>
            </motion.div>
          )}

          {/* Results Phase */}
          {config.phase === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-4"
            >
              {(() => {
                const results = getResults();
                if (!results) return null;
                
                return (
                  <>
                    <Card className={`p-6 text-center ${results.wasOutsiderCaught ? 'bg-green-500/10 border-green-500' : 'bg-destructive/10 border-destructive'}`}>
                      <Trophy className={`h-12 w-12 mx-auto mb-4 ${results.wasOutsiderCaught ? 'text-green-500' : 'text-destructive'}`} />
                      <h2 className="text-2xl font-bold mb-2">
                        {results.wasOutsiderCaught ? 'Outsider Caught!' : 'Outsider Wins!'}
                      </h2>
                      <p className="text-muted-foreground">
                        The secret word was: <span className="font-bold text-foreground">{config.secretWord}</span>
                      </p>
                    </Card>

                    <Card className="p-4">
                      <h3 className="font-semibold mb-3">The Outsider{config.outsiderIndices!.length > 1 ? 's' : ''}:</h3>
                      <div className="space-y-2">
                        {config.outsiderIndices!.map(index => (
                          <div key={index} className="p-3 bg-destructive/10 rounded-lg">
                            <span className="font-medium">{config.players[index]}</span>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card className="p-4">
                      <h3 className="font-semibold mb-3">Vote Results:</h3>
                      <div className="space-y-2">
                        {results.sortedVotes.map(([player, count]) => (
                          <div key={player} className="flex justify-between items-center p-2 bg-muted rounded">
                            <span>{player}</span>
                            <span className="font-bold">{count} vote{count > 1 ? 's' : ''}</span>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={exitGame}>
                        Exit
                      </Button>
                      <Button className="flex-1" onClick={playAgain}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Play Again
                      </Button>
                    </div>
                  </>
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