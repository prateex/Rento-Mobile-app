import { useLocation, Link } from "wouter";
import { Home, Bike, Users, CalendarCheck, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/bikes", icon: Bike, label: "Vehicles" },
    { href: "/bookings", icon: CalendarCheck, label: "Bookings" },
    { href: "/customers", icon: Users, label: "Customers" },
    { href: "/settings", icon: Menu, label: "More" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50 pb-safe">
      <div className="flex justify-between items-center px-4 h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "flex flex-col items-center justify-center space-y-1 w-14 cursor-pointer",
                isActive ? "text-primary-600" : "text-muted-foreground hover:text-foreground"
              )}>
                <item.icon 
                  size={24} 
                  strokeWidth={isActive ? 2.5 : 2}
                  className={isActive ? "text-[hsl(49,100%,50%)]" : ""}
                />
                <span className={cn(
                  "text-[10px] font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
