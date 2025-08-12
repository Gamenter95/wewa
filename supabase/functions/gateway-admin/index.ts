// Gateway admin operations via DB-only token
// Actions: get, generate, update, revoke
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

async function getUserFromToken(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) return { error: "missing_token" } as const;
  const token = auth.split(" ")[1];
  const { data: session } = await supabase
    .from("sessions")
    .select("user_id, revoked, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!session || session.revoked || new Date(session.expires_at) < new Date()) return { error: "invalid_token" } as const;
  return { token, user_id: session.user_id } as const;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });

  try {
    const auth = await getUserFromToken(req);
    if ("error" in auth) return json({ error: auth.error }, { status: 401 });

    const { action, enabled } = (await req.json().catch(() => ({}))) as { action?: string; enabled?: boolean };

    if (action === "get") {
      const { data } = await supabase
        .from("gateway_tokens")
        .select("*")
        .eq("user_id", auth.user_id)
        .eq("is_active", true)
        .maybeSingle();
      return json({ tokenRow: data ?? null });
    }

    if (action === "generate") {
      const { data, error } = await supabase.rpc("generate_gateway_token", { user_uuid: auth.user_id });
      if (error) return json({ error: error.message }, { status: 400 });
      const { data: row } = await supabase.from("gateway_tokens").select("*").eq("token", data as string).maybeSingle();
      return json({ tokenRow: row ?? null });
    }

    if (action === "update") {
      if (typeof enabled !== "boolean") return json({ error: "missing_enabled" }, { status: 400 });
      const { data: row } = await supabase
        .from("gateway_tokens")
        .select("id")
        .eq("user_id", auth.user_id)
        .eq("is_active", true)
        .maybeSingle();
      if (!row) return json({ error: "no_active_token" }, { status: 400 });
      const { error } = await supabase.from("gateway_tokens").update({ gateway_enabled: enabled }).eq("id", row.id);
      if (error) return json({ error: error.message }, { status: 400 });
      const { data: updated } = await supabase.from("gateway_tokens").select("*").eq("id", row.id).maybeSingle();
      return json({ tokenRow: updated ?? null });
    }

    if (action === "revoke") {
      const { data: row } = await supabase
        .from("gateway_tokens")
        .select("id")
        .eq("user_id", auth.user_id)
        .eq("is_active", true)
        .maybeSingle();
      if (!row) return json({ error: "no_active_token" }, { status: 400 });
      const { error } = await supabase.from("gateway_tokens").update({ is_active: false, gateway_enabled: false }).eq("id", row.id);
      if (error) return json({ error: error.message }, { status: 400 });
      return json({ tokenRow: null });
    }

    return json({ error: "unknown_action" }, { status: 400 });
  } catch (e) {
    return json({ error: String(e) }, { status: 500 });
  }
});
