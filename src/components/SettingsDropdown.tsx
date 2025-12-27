import { useState } from 'react';
import { Settings, Volume2, VolumeX, Moon, Sun, RefreshCw } from 'lucide-react';
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

interface SettingsDropdownProps {
  className?: string;
}

export const SettingsDropdown = ({ className }: SettingsDropdownProps) => {
  const { volume, setVolume, isMuted, toggleMute } = useAudio();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

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

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className}>
          <Settings 
            className={cn(
              "h-5 w-5 transition-transform duration-500",
              isOpen && "animate-spin"
            )} 
            style={{ animationDuration: isOpen ? '0.5s' : undefined }}
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
