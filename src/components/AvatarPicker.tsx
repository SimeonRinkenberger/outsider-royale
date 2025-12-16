import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState } from 'react';
import { Check, User } from 'lucide-react';

// Generic character avatars - using emoji-based avatars
const AVATAR_OPTIONS = [
  { id: 'avatar-1', emoji: '🦊', color: 'bg-orange-500' },
  { id: 'avatar-2', emoji: '🐼', color: 'bg-slate-600' },
  { id: 'avatar-3', emoji: '🦁', color: 'bg-amber-500' },
  { id: 'avatar-4', emoji: '🐸', color: 'bg-green-500' },
  { id: 'avatar-5', emoji: '🐙', color: 'bg-pink-500' },
  { id: 'avatar-6', emoji: '🦄', color: 'bg-purple-500' },
  { id: 'avatar-7', emoji: '🐲', color: 'bg-red-500' },
  { id: 'avatar-8', emoji: '🦋', color: 'bg-blue-500' },
  { id: 'avatar-9', emoji: '🐯', color: 'bg-yellow-500' },
  { id: 'avatar-10', emoji: '🦉', color: 'bg-brown-500' },
  { id: 'avatar-11', emoji: '🐺', color: 'bg-gray-500' },
  { id: 'avatar-12', emoji: '🦈', color: 'bg-cyan-500' },
  { id: 'avatar-13', emoji: '🐢', color: 'bg-teal-500' },
  { id: 'avatar-14', emoji: '🦜', color: 'bg-lime-500' },
  { id: 'avatar-15', emoji: '🐨', color: 'bg-zinc-500' },
  { id: 'avatar-16', emoji: '🦔', color: 'bg-stone-500' },
];

interface AvatarPickerProps {
  currentAvatar?: string | null;
  displayName?: string;
  onSelect: (avatarId: string) => void;
}

export const AvatarPicker = ({ currentAvatar, displayName, onSelect }: AvatarPickerProps) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(currentAvatar);

  const currentAvatarData = AVATAR_OPTIONS.find(a => a.id === currentAvatar);

  const handleSelect = (avatarId: string) => {
    setSelected(avatarId);
  };

  const handleSave = () => {
    if (selected) {
      onSelect(selected);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="relative group">
          <Avatar className="h-16 w-16 border-2 border-primary/50 group-hover:border-primary transition-colors">
            {currentAvatarData ? (
              <div className={`w-full h-full flex items-center justify-center text-3xl ${currentAvatarData.color}`}>
                {currentAvatarData.emoji}
              </div>
            ) : (
              <AvatarFallback className="bg-muted">
                {displayName ? displayName.charAt(0).toUpperCase() : <User className="h-6 w-6" />}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-xs text-white font-medium">Edit</span>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Your Avatar</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-3 py-4">
          {AVATAR_OPTIONS.map((avatar) => (
            <button
              key={avatar.id}
              onClick={() => handleSelect(avatar.id)}
              className={`relative p-2 rounded-xl transition-all ${
                selected === avatar.id 
                  ? 'ring-2 ring-primary bg-primary/10 scale-110' 
                  : 'hover:bg-muted hover:scale-105'
              }`}
            >
              <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center text-2xl ${avatar.color}`}>
                {avatar.emoji}
              </div>
              {selected === avatar.id && (
                <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!selected}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const getAvatarById = (avatarId: string | null | undefined) => {
  return AVATAR_OPTIONS.find(a => a.id === avatarId);
};

export { AVATAR_OPTIONS };
