import { ReactNode, useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import { Menu, X, Home, Send, Download, CreditCard, Settings, LogOut, WifiOff, Wifi, ChevronLeft, ChevronRight, ToggleLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
// No longer needed as we're using localStorage directly
import { useOfflineBalance } from "@/contexts/OfflineBalanceContext";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "@/components/ui/use-toast";

type LayoutProps = {
  children: ReactNode;
};

const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Initialize from localStorage if available
    const savedCollapsed = typeof window !== 'undefined' ? localStorage.getItem('sidebarCollapsed') : null;
    return savedCollapsed ? JSON.parse(savedCollapsed) : false;
  });
  const location = useLocation();
  const { isOffline, toggleOfflineMode } = useOfflineBalance();
  const { reservedBalance } = useWallet();

  // Toggle online/offline mode using OfflineBalanceContext
  const toggleOnlineMode = useCallback(() => {
    toggleOfflineMode();
  }, [toggleOfflineMode]);

  // Toggle sidebar collapsed state and persist it
  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
      return newState;
    });
  }, []);

  const menuItems = [
    { name: "Dashboard", path: "/dashboard", icon: Home },
    { name: "Send Money", path: "/send", icon: Send },
    { name: "Request Money", path: "/request", icon: Download },
    { name: "Offline Transactions", path: "/offline", icon: CreditCard },
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 transform bg-white shadow-lg transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-6">
          {!sidebarCollapsed && (
            <h1 className="text-xl font-bold text-greenleaf-600">GreenLeaf</h1>
          )}
          <button 
            onClick={toggleSidebarCollapsed}
            className="ml-auto rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:flex"
          >
            {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="mt-6 px-3">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center px-4 py-3 mt-2 text-base rounded-md transition-colors",
                location.pathname === item.path
                  ? "bg-greenleaf-50 text-greenleaf-700 font-medium"
                  : "text-dark-light hover:bg-gray-100"
              )}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={20} className={cn("shrink-0", sidebarCollapsed ? "mx-auto" : "mr-3")} />
              {!sidebarCollapsed && <span>{item.name}</span>}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full border-t p-4">
          <button
            className={cn(
              "flex w-full items-center rounded-md px-4 py-3 hover:bg-gray-100",
              isOffline ? "text-gray-600" : "text-greenleaf-600",
              sidebarCollapsed && "justify-center"
            )}
            onClick={toggleOnlineMode}
          >
            {isOffline ? (
              <WifiOff size={20} className={cn("text-gray-500", sidebarCollapsed ? "mx-auto" : "mr-3")} />
            ) : (
              <Wifi size={20} className={cn("text-greenleaf-500", sidebarCollapsed ? "mx-auto" : "mr-3")} />
            )}
            {!sidebarCollapsed && (
              <div className="flex flex-col items-start">
                <span className="font-medium">{isOffline ? "Go Online" : "Go Offline"}</span>
                <span className="text-xs text-gray-500">{isOffline ? 
                  "Your offline balance will be synced with your online balance when you go online." : 
                  "Your online balance will be copied to your offline balance when you go offline."
                }</span>
              </div>
            )}
          </button>
          <button className={cn(
            "flex w-full items-center rounded-md px-4 py-3 text-red-600 hover:bg-gray-100",
            sidebarCollapsed && "justify-center"
          )}>
            <LogOut size={20} className={sidebarCollapsed ? "mx-auto" : "mr-3"} />
            {!sidebarCollapsed && "Logout"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn("flex flex-1 flex-col overflow-hidden")}>
        {/* Top navbar */}
        <header className="bg-white shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center">
                <button
                  className="text-gray-600 focus:outline-none lg:hidden"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
                
                <Button
                  variant="ghost"
                  className="hidden lg:flex ml-4 p-2"
                  onClick={toggleSidebarCollapsed}
                >
                  {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </Button>
              </div>

              <div className="flex items-center">
                <button 
                  onClick={toggleOnlineMode}
                  className={cn(
                    "flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors",
                    isOffline 
                      ? "bg-gray-200 text-gray-700 hover:bg-gray-300" 
                      : "bg-greenleaf-100 text-greenleaf-700 hover:bg-greenleaf-200"
                  )}
                >
                  {isOffline ? (
                    <>
                      <WifiOff size={14} className="mr-1" />
                      Go Online
                    </>
                  ) : (
                    <>
                      <Wifi size={14} className="mr-1" />
                      Go Offline
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main content container */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;