import { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import MobileLayout from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bike } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const login = useStore((state) => state.login);

  const handleSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    const ok = await login(email, password);
    setLoading(false);
    if (ok) {
      setLocation("/");
    } else {
      setError("Login failed. Please check credentials or approval status.");
    }
  };

  return (
    <MobileLayout>
      <div className="flex flex-col h-full p-6 justify-center min-h-[80vh]">
        <div className="flex flex-col items-center mb-12 space-y-4">
          <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
            <Bike size={40} className="text-black" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">VehicleRental</h1>
            <p className="text-muted-foreground mt-2">Management App for Owners</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <Input 
                type="email" 
                placeholder="Enter email" 
                className="h-12 text-lg bg-zinc-50 border-zinc-200"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Password</label>
              <Input 
                type="password" 
                placeholder="Enter password" 
                className="h-12 text-lg bg-zinc-50 border-zinc-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <Button 
              className="w-full h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all" 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
