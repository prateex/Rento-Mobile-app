import { ReactNode } from "react";
import BottomNav from "./BottomNav";
import { useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";

interface MobileLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export default function MobileLayout({ children, showNav = true }: MobileLayoutProps) {
  const [location] = useLocation();
  
  // Hide nav on login screen
  const isLoginPage = location === "/login";
  const shouldShowNav = showNav && !isLoginPage;

  return (
    <div className="min-h-screen bg-zinc-100 flex justify-center font-sans">
      <div className="w-full max-w-md bg-background min-h-screen shadow-2xl relative flex flex-col">
        <main className="flex-1 pb-20 overflow-y-auto scrollbar-hide">
          {children}
        </main>
        {shouldShowNav && <BottomNav />}
        <Toaster />
      </div>
    </div>
  );
}
