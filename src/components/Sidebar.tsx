import { LayoutDashboard, Target, History, Sparkles, Settings, ShieldAlert, LogOut } from "lucide-react";

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  user: any;
  onLogout: () => void;
}

export default function Sidebar({ currentTab, setCurrentTab, user, onLogout }: SidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "analyzer", label: "Analyzer", icon: Target },
    { id: "history", label: "Scan History", icon: History },
    { id: "intelligence", label: "Intelligence", icon: Sparkles },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="h-full w-full flex flex-col py-8 justify-between">
      <div className="flex flex-col gap-4">
        {/* User Info / Identity Profile Card */}
        <div className="px-6 mb-8 flex items-center gap-3">
          <img
            alt={user?.displayName || "Agent Workspace"}
            className="w-10 h-10 rounded-full border border-primary-fixed-dim object-cover shadow-[0_0_10px_rgba(0,219,233,0.35)]"
            src={user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuC6pR8x-Hg55tyg5VXTrJ3c6nmf8IBH3W20g3rEiMjvFw1fdjUAzwQ4ffFge0wR47BoYTy7sdSpOzjnTLFuuAJsCMx36GKqwF5YEIFIPfPneSNUgNbElSSBjlMKz4BYdR2iix6XAMmM7vL8rJ0yLQ-KunzDsdhzjNMPQaNBJyufZoGgnRvIQp4PN1mjMwkdY08d-zfR2rMiur8wGAQvg2axeN21sg0VU9WqnQSJZJy9awebSkLlEWfgt5yLSuDXOmR7XhNlG_9_TTyh"}
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-primary-fixed-dim truncate">
              {user?.displayName || "Operative Client"}
            </h2>
            <p className="font-mono text-[9px] text-primary tracking-widest uppercase font-semibold">
              Threat Level: Low
            </p>
            <p className="font-mono text-[9px] text-outline tracking-wider lowercase truncate">
              {user?.email || "v2.5.0-stable"}
            </p>
          </div>
        </div>

        {/* Action Menu List */}
        <nav className="flex flex-col gap-1 px-3">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-md font-display font-bold text-xs uppercase tracking-widest transition-all duration-300 group cursor-pointer ${
                  isActive
                    ? "bg-primary-container/10 border-r-2 border-primary-fixed-dim text-primary-fixed-dim shadow-[0_0_15px_rgba(0,219,233,0.15)]"
                    : "text-on-surface-variant hover:bg-surface-bright/20 hover:text-on-surface"
                }`}
              >
                <IconComponent className={`w-4 h-4 group-hover:translate-x-0.5 transition-transform ${isActive ? "text-primary-fixed-dim" : "text-outline"}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Logout control bottom action */}
      <div className="px-3">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-md font-display font-bold text-xs uppercase tracking-widest text-error/75 hover:bg-error-container/10 hover:text-error transition-all duration-300 group cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-error/70" />
          TERMINATE UPLINK
        </button>
      </div>
    </aside>
  );
}
