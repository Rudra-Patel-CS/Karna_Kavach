import React, { useState, useEffect, useId } from "react";
import { Shield, Mail, Key, Eye, EyeOff, LogIn, UserPlus, User } from "lucide-react";
import { loginWithGoogle, loginWithEmail, registerWithEmail } from "../firebase";
import { motion, AnimatePresence } from "motion/react";

interface AuthViewProps {
  onAuthSuccess: (user: any) => void;
}

type AuthMode = "signin" | "register";

export default function AuthView({ onAuthSuccess }: AuthViewProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  // All fields start empty — browser autofill is blocked via autocomplete tricks
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  // Unique form key forces React to remount the form completely on mode switch,
  // which clears any browser-injected autofill values
  const [formKey, setFormKey] = useState(0);

  // Extra guard: clear fields after mount in case browser autofill fired
  useEffect(() => {
    const timer = setTimeout(() => {
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setDisplayName("");
    }, 50);
    return () => clearTimeout(timer);
  }, [formKey]);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMsg("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setDisplayName("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFormKey(k => k + 1); // remount form to kill autofill
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    if (mode === "register") {
      if (!displayName.trim()) {
        setErrorMsg("Please enter your name.");
        return;
      }
      if (password.length < 6) {
        setErrorMsg("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    if (mode === "register") {
      const { user, error } = await registerWithEmail(email.trim(), password, displayName.trim());
      setLoading(false);
      if (user) {
        onAuthSuccess(user);
      } else {
        setErrorMsg((error as string) || "Registration failed. Please try again.");
      }
    } else {
      const { user, error } = await loginWithEmail(email.trim(), password);
      setLoading(false);
      if (user) {
        onAuthSuccess(user);
      } else {
        setErrorMsg((error as string) || "Sign in failed. Please check your credentials.");
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg("");
    const { user, error } = await loginWithGoogle();
    setLoading(false);
    if (user) {
      onAuthSuccess(user);
    } else if (error) {
      setErrorMsg(error);
    }
  };

  const inputClass =
    "w-full bg-surface-container-lowest border border-outline-variant/30 rounded-lg py-3 pl-10 pr-4 text-sm text-on-surface placeholder:text-outline/50 focus:outline-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim/30 font-mono transition-colors";

  return (
    <div className="relative z-10 w-full max-w-md px-6 md:px-0 flex flex-col items-center">

      {/* Header */}
      <div className="text-center mb-8 flex flex-col items-center">
        <motion.div
          initial={{ rotate: -15, scale: 0.9, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="w-20 h-20 rounded-full bg-surface-container-highest/50 flex items-center justify-center mb-5 glass-panel border-primary-fixed-dim/30 shadow-[0_0_15px_rgba(0,219,233,0.15)] hover:border-primary-fixed-dim transition-colors"
        >
          <Shield
            className="w-10 h-10 text-primary-fixed-dim drop-shadow-[0_0_10px_rgba(0,219,233,0.5)]"
            fill="rgba(0,219,233,0.1)"
          />
        </motion.div>
        <h1 className="font-display text-4xl font-extrabold text-primary-fixed mb-2 tracking-tight drop-shadow-[0_0_8px_rgba(0,219,233,0.3)]">
          KARNA_KAVACH
        </h1>
        <p className="text-on-surface-variant font-mono text-xs tracking-widest font-semibold uppercase">
          {mode === "signin"
            ? "Welcome Back, Agent. Secure the perimeter."
            : "Register New Operative. Join the defence network."}
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex bg-surface-container-high rounded-xl p-1 border border-outline-variant/30 w-full mb-6">
        <button
          type="button"
          onClick={() => switchMode("signin")}
          className={`flex-1 text-[11px] uppercase font-bold tracking-wider py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
            mode === "signin"
              ? "bg-primary-fixed-dim text-background shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <LogIn className="w-3.5 h-3.5" />
          Sign In
        </button>
        <button
          type="button"
          onClick={() => switchMode("register")}
          className={`flex-1 text-[11px] uppercase font-bold tracking-wider py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
            mode === "register"
              ? "bg-indigo-500 text-white shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          Register
        </button>
      </div>

      {/* Form Panel */}
      <div className="glass-panel w-full rounded-3xl p-8 relative overflow-hidden shadow-2xl border border-neutral-800">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary-container/5 rounded-full blur-3xl pointer-events-none" />

        <AnimatePresence mode="wait">
          <motion.form
            key={formKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            onSubmit={handleSubmit}
            className="space-y-5 relative z-10"
            // Disable browser autofill on the whole form
            autoComplete="off"
          >
            {/* Hidden honeypot fields to trick browser autofill away from real fields */}
            <input type="text" name="username_fake" style={{ display: "none" }} readOnly tabIndex={-1} />
            <input type="password" name="password_fake" style={{ display: "none" }} readOnly tabIndex={-1} />

            {/* Error */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-error-container/20 border border-error/35 text-error rounded-lg px-4 py-3 text-xs font-mono"
                >
                  {errorMsg}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Display Name — register only */}
            {mode === "register" && (
              <div className="space-y-2">
                <label className="font-display text-xs font-bold uppercase tracking-wider text-on-surface-variant block">
                  Full Name
                </label>
                <div className="relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary-fixed-dim transition-colors">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={inputClass}
                    placeholder="Your full name"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-form-type="other"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label className="font-display text-xs font-bold uppercase tracking-wider text-on-surface-variant block">
                {mode === "signin" ? "Operative ID (Email)" : "Email Address"}
              </label>
              <div className="relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary-fixed-dim transition-colors">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="your@email.com"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-form-type="other"
                  inputMode="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="font-display text-xs font-bold uppercase tracking-wider text-on-surface-variant block">
                {mode === "signin" ? "Encryption Key (Password)" : "Password"}
              </label>
              <div className="relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary-fixed-dim transition-colors">
                  <Key className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-10`}
                  placeholder={mode === "register" ? "Min. 6 characters" : "••••••••••••"}
                  autoComplete="new-password"
                  data-form-type="other"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary-fixed-dim transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password — register only */}
            {mode === "register" && (
              <div className="space-y-2">
                <label className="font-display text-xs font-bold uppercase tracking-wider text-on-surface-variant block">
                  Confirm Password
                </label>
                <div className="relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary-fixed-dim transition-colors">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`${inputClass} pr-10`}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    data-form-type="other"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary-fixed-dim transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full font-display font-black text-xs tracking-widest py-3.5 rounded-lg transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer uppercase disabled:opacity-50 disabled:cursor-wait ${
                mode === "signin"
                  ? "bg-primary-fixed-dim hover:bg-primary-fixed text-background shadow-[0_0_15px_rgba(0,219,233,0.35)]"
                  : "bg-indigo-500 hover:bg-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.35)]"
              }`}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {mode === "signin" ? "VERIFYING UPLINK..." : "REGISTERING OPERATIVE..."}
                </>
              ) : mode === "signin" ? (
                <>
                  <LogIn className="w-4 h-4" />
                  INITIALIZE UPLINK
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  CREATE ACCOUNT
                </>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center py-1">
              <div className="flex-grow border-t border-outline/10" />
              <span className="px-3 text-[10px] text-outline font-display font-medium tracking-widest">
                OR SIGN IN WITH
              </span>
              <div className="flex-grow border-t border-outline/10" />
            </div>

            {/* Google / GitHub */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleGoogleSignIn}
                type="button"
                disabled={loading}
                className="flex items-center justify-center gap-2 py-2.5 px-4 border border-outline-variant/30 rounded-lg text-xs text-on-surface hover:bg-surface-bright/20 hover:border-primary-fixed-dim/50 transition-all font-mono cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
              </button>

              <button
                onClick={handleGoogleSignIn}
                type="button"
                disabled={loading}
                className="flex items-center justify-center gap-2 py-2.5 px-4 border border-outline-variant/30 rounded-lg text-xs text-on-surface hover:bg-surface-bright/20 hover:border-primary-fixed-dim/50 transition-all font-mono cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
                GitHub
              </button>
            </div>
          </motion.form>
        </AnimatePresence>
      </div>

      {/* Bottom mode switch */}
      <div className="mt-6 text-center relative z-10">
        <p className="text-on-surface-variant font-mono text-xs">
          {mode === "signin" ? "New operative?" : "Already registered?"}
          <button
            type="button"
            onClick={() => switchMode(mode === "signin" ? "register" : "signin")}
            className="text-primary-fixed-dim hover:text-primary transition-colors hover:underline underline-offset-4 ml-1.5 font-bold"
          >
            {mode === "signin" ? "Create an account" : "Sign in instead"}
          </button>
        </p>
      </div>
    </div>
  );
}
