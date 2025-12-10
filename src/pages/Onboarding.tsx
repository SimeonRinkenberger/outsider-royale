import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { setStoredUserId, setStoredDisplayName } from '@/lib/gameUtils';
import { toast } from 'sonner';
import { User } from 'lucide-react';

const Onboarding = () => {
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleContinue = async () => {
    if (!displayName.trim() || displayName.length > 16) {
      toast.error('Please enter a name (1-16 characters)');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({ display_name: displayName.trim() })
        .select()
        .single();

      if (error) throw error;

      setStoredUserId(data.id);
      setStoredDisplayName(data.display_name);
      
      toast.success(`Welcome, ${data.display_name}!`);
      navigate('/home');
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Failed to create profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
            <User className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white">Welcome!</h1>
          <p className="text-white/90 text-lg">
            Choose a display name to get started
          </p>
        </div>

        <div className="bg-card/95 backdrop-blur rounded-2xl p-6 space-y-6 shadow-card">
          <div className="space-y-2">
            <label className="text-sm font-medium">Display Name</label>
            <Input
              placeholder="Enter your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              className="h-12 text-base"
              onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
            />
            <p className="text-xs text-muted-foreground">
              {displayName.length}/50 characters
            </p>
          </div>

          <Button
            onClick={handleContinue}
            disabled={isLoading || !displayName.trim()}
            className="w-full h-12 text-base"
            size="lg"
          >
            {isLoading ? 'Creating...' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
