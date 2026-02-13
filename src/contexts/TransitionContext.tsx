import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useMotionValue, animate } from 'framer-motion';
import LoadingScreen from '@/components/LoadingScreen';

// Animation durations in seconds
const EXPAND_DURATION = 0.45;
const SHRINK_DURATION = 0.45;

type TransitionPhase = 'idle' | 'expanding' | 'loading' | 'shrinking' | 'waiting-reveal';

interface TransitionOptions {
  prepare?: () => Promise<string | void>;
  loadingText?: string;
  origin?: { x: number; y: number };
  reason?: string;
}

interface TransitionContextType {
  startTransition: (toRoute: string, options?: TransitionOptions) => void;
  phase: TransitionPhase;
  isTransitioning: boolean;
  markRevealReady: (id: number) => void;
  awaitingRevealId: number | null;
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
  const [originPoint, setOriginPoint] = useState({ x: 50, y: 50 });
  const [currentRadius, setCurrentRadius] = useState(0);
  const [awaitingRevealId, setAwaitingRevealId] = useState<number | null>(null);
  const [maxRadius, setMaxRadius] = useState(() => 
    typeof window !== 'undefined' ? Math.hypot(window.innerWidth, window.innerHeight) : 2000
  );
  
  // Stable refs
  const transitionLockRef = useRef(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const prepareCallbackRef = useRef<(() => Promise<string | void>) | null>(null);
  const mountedRef = useRef(true);
  const currentTransitionIdRef = useRef(0);
  const shrinkCompleteRef = useRef(false);
  const revealReadyRef = useRef(false);
  
  // CRITICAL: Motion value must be stable and never recreated
  const radiusRef = useRef(useMotionValue(0));
  const radius = radiusRef.current;
  
  // Track radius changes for display
  useEffect(() => {
    const unsubscribe = radius.on('change', (v) => {
      setCurrentRadius(Math.round(v));
    });
    return unsubscribe;
  }, [radius]);
  
  // Update maxRadius on resize
  useEffect(() => {
    const updateMaxRadius = () => {
      const newMax = Math.hypot(window.innerWidth, window.innerHeight);
      setMaxRadius(newMax);
    };
    
    window.addEventListener('resize', updateMaxRadius);
    return () => window.removeEventListener('resize', updateMaxRadius);
  }, []);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // markRevealReady is now a no-op - we complete transition immediately at shrink complete
  const markRevealReady = useCallback((id: number) => {
    // No-op: transition completes immediately at shrink
  }, []);

  const startTransition = useCallback(async (toRoute: string, options: TransitionOptions = {}) => {
    // HARD LOCK: Cannot start second transition
    if (transitionLockRef.current) {
      return;
    }
    
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      if (options.prepare) await options.prepare();
      navigate(toRoute);
      return;
    }
    
    // Reset reveal state
    shrinkCompleteRef.current = false;
    revealReadyRef.current = false;
    setAwaitingRevealId(null);
    
    // Increment transition ID
    const thisTransitionId = currentTransitionIdRef.current + 1;
    currentTransitionIdRef.current = thisTransitionId;
    
    // ACQUIRE LOCK
    transitionLockRef.current = true;
    pendingNavigationRef.current = toRoute;
    prepareCallbackRef.current = options.prepare || null;
    
    setLoadingText(options.loadingText || 'Loading');
    
    if (options.origin) {
      setOriginPoint({
        x: (options.origin.x / window.innerWidth) * 100,
        y: (options.origin.y / window.innerHeight) * 100,
      });
    } else {
      setOriginPoint({ x: 50, y: 50 });
    }
    
    // Calculate max radius
    const max = Math.hypot(window.innerWidth, window.innerHeight);
    setMaxRadius(max);
    
    // Start at 0
    radius.set(0);
    
    // Start expanding phase
    setPhase('expanding');
    
    // Animate expansion
    animate(radius, max, {
      duration: EXPAND_DURATION,
      ease: [0.4, 0, 0.2, 1],
      onComplete: async () => {
        if (!mountedRef.current) {
          return;
        }
        
        setPhase('loading');
        
        let finalRoute = pendingNavigationRef.current;
        
        // Run prepare callback
        try {
          if (prepareCallbackRef.current) {
            const dynamicRoute = await prepareCallbackRef.current();
            if (dynamicRoute) {
              finalRoute = dynamicRoute;
            }
          }
        } catch (error) {
          // RELEASE LOCK on error
          setPhase('idle');
          radius.set(0);
          transitionLockRef.current = false;
          pendingNavigationRef.current = null;
          prepareCallbackRef.current = null;
          return;
        }
        
        if (!mountedRef.current) {
          return;
        }
        
        // NAVIGATE while overlay covers everything
        if (finalRoute) {
          navigate(finalRoute);
        }
        
        // Wait for React to render the new route
        await new Promise(resolve => {
          requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
          });
        });
        
        if (!mountedRef.current) {
          return;
        }
        
        // CRITICAL: Ensure radius is at max before shrinking
        const currentMax = Math.hypot(window.innerWidth, window.innerHeight);
        radius.set(currentMax);
        
        setPhase('shrinking');
        
        // Animate shrink
        animate(radius, 0, {
          duration: SHRINK_DURATION,
          ease: [0.4, 0, 0.2, 1],
          onComplete: () => {
            // IMMEDIATELY complete transition
            setPhase('idle');
            
            transitionLockRef.current = false;
            pendingNavigationRef.current = null;
            prepareCallbackRef.current = null;
            shrinkCompleteRef.current = false;
            revealReadyRef.current = false;
            setAwaitingRevealId(null);
          },
        });
      },
    });
  }, [navigate, radius]);

  const isTransitioning = phase !== 'idle';

  return (
    <TransitionContext.Provider value={{ startTransition, phase, isTransitioning, markRevealReady, awaitingRevealId }}>
      {children}
      <TransitionOverlay 
        phase={phase} 
        loadingText={loadingText} 
        origin={originPoint}
        currentRadius={currentRadius}
      />
    </TransitionContext.Provider>
  );
};

interface TransitionOverlayProps {
  phase: TransitionPhase;
  loadingText: string;
  origin: { x: number; y: number };
  currentRadius: number;
}

const TransitionOverlay: React.FC<TransitionOverlayProps> = ({ 
  phase, 
  loadingText, 
  origin,
  currentRadius,
}) => {
  const isVisible = phase !== 'idle';

  if (!isVisible) {
    return null;
  }

  const cx = phase === 'expanding' ? `${origin.x}%` : '50%'
  const cy = phase === 'expanding' ? `${origin.y}%` : '50%';

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'hsl(var(--background))',
        opacity: 1,
        pointerEvents: 'all',
        clipPath: `circle(${currentRadius}px at ${cx} ${cy})`,
        WebkitClipPath: `circle(${currentRadius}px at ${cx} ${cy})`,
        willChange: 'clip-path',
        transform: 'translateZ(0)', // Force GPU acceleration
      }}
    >
      <LoadingScreen text={loadingText} isTransitionOverlay={true} />
    </div>,
    document.body
  );
};

export default TransitionProvider;
