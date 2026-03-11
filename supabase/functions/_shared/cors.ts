/**
 * Shared CORS configuration for all edge functions.
 * Restricts Access-Control-Allow-Origin to known app origins.
 */

const ALLOWED_ORIGINS = [
  "https://outsiderroyale.com",
  "https://www.outsiderroyale.com",
  "https://outsiderroyale.lovable.app",
  "https://4b9de44f-1c68-4ee8-8e08-f7594c181759.lovableproject.com",
  "https://outsiderroyale.com",
  "https://www.outsiderroyale.com",
  "capacitor://localhost",
  "http://localhost:8080",
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

export function validateOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}
