/**
 * KarnaKavach — Firestore User Profile Service
 *
 * Handles automatic creation and maintenance of user profile documents
 * in the Firestore `users/{uid}` collection after any successful auth.
 *
 * Document structure:
 * {
 *   uid, name, email, provider, photoURL,
 *   createdAt, lastLoginAt,
 *   totalScans, totalThreats          ← counters for future dashboard use
 * }
 *
 * Logic:
 *   - Document does NOT exist → create with all fields + timestamps
 *   - Document already exists → only update lastLoginAt (no overwrite)
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  FieldValue,
} from "firebase/firestore";
import { db, isDummy } from "../firebase";

// ── TypeScript types ────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  provider: string;           // "password" | "google.com" | "github.com"
  photoURL: string;
  createdAt: FieldValue | Date | null;
  lastLoginAt: FieldValue | Date | null;
  totalScans: number;
  totalThreats: number;
}

// Shape we write when creating a new document
interface NewProfilePayload {
  uid: string;
  name: string;
  email: string;
  provider: string;
  photoURL: string;
  createdAt: FieldValue;
  lastLoginAt: FieldValue;
  totalScans: 0;
  totalThreats: 0;
}

// Shape we write when updating an existing document
interface ProfileUpdatePayload {
  lastLoginAt: FieldValue;
}

// ── Helper: detect auth provider from Firebase user object ──────────────────

function detectProvider(firebaseUser: any): string {
  if (!firebaseUser) return "unknown";
  // providerData is an array — first entry is the primary provider
  const providerData = firebaseUser.providerData;
  if (providerData && providerData.length > 0) {
    return providerData[0].providerId || "unknown";
  }
  return "password";
}

// ── Main exported function ──────────────────────────────────────────────────

/**
 * createOrUpdateUserProfile
 *
 * Call this immediately after any successful Firebase authentication.
 * Accepts the raw Firebase user object returned by auth methods.
 *
 * @param firebaseUser - Firebase Auth User object (or null — handled gracefully)
 */
export async function createOrUpdateUserProfile(
  firebaseUser: any
): Promise<void> {
  // Skip in offline/demo mode or if Firestore is not available
  if (isDummy || !db || !firebaseUser?.uid) {
    return;
  }

  const uid: string = firebaseUser.uid;
  const userDocRef = doc(db, "users", uid);

  try {
    const snapshot = await getDoc(userDocRef);

    if (!snapshot.exists()) {
      // ── NEW USER: create full profile document ───────────────────────────
      const newProfile: NewProfilePayload = {
        uid,
        name:        firebaseUser.displayName  || firebaseUser.email?.split("@")[0] || "Agent",
        email:       firebaseUser.email        || "",
        provider:    detectProvider(firebaseUser),
        photoURL:    firebaseUser.photoURL     || "",
        createdAt:   serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        totalScans:  0,
        totalThreats: 0,
      };

      await setDoc(userDocRef, newProfile);
      console.log(`[UserProfile] New profile created for uid: ${uid}`);

    } else {
      // ── RETURNING USER: only update lastLoginAt ──────────────────────────
      const update: ProfileUpdatePayload = {
        lastLoginAt: serverTimestamp(),
      };

      await updateDoc(userDocRef, update);
      console.log(`[UserProfile] Last login updated for uid: ${uid}`);
    }
  } catch (error: any) {
    // Non-fatal — log but do not block the auth flow
    console.error("[UserProfile] Failed to create/update user profile:", error?.message || error);
  }
}

// ── Optional: fetch a user profile for display ──────────────────────────────

/**
 * getUserProfile
 *
 * Fetches the Firestore user profile for a given UID.
 * Returns null if the document doesn't exist or Firestore is unavailable.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (isDummy || !db || !uid) return null;

  try {
    const snapshot = await getDoc(doc(db, "users", uid));
    if (!snapshot.exists()) return null;
    return snapshot.data() as UserProfile;
  } catch (error: any) {
    console.error("[UserProfile] Failed to fetch user profile:", error?.message || error);
    return null;
  }
}
