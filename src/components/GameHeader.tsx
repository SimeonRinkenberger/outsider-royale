import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, BarChart3 } from 'lucide-react';

interface GameHeaderProps {
  title: string;
  showBack?: boolean;
  backPath?: string;
  onBack?: () => void;
  rightContent?: React.ReactNode;
}

const GameHeader = ({ title, showBack = true, backPath, onBack, rightContent }: GameHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };

  const handleProfileClick = () => {
    navigate('/stats');
  };

  return (
    <header className="bg-card border-b border-border p-4">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBack && (
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-xl font-bold truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {rightContent}
          <Button variant="ghost" size="icon" onClick={handleProfileClick}>
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default GameHeader;
