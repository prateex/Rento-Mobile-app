import { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import MobileLayout from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bike } from "lucide-react";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [, setLocation] = useLocation();
  const login = useStore((state) => state.login);

  const handleSendOtp = () => {
    if (phone.length >= 10) {
      setStep('otp');
    }
  };

  const handleVerify = () => {
    if (otp === "1234") {
      login(phone);
      setLocation("/");
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
          {step === 'phone' ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                <Input 
                  type="tel" 
                  placeholder="Enter mobile number" 
                  className="h-12 text-lg bg-zinc-50 border-zinc-200"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <Button 
                className="w-full h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all" 
                onClick={handleSendOtp}
                disabled={phone.length < 10}
              >
                Continue
              </Button>
              <div className="mt-8 p-4 bg-zinc-50 rounded-lg border border-dashed border-zinc-300 text-xs text-muted-foreground">
                <p className="font-semibold mb-1">Demo Credentials:</p>
                <p>Admin: 9999999999</p>
                <p>Staff: 8888888888</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Enter OTP</label>
                <Input 
                  type="text" 
                  placeholder="Enter OTP (Use 1234)" 
                  className="h-12 text-lg bg-zinc-50 border-zinc-200 tracking-widest text-center"
                  maxLength={4}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </div>
              <Button 
                className="w-full h-12 text-base font-semibold shadow-md" 
                onClick={handleVerify}
              >
                Verify & Login
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep('phone')}>
                Change Phone Number
              </Button>
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
