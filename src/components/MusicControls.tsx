import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAudio } from '@/contexts/AudioContext';

interface MusicControlsProps {
  className?: string;
}

export const MusicControls = ({ className }: MusicControlsProps) => {
  const { volume, setVolume, isMuted, toggleMute } = useAudio();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={className}>
          {isMuted || volume === 0 ? (
            <VolumeX className="h-5 w-5" />
          ) : (
            <Volume2 className="h-5 w-5" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Music</span>
            <Button variant="ghost" size="sm" onClick={toggleMute} className="h-8 px-2">
              {isMuted ? 'Unmute' : 'Mute'}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <VolumeX className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[volume]}
              onValueChange={([v]) => setVolume(v)}
              max={1}
              step={0.01}
              className="flex-1"
            />
            <Volume2 className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
