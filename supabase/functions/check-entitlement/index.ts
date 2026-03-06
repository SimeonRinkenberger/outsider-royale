import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rcSecretKey = Deno.env.get("REVENUECAT_SECRET_KEY");
    if (!rcSecretKey) {
      console.error("REVENUECAT_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ isPro: false, error: "Service not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query RevenueCat REST API for subscriber info
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
      {
        headers: {
          "Authorization": `Bearer ${rcSecretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error(`RevenueCat API error: ${response.status}`);
      return new Response(
        JSON.stringify({ isPro: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const subscriber = data.subscriber;
    const proEntitlement = subscriber?.entitlements?.pro;

    if (!proEntitlement) {
      return new Response(
        JSON.stringify({ isPro: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if entitlement is active
    const now = new Date();
    const expiresAt = proEntitlement.expires_date ? new Date(proEntitlement.expires_date) : null;
    const isActive = expiresAt ? expiresAt > now : false;
    const unsubscribeDetected = proEntitlement.unsubscribe_detected_at != null;

    const isPro = isActive && !unsubscribeDetected;

    return new Response(
      JSON.stringify({
        isPro,
        expiresAt: proEntitlement.expires_date || null,
        productId: proEntitlement.product_identifier || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error checking entitlement:", error);
    return new Response(
      JSON.stringify({ isPro: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
