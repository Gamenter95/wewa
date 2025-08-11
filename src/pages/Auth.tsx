import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

const phoneToEmail = (phone: string) => `${phone}@weoo.local`;

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session) navigate("/");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    document.title = "Login / Sign Up | Weoo Wallet";
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const phone = String(form.get("phone") || "").trim();
    const password = String(form.get("password") || "").trim();
    if (!phone || !password) return toast({ title: "Missing fields", description: "Enter phone and password" });
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password,
    });
    setLoading(false);
    if (error) return toast({ title: "Login failed", description: error.message });
    toast({ title: "Logged in" });
    navigate("/");
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = String(form.get("username") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const password = String(form.get("password") || "").trim();
    if (!username || !phone || !password) return toast({ title: "Missing fields", description: "Fill all fields" });
    setLoading(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email: phoneToEmail(phone),
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { username, phone_number: phone },
      },
    });
    setLoading(false);
    if (error) return toast({ title: "Signup failed", description: error.message });
    toast({ title: "Account created", description: "You can now login" });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Weoo Wallet</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-phone">Mobile Number</Label>
                  <Input id="login-phone" name="phone" placeholder="e.g. 5551234567" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input id="login-password" name="password" type="password" />
                </div>
                <Button type="submit" disabled={loading} className="w-full">{loading ? "Please wait..." : "Login"}</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-username">Username</Label>
                  <Input id="signup-username" name="username" placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Mobile Number</Label>
                  <Input id="signup-phone" name="phone" placeholder="e.g. 5551234567" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input id="signup-password" name="password" type="password" />
                </div>
                <Button type="submit" disabled={loading} className="w-full">{loading ? "Please wait..." : "Create account"}</Button>
              </form>
              <p className="text-sm text-muted-foreground mt-2">Tip: Disable email confirmation in Supabase for quicker testing.</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
};

export default Auth;
