import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingScreen from '@/components/LoadingScreen';

// Animation durations in ms
const EXPAND_DURATION = 400;
const SHRINK_DURATION = 400;

type TransitionPhase = 'idle' | 'expanding' | 'loading' | 'shrinking';

interface TransitionOptions {
  /** Async work to do while loading. Can return the target route if dynamic. */
  prepare?: () => Promise<string | void>;
  /** Custom loading text */
  loadingText?: string;
  /** Origin point for the circle (defaults to center) */
  origin?: { x: number; y: number };
}

interface TransitionContextType {
  /** Start a transition to a new route. If toRoute is empty, prepare() must return the route. */
  startTransition: (toRoute: string, options?: TransitionOptions) => void;
  /** Current phase of the transition */
  phase: TransitionPhase;
  /** Whether a transition is in progress */
  isTransitioning: boolean;
}

const TransitionContext = createContext<TransitionContextType | null>(null);

export const useTransition = () => {
  const context = useContext(TransitionContext);
  if (!context) {
    throw new Error('useTransition must be used within TransitionProvider');
  }
  return context;
};

export const TransitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [phase, setPhase] = useState<TransitionPhase>('idle');
  const [loadingText, setLoadingText] = useState('Loading');
  const [origin, setOrigin] = useState({ x: 0.5, y: 0.5 }); // Normalized 0-1
  
  // Guards to prevent double navigation
  const transitionLockRef = useRef(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  
  // Track if we've navigated to prevent re-navigation
  const hasNavigatedRef = useRef(false);
  
  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const startTransition = useCallback(async (toRoute: string, options: TransitionOptions = {}) => {
    // Idempotency guard - prevent double transitions
    if (transitionLockRef.current) {
      console.log('[Transition] Blocked: transition already in progress');
      return;
    }
    
    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      if (options.prepare) await options.prepare();
      navigate(toRoute);
      return;
    }
    
    console.log('[Transition] Start ->', toRoute);
    
    // Lock transition
    transitionLockRef.current = true;
    hasNavigatedRef.current = false;
    pendingNavigationRef.current = toRoute;
    
    // Set loading text and origin
    setLoadingText(options.loadingText || 'Loading');
    if (options.origin) {
      setOrigin({
        x: options.origin.x / window.innerWidth,
        y: options.origin.y / window.innerHeight,
      });
    } else {
      setOrigin({ x: 0.5, y: 0.5 });
    }
    
    // Phase 1: Expanding
    setPhase('expanding');
    
    // Wait for expand animation to complete
    await new Promise(resolve => setTimeout(resolve, EXPAND_DURATION));
    if (!mountedRef.current) return;
    
    console.log('[Transition] Expand complete');
    
    // Phase 2: Loading - execute prepare callback
    setPhase('loading');
    
    let finalRoute = pendingNavigationRef.current;
    
    try {
      if (options.prepare) {
        const dynamicRoute = await options.prepare();
        // If prepare returns a route, use that instead
        if (dynamicRoute) {
          finalRoute = dynamicRoute;
          pendingNavigationRef.current = dynamicRoute;
        }
      }
    } catch (error) {
      console.error('[Transition] Prepare failed:', error);
      // Reset on error
      setPhase('idle');
      transitionLockRef.current = false;
      pendingNavigationRef.current = null;
      return;
    }
    
    if (!mountedRef.current) return;
    console.log('[Transition] Prepare complete');
    
    // Navigate now (while still covered by overlay)
    if (!hasNavigatedRef.current && finalRoute) {
      hasNavigatedRef.current = true;
      console.log('[Transition] Route changed ->', finalRoute);
      navigate(finalRoute);
    }
    
    // Small delay to let React render the new route (still hidden)
    await new Promise(resolve => requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    }));
    
    if (!mountedRef.current) return;
    
    // Phase 3: Shrinking to reveal new screen
    setPhase('shrinking');
    
    // Wait for shrink animation to complete
    await new Promise(resolve => setTimeout(resolve, SHRINK_DURATION));
    
    if (!mountedRef.current) return;
    console.log('[Transition] Shrink complete');
    
    // Done - cleanup
    setPhase('idle');
    transitionLockRef.current = false;
    pendingNavigationRef.current = null;
  }, [navigate]);

  const isTransitioning = phase !== 'idle';

  return (
    <TransitionContext.Provider value={{ startTransition, phase, isTransitioning }}>
      {children}
      <TransitionOverlay 
        phase={phase} 
        loadingText={loadingText} 
        origin={origin}
      />
    </TransitionContext.Provider>
  );
};

// The circular reveal overlay component
interface TransitionOverlayProps {
  phase: TransitionPhase;
  loadingText: string;
  origin: { x: number; y: number };
}

const TransitionOverlay: React.FC<TransitionOverlayProps> = ({ phase, loadingText, origin }) => {
  // Calculate clip-path based on phase
  // Origin is normalized 0-1, convert to percentage
  const originX = `${origin.x * 100}%`;
  const originY = `${origin.y * 100}%`;
  
  const getClipPath = () => {
    switch (phase) {
      case 'expanding':
        return `circle(150% at ${originX} ${originY})`;
      case 'loading':
        return `circle(150% at 50% 50%)`;
      case 'shrinking':
        return `circle(0% at 50% 50%)`;
      case 'idle':
      default:
        return `circle(0% at 50% 50%)`;
    }
  };
  
  const getInitialClipPath = () => {
    if (phase === 'expanding') {
      return `circle(0% at ${originX} ${originY})`;
    }
    return `circle(150% at 50% 50%)`;
  };

  const isActive = phase !== 'idle';

  return createPortal(
    <AnimatePresence>
      {isActive && (
        <motion.div
          key={`transition-${phase}`}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
          initial={{ clipPath: getInitialClipPath() }}
          animate={{ clipPath: getClipPath() }}
          transition={{ 
            duration: phase === 'expanding' ? EXPAND_DURATION / 1000 : SHRINK_DURATION / 1000,
            ease: [0.4, 0, 0.2, 1]
          }}
        >
          <LoadingScreen text={loadingText} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default TransitionProvider;
