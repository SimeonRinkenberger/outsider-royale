import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState, useRef } from 'react';
import { Check, User, Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

const isCustomUrl = (avatar: string | null | undefined): boolean => {
  return !!avatar && (avatar.startsWith('http://') || avatar.startsWith('https://'));
};

export const AvatarPicker = ({ currentAvatar, displayName, onSelect }: AvatarPickerProps) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(currentAvatar);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentAvatarData = AVATAR_OPTIONS.find(a => a.id === currentAvatar);
  const isCustomAvatar = isCustomUrl(currentAvatar);

  const handleSelect = (avatarId: string) => {
    setSelected(avatarId);
  };

  const handleSave = () => {
    if (selected) {
      onSelect(selected);
    }
    setOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be smaller than 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload to storage (upsert to overwrite previous)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Add cache-busting param
      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;
      
      setSelected(urlWithCacheBust);
      onSelect(urlWithCacheBust);
      setOpen(false);
      toast.success('Avatar uploaded!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload avatar');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="relative group">
          <Avatar className="h-16 w-16 border-2 border-primary/50 group-hover:border-primary transition-colors">
            {isCustomAvatar ? (
              <AvatarImage src={currentAvatar!} alt="User avatar" className="object-cover" />
            ) : currentAvatarData ? (
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

        {/* Upload Button */}
        <div className="flex justify-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            className="gap-2 w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="h-4 w-4" /> Upload Custom Photo</>
            )}
          </Button>
        </div>

        <div className="relative flex items-center py-1">
          <div className="flex-1 border-t border-border" />
          <span className="px-3 text-xs text-muted-foreground">or choose an emoji</span>
          <div className="flex-1 border-t border-border" />
        </div>

        <div className="grid grid-cols-4 gap-3">
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
          <Button onClick={handleSave} disabled={!selected || isCustomUrl(selected)}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const getAvatarById = (avatarId: string | null | undefined) => {
  return AVATAR_OPTIONS.find(a => a.id === avatarId);
};

export { AVATAR_OPTIONS, isCustomUrl };
