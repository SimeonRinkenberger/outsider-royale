import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const ForceUpdateButton = () => {
  const forceUpdate = async () => {
    toast.info('Clearing cache and reloading...');
    
    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    
    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    
    // Hard reload with cache bypass
    window.location.href = window.location.pathname + '?v=' + Date.now();
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={forceUpdate}
      className="fixed top-4 left-14 z-50"
      title="Force update - clears cache and reloads"
    >
      <RefreshCw className="h-5 w-5" />
    </Button>
  );
};

export default ForceUpdateButton;
