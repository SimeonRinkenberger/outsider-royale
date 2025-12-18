import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
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
  const [originPoint, setOriginPoint] = useState({ x: 50, y: 50 }); // Percentage
  
  // Guards and refs
  const transitionLockRef = useRef(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const prepareCallbackRef = useRef<(() => Promise<string | void>) | null>(null);
  const mountedRef = useRef(true);
  
  // Motion value for radius (in pixels)
  const radius = useMotionValue(0);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Calculate max radius needed to cover screen
  const getMaxRadius = useCallback(() => {
    return Math.hypot(window.innerWidth, window.innerHeight);
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
      setOriginPoint({
        x: (options.origin.x / window.innerWidth) * 100,
        y: (options.origin.y / window.innerHeight) * 100,
      });
    } else {
      setOriginPoint({ x: 50, y: 50 });
    }
    
    // Calculate max radius
    const max = getMaxRadius();
    
    // Start at 0
    radius.set(0);
    
    // Start expanding phase
    setPhase('expanding');
    
    console.log('[TRANSITION] Animating expand: 0 ->', max);
    
    // Animate expansion
    animate(radius, max, {
      duration: EXPAND_DURATION,
      ease: [0.4, 0, 0.2, 1],
      onComplete: async () => {
        if (!mountedRef.current) return;
        console.log('[TRANSITION] Expand complete, starting loading phase');
        
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
          radius.set(0);
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
        
        // CRITICAL: Ensure radius is at max before shrinking
        const currentMax = getMaxRadius();
        radius.set(currentMax);
        console.log('[TRANSITION] Starting shrink from', currentMax, '-> 0');
        
        setPhase('shrinking');
        
        // Animate shrink
        animate(radius, 0, {
          duration: SHRINK_DURATION,
          ease: [0.4, 0, 0.2, 1],
          onComplete: () => {
            console.log('[TRANSITION] Shrink complete, going idle');
            setPhase('idle');
            transitionLockRef.current = false;
            pendingNavigationRef.current = null;
            prepareCallbackRef.current = null;
          },
        });
      },
    });
  }, [navigate, radius, getMaxRadius]);

  const isTransitioning = phase !== 'idle';

  return (
    <TransitionContext.Provider value={{ startTransition, phase, isTransitioning }}>
      {children}
      <TransitionOverlay 
        phase={phase} 
        loadingText={loadingText} 
        origin={originPoint}
        radius={radius}
      />
    </TransitionContext.Provider>
  );
};

interface TransitionOverlayProps {
  phase: TransitionPhase;
  loadingText: string;
  origin: { x: number; y: number };
  radius: ReturnType<typeof useMotionValue<number>>;
}

const TransitionOverlay: React.FC<TransitionOverlayProps> = ({ 
  phase, 
  loadingText, 
  origin,
  radius,
}) => {
  // Create clipPath from radius motion value
  const clipPath = useTransform(radius, (r) => {
    // During expanding, use origin point; during shrinking, use center
    const cx = phase === 'expanding' ? `${origin.x}%` : '50%';
    const cy = phase === 'expanding' ? `${origin.y}%` : '50%';
    return `circle(${r}px at ${cx} ${cy})`;
  });

  const isVisible = phase !== 'idle';

  if (!isVisible) return null;

  return createPortal(
    <motion.div
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
        clipPath: clipPath,
        WebkitClipPath: clipPath,
      }}
    >
      <LoadingScreen text={loadingText} />
    </motion.div>,
    document.body
  );
};

export default TransitionProvider;