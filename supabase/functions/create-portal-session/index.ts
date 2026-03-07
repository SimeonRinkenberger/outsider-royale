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

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the Stripe customer by the user's email
    const userEmail = auth.user.email;
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "No email associated with account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Search for existing Stripe customer by email
    const customerSearchResponse = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(userEmail)}&limit=1`,
      {
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
        },
      }
    );

    if (!customerSearchResponse.ok) {
      console.error("Stripe customer search failed:", await customerSearchResponse.text());
      return new Response(
        JSON.stringify({ error: "Failed to look up subscription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customerData = await customerSearchResponse.json();
    const customer = customerData.data?.[0];

    if (!customer) {
      return new Response(
        JSON.stringify({ error: "No subscription found for this account" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate origin for return URL — prevent open redirect
    const safeOrigin = validateOrigin(req);

    // Create a Stripe Billing Portal session
    const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "customer": customer.id,
        "return_url": safeOrigin,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Stripe portal error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create portal session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const session = await response.json();
    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating portal session:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create portal session" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
