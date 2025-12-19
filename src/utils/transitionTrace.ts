/**
 * Transition Tracing Utility
 * Provides detailed logging for debugging transition issues
 */

export interface TraceEvent {
  timestamp: number;
  eventName: string;
  transitionId: number | null;
  phase: string;
  reason: string;
  routeFrom: string;
  routeTo: string;
  activeOverlay: 'MAIN' | 'WAITING' | 'NONE';
  loaderRendersThisTransition: string[];
  data?: Record<string, unknown>;
}

// Initialize global state
declare global {
  interface Window {
    __TRANSITION_TRACE__: TraceEvent[];
    __LOADERS_THIS_TRANSITION__: Array<{
      name: string;
      filePath: string;
      route: string;
      transitionId: number | null;
      timestamp: number;
    }>;
    __CURRENT_TRANSITION_ID__: number | null;
    __CURRENT_TRANSITION_PHASE__: string;
    __CURRENT_TRANSITION_REASON__: string;
    __CURRENT_ROUTE_FROM__: string;
    __CURRENT_ROUTE_TO__: string;
  }
}

// Initialize globals
if (typeof window !== 'undefined') {
  window.__TRANSITION_TRACE__ = window.__TRANSITION_TRACE__ || [];
  window.__LOADERS_THIS_TRANSITION__ = window.__LOADERS_THIS_TRANSITION__ || [];
  window.__CURRENT_TRANSITION_ID__ = null;
  window.__CURRENT_TRANSITION_PHASE__ = 'idle';
  window.__CURRENT_TRANSITION_REASON__ = '';
  window.__CURRENT_ROUTE_FROM__ = '';
  window.__CURRENT_ROUTE_TO__ = '';
}

/**
 * Get current active overlay status
 */
function getActiveOverlay(): 'MAIN' | 'WAITING' | 'NONE' {
  const phase = window.__CURRENT_TRANSITION_PHASE__;
  if (phase === 'idle') return 'NONE';
  if (phase === 'waiting-reveal') return 'WAITING';
  return 'MAIN';
}

/**
 * Log a transition trace event
 */
export function traceTransition(eventName: string, data?: Record<string, unknown>) {
  const event: TraceEvent = {
    timestamp: Date.now(),
    eventName,
    transitionId: window.__CURRENT_TRANSITION_ID__,
    phase: window.__CURRENT_TRANSITION_PHASE__,
    reason: window.__CURRENT_TRANSITION_REASON__,
    routeFrom: window.__CURRENT_ROUTE_FROM__,
    routeTo: window.__CURRENT_ROUTE_TO__,
    activeOverlay: getActiveOverlay(),
    loaderRendersThisTransition: window.__LOADERS_THIS_TRANSITION__.map(l => l.name),
    data,
  };

  window.__TRANSITION_TRACE__.push(event);

  // Structured console log
  console.log(
    `%c[TRACE] ${eventName}`,
    'color: #ff9800; font-weight: bold; font-size: 12px;',
    {
      id: event.transitionId,
      phase: event.phase,
      reason: event.reason,
      from: event.routeFrom,
      to: event.routeTo,
      overlay: event.activeOverlay,
      loaders: event.loaderRendersThisTransition,
      ...data,
    }
  );
}

/**
 * Set transition context for all subsequent trace calls
 */
export function setTraceContext(context: {
  transitionId?: number | null;
  phase?: string;
  reason?: string;
  routeFrom?: string;
  routeTo?: string;
}) {
  if (context.transitionId !== undefined) window.__CURRENT_TRANSITION_ID__ = context.transitionId;
  if (context.phase !== undefined) window.__CURRENT_TRANSITION_PHASE__ = context.phase;
  if (context.reason !== undefined) window.__CURRENT_TRANSITION_REASON__ = context.reason;
  if (context.routeFrom !== undefined) window.__CURRENT_ROUTE_FROM__ = context.routeFrom;
  if (context.routeTo !== undefined) window.__CURRENT_ROUTE_TO__ = context.routeTo;
}

/**
 * Register a loader render for this transition
 */
export function registerLoaderRender(name: string, filePath: string) {
  const entry = {
    name,
    filePath,
    route: window.location.pathname,
    transitionId: window.__CURRENT_TRANSITION_ID__,
    timestamp: Date.now(),
  };
  
  // Avoid duplicates
  const exists = window.__LOADERS_THIS_TRANSITION__.some(
    l => l.name === name && l.transitionId === entry.transitionId
  );
  
  if (!exists) {
    window.__LOADERS_THIS_TRANSITION__.push(entry);
  }

  console.log(
    `%c[LOADER RENDER] ${name}`,
    'color: #e91e63; font-weight: bold;',
    {
      filePath,
      route: entry.route,
      transitionId: entry.transitionId,
      phase: window.__CURRENT_TRANSITION_PHASE__,
    }
  );
}

/**
 * Clear loader renders for new transition
 */
export function clearLoaderRenders() {
  window.__LOADERS_THIS_TRANSITION__ = [];
}

/**
 * Flush and print transition trace report
 */
export function flushTransitionTrace(label: string) {
  console.group(`%c[TRANSITION REPORT] ${label}`, 'color: #4caf50; font-weight: bold; font-size: 14px;');
  
  console.log('=== TRACE EVENTS ===');
  window.__TRANSITION_TRACE__.forEach((event, i) => {
    const relativeTime = i === 0 ? 0 : event.timestamp - window.__TRANSITION_TRACE__[0].timestamp;
    console.log(
      `${String(i + 1).padStart(2, '0')}. [+${relativeTime}ms] ${event.eventName}`,
      {
        id: event.transitionId,
        phase: event.phase,
        overlay: event.activeOverlay,
        to: event.routeTo,
      }
    );
  });

  console.log('\n=== LOADERS RENDERED ===');
  window.__LOADERS_THIS_TRANSITION__.forEach((loader, i) => {
    console.log(`${String(i + 1).padStart(2, '0')}. ${loader.name} @ ${loader.filePath} (route: ${loader.route}, id: ${loader.transitionId})`);
  });

  console.log('\n=== SUMMARY ===');
  console.log('Total events:', window.__TRANSITION_TRACE__.length);
  console.log('Total loaders rendered:', window.__LOADERS_THIS_TRANSITION__.length);
  console.log('Unique loaders:', [...new Set(window.__LOADERS_THIS_TRANSITION__.map(l => l.name))]);
  
  // Check for issues
  const issues: string[] = [];
  const hasWaitingReveal = window.__TRANSITION_TRACE__.some(e => e.eventName === 'WAITING_REVEAL_START');
  const hasPlaceholderDuringTransition = window.__LOADERS_THIS_TRANSITION__.some(
    l => l.name.includes('PLACEHOLDER') && l.transitionId !== null
  );
  
  if (hasWaitingReveal) issues.push('⚠️ WAITING_REVEAL phase was entered');
  if (hasPlaceholderDuringTransition) issues.push('⚠️ Placeholder rendered during active transition');
  
  if (issues.length > 0) {
    console.log('\n=== ISSUES DETECTED ===');
    issues.forEach(issue => console.log(issue));
  } else {
    console.log('\n✅ No obvious issues detected');
  }

  console.groupEnd();

  // Also log the raw data for copy-paste
  console.log('[LOADERS_THIS_TRANSITION]', window.__LOADERS_THIS_TRANSITION__);
  console.log('[TRANSITION_TRACE]', window.__TRANSITION_TRACE__);
}

/**
 * Reset trace for new transition flow test
 */
export function resetTransitionTrace() {
  window.__TRANSITION_TRACE__ = [];
  window.__LOADERS_THIS_TRANSITION__ = [];
}

/**
 * Log screen mount event
 */
export function traceScreenMount(screenName: string, hasData: boolean, extraData?: Record<string, unknown>) {
  console.log(
    `%c[SCREEN] ${screenName} mounted`,
    'color: #2196f3; font-weight: bold;',
    {
      hasData,
      route: window.location.pathname,
      transitionId: window.__CURRENT_TRANSITION_ID__,
      phase: window.__CURRENT_TRANSITION_PHASE__,
      ...extraData,
    }
  );
}

/**
 * Log screen data ready event
 */
export function traceScreenDataReady(screenName: string, extraData?: Record<string, unknown>) {
  console.log(
    `%c[SCREEN] ${screenName} hasData=true`,
    'color: #8bc34a; font-weight: bold;',
    {
      route: window.location.pathname,
      transitionId: window.__CURRENT_TRANSITION_ID__,
      phase: window.__CURRENT_TRANSITION_PHASE__,
      ...extraData,
    }
  );
}

/**
 * Log markRevealReady call
 */
export function traceMarkRevealReady(screenName: string, revealId: number) {
  console.log(
    `%c[SCREEN] ${screenName} calling markRevealReady(${revealId})`,
    'color: #9c27b0; font-weight: bold;',
    {
      route: window.location.pathname,
      transitionId: window.__CURRENT_TRANSITION_ID__,
      phase: window.__CURRENT_TRANSITION_PHASE__,
    }
  );
}
