import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Weoo Wallet – Secure Gateway";
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id ?? null);
    });
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!userId) { setProfile(null); return; }
      const { data } = await supabase
        .from("profiles")
        .select("username, phone_number, balance")
        .eq("user_id", userId)
        .maybeSingle();
      setProfile(data ?? null);
    };
    load();
  }, [userId]);

  const logout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      {!userId ? (
        <div className="max-w-2xl text-center space-y-6">
          <h1 className="text-4xl font-bold">Weoo Wallet</h1>
          <p className="text-muted-foreground text-lg">A simple, secure wallet with a powerful payment gateway.</p>
          <div className="flex gap-3 justify-center">
            <Button asChild>
              <Link to="/auth">Login / Sign Up</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm text-muted-foreground">Username</div>
              <div className="text-base font-medium">{profile?.username ?? "-"}</div>
              <div className="text-sm text-muted-foreground mt-3">Mobile</div>
              <div className="text-base font-medium">{profile?.phone_number ?? "-"}</div>
              <div className="text-sm text-muted-foreground mt-3">Balance</div>
              <div className="text-2xl font-bold">${profile?.balance?.toFixed ? profile.balance.toFixed(2) : Number(profile?.balance ?? 0).toFixed(2)}</div>
              <div className="flex gap-2 mt-4">
                <Button onClick={() => navigate("/gateway")}>Open Gateway</Button>
                <Button variant="secondary" onClick={logout}>Logout</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
};

export default Index;
