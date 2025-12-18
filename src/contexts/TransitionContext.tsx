import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, Variants } from 'framer-motion';
import LoadingScreen from '@/components/LoadingScreen';

// Animation durations in seconds
const EXPAND_DURATION = 0.45;
const SHRINK_DURATION = 0.45;

type TransitionPhase = 'idle' | 'expanding' | 'loading' | 'shrinking';

interface TransitionOptions {
  prepare?: () => Promise<string | void>;
  loadingText?: string;
  origin?: { x: number; y: number };
}

interface TransitionContextType {
  startTransition: (toRoute: string, options?: TransitionOptions) => void;
  phase: TransitionPhase;
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
  const [origin, setOrigin] = useState({ x: 50, y: 50 }); // Percentage values
  
  // Guards and refs
  const transitionLockRef = useRef(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const prepareCallbackRef = useRef<(() => Promise<string | void>) | null>(null);
  const mountedRef = useRef(true);
  
  // Debug: Log phase changes
  useEffect(() => {
    console.log('[TRANSITION] phase ->', phase);
  }, [phase]);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Called when expand animation completes
  const handleExpandComplete = useCallback(async () => {
    if (!mountedRef.current) return;
    console.log('[TRANSITION] Expand animation complete');
    
    // Move to loading phase
    setPhase('loading');
    
    let finalRoute = pendingNavigationRef.current;
    
    try {
      if (prepareCallbackRef.current) {
        console.log('[TRANSITION] Running prepare()');
        const dynamicRoute = await prepareCallbackRef.current();
        if (dynamicRoute) {
          finalRoute = dynamicRoute;
        }
      }
    } catch (error) {
      console.error('[TRANSITION] Prepare failed:', error);
      setPhase('idle');
      transitionLockRef.current = false;
      pendingNavigationRef.current = null;
      prepareCallbackRef.current = null;
      return;
    }
    
    if (!mountedRef.current) return;
    
    // Navigate while overlay covers everything
    if (finalRoute) {
      console.log('[TRANSITION] Navigating to:', finalRoute);
      navigate(finalRoute);
    }
    
    // Wait for React to render the new route
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
    
    if (!mountedRef.current) return;
    
    // NOW trigger shrink - overlay is still at 150%
    console.log('[TRANSITION] Starting shrink phase');
    setPhase('shrinking');
  }, [navigate]);

  // Called when shrink animation completes
  const handleShrinkComplete = useCallback(() => {
    console.log('[TRANSITION] Shrink animation complete');
    setPhase('idle');
    transitionLockRef.current = false;
    pendingNavigationRef.current = null;
    prepareCallbackRef.current = null;
  }, []);

  const startTransition = useCallback(async (toRoute: string, options: TransitionOptions = {}) => {
    if (transitionLockRef.current) {
      console.log('[TRANSITION] Blocked: already in progress');
      return;
    }
    
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      if (options.prepare) await options.prepare();
      navigate(toRoute);
      return;
    }
    
    console.log('[TRANSITION] Starting transition to:', toRoute);
    
    transitionLockRef.current = true;
    pendingNavigationRef.current = toRoute;
    prepareCallbackRef.current = options.prepare || null;
    
    setLoadingText(options.loadingText || 'Loading');
    
    if (options.origin) {
      setOrigin({
        x: (options.origin.x / window.innerWidth) * 100,
        y: (options.origin.y / window.innerHeight) * 100,
      });
    } else {
      setOrigin({ x: 50, y: 50 });
    }
    
    // Start with expanding
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
        onExpandComplete={handleExpandComplete}
        onShrinkComplete={handleShrinkComplete}
      />
    </TransitionContext.Provider>
  );
};

interface TransitionOverlayProps {
  phase: TransitionPhase;
  loadingText: string;
  origin: { x: number; y: number };
  onExpandComplete: () => void;
  onShrinkComplete: () => void;
}

const TransitionOverlay: React.FC<TransitionOverlayProps> = ({ 
  phase, 
  loadingText, 
  origin,
  onExpandComplete,
  onShrinkComplete,
}) => {
  // Track what phase we're animating FROM to properly detect completion
  const lastPhaseRef = useRef<TransitionPhase>('idle');
  
  // Define variants for each phase
  // Key insight: clipPath circle() where 150% covers entire screen, 0% reveals everything
  const variants: Variants = {
    idle: {
      clipPath: `circle(0% at ${origin.x}% ${origin.y}%)`,
    },
    expanding: {
      clipPath: `circle(150% at ${origin.x}% ${origin.y}%)`,
      transition: { duration: EXPAND_DURATION, ease: [0.4, 0, 0.2, 1] },
    },
    loading: {
      clipPath: `circle(150% at 50% 50%)`,
      transition: { duration: 0.1, ease: 'linear' },
    },
    shrinking: {
      clipPath: `circle(0% at 50% 50%)`,
      transition: { duration: SHRINK_DURATION, ease: [0.4, 0, 0.2, 1] },
    },
  };

  const handleAnimationComplete = (definition: string) => {
    console.log('[TRANSITION] onAnimationComplete, definition:', definition, 'phase:', phase);
    
    if (definition === 'expanding' && phase === 'expanding') {
      onExpandComplete();
    } else if (definition === 'shrinking' && phase === 'shrinking') {
      onShrinkComplete();
    }
  };

  // Update last phase ref
  useEffect(() => {
    lastPhaseRef.current = phase;
  }, [phase]);

  const isVisible = phase !== 'idle';
  
  // Get clip path for debug display
  const getClipPathForPhase = (p: TransitionPhase) => {
    if (p === 'idle') return `circle(0% at ${origin.x}% ${origin.y}%)`;
    if (p === 'expanding') return `circle(150% at ${origin.x}% ${origin.y}%)`;
    if (p === 'loading') return `circle(150% at 50% 50%)`;
    if (p === 'shrinking') return `circle(0% at 50% 50%)`;
    return 'unknown';
  };
  
  // Debug: log current state
  useEffect(() => {
    if (isVisible) {
      console.log('[TRANSITION] Overlay visible, phase:', phase, 'clipPath target:', getClipPathForPhase(phase));
    }
  }, [phase, isVisible]);

  if (!isVisible) return null;

  return createPortal(
    <>
      {/* Debug label - remove after fixing */}
      <div 
        style={{
          position: 'fixed',
          top: 10,
          left: 10,
          zIndex: 10000,
          background: 'rgba(0,0,0,0.8)',
          color: '#0f0',
          padding: '8px 12px',
          borderRadius: 4,
          fontFamily: 'monospace',
          fontSize: 12,
        }}
      >
        Phase: {phase}
        <br />
        Target: {getClipPathForPhase(phase).slice(0, 35)}...
      </div>
      
      {/* The actual overlay */}
      <motion.div
        key="transition-overlay"
        initial="idle"
        animate={phase}
        variants={variants}
        onAnimationComplete={handleAnimationComplete}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'hsl(var(--background))',
          pointerEvents: 'all',
        }}
      >
        <LoadingScreen text={loadingText} />
      </motion.div>
    </>,
    document.body
  );
};

export default TransitionProvider;