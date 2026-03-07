import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { setStoredDisplayName } from '@/lib/gameUtils';
import { toast } from 'sonner';
import { Settings, User, Mail, Lock, ChevronDown, Loader2, Eye, EyeOff, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { z } from 'zod';

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain a special character');

const getPasswordRequirements = (password: string) => ({
  minLength: password.length >= 8,
  hasLowercase: /[a-z]/.test(password),
  hasUppercase: /[A-Z]/.test(password),
  hasNumber: /[0-9]/.test(password),
  hasSpecial: /[^a-zA-Z0-9]/.test(password),
});

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
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
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
    try {
      passwordSchema.parse(newPassword);
    } catch (e) {
      if (e instanceof z.ZodError) {
        toast.error(e.errors[0].message);
        return;
      }
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully!');
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
        <Card className="p-4 bg-gradient-card border-border">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Settings className={`h-4 w-4 ${isOpen ? 'animate-spin-cw' : 'animate-spin-ccw'}`} />
              Account Settings
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="space-y-6 pt-4">
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
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {newPassword.length > 0 && (
                    <div className="space-y-1 text-xs">
                      {[
                        { key: 'minLength', label: 'At least 8 characters' },
                        { key: 'hasLowercase', label: 'Lowercase letter' },
                        { key: 'hasUppercase', label: 'Uppercase letter' },
                        { key: 'hasNumber', label: 'Number' },
                        { key: 'hasSpecial', label: 'Special character (!@#$...)' },
                      ].map(({ key, label }) => {
                        const met = getPasswordRequirements(newPassword)[key as keyof ReturnType<typeof getPasswordRequirements>];
                        return (
                          <div key={key} className={`flex items-center gap-1.5 ${met ? 'text-green-500' : 'text-muted-foreground'}`}>
                            {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            <span>{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </motion.div>
  );
};
