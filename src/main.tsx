import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Completely neuter navigator.locks to prevent Supabase auth deadlocks
// in iframe/preview environments. Must use defineProperty since delete
// may not work on non-configurable properties.
try {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    Object.defineProperty(navigator, 'locks', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  }
} catch (e) {
  // If defineProperty fails, try overwrite
  try { (navigator as any).locks = undefined; } catch (_) {}
}

createRoot(document.getElementById("root")!).render(<App />);
