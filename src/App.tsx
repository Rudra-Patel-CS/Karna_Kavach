import { useState, useEffect } from "react";
import SplashView from "./components/SplashView";
import AuthView from "./components/AuthView";
import Sidebar from "./components/Sidebar";
import DashboardView from "./components/DashboardView";
import AnalyzerView from "./components/AnalyzerView";
import HistoryView from "./components/HistoryView";
import IntelligenceView from "./components/IntelligenceView";
import SettingsView from "./components/SettingsView";
import { Scan } from "./types";
import { Shield, ShieldCheck, ShieldAlert, Cpu, X, Menu } from "lucide-react";
import { 
  auth, 
  isDummy, 
  logoutUser, 
  verifyFirestoreConnectivity, 
  saveScanToFirestore, 
  listenUserScansFromFirestore 
} from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [viewState, setViewState] = useState<"splash" | "auth" | "app">("splash");
  const [targetState, setTargetState] = useState<"auth" | "app">("auth");
  const [isSplashDone, setIsSplashDone] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [scans, setScans] = useState<Scan[]>([]);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // Selected scan for full audit popup overlay details
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  
  // Responsive sidebar for mobile structures
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (isSplashDone) {
      setViewState(targetState);
    }
  }, [isSplashDone, targetState]);

  // Read active credential bypass sessions and historical diagnostics logs on mount
  useEffect(() => {
    // 1. Check for local simulated offline user
    if (isDummy) {
      const offlineUser = localStorage.getItem("karnakavach_offline_user");
      if (offlineUser) {
        try {
          setUser(JSON.parse(offlineUser));
          setTargetState("app");
        } catch {
          localStorage.removeItem("karnakavach_offline_user");
        }
      }
    }

    // 2. Setup Firebase auth synchronization if live database is enabled
    if (auth) {
      const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0].toUpperCase() || "Agent",
            photoURL: firebaseUser.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuD1Ub2i2kPA6x2n7uX3sac_HUxPuuPihELkEtU_WDJXZNfoamkbzL_p3-6VgkiA7KLESmH8fS2hcP5SZURTILu0JNUXpTN4W8D6CvwlzXXyCNIcI0iKH6HhpmNnmqup9C1GHLT5GvBiN_9sQFTI6cPxM57gajYoJ8mb9mSPeroIB4UskVCf7GcXPdv2o_snyjME8SsNVW2eiE1DkoaKSy8jrfyBcxzUZlQDoAiJO-5JhinWdxR5jnf1ss8Q7bKAXOsKD8tBaQj4v5lo",
            emailVerified: firebaseUser.emailVerified
          });
          setTargetState("app");
        } else {
          setTargetState("auth");
        }
      });
      verifyFirestoreConnectivity();
      return () => unsubscribeAuth();
    }

    // 3. Ping core backend to inspect active environment configurators
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.hasApiKey) {
          setHasApiKey(true);
        }
      })
      .catch(() => {
        console.warn("Status probe unreachable. Defaulting to sandbox simulation.");
      });
  }, []);

  // Sync scans dynamically with Auth states (Firestore vs Local Storage)
  useEffect(() => {
    if (!user) {
      setScans([]);
      return;
    }

    if (isDummy) {
      const savedScans = localStorage.getItem(`karnakavach_scans_${user.uid}`) || localStorage.getItem("karnakavach_scans");
      if (savedScans) {
        try {
          setScans(JSON.parse(savedScans));
        } catch {
          console.error("Corrupted local scans storage logs.");
        }
      } else {
        setScans([]);
      }
      return;
    }

    // Live reactive database listener (complying with Zero Trust enforcer rules)
    const unsubscribeScans = listenUserScansFromFirestore(
      user.uid,
      (userScans) => {
        setScans(userScans);
      },
      (error) => {
        console.error("Subcription database tracking failure:", error);
      }
    );

    return () => unsubscribeScans();
  }, [user]);

  // Synchronize system settings
  useEffect(() => {
    const applySettings = () => {
      const saved = localStorage.getItem("karnakavach_settings");
      if (saved) {
         try {
           const parsed = JSON.parse(saved);
           if (parsed.theme === "light") {
             document.documentElement.setAttribute("data-theme", "light");
           } else if (parsed.theme === "dark") {
             document.documentElement.removeAttribute("data-theme");
           } else {
             if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
               document.documentElement.setAttribute("data-theme", "light");
             } else {
               document.documentElement.removeAttribute("data-theme");
             }
           }
         } catch(e) {}
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    };
    
    applySettings();
    window.addEventListener("karnakavach_settings_updated", applySettings);
    return () => window.removeEventListener("karnakavach_settings_updated", applySettings);
  }, []);

  const handleAuthSuccess = (authenticatedUser: any) => {
    setUser(authenticatedUser);
    setViewState("app");
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setViewState("auth");
    setSidebarOpen(false);
  };

  const handleNewScanResult = async (newScan: Scan) => {
    if (!user) return;

    // Check if user disabled saving history
    const saved = localStorage.getItem("karnakavach_settings");
    let shouldSaveHistory = true;
    let shouldNotify = true;
    
    if (saved) {
       try {
         const parsed = JSON.parse(saved);
         if (parsed.saveHistory === false) shouldSaveHistory = false;
         if (parsed.notifications === false) shouldNotify = false;
       } catch(e) {}
    }

    if (shouldNotify && newScan.riskLevel === "HIGH" && 'Notification' in window && Notification.permission === "granted") {
      new Notification("High Risk Phishing Detected!", {
        body: `Threat detected from ${newScan.sender}`,
        icon: "/favicon.ico"
      });
    }

    if (!shouldSaveHistory) {
      // Do not persist this scan, just add to local state
      setScans(prev => [newScan, ...prev]);
      return;
    }

    if (isDummy) {
      const updated = [newScan, ...scans];
      setScans(updated);
      localStorage.setItem(`karnakavach_scans_${user.uid}`, JSON.stringify(updated));
      localStorage.setItem("karnakavach_scans", JSON.stringify(updated));
    } else {
      try {
        await saveScanToFirestore(user.uid, newScan);
      } catch (error) {
        console.error("Failed to commit assessment payload to Firestore:", error);
      }
    }
  };

  const handleClearHistory = () => {
    setScans([]);
    if (user) {
      localStorage.removeItem(`karnakavach_scans_${user.uid}`);
    }
    localStorage.removeItem("karnakavach_scans");
  };

  return (
    <div className="bg-background text-on-surface min-h-screen font-sans flex flex-col justify-between overflow-x-hidden relative select-none antialiased selection:bg-primary-container/20 selection:text-primary-fixed-dim">
      
      <AnimatePresence mode="wait">
        {/* Cinematic splash greeting intro */}
        {viewState === "splash" && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="fixed inset-0 z-50 h-full w-full"
          >
            <SplashView onComplete={() => setIsSplashDone(true)} />
          </motion.div>
        )}

        {/* Cyber-Secure Credentials Sign-In */}
        {viewState === "auth" && (
          <motion.div
            key="auth"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="min-h-screen flex items-center justify-center relative bg-background overflow-hidden p-6"
          >
            {/* Background cyber radial glow */}
            <div className="absolute inset-0 z-0 opacity-30 mix-blend-screen pointer-events-none bg-radial-gradient" style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(0, 219, 233, 0.12) 0%, transparent 60%)" }} />
            <AuthView onAuthSuccess={handleAuthSuccess} />
          </motion.div>
        )}

        {/* Master Connected Commander Dashboard App */}
        {viewState === "app" && (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="min-h-screen flex w-full h-full relative"
          >
            
            {/* Large screen left sidebar drawer */}
            <aside id="desktop-sidebar" className="hidden lg:block w-64 shrink-0 fixed left-0 top-0 h-screen z-40 bg-surface-container-lowest/20 backdrop-blur-2xl border-r border-outline-variant/15 shadow-2xl shadow-background">
              <Sidebar 
                currentTab={currentTab} 
                setCurrentTab={setCurrentTab} 
                user={user} 
                onLogout={handleLogout} 
              />
            </aside>

            {/* Responsive mobile sidebar slide-over container */}
            <AnimatePresence>
              {sidebarOpen && (
                <div id="mobile-sidebar-backdrop" className="fixed inset-0 z-50 lg:hidden flex">
                  {/* Backdrop overlay */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSidebarOpen(false)}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                  />
                  
                  {/* Sidebar body slide-in */}
                  <motion.div
                    initial={{ x: "-100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "-100%" }}
                    transition={{ type: "spring", bounce: 0.1, duration: 0.5 }}
                    className="relative w-64 bg-background border-r border-outline-variant/15 h-full z-10 flex flex-col shadow-2xl"
                  >
                    <Sidebar 
                      currentTab={currentTab} 
                      setCurrentTab={(tab) => {
                        setCurrentTab(tab);
                        setSidebarOpen(false);
                      }} 
                      user={user} 
                      onLogout={handleLogout} 
                    />
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Main right container page canvas */}
            <div id="main-canvas" className="flex-1 flex flex-col min-h-screen w-full lg:pl-64">
              
              {/* Dynamic TopAppBar Header */}
              <header id="top-bar" className="sticky top-0 w-full z-30 bg-background/80 backdrop-blur-xl border-b border-outline-variant/15 flex justify-between items-center px-6 md:px-10 h-16 shrink-0">
                <div className="flex items-center gap-4">
                  {/* Mobile sidebar trigger burger button */}
                  <button 
                    onClick={() => setSidebarOpen(true)}
                    className="lg:hidden p-1.5 rounded bg-surface-container-high/40 border border-outline-variant/20 hover:border-primary-fixed-dim transition-colors text-on-surface cursor-pointer"
                  >
                    <Menu className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary-fixed-dim drop-shadow-[0_0_8px_rgba(0,219,233,0.55)]" fill="rgba(0,219,233,0.1)" />
                    <h1 className="font-display text-lg font-extrabold tracking-tight text-primary-fixed-dim uppercase">
                      Admin: {currentTab}
                    </h1>
                  </div>
                </div>

                <div className="flex items-center gap-4 select-none">
                  <div className="hidden md:flex items-center gap-2 bg-surface-container-low/60 border border-outline-variant/20 px-3.5 py-1.5 rounded-lg text-[10px] font-mono tracking-widest font-black uppercase text-primary-fixed-dim">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary-fixed-dim animate-pulse" />
                    ENGINE UPLINK: ONLINE
                  </div>
                  
                  {/* Mini profile avatar */}
                  <img
                    alt={user?.displayName || "Agent"}
                    className="w-8 h-8 rounded-full border border-outline-variant/40 object-cover cursor-pointer hover:border-primary-fixed-dim transition-colors"
                    src={user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuC6pR8x-Hg55tyg5VXTrJ3c6nmf8IBH3W20g3rEiMjvFw1fdjUAzwQ4ffFge0wR47BoYTy7sdSpOzjnTLFuuAJsCMx36GKqwF5YEIFIPfPneSNUgNbElSSBjlMKz4BYdR2iix6XAMmM7vL8rJ0yLQ-KunzDsdhzjNMPQaNBJyufZoGgnRvIQp4PN1mjMwkdY08d-zfR2rMiur8wGAQvg2axeN21sg0VU9WqnQSJZJy9awebSkLlEWfgt5yLSuDXOmR7XhNlG_9_TTyh"}
                    onClick={() => setCurrentTab("settings")}
                  />
                </div>
              </header>

              {/* Central Contents Stage Area */}
              <main id="content-stage" className="flex-1 p-6 md:p-10 select-none max-w-[1440px] mx-auto w-full">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.35 }}
                    className="w-full h-full"
                  >
                    {currentTab === "dashboard" && (
                      <DashboardView 
                        scans={scans} 
                        onSelectScan={(scan) => {
                          setSelectedScan(scan);
                          setCurrentTab("intelligence");
                        }}
                        onInitiateScanMail={() => setCurrentTab("analyzer")}
                      />
                    )}
                    {currentTab === "analyzer" && (
                      <AnalyzerView 
                        onScanComplete={handleNewScanResult} 
                        onRequestOpenSettings={() => setCurrentTab("settings")}
                      />
                    )}
                    {currentTab === "history" && (
                      <HistoryView 
                        scans={scans} 
                        onSelectScan={(scan) => {
                          setSelectedScan(scan);
                          setCurrentTab("intelligence");
                        }}
                        onClearHistory={handleClearHistory}
                      />
                    )}
                    {currentTab === "intelligence" && <IntelligenceView scan={selectedScan || scans[0] || null} />}
                    {currentTab === "settings" && (
                      <SettingsView user={user} hasApiKey={hasApiKey} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </main>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
