import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Patch navigator.locks to add a timeout and prevent deadlocks
// This fixes a known Supabase auth-js issue (#1594, #2013) where
// navigator.locks can deadlock in iframe/preview environments
if (typeof navigator !== 'undefined' && navigator.locks) {
  const originalRequest = navigator.locks.request.bind(navigator.locks);
  (navigator.locks as any).request = async (name: string, ...args: any[]) => {
    const options = typeof args[0] === 'object' && !(args[0] instanceof Function) ? args[0] : {};
    const callback = typeof args[0] === 'function' ? args[0] : args[1];
    
    // Add a 5-second timeout to all lock acquisitions
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    try {
      return await originalRequest(name, { ...options, signal: controller.signal }, callback);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.warn(`[LockPatch] Lock "${name}" timed out after 5s, executing without lock`);
        // Execute the callback without the lock to prevent deadlock
        return await callback({ name, mode: 'exclusive' });
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  };
}

createRoot(document.getElementById("root")!).render(<App />);
