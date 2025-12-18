import foxWelcome from '@/assets/fox_welcome.png';

const LoadingScreen = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <img 
        src={foxWelcome} 
        alt="Welcome" 
        className="w-64 h-auto object-contain"
      />
    </div>
  );
};

export default LoadingScreen;
