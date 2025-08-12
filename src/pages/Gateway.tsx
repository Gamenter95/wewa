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
    const token = localStorage.getItem("db_token");
    if (!token) navigate("/auth");
    setSessionUserId("placeholder"); // presence indicates authenticated via DB token
    return () => {};
  }, [navigate]);

  useEffect(() => {
    document.title = "Gateway | Weoo Wallet";
  }, []);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("db_token");
      if (!token) return;
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("gateway-admin", {
        body: { action: "get" },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error || (data as any)?.error) {
        toast({ title: "Error", description: (data as any)?.error || error?.message });
        setTokenRow(null);
      } else {
        setTokenRow((data as any)?.tokenRow ?? null);
      }
      setLoading(false);
    };
    load();
  }, [sessionUserId]);

  const generateToken = async () => {
    const token = localStorage.getItem("db_token");
    if (!token) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("gateway-admin", {
      body: { action: "generate" },
      headers: { Authorization: `Bearer ${token}` },
    });
    setLoading(false);
    if (error || (data as any)?.error) return toast({ title: "Token error", description: (data as any)?.error || error?.message });
    setTokenRow((data as any)?.tokenRow ?? null);
    toast({ title: "Token generated" });
  };

  const toggleGateway = async (enabled: boolean) => {
    const token = localStorage.getItem("db_token");
    if (!tokenRow || !token) return toast({ title: "No token", description: "Generate a token first" });
    const { data, error } = await supabase.functions.invoke("gateway-admin", {
      body: { action: "update", enabled },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error || (data as any)?.error) return toast({ title: "Update failed", description: (data as any)?.error || error?.message });
    setTokenRow((data as any)?.tokenRow ?? null);
  };

  const revoke = async () => {
    const token = localStorage.getItem("db_token");
    if (!token) return;
    const { data, error } = await supabase.functions.invoke("gateway-admin", {
      body: { action: "revoke" },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error || (data as any)?.error) return toast({ title: "Revoke failed", description: (data as any)?.error || error?.message });
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
