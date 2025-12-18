import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
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
  
  const [phase, setPhase] = useState<TransitionPhase>('idle');
  const [loadingText, setLoadingText] = useState('Loading');
  const [origin, setOrigin] = useState({ x: 0.5, y: 0.5 }); // Normalized 0-1
  
  // Guards and refs for state machine
  const transitionLockRef = useRef(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const prepareCallbackRef = useRef<(() => Promise<string | void>) | null>(null);
  const mountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Handle phase transitions via animation completion
  const handleAnimationComplete = useCallback(async () => {
    if (!mountedRef.current) return;
    
    console.log('[Transition] Animation complete, phase:', phase);
    
    if (phase === 'expanding') {
      // Expand finished -> move to loading and run prepare
      setPhase('loading');
      
      let finalRoute = pendingNavigationRef.current;
      
      try {
        if (prepareCallbackRef.current) {
          console.log('[Transition] Running prepare()');
          const dynamicRoute = await prepareCallbackRef.current();
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
        prepareCallbackRef.current = null;
        return;
      }
      
      if (!mountedRef.current) return;
      console.log('[Transition] Prepare complete, navigating to:', finalRoute);
      
      // Navigate now (while still covered by overlay)
      if (finalRoute) {
        navigate(finalRoute);
      }
      
      // Small delay to let React render the new route (still hidden behind overlay)
      await new Promise(resolve => requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      }));
      
      if (!mountedRef.current) return;
      
      // Now trigger shrink animation
      console.log('[Transition] Starting shrink');
      setPhase('shrinking');
      
    } else if (phase === 'shrinking') {
      // Shrink finished -> back to idle
      console.log('[Transition] Shrink complete, going idle');
      setPhase('idle');
      transitionLockRef.current = false;
      pendingNavigationRef.current = null;
      prepareCallbackRef.current = null;
    }
  }, [phase, navigate]);

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
    pendingNavigationRef.current = toRoute;
    prepareCallbackRef.current = options.prepare || null;
    
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
    
    // Start expanding phase - the animation completion will handle the rest
    setPhase('expanding');
  }, [navigate]);

  const isTransitioning = phase !== 'idle';

  return (
    <TransitionContext.Provider value={{ startTransition, phase, isTransitioning }}>
      {children}
      <TransitionOverlay 
        phase={phase} 
        loadingText={loadingText} 
        origin={origin}
        onAnimationComplete={handleAnimationComplete}
      />
    </TransitionContext.Provider>
  );
};

// The circular reveal overlay component
interface TransitionOverlayProps {
  phase: TransitionPhase;
  loadingText: string;
  origin: { x: number; y: number };
  onAnimationComplete: () => void;
}

const TransitionOverlay: React.FC<TransitionOverlayProps> = ({ 
  phase, 
  loadingText, 
  origin,
  onAnimationComplete 
}) => {
  // Origin is normalized 0-1, convert to percentage
  const originX = `${origin.x * 100}%`;
  const originY = `${origin.y * 100}%`;
  
  // Define clip paths for each phase
  const clipPaths = {
    idle: `circle(0% at 50% 50%)`,
    expanding: `circle(150% at ${originX} ${originY})`,
    loading: `circle(150% at 50% 50%)`,
    shrinking: `circle(0% at 50% 50%)`,
  };
  
  const initialClipPath = `circle(0% at ${originX} ${originY})`;
  
  // Get animation duration based on phase
  const getDuration = () => {
    if (phase === 'expanding') return EXPAND_DURATION / 1000;
    if (phase === 'shrinking') return SHRINK_DURATION / 1000;
    return 0.1; // Quick transition for loading phase
  };

  const isVisible = phase !== 'idle';

  // Don't render anything when idle
  if (!isVisible) return null;

  return createPortal(
    <motion.div
      key="transition-overlay"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
      initial={{ clipPath: initialClipPath }}
      animate={{ clipPath: clipPaths[phase] }}
      transition={{ 
        duration: getDuration(),
        ease: [0.4, 0, 0.2, 1]
      }}
      onAnimationComplete={() => {
        // Only trigger callback for expanding and shrinking phases
        if (phase === 'expanding' || phase === 'shrinking') {
          onAnimationComplete();
        }
      }}
      style={{
        // Ensure overlay blocks all interaction
        pointerEvents: 'all',
      }}
    >
      <LoadingScreen text={loadingText} />
    </motion.div>,
    document.body
  );
};

export default TransitionProvider;