// Gateway function for processing payments
// GET with params: TOKEN, NUMBER, AMOUNT, COMMENT (optional)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...corsHeaders },
    ...init,
  });
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("TOKEN");
    const number = url.searchParams.get("NUMBER");
    const amount = url.searchParams.get("AMOUNT");
    const comment = url.searchParams.get("COMMENT") || "";

    if (!token || !number || !amount) {
      return json({ success: false, error: "missing_required_params" }, { status: 400 });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return json({ success: false, error: "invalid_amount" }, { status: 400 });
    }

    // Validate gateway token
    const { data: gatewayToken } = await supabase
      .from("gateway_tokens")
      .select("user_id, gateway_enabled")
      .eq("token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (!gatewayToken || !gatewayToken.gateway_enabled) {
      return json({ success: false, error: "invalid_or_disabled_token" }, { status: 401 });
    }

    // Get sender profile
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", gatewayToken.user_id)
      .maybeSingle();

    if (!senderProfile) {
      return json({ success: false, error: "sender_not_found" }, { status: 404 });
    }

    // Get receiver profile by phone number
    const { data: receiverProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("phone_number", number)
      .maybeSingle();

    if (!receiverProfile) {
      return json({ success: false, error: "receiver_not_found" }, { status: 404 });
    }

    // Check balance
    if (Number(senderProfile.balance) < amountNum) {
      // Record failed transaction
      await supabase.from("transactions").insert({
        from_user_id: gatewayToken.user_id,
        to_user_id: receiverProfile.user_id,
        to_phone_number: number,
        amount: amountNum,
        comment,
        status: "insufficient_funds",
      });
      return json({ success: false, error: "insufficient_funds" }, { status: 400 });
    }

    // Update balances
    const newSenderBalance = Number(senderProfile.balance) - amountNum;
    const newReceiverBalance = Number(receiverProfile.balance) + amountNum;

    const { error: senderError } = await supabase
      .from("profiles")
      .update({ balance: newSenderBalance })
      .eq("user_id", gatewayToken.user_id);

    const { error: receiverError } = await supabase
      .from("profiles")
      .update({ balance: newReceiverBalance })
      .eq("user_id", receiverProfile.user_id);

    if (senderError || receiverError) {
      // Record failed transaction
      await supabase.from("transactions").insert({
        from_user_id: gatewayToken.user_id,
        to_user_id: receiverProfile.user_id,
        to_phone_number: number,
        amount: amountNum,
        comment,
        status: "failed_update",
      });
      return json({ success: false, error: "transaction_failed" }, { status: 500 });
    }

    // Record successful transaction
    await supabase.from("transactions").insert({
      from_user_id: gatewayToken.user_id,
      to_user_id: receiverProfile.user_id,
      to_phone_number: number,
      amount: amountNum,
      comment,
      status: "success",
    });

    return json({
      success: true,
      message: "payment_successful",
      transaction: {
        from: senderProfile.phone_number,
        to: number,
        amount: amountNum,
        comment,
        new_balance: newSenderBalance,
      },
    });
  } catch (e) {
    console.error("Gateway function error:", e);
    return json({ success: false, error: String(e) }, { status: 500 });
  }
});