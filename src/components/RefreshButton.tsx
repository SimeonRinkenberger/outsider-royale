import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

const RefreshButton = () => {
  const goHome = () => {
    window.location.href = '/home';
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
