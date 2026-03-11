import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    // ── 1. Check RevenueCat (primary source of truth) ──────────────

    const rcSecretKey = Deno.env.get("REVENUECAT_SECRET_KEY");

    if (rcSecretKey) {
      try {
        const response = await fetch(
          `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
          {
            headers: {
              "Authorization": `Bearer ${rcSecretKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const subscriber = data.subscriber;
          const proEntitlement = subscriber?.entitlements?.pro;

          if (proEntitlement) {
            const now = new Date();
            const expiresAt = proEntitlement.expires_date
              ? new Date(proEntitlement.expires_date)
              : null;
            const isPro = expiresAt ? expiresAt > now : true;

            if (isPro) {
              return new Response(
                JSON.stringify({
                  isPro: true,
                  expiresAt: proEntitlement.expires_date || null,
                  productId: proEntitlement.product_identifier || null,
                  source: "revenuecat",
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }
      } catch (rcError) {
        console.error("RevenueCat check failed, falling through to local DB:", rcError);
      }
    }

    // ── 2. Fallback: check local user_entitlements table ───────────
    //    Supports admin-granted entitlements (e.g. lifetime pro)

    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: entitlement, error: entError } = await supabase
        .from("user_entitlements")
        .select("is_active, expires_at, product_id, products(product_key)")
        .eq("user_id", userId)
        .eq("is_active", true)
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
        .limit(1)
        .maybeSingle();

      if (!entError && entitlement) {
        const productKey = (entitlement as any).products?.product_key;
        // Any active subscription-type entitlement counts as pro
        if (productKey === "premium_subscription" || productKey === "premium_monthly" || productKey === "premium_yearly") {
          return new Response(
            JSON.stringify({
              isPro: true,
              expiresAt: entitlement.expires_at || null,
              productId: productKey,
              source: "local",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } catch (dbError) {
      console.error("Local DB entitlement check failed:", dbError);
    }

    // ── 3. Not pro anywhere ────────────────────────────────────────

    return new Response(
      JSON.stringify({ isPro: false }),
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
