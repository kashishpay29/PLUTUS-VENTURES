import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { api, formatError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { requestPermission } from "../firebase";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (user && user.id) {
    return <Navigate to={["admin", "sub_admin"].includes(user.role) ? "/admin" : "/engineer"} replace />;
  }

  const submitCreds = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login(data.token, data.user);
      toast.success(`Welcome back, ${data.user.name}`);

      // Save FCM token for push notifications
      try {
        const fcmToken = await requestPermission();
        if (fcmToken) {
          await api.post("/users/fcm-token", { token: fcmToken });
        }
      } catch (e) {
        console.error("FCM token error:", e);
      }

      nav(["admin", "sub_admin"].includes(data.user.role) ? "/admin" : "/engineer");
    } catch (err) {
      toast.error(formatError(err.response?.data?.detail) || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-5 login-bg">
      {/* Left – Brand */}
      <div className="hidden lg:flex lg:col-span-3 flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-md bg-white grid place-items-center p-1.5">
            <img src="/assets/logo192.png" alt="Plutus" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="font-display font-black text-2xl tracking-tight">Plutus Ventures</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Partnering Your IT Landscape</div>
          </div>
        </div>
        <div className="max-w-lg">
          <div className="text-xs uppercase tracking-[0.3em] text-white/60 mb-4">IT Service Management Platform</div>
          <h1 className="font-display font-black text-5xl xl:text-6xl leading-[1.05] tracking-tight">
            The control room for your field service operation.
          </h1>
        </div>
      </div>

      {/* Right – Form */}
      <div className="lg:col-span-2 bg-white flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-md bg-white border border-slate-200 p-1.5">
              <img src="/assets/logo192.png" alt="Plutus" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="font-display font-black text-xl text-navy">Plutus Ventures</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Partnering Your IT Landscape</div>
            </div>
          </div>

          <h2 className="font-display font-black text-3xl tracking-tight text-navy mb-2">
            Sign in to your console
          </h2>
          <p className="text-slate-500 mb-8 text-sm">
            Use your admin or engineer credentials.
          </p>

          <form onSubmit={submitCreds} className="space-y-5">
            <div>
              <Label className="text-xs uppercase tracking-wider font-bold text-slate-700">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@plutusventures.in"
                required
                className="mt-1.5 h-12"
                data-testid="login-email-input"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider font-bold text-slate-700">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="mt-1.5 h-12"
                data-testid="login-password-input"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-navy hover:bg-navy/90 text-white font-bold rounded-md"
              data-testid="login-submit-btn"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Sign in <ArrowRight className="w-4 h-4 ml-2" /></>}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}