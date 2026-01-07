import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getStoredUserId, getStoredAvatarId, setStoredAvatarId } from '@/lib/gameUtils';
import { getAvatarById } from '@/components/AvatarPicker';
import { useTransition } from '@/contexts/TransitionContext';
import { SettingsDropdown } from '@/components/SettingsDropdown';
interface GameHeaderProps {
  title: string;
  showBack?: boolean;
  backPath?: string;
  onBack?: () => void;
  rightContent?: React.ReactNode;
}
const GameHeader = ({
  title,
  showBack = true,
  backPath,
  onBack,
  rightContent
}: GameHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    startTransition
  } = useTransition();
  const userId = getStoredUserId();

  // Initialize from localStorage cache immediately
  const cachedAvatarId = getStoredAvatarId();
  const cachedAvatar = cachedAvatarId ? getAvatarById(cachedAvatarId) : null;
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(cachedAvatar?.emoji || null);
  const [isNavigating, setIsNavigating] = useState(false);
  useEffect(() => {
    const fetchAvatar = async () => {
      if (!userId) return;
      const {
        data: profile
      } = await supabase.from('profiles').select('avatar_url').eq('id', userId).maybeSingle();
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
      startTransition(backPath);
    } else {
      navigate(-1);
    }

    // Reset after animation
    setTimeout(() => setIsNavigating(false), 500);
  };
  const handleProfileClick = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    startTransition('/stats', {
      origin: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      }
    });
  };
  return <header className="bg-card border-b border-border p-4 sticky top-0 z-20">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {showBack && <Button variant="ghost" size="icon" onClick={handleBack} disabled={isNavigating} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>}
          
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {rightContent}
          <SettingsDropdown />
          <Button variant="ghost" size="icon" onClick={handleProfileClick} className="relative">
            {avatarEmoji ? <span className="text-lg">{avatarEmoji}</span> : <User className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </header>;
};
export default GameHeader;