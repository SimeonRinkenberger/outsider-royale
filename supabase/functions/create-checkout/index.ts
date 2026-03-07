import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, validateOrigin } from "../_shared/cors.ts";
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

    // Parse optional plan from body (default: yearly)
    let plan = "yearly";
    try {
      const body = await req.json();
      if (body.plan === "monthly" || body.plan === "yearly") {
        plan = body.plan;
      }
    } catch {
      // No body or invalid JSON — use default plan
    }

    const isMonthly = plan === "monthly";

    const rcSecretKey = Deno.env.get("REVENUECAT_SECRET_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!rcSecretKey) {
      return new Response(
        JSON.stringify({ error: "Service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Option 1: Use RevenueCat's Web Billing checkout URL if available
    const rcProjectId = Deno.env.get("REVENUECAT_PROJECT_ID");

    if (rcProjectId) {
      const checkoutUrl = `https://billing.revenuecat.com/checkout/${rcProjectId}?app_user_id=${encodeURIComponent(userId)}`;
      return new Response(
        JSON.stringify({ url: checkoutUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Option 2: Create a Stripe Checkout session directly
    if (stripeKey) {
      // Validate origin for redirect URLs — prevent open redirect
      const safeOrigin = validateOrigin(req);

      const priceId = isMonthly
        ? (Deno.env.get("STRIPE_MONTHLY_PRICE_ID") || "")
        : (Deno.env.get("STRIPE_YEARLY_PRICE_ID") || "");

      if (!priceId) {
        return new Response(
          JSON.stringify({ error: "Price not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const params: Record<string, string> = {
        "mode": "subscription",
        "success_url": `${safeOrigin}?checkout=success`,
        "cancel_url": `${safeOrigin}?checkout=cancel`,
        "client_reference_id": userId,
        "metadata[rc_app_user_id]": userId,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
      };

      // Pre-fill email if available
      if (auth.user.email) {
        params["customer_email"] = auth.user.email;
      }

      const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params),
      });

      if (stripeResponse.ok) {
        const session = await stripeResponse.json();
        return new Response(
          JSON.stringify({ url: session.url }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const stripeError = await stripeResponse.text();
      console.error("Stripe API error:", stripeError);
    }

    return new Response(
      JSON.stringify({ error: "Checkout not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating checkout:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create checkout" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
