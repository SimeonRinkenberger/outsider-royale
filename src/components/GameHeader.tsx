import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getStoredUserId, getStoredAvatarId, setStoredAvatarId } from '@/lib/gameUtils';
import { getAvatarById } from '@/components/AvatarPicker';
import { useBackTransition } from '@/components/BackTransition';
import { MusicControls } from '@/components/MusicControls';

interface GameHeaderProps {
  title: string;
  showBack?: boolean;
  backPath?: string;
  onBack?: () => void;
  rightContent?: React.ReactNode;
}

const GameHeader = ({ title, showBack = true, backPath, onBack, rightContent }: GameHeaderProps) => {
  const navigate = useNavigate();
  const { navigateBack } = useBackTransition();
  const userId = getStoredUserId();
  
  // Initialize from localStorage cache immediately
  const cachedAvatarId = getStoredAvatarId();
  const cachedAvatar = cachedAvatarId ? getAvatarById(cachedAvatarId) : null;
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(cachedAvatar?.emoji || null);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const fetchAvatar = async () => {
      if (!userId) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .maybeSingle();
      
      if (profile?.avatar_url) {
        const avatar = getAvatarById(profile.avatar_url);
        if (avatar) {
          setAvatarEmoji(avatar.emoji);
          setStoredAvatarId(profile.avatar_url);
        }
      }
    };
    
    fetchAvatar();
  }, [userId]);

  const handleBack = () => {
    if (isNavigating) return;
    setIsNavigating(true);

    if (onBack) {
      // onBack handles its own navigation
      onBack();
    } else if (backPath) {
      navigateBack(backPath);
    } else {
      navigate(-1);
    }

    // Reset after animation
    setTimeout(() => setIsNavigating(false), 500);
  };

  const handleProfileClick = () => {
    navigate('/stats', { state: { fromGame: true } });
  };

  return (
    <header className="bg-card border-b border-border p-4">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBack && (
            <Button variant="ghost" size="icon" onClick={handleBack} disabled={isNavigating}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-xl font-bold truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-1">
          {rightContent}
          <MusicControls />
          <Button variant="ghost" size="icon" onClick={handleProfileClick} className="relative">
            {avatarEmoji ? (
              <span className="text-lg">{avatarEmoji}</span>
            ) : (
              <User className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
};

export default GameHeader;
