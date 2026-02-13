import { useEffect, useCallback } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { hasValidSession } from './lib/gameUtils';
import { AudioProvider } from './contexts/AudioContext';
import { TransitionProvider } from './contexts/TransitionContext';
import { NetworkProvider } from './contexts/NetworkContext';
import { AuthProvider } from './contexts/AuthContext';
import { EntitlementProvider } from './contexts/EntitlementContext';
import { preloadAllImages } from './lib/imagePreloader';
import { syncCategories } from './lib/categoryCache';
import { getEntitlement } from './services/purchases/applePurchases';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';

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

// Preload all images immediately on app load
preloadAllImages();

// Initial sync on cold start (free-tier only, re-syncs with entitlement in EntitlementProvider)
syncCategories(false);

/**
 * Hook to re-sync categories when app is resumed (e.g. after force quit on mobile)
 */
function useSyncOnResume() {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncCategories(getEntitlement().isPro);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
}

/**
 * ProtectedRoute - allows access for both guest and authed users
 * Only redirects to onboarding if there's no session at all (mode === 'none')
 * Game flow routes (lobby, game, results) work for guests
 */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const hasSession = hasValidSession();
  
  // Guard check - stripped in production by esbuild
  
  // Allow access if user has any valid session (guest or authed)
  if (hasSession) {
    return <>{children}</>;
  }
  
  // No session at all - redirect to onboarding
  return <Navigate to="/onboarding" replace />;
};

const App = () => {
  useSyncOnResume();
  
  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <NetworkProvider>
        <AuthProvider>
          <EntitlementProvider>
            <AudioProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <OfflineBanner />
                
                <BrowserRouter>
                  <TransitionProvider>
                    
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
          </EntitlementProvider>
        </AuthProvider>
      </NetworkProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;