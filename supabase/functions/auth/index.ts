// Phone-only DB auth edge function
// - POST with action: signup | login | logout | me
// - Uses sessions table tokens; returns token and profile

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

async function sha256Hex(input: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", input);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const pwBytes = new TextEncoder().encode(password);
  const salted = new Uint8Array(salt.length + pwBytes.length);
  salted.set(salt, 0);
  salted.set(pwBytes, salt.length);
  const hash = await sha256Hex(salted);
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hash}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map((h) => parseInt(h, 16)));
  const pwBytes = new TextEncoder().encode(password);
  const salted = new Uint8Array(salt.length + pwBytes.length);
  salted.set(salt, 0);
  salted.set(pwBytes, salt.length);
  const hash = await sha256Hex(salted);
  return hash === hashHex;
}

function genToken(prefix = "sess_"): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}${hex}`;
}

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

  try {
    const { action, username, phone, password } = (await req.json().catch(() => ({}))) as {
      action?: string;
      username?: string;
      phone?: string;
      password?: string;
    };

    if (req.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });

    // signup
    if (action === "signup") {
      if (!username || !phone || !password) return json({ error: "missing_fields" }, { status: 400 });

      // Create user
      const password_hash = await hashPassword(password);
      const { data: userRow, error: userErr } = await supabase
        .from("users")
        .insert({ username, phone_number: phone, password_hash })
        .select("id, username, phone_number")
        .maybeSingle();
      if (userErr) return json({ error: userErr.message }, { status: 400 });

      // Ensure profile exists
      await supabase
        .from("profiles")
        .insert({ user_id: userRow!.id, username, phone_number: phone })
        .select("id")
        .maybeSingle();

      // Create session
      const token = genToken();
      const { error: sessErr } = await supabase
        .from("sessions")
        .insert({ user_id: userRow!.id, token });
      if (sessErr) return json({ error: sessErr.message }, { status: 400 });

      return json({ token, user: { id: userRow!.id, username: userRow!.username, phone_number: userRow!.phone_number } });
    }

    // login
    if (action === "login") {
      if (!phone || !password) return json({ error: "missing_fields" }, { status: 400 });
      const { data: user, error: qErr } = await supabase
        .from("users")
        .select("id, username, phone_number, password_hash")
        .eq("phone_number", phone)
        .maybeSingle();
      if (qErr) return json({ error: qErr.message }, { status: 400 });
      if (!user) return json({ error: "invalid_credentials" }, { status: 400 });
      const ok = await verifyPassword(password, user.password_hash);
      if (!ok) return json({ error: "invalid_credentials" }, { status: 400 });

      const token = genToken();
      const { error: sessErr } = await supabase
        .from("sessions")
        .insert({ user_id: user.id, token });
      if (sessErr) return json({ error: sessErr.message }, { status: 400 });

      return json({ token, user: { id: user.id, username: user.username, phone_number: user.phone_number } });
    }

    // logout
    if (action === "logout") {
      const auth = await getUserFromToken(req);
      if ("error" in auth) return json({ error: auth.error }, { status: 401 });
      await supabase.from("sessions").update({ revoked: true }).eq("token", auth.token);
      return json({ success: true });
    }

    // me
    if (action === "me") {
      const auth = await getUserFromToken(req);
      if ("error" in auth) return json({ error: auth.error }, { status: 401 });
      const { data: user } = await supabase
        .from("users")
        .select("id, username, phone_number")
        .eq("id", auth.user_id)
        .maybeSingle();
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, phone_number, balance")
        .eq("user_id", auth.user_id)
        .maybeSingle();
      return json({ user, profile });
    }

    return json({ error: "unknown_action" }, { status: 400 });
  } catch (e) {
    return json({ error: String(e) }, { status: 500 });
  }
});
