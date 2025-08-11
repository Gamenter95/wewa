import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("TOKEN");
  const toNumber = url.searchParams.get("NUMBER");
  const amountParam = url.searchParams.get("AMOUNT");
  const comment = url.searchParams.get("COMMENT") ?? null;

  const amount = amountParam ? Number(amountParam) : NaN;

  if (!token || !toNumber || !amountParam || Number.isNaN(amount) || amount <= 0) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Missing or invalid parameters. Expected TOKEN, NUMBER, AMOUNT (>0), optional COMMENT.",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  try {
    // 1) Validate token
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("gateway_tokens")
      .select("id, user_id, is_active, gateway_enabled")
      .eq("token", token)
      .maybeSingle();

    if (tokenErr) throw tokenErr;
    if (!tokenRow) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!tokenRow.is_active || !tokenRow.gateway_enabled) {
      return new Response(
        JSON.stringify({ success: false, error: "Gateway disabled or token inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Load sender and receiver profiles
    const [{ data: sender, error: senderErr }, { data: receiver, error: receiverErr }] = await Promise.all([
      supabase.from("profiles").select("id, user_id, phone_number, balance").eq("user_id", tokenRow.user_id).maybeSingle(),
      supabase.from("profiles").select("id, user_id, phone_number, balance").eq("phone_number", toNumber).maybeSingle(),
    ]);

    if (senderErr) throw senderErr;
    if (receiverErr) throw receiverErr;
    if (!sender) {
      return new Response(
        JSON.stringify({ success: false, error: "Sender profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!receiver) {
      return new Response(
        JSON.stringify({ success: false, error: "Receiver number not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const roundedAmount = Math.round(amount * 100) / 100;

    if (Number(sender.balance) < roundedAmount) {
      await supabase.from("transactions").insert({
        from_user_id: sender.user_id,
        to_phone_number: receiver.phone_number,
        to_user_id: receiver.user_id,
        amount: roundedAmount,
        comment,
        status: "insufficient_funds",
      });
      return new Response(
        JSON.stringify({ success: false, error: "Insufficient balance" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Perform balance updates (best-effort; not fully transactional)
    const newSenderBalance = Number(sender.balance) - roundedAmount;
    const newReceiverBalance = Number(receiver.balance) + roundedAmount;

    const [{ error: updSenderErr }, { error: updReceiverErr }] = await Promise.all([
      supabase.from("profiles").update({ balance: newSenderBalance }).eq("id", sender.id),
      supabase.from("profiles").update({ balance: newReceiverBalance }).eq("id", receiver.id),
    ]);

    if (updSenderErr || updReceiverErr) {
      await supabase.from("transactions").insert({
        from_user_id: sender.user_id,
        to_phone_number: receiver.phone_number,
        to_user_id: receiver.user_id,
        amount: roundedAmount,
        comment,
        status: "failed_update",
      });
      return new Response(
        JSON.stringify({ success: false, error: "Payment failed during update" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .insert({
        from_user_id: sender.user_id,
        to_phone_number: receiver.phone_number,
        to_user_id: receiver.user_id,
        amount: roundedAmount,
        comment,
        status: "success",
      })
      .select("id")
      .single();

    if (txErr) throw txErr;

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: tx.id,
        from: sender.phone_number,
        to: receiver.phone_number,
        amount: roundedAmount,
        remaining_balance: newSenderBalance,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
