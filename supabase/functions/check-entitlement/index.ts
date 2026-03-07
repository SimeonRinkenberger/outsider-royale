import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller via JWT
    const auth = await authenticateRequest(req);
    if (!auth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = auth.profileId; // RevenueCat app_user_id = profile ID

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

    // Check if entitlement is active.
    // A user who cancelled still has access until their period expires,
    // so we only check the expiration date — not unsubscribe_detected_at.
    // Null expires_date = lifetime subscription (treat as active).
    const now = new Date();
    const expiresAt = proEntitlement.expires_date ? new Date(proEntitlement.expires_date) : null;
    const isPro = expiresAt ? expiresAt > now : true;

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
