import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

const RefreshButton = () => {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => window.location.reload()}
      className="fixed top-4 right-4 z-50 h-10 w-10 rounded-full shadow-lg bg-card border-border"
    >
      <RefreshCw className="h-4 w-4" />
    </Button>
  );
};

export default RefreshButton;
