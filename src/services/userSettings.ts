/**
 * KarnaKavach — Firestore User Settings Service
 *
 * Stores user settings in Firestore at: settings/{uid}
 * Falls back to localStorage if Firestore is unavailable.
 *
 * Design:
 *  - loadSettings(uid)  → reads Firestore first, falls back to localStorage
 *  - saveSettings(uid, settings) → writes to both Firestore AND localStorage
 *  - listenSettings(uid, cb) → real-time onSnapshot listener (optional)
 */

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db, isDummy } from "../firebase";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AppSettings {
  theme: string;
  model: string;
  sensitivity: string;
  saveHistory: boolean;
  autoUrlScan: boolean;
  enableOcr: boolean;
  notifications: boolean;
  exportFormat: string;
  language: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme:        "dark",
  model:        "gemini-2.5-flash",
  sensitivity:  "Medium",
  saveHistory:  true,
  autoUrlScan:  true,
  enableOcr:    true,
  notifications: true,
  exportFormat: "JSON",
  language:     "English",
};

const LS_KEY = "karnakavach_settings";

// ── localStorage helpers ─────────────────────────────────────────────────────

export function loadSettingsFromLocalStorage(): AppSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettingsToLocalStorage(settings: AppSettings): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event("karnakavach_settings_updated"));
  } catch (e) {
    console.warn("[Settings] localStorage write failed:", e);
  }
}

// ── Firestore helpers ────────────────────────────────────────────────────────

function settingsRef(uid: string) {
  return doc(db, "settings", uid);
}

/**
 * loadSettings
 * Reads from Firestore first. Falls back to localStorage on any failure.
 */
export async function loadSettings(uid: string): Promise<AppSettings> {
  if (isDummy || !db || !uid) {
    return loadSettingsFromLocalStorage();
  }

  try {
    const snap = await getDoc(settingsRef(uid));
    if (snap.exists()) {
      const data = snap.data();
      // Merge with defaults so any missing fields always have a value
      const settings: AppSettings = { ...DEFAULT_SETTINGS, ...data };
      // Keep localStorage in sync for offline fallback
      saveSettingsToLocalStorage(settings);
      console.log("[Settings] Loaded from Firestore for uid:", uid);
      return settings;
    } else {
      // No settings doc yet — use localStorage defaults
      return loadSettingsFromLocalStorage();
    }
  } catch (err: any) {
    console.warn("[Settings] Firestore read failed, using localStorage:", err?.message);
    return loadSettingsFromLocalStorage();
  }
}

/**
 * saveSettings
 * Writes to Firestore AND localStorage simultaneously.
 * If Firestore fails, localStorage still has the latest values.
 */
export async function saveSettings(uid: string, settings: AppSettings): Promise<void> {
  // Always save to localStorage first — instant and never fails
  saveSettingsToLocalStorage(settings);

  if (isDummy || !db || !uid) return;

  try {
    await setDoc(settingsRef(uid), {
      ...settings,
      updatedAt: serverTimestamp(),
    });
    console.log("[Settings] Saved to Firestore for uid:", uid);
  } catch (err: any) {
    // Non-fatal — localStorage already has the data
    console.warn("[Settings] Firestore write failed (localStorage saved):", err?.message);
  }
}

/**
 * listenSettings
 * Sets up a real-time onSnapshot listener.
 * Calls the callback whenever settings change in Firestore (e.g. from another device).
 * Returns an unsubscribe function to clean up.
 */
export function listenSettings(
  uid: string,
  onChange: (settings: AppSettings) => void
): Unsubscribe {
  if (isDummy || !db || !uid) return () => {};

  return onSnapshot(
    settingsRef(uid),
    (snap) => {
      if (snap.exists()) {
        const settings: AppSettings = { ...DEFAULT_SETTINGS, ...snap.data() };
        saveSettingsToLocalStorage(settings); // keep localStorage in sync
        onChange(settings);
      }
    },
    (err) => {
      console.warn("[Settings] Firestore listener error:", err?.message);
    }
  );
}
