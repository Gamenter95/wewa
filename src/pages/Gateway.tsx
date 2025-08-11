import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

const Gateway = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [tokenRow, setTokenRow] = useState<any | null>(null);
  const baseUrl = useMemo(() => `https://jiyjlqibnyxmcotcdbzb.functions.supabase.co/gateway`, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) navigate("/auth");
      setSessionUserId(session?.user?.id ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/auth");
      setSessionUserId(data.session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    document.title = "Gateway | Weoo Wallet";
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!sessionUserId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("gateway_tokens")
        .select("*")
        .eq("user_id", sessionUserId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) toast({ title: "Error", description: error.message });
      setTokenRow(data ?? null);
      setLoading(false);
    };
    load();
  }, [sessionUserId]);

  const generateToken = async () => {
    if (!sessionUserId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("generate_gateway_token", { user_uuid: sessionUserId });
    if (error) {
      setLoading(false);
      return toast({ title: "Token error", description: error.message });
    }
    // Fetch the newly created token row by token string
    const { data: newRow } = await supabase
      .from("gateway_tokens")
      .select("*")
      .eq("token", data as string)
      .maybeSingle();
    setTokenRow(newRow ?? null);
    setLoading(false);
    toast({ title: "Token generated" });
  };

  const toggleGateway = async (enabled: boolean) => {
    if (!tokenRow) return toast({ title: "No token", description: "Generate a token first" });
    const { error } = await supabase
      .from("gateway_tokens")
      .update({ gateway_enabled: enabled })
      .eq("id", tokenRow.id);
    if (error) return toast({ title: "Update failed", description: error.message });
    setTokenRow({ ...tokenRow, gateway_enabled: enabled });
  };

  const revoke = async () => {
    if (!tokenRow) return;
    const { error } = await supabase
      .from("gateway_tokens")
      .update({ is_active: false, gateway_enabled: false })
      .eq("id", tokenRow.id);
    if (error) return toast({ title: "Revoke failed", description: error.message });
    setTokenRow(null);
    toast({ title: "Token revoked" });
  };

  const exampleUrl = tokenRow
    ? `${baseUrl}?TOKEN=${encodeURIComponent(tokenRow.token)}&NUMBER=5551234567&AMOUNT=10.00&COMMENT=Hello`
    : `${baseUrl}?TOKEN=YOUR_TOKEN&NUMBER=5551234567&AMOUNT=10.00&COMMENT=Hello`;

  return (
    <main className="min-h-screen p-6 bg-background">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Gateway</CardTitle>
            <CardDescription>Enable your payment gateway and manage your token.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="text-base font-medium">{tokenRow?.gateway_enabled ? "Enabled" : "Disabled"}</div>
              </div>
              <Switch checked={!!tokenRow?.gateway_enabled} onCheckedChange={toggleGateway} disabled={!tokenRow || loading} />
            </div>

            <div className="space-y-2">
              <Label>Current Token</Label>
              <Input readOnly value={tokenRow?.token ?? "No token"} />
              <div className="flex gap-2">
                <Button onClick={generateToken} disabled={loading}>
                  {tokenRow ? "Regenerate Token" : "Generate Token"}
                </Button>
                <Button variant="destructive" onClick={revoke} disabled={!tokenRow || loading}>
                  Revoke Token
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-2">
            <div className="text-sm">API Endpoint</div>
            <Input readOnly value={exampleUrl} />
            <div className="text-xs text-muted-foreground">
              Call with GET. Returns JSON with success or error. Ensure your balance covers the amount.
            </div>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
};

export default Gateway;
