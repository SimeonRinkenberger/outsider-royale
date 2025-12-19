import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { getStoredUserId } from './lib/gameUtils';
import { AudioProvider } from './contexts/AudioContext';
import { TransitionProvider } from './contexts/TransitionContext';
import ThemeToggle from './components/ThemeToggle';
import ForceUpdateButton from './components/ForceUpdateButton';
import ErrorBoundary from './components/ErrorBoundary';
import Menu from './pages/Menu';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Auth from './pages/Auth';
import AuthCallback from './pages/AuthCallback';
import Stats from './pages/Stats';
import InPersonSetup from './pages/InPersonSetup';
import InPersonGame from './pages/InPersonGame';
import Lobby from './pages/Lobby';
import Game from './pages/Game';
import Results from './pages/Results';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  // getStoredUserId is synchronous (localStorage), no need for loading state
  const userId = getStoredUserId();
  return userId ? <>{children}</> : <Navigate to="/onboarding" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AudioProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <TransitionProvider>
              <ThemeToggle />
              <ForceUpdateButton />
              
              <Routes>
              <Route path="/" element={<Menu />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/in-person" element={<InPersonSetup />} />
              <Route path="/in-person/game" element={<InPersonGame />} />
              <Route path="/stats" element={<Stats />} />
              <Route
                path="/home"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lobby/:lobbyId"
                element={
                  <ProtectedRoute>
                    <Lobby />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/game/:lobbyId"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallbackMessage="Something went wrong loading the game. Tap to retry.">
                      <Game />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/results/:lobbyId"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary fallbackMessage="Something went wrong loading the results. Tap to retry.">
                      <Results />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TransitionProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AudioProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;