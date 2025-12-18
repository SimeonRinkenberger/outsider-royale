import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useMotionValue, animate } from 'framer-motion';
import LoadingScreen from '@/components/LoadingScreen';

// Animation durations in seconds
const EXPAND_DURATION = 0.45;
const SHRINK_DURATION = 0.45;

// Debug mode - ENABLED until confirmed working
const DEBUG_MODE = true;

type TransitionPhase = 'idle' | 'expanding' | 'loading' | 'shrinking';

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
  const [originPoint, setOriginPoint] = useState({ x: 50, y: 50 });
  const [transitionId, setTransitionId] = useState(0);
  const [currentRadius, setCurrentRadius] = useState(0);
  const [reason, setReason] = useState<string>('');
  const [maxRadius, setMaxRadius] = useState(() => 
    typeof window !== 'undefined' ? Math.hypot(window.innerWidth, window.innerHeight) : 2000
  );
  
  // Stable refs - CRITICAL: these must never cause re-renders during animation
  const transitionLockRef = useRef(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const prepareCallbackRef = useRef<(() => Promise<string | void>) | null>(null);
  const mountedRef = useRef(true);
  const currentTransitionIdRef = useRef(0);
  
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
    console.log('[TRANSITION] Provider mounted - overlay is persistent');
    return () => {
      mountedRef.current = false;
      console.log('[TRANSITION] Provider unmounted');
    };
  }, []);

  const startTransition = useCallback(async (toRoute: string, options: TransitionOptions = {}) => {
    // HARD LOCK: Cannot start second transition
    if (transitionLockRef.current) {
      console.log(`[TRANSITION] ⛔ BLOCKED second start reason="${options.reason || 'unknown'}" to="${toRoute}" (current transition in progress)`);
      return;
    }
    
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      if (options.prepare) await options.prepare();
      navigate(toRoute);
      return;
    }
    
    // Increment transition ID
    const thisTransitionId = currentTransitionIdRef.current + 1;
    currentTransitionIdRef.current = thisTransitionId;
    setTransitionId(thisTransitionId);
    setReason(options.reason || 'navigation');
    
    console.log(`[TRANSITION] ▶️ START id=${thisTransitionId} reason="${options.reason || 'navigation'}" to="${toRoute}"`);
    
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
    
    console.log(`[TRANSITION] 📈 Expanding id=${thisTransitionId}: 0 -> ${Math.round(max)}px`);
    
    // Animate expansion
    animate(radius, max, {
      duration: EXPAND_DURATION,
      ease: [0.4, 0, 0.2, 1],
      onComplete: async () => {
        if (!mountedRef.current) {
          console.log(`[TRANSITION] ⚠️ Expand done but unmounted id=${thisTransitionId}`);
          return;
        }
        
        console.log(`[TRANSITION] ✅ Expand complete id=${thisTransitionId}`);
        
        setPhase('loading');
        
        let finalRoute = pendingNavigationRef.current;
        
        // Run prepare callback
        try {
          if (prepareCallbackRef.current) {
            console.log(`[TRANSITION] ⏳ Prepare start id=${thisTransitionId}`);
            const dynamicRoute = await prepareCallbackRef.current();
            if (dynamicRoute) {
              finalRoute = dynamicRoute;
            }
            console.log(`[TRANSITION] ✅ Prepare done id=${thisTransitionId}`);
          }
        } catch (error) {
          console.error(`[TRANSITION] ❌ Prepare failed id=${thisTransitionId}:`, error);
          // RELEASE LOCK on error
          setPhase('idle');
          radius.set(0);
          transitionLockRef.current = false;
          pendingNavigationRef.current = null;
          prepareCallbackRef.current = null;
          return;
        }
        
        if (!mountedRef.current) {
          console.log(`[TRANSITION] ⚠️ After prepare but unmounted id=${thisTransitionId}`);
          return;
        }
        
        // NAVIGATE while overlay covers everything
        if (finalRoute) {
          console.log(`[TRANSITION] 🧭 Navigated id=${thisTransitionId} to="${finalRoute}"`);
          navigate(finalRoute);
        }
        
        // Wait for React to render the new route
        await new Promise(resolve => {
          requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
          });
        });
        
        if (!mountedRef.current) {
          console.log(`[TRANSITION] ⚠️ After nav but unmounted id=${thisTransitionId}`);
          return;
        }
        
        // CRITICAL: Ensure radius is at max before shrinking
        const currentMax = Math.hypot(window.innerWidth, window.innerHeight);
        radius.set(currentMax);
        
        console.log(`[TRANSITION] 📉 Shrink start id=${thisTransitionId} from ${Math.round(currentMax)}px -> 0`);
        
        setPhase('shrinking');
        
        // Animate shrink
        animate(radius, 0, {
          duration: SHRINK_DURATION,
          ease: [0.4, 0, 0.2, 1],
          onComplete: () => {
            console.log(`[TRANSITION] ✅ Shrink complete id=${thisTransitionId}`);
            // ONLY place where phase becomes idle - RELEASE LOCK
            setPhase('idle');
            transitionLockRef.current = false;
            pendingNavigationRef.current = null;
            prepareCallbackRef.current = null;
          },
        });
      },
    });
  }, [navigate, radius]);

  const isTransitioning = phase !== 'idle';

  return (
    <TransitionContext.Provider value={{ startTransition, phase, isTransitioning }}>
      {children}
      <TransitionOverlay 
        phase={phase} 
        loadingText={loadingText} 
        origin={originPoint}
        radius={radius}
        currentRadius={currentRadius}
        maxRadius={maxRadius}
        transitionId={transitionId}
        reason={reason}
      />
    </TransitionContext.Provider>
  );
};

interface TransitionOverlayProps {
  phase: TransitionPhase;
  loadingText: string;
  origin: { x: number; y: number };
  radius: ReturnType<typeof useMotionValue<number>>;
  currentRadius: number;
  maxRadius: number;
  transitionId: number;
  reason: string;
}

const TransitionOverlay: React.FC<TransitionOverlayProps> = ({ 
  phase, 
  loadingText, 
  origin,
  currentRadius,
  maxRadius,
  transitionId,
  reason,
}) => {
  const [isOverlayMounted] = useState(true);

  const isVisible = phase !== 'idle';
  const isShrinking = phase === 'shrinking';
  
  // Debug UI - ALWAYS render when DEBUG_MODE is true
  const debugUI = DEBUG_MODE ? createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 10,
        left: 10,
        zIndex: 10000000,
        background: 'rgba(0, 0, 0, 0.9)',
        color: '#0f0',
        padding: '10px 14px',
        borderRadius: 6,
        fontFamily: 'monospace',
        fontSize: 11,
        lineHeight: 1.5,
        border: '2px solid #0f0',
        pointerEvents: 'none',
        minWidth: 180,
      }}
    >
      <div>Phase: <strong style={{ color: isShrinking ? '#f00' : phase === 'loading' ? '#ff0' : '#0f0' }}>{phase}</strong></div>
      <div>Radius: <strong>{currentRadius}px</strong></div>
      <div>MaxRadius: <strong>{Math.round(maxRadius)}px</strong></div>
      <div>Mounted: <strong style={{ color: '#0f0' }}>{isOverlayMounted ? 'YES' : 'NO'}</strong></div>
      <div>ID: <strong>{transitionId}</strong></div>
      <div>Reason: <strong>{reason || '-'}</strong></div>
    </div>,
    document.body
  ) : null;

  // ALWAYS render debug UI
  // Only render overlay content when not idle
  if (!isVisible) {
    return debugUI;
  }

  // FORCED VISIBILITY PROOF during shrinking
  const bgColor = isShrinking ? 'rgba(255, 0, 0, 0.25)' : 'hsl(var(--background))';
  const outline = isShrinking ? '3px solid red' : 'none';

  // Build clipPath string from radius
  const cx = phase === 'expanding' ? `${origin.x}%` : '50%';
  const cy = phase === 'expanding' ? `${origin.y}%` : '50%';

  return (
    <>
      {debugUI}
      {createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: bgColor,
            outline: outline,
            opacity: 1,
            pointerEvents: 'all',
            clipPath: `circle(${currentRadius}px at ${cx} ${cy})`,
            WebkitClipPath: `circle(${currentRadius}px at ${cx} ${cy})`,
          }}
        >
          <LoadingScreen text={loadingText} />
        </div>,
        document.body
      )}
    </>
  );
};

export default TransitionProvider;
