import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Remove navigator.locks entirely to prevent Supabase auth deadlocks
// in iframe/preview environments. Supabase will fall back to a
// tab-based approach that doesn't hang.
if (typeof navigator !== 'undefined' && navigator.locks) {
  delete (navigator as any).locks;
}

createRoot(document.getElementById("root")!).render(<App />);
