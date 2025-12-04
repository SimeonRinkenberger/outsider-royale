import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

const RefreshButton = () => {
  const goHome = () => {
    // Force hard reload with cache bust to pick up any published updates
    window.location.href = '/home?v=' + Date.now();
    window.location.reload();
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={goHome}
      className="fixed top-4 right-4 z-50 h-10 w-10 rounded-full shadow-lg bg-card border-border"
    >
      <Home className="h-4 w-4" />
    </Button>
  );
};

export default RefreshButton;
