import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Volume2, VolumeX, Moon, Sun, RefreshCw, Crown, ExternalLink, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAudio } from '@/contexts/AudioContext';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { isNative } from '@/lib/platform';
import { cn } from '@/lib/utils';
import { useEntitlement } from '@/contexts/EntitlementContext';
import { useAuth } from '@/contexts/AuthContext';

interface SettingsDropdownProps {
  className?: string;
}

export const SettingsDropdown = ({ className }: SettingsDropdownProps) => {
  const { volume, setVolume, isMuted, toggleMute } = useAudio();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { isPro, openManageSubscription } = useEntitlement();
  const { isGuest, signOutAndReset, profileId } = useAuth();
  const navigate = useNavigate();
  const [isSpinning, setIsSpinning] = useState(false);
  const scrollPosRef = useRef(0);

  const forceUpdate = async () => {
    toast.info('Clearing cache and reloading...');
    
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    
    window.location.href = window.location.pathname + '?v=' + Date.now();
  };

  const currentTheme = resolvedTheme || theme;

  // Prevent iOS scroll jump: capture scroll position before dropdown opens
  const handleTriggerPointerDown = useCallback(() => {
    scrollPosRef.current = window.scrollY;
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      setIsSpinning(true);
      setTimeout(() => setIsSpinning(false), 500);
      // Restore scroll position that iOS may have shifted
      const savedPos = scrollPosRef.current;
      requestAnimationFrame(() => {
        window.scrollTo(0, savedPos);
        // Double-check after a frame in case iOS adjusts late
        requestAnimationFrame(() => {
          window.scrollTo(0, savedPos);
        });
      });
    }
  }, []);

  return (
    <DropdownMenu onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          onPointerDown={handleTriggerPointerDown}
        >
          <Settings 
            className={cn(
              "h-5 w-5 transition-transform duration-500",
              isSpinning && "rotate-180"
            )} 
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Volume Controls */}
        <div className="px-2 py-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Music</span>
            <Button variant="ghost" size="sm" onClick={toggleMute} className="h-7 px-2 text-xs">
              {isMuted ? 'Unmute' : 'Mute'}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <VolumeX className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider
              value={[volume]}
              onValueChange={([v]) => setVolume(v)}
              max={1}
              step={0.01}
              className="flex-1"
            />
            <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </div>
        
        <DropdownMenuSeparator />
        
        {/* Theme Toggle */}
        <div className="px-2 py-2">
          <span className="text-sm font-medium mb-2 block">Theme</span>
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setTheme("light")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-sm transition-all",
                currentTheme === "light" 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sun className="h-4 w-4" />
              Light
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-sm transition-all",
                currentTheme === "dark" 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Moon className="h-4 w-4" />
              Dark
            </button>
          </div>
        </div>
        
        {/* Manage Subscription - only show when Pro */}
        {isPro && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openManageSubscription()}>
              <Crown className="h-4 w-4 mr-2 text-primary" />
              Manage Subscription
              <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
            </DropdownMenuItem>
          </>
        )}


        {/* Refresh Button - only show on web */}
        {!isNative() && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={forceUpdate}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Force Refresh
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
