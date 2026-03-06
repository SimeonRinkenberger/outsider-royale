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
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!rcSecretKey) {
      return new Response(
        JSON.stringify({ error: "Service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Option 1: Use RevenueCat's Web Billing checkout URL if available
    // RevenueCat generates Stripe checkout sessions via their API
    const rcProjectId = Deno.env.get("REVENUECAT_PROJECT_ID");
    
    if (rcProjectId) {
      // RevenueCat Web Billing URL format
      const checkoutUrl = `https://billing.revenuecat.com/checkout/${rcProjectId}?app_user_id=${encodeURIComponent(userId)}`;
      return new Response(
        JSON.stringify({ url: checkoutUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Option 2: Create a Stripe Checkout session directly
    if (stripeKey) {
      const origin = req.headers.get("origin") || "https://outsiderroyale.lovable.app";
      
      const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          "mode": "subscription",
          "success_url": `${origin}?checkout=success`,
          "cancel_url": `${origin}?checkout=cancel`,
          "client_reference_id": userId,
          "metadata[rc_app_user_id]": userId,
          // The Stripe price IDs should be configured in RevenueCat
          // and mapped to the same products
          "line_items[0][price]": Deno.env.get("STRIPE_YEARLY_PRICE_ID") || "",
          "line_items[0][quantity]": "1",
        }),
      });

      if (stripeResponse.ok) {
        const session = await stripeResponse.json();
        return new Response(
          JSON.stringify({ url: session.url }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
