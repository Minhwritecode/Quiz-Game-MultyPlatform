import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { corsHeaders } from "../_shared/cors.ts";

type CheckoutBody = {
  action?: "create_session" | "confirm_payment";
  plan_id?: "archmage_monthly" | "archmage_yearly" | "token_pack_100";
  provider?: "stripe" | "iap_apple" | "iap_google" | "payos";
  subscription_id?: string;
  external_ref?: string;
  success_url?: string;
  cancel_url?: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing bearer token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = auth.slice(7);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData.user) {
    return new Response(JSON.stringify({ error: "Sign in required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: CheckoutBody;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const action = body.action ?? "create_session";

  if (action === "confirm_payment") {
    if (!body.subscription_id) {
      return new Response(JSON.stringify({ error: "subscription_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data, error } = await supabase.rpc("confirm_billing_payment", {
      p_subscription_id: body.subscription_id,
      p_external_ref: body.external_ref ?? "",
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const planId = body.plan_id ?? "archmage_monthly";
  const provider = body.provider ?? "stripe";

  const { data: sessionData, error: rpcErr } = await supabase.rpc(
    "create_billing_checkout_session",
    {
      p_plan_id: planId,
      p_provider: provider,
    },
  );

  if (rpcErr || !sessionData) {
    return new Response(JSON.stringify({ error: rpcErr?.message ?? "Failed to create session" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // If live STRIPE_SECRET_KEY is configured, create a real Stripe Checkout URL
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")?.trim();
  let checkoutUrl: string | null = null;

  if (stripeKey && provider === "stripe") {
    try {
      const amountVnd = Number(sessionData.amountVnd ?? 79000);
      const params = new URLSearchParams({
        mode: "payment",
        success_url: body.success_url || "https://papyrus.app/billing/success",
        cancel_url: body.cancel_url || "https://papyrus.app/billing/cancel",
        "line_items[0][price_data][currency]": "vnd",
        "line_items[0][price_data][unit_amount]": String(amountVnd),
        "line_items[0][price_data][product_data][name]": `Papyrus ${planId}`,
        "line_items[0][quantity]": "1",
        "metadata[subscription_id]": String(sessionData.subscriptionId),
        "metadata[user_id]": userData.user.id,
      });

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      if (stripeRes.ok) {
        const stripeJson = (await stripeRes.json()) as { id?: string; url?: string };
        checkoutUrl = stripeJson.url ?? null;
      }
    } catch {
      // Fallback to direct in-app confirmation flow
    }
  }

  return new Response(
    JSON.stringify({
      ...sessionData,
      checkoutUrl,
      mode: stripeKey ? "live_stripe" : "verified_instant",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
