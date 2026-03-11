import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserX, Users } from 'lucide-react';
import { getAvatarById } from '@/components/AvatarPicker';
import type { LobbyPlayer } from '@/types/game';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface KickPlayerDialogProps {
  players: LobbyPlayer[];
  lobbyId: string;
  /** If true, converts kicked player to spectator instead of deleting (safe during active games). */
  useSpectatorMode?: boolean;
}

/**
 * A dialog that shows all players with kick buttons (for the host).
 * Includes its own trigger button and confirmation alert.
 */
export const KickPlayerDialog = ({ players, lobbyId, useSpectatorMode = false }: KickPlayerDialogProps) => {
  const [kickTarget, setKickTarget] = useState<{ id: string; name: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const kickPlayer = async (playerId: string) => {
    try {
      if (useSpectatorMode) {
        const { error } = await supabase
          .from('lobby_players')
          .update({ is_spectator: true })
          .eq('id', playerId)
          .eq('lobby_id', lobbyId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lobby_players')
          .delete()
          .eq('id', playerId)
          .eq('lobby_id', lobbyId);

        if (error) throw error;
      }

      toast.success('Player removed');
    } catch (error) {
      console.error('Error removing player:', error);
      toast.error('Failed to remove player');
    }
  };

  const nonHostPlayers = players.filter(p => !p.is_host && !p.is_spectator);

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Users className="h-5 w-5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Manage Players</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {nonHostPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No players to manage
              </p>
            ) : (
              nonHostPlayers.map((player) => {
                const avatar = player.avatar_url ? getAvatarById(player.avatar_url) : null;
                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${avatar ? avatar.color : 'bg-muted'}`}>
                        {avatar ? avatar.emoji : <Users className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <span className="font-medium">{player.display_name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setKickTarget({ id: player.id, name: player.display_name })}
                    >
                      <UserX className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Kick Confirmation */}
      <AlertDialog open={!!kickTarget} onOpenChange={(open) => !open && setKickTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove player?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-semibold text-foreground">{kickTarget?.name}</span>{' '}
              from the game?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (kickTarget) {
                  kickPlayer(kickTarget.id);
                  setKickTarget(null);
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
