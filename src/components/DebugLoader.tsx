import React, { useEffect } from 'react';
import { registerLoaderRender } from '@/utils/transitionTrace';

// Global tracker for loaders rendered during this transition
declare global {
  interface Window {
    __LAST_RENDERED_LOADERS__: string[];
    __TRANSITION_PHASE__: string;
    __LOADER_DEBUG_ENABLED__: boolean;
  }
}

// Initialize global tracker
if (typeof window !== 'undefined') {
  window.__LAST_RENDERED_LOADERS__ = window.__LAST_RENDERED_LOADERS__ || [];
  window.__LOADER_DEBUG_ENABLED__ = true;
}

interface DebugLoaderProps {
  name: string;
  filePath: string;
  children: React.ReactNode;
}

/**
 * DebugLoader - Wraps any loading UI to identify:
 * 1. Component name
 * 2. File path
 * 3. Stack trace (reveals where it was called from)
 * 4. When it renders relative to transition lifecycle
 */
export function DebugLoader({ name, filePath, children }: DebugLoaderProps) {
  useEffect(() => {
    if (!window.__LOADER_DEBUG_ENABLED__) return;

    const phase = window.__TRANSITION_PHASE__ || 'unknown';
    
    // Add to global tracker
    const entry = `${name} @ ${filePath}`;
    if (!window.__LAST_RENDERED_LOADERS__.includes(entry)) {
      window.__LAST_RENDERED_LOADERS__.push(entry);
    }

    // Register with transition trace system
    registerLoaderRender(name, filePath);

    // Return cleanup to track unmount
    return () => {
      console.log(`[DEBUG LOADER UNMOUNT] 🔄 ${name} @ ${filePath}`);
    };
  }, [name, filePath]);

  return <>{children}</>;
}

/**
 * Log all loaders rendered during this transition
 * Call this at the end of a transition to see what rendered
 */
export function logLoadersRenderedThisTransition() {
  console.group('[LOADERS RENDERED THIS TRANSITION]');
  console.log('Total loaders:', window.__LAST_RENDERED_LOADERS__.length);
  window.__LAST_RENDERED_LOADERS__.forEach((loader, i) => {
    console.log(`  ${i + 1}. ${loader}`);
  });
  console.groupEnd();
}

/**
 * Reset the loader tracker (call at start of new transition)
 */
export function resetLoaderTracker() {
  window.__LAST_RENDERED_LOADERS__ = [];
}

/**
 * Update global transition phase (call from TransitionContext)
 */
export function setTransitionPhase(phase: string) {
  window.__TRANSITION_PHASE__ = phase;
}

export default DebugLoader;
