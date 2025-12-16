import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { setStoredDisplayName } from '@/lib/gameUtils';
import { toast } from 'sonner';
import { Settings, User, Mail, Lock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AccountSettingsProps {
  profileId: string | null;
  currentDisplayName: string | null;
  currentEmail: string | null;
  onDisplayNameChange: (name: string) => void;
}

export const AccountSettings = ({ 
  profileId, 
  currentDisplayName, 
  currentEmail,
  onDisplayNameChange 
}: AccountSettingsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(currentDisplayName || '');
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleUpdateDisplayName = async () => {
    if (!profileId || !newDisplayName.trim()) {
      toast.error('Please enter a display name');
      return;
    }

    if (newDisplayName.trim().length > 50) {
      toast.error('Display name must be 50 characters or less');
      return;
    }

    setIsUpdatingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: newDisplayName.trim() })
        .eq('id', profileId);

      if (error) throw error;

      setStoredDisplayName(newDisplayName.trim());
      onDisplayNameChange(newDisplayName.trim());
      toast.success('Display name updated!');
    } catch (error) {
      console.error('Error updating display name:', error);
      toast.error('Failed to update display name');
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) {
      toast.error('Please enter a new email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsUpdatingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim()
      });

      if (error) throw error;

      toast.success('Email update sent! Check your new email to confirm.');
      setNewEmail('');
    } catch (error: any) {
      console.error('Error updating email:', error);
      toast.error(error.message || 'Failed to update email');
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast.error(error.message || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Account Settings</span>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-border"
                >
                  <div className="p-4 space-y-6">
                    {/* Display Name */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <Label className="font-medium">Display Name</Label>
                      </div>
                      <div className="space-y-2">
                        <Input
                          value={newDisplayName}
                          onChange={(e) => setNewDisplayName(e.target.value)}
                          placeholder="Enter display name"
                          maxLength={50}
                        />
                        <Button 
                          onClick={handleUpdateDisplayName} 
                          disabled={isUpdatingName || newDisplayName === currentDisplayName}
                          size="sm"
                          className="w-full"
                        >
                          {isUpdatingName ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Updating...</>
                          ) : (
                            'Update Display Name'
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-primary" />
                        <Label className="font-medium">Email</Label>
                      </div>
                      <p className="text-sm text-muted-foreground">Current: {currentEmail}</p>
                      <div className="space-y-2">
                        <Input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="Enter new email"
                        />
                        <Button 
                          onClick={handleUpdateEmail} 
                          disabled={isUpdatingEmail || !newEmail.trim()}
                          size="sm"
                          className="w-full"
                        >
                          {isUpdatingEmail ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</>
                          ) : (
                            'Update Email'
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-primary" />
                        <Label className="font-medium">Password</Label>
                      </div>
                      <div className="space-y-2">
                        <Input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New password"
                        />
                        <Input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                        />
                        <Button 
                          onClick={handleUpdatePassword} 
                          disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                          size="sm"
                          className="w-full"
                        >
                          {isUpdatingPassword ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Updating...</>
                          ) : (
                            'Update Password'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </motion.div>
  );
};
