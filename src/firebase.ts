import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  getDocFromServer,
  Timestamp
} from "firebase/firestore";
// import safely with a default fallback to prevent TS complaints
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };

const isDummy = firebaseConfig.apiKey.includes("DUMMY_KEY");

let app;
let auth: any = null;
let db: any = null;

if (!isDummy) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    // Use standard database ID if provided, or fallback
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  } catch (error) {
    console.error("Firebase Initialization Error:", error);
  }
}

export { auth, db, isDummy };

// Skill specified error handler structures
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection check mechanism on startup
export async function verifyFirestoreConnectivity(): Promise<void> {
  if (isDummy || !db) return;
  try {
    const testDocRef = doc(db, 'test', 'connection');
    await getDocFromServer(testDocRef);
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.error("Please check your Firebase configuration or networks.");
    }
  }
}

// Global authentication handlers

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<{ user: any; error?: string }> {
  // Always try local simulation first if Firebase auth will likely fail,
  // or if auth is not available
  if (isDummy || !auth) {
    return _localRegister(email, password, displayName);
  }
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    return { user: result.user };
  } catch (err: any) {
    const code: string = err.code || "";
    // If email/password provider is not enabled in Firebase console (400/operation-not-allowed),
    // fall back to local simulation so the app still works
    if (
      code === "auth/operation-not-allowed" ||
      code === "auth/configuration-not-found" ||
      err.message?.includes("OPERATION_NOT_ALLOWED") ||
      err.message?.includes("400")
    ) {
      console.warn("Firebase Email/Password auth not enabled — using local simulation.");
      return _localRegister(email, password, displayName);
    }
    return { user: null, error: mapFirebaseAuthError(code) };
  }
}

function _localRegister(email: string, password: string, displayName: string): { user: any } {
  // Store registered users in localStorage so login can validate them
  const usersKey = "karnakavach_registered_users";
  const existing: Record<string, any> = JSON.parse(localStorage.getItem(usersKey) || "{}");
  if (existing[email]) {
    return { user: null, error: "This email is already registered. Please sign in instead." } as any;
  }
  const newUser = {
    uid: "agent_" + Math.random().toString(36).substr(2, 9),
    email,
    displayName: displayName || email.split("@")[0],
    photoURL: "",
    emailVerified: false,
    _password: password // stored only for local offline validation
  };
  existing[email] = newUser;
  localStorage.setItem(usersKey, JSON.stringify(existing));
  // Log them in immediately
  const { _password: _, ...safeUser } = newUser;
  localStorage.setItem("karnakavach_offline_user", JSON.stringify(safeUser));
  return { user: safeUser };
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<{ user: any; error?: string }> {
  if (isDummy || !auth) {
    return _localLogin(email, password);
  }
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user };
  } catch (err: any) {
    const code: string = err.code || "";
    // Fallback to local simulation when provider is not enabled
    if (
      code === "auth/operation-not-allowed" ||
      code === "auth/configuration-not-found" ||
      err.message?.includes("OPERATION_NOT_ALLOWED") ||
      err.message?.includes("400")
    ) {
      console.warn("Firebase Email/Password auth not enabled — using local simulation.");
      return _localLogin(email, password);
    }
    return { user: null, error: mapFirebaseAuthError(code) };
  }
}

function _localLogin(email: string, password: string): { user: any; error?: string } {
  const usersKey = "karnakavach_registered_users";
  const existing: Record<string, any> = JSON.parse(localStorage.getItem(usersKey) || "{}");
  const found = existing[email];
  if (!found) {
    return { user: null, error: "No account found with this email. Please register first." };
  }
  if (found._password !== password) {
    return { user: null, error: "Incorrect password. Please try again." };
  }
  const { _password: _, ...safeUser } = found;
  localStorage.setItem("karnakavach_offline_user", JSON.stringify(safeUser));
  return { user: safeUser };
}

function mapFirebaseAuthError(code: string): string {
  switch (code) {
    case "auth/user-not-found":
    case "auth/invalid-credential":
      return "No account found with these credentials. Please register first.";
    case "auth/wrong-password":
      return "Incorrect password. Please try again.";
    case "auth/email-already-in-use":
      return "This email is already registered. Please sign in instead.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection.";
    default:
      return "Authentication failed. Please try again.";
  }
}

export async function loginWithGoogle(): Promise<{ user: any; error?: string }> {
  if (isDummy || !auth) {
    // Return a dummy authenticated user for full offline access simulation
    const dummyUser = {
      uid: "agent_demo_user",
      email: "guest.agent@karnakavach.ai",
      displayName: "Guest Agent",
      photoURL: "https://lh3.googleusercontent.com/aida-public/AB6AXuD1Ub2i2kPA6x2n7uX3sac_HUxPuuPihELkEtU_WDJXZNfoamkbzL_p3-6VgkiA7KLESmH8fS2hcP5SZURTILu0JNUXpTN4W8D6CvwlzXXyCNIcI0iKH6HhpmNnmqup9C1GHLT5GvBiN_9sQFTI6cPxM57gajYoJ8mb9mSPeroIB4UskVCf7GcXPdv2o_snyjME8SsNVW2eiE1DkoaKSy8jrfyBcxzUZlQDoAiJO-5JhinWdxR5jnf1ss8Q7bKAXOsKD8tBaQj4v5lo",
      emailVerified: true
    };
    localStorage.setItem("karnakavach_offline_user", JSON.stringify(dummyUser));
    return { user: dummyUser };
  }

  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return { user: result.user };
  } catch (err: any) {
    console.error("Google Sign-In Error:", err);
    return { user: null, error: err.message || "Failed to establish secure connection." };
  }
}

export async function logoutUser(): Promise<void> {
  localStorage.removeItem("karnakavach_offline_user");
  if (auth) {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign-out error:", err);
    }
  }
}

// High-Integrity Firestore Operations for Karna_Kavach Scans
export async function saveScanToFirestore(userId: string, scan: any): Promise<void> {
  if (isDummy || !db) {
    console.log("Sandbox scan storage simulation.", scan);
    return;
  }
  
  // Format the document collection reference
  const docPath = `scans/${scan.id}`;
  try {
    const scanDocRef = doc(db, "scans", scan.id);
    
    // Ensure ID conforms to regex alphanumeric plus dash / underscore
    const cleanedId = scan.id.replace(/[^a-zA-Z0-9_\-]/g, "");
    const destinationRef = doc(db, "scans", cleanedId);
    
    await setDoc(destinationRef, {
      sender: scan.sender || "unknown",
      subject: scan.subject || "No Subject",
      body: scan.body || "",
      riskScore: Math.round(scan.riskScore) || 0,
      riskLevel: scan.riskLevel || "LOW",
      createdAt: serverTimestamp(),
      summary: scan.summary || "",
      confidence: Math.round(scan.confidence) || 100,
      userId: userId,
      threatVectors: scan.threatVectors || []
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export function listenUserScansFromFirestore(
  userId: string,
  onUpdate: (scans: any[]) => void,
  onError: (error: Error) => void
): () => void {
  if (isDummy || !db) {
    // If bypass logic or sandbox, do not connect live listener
    return () => {};
  }

  const scansCollectionPath = "scans";
  try {
    const q = query(
      collection(db, "scans"),
      where("userId", "==", userId)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const results: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Safely reconstruct the string-based createdAt representation from standard Timestamp structures
          let createdAtStr = new Date().toISOString();
          if (data.createdAt && data.createdAt instanceof Timestamp) {
            createdAtStr = data.createdAt.toDate().toISOString();
          }
          
          results.push({
            id: docSnap.id,
            sender: data.sender || "",
            subject: data.subject || "",
            body: data.body || "",
            riskScore: data.riskScore ?? 0,
            riskLevel: data.riskLevel || "LOW",
            createdAt: createdAtStr,
            summary: data.summary || "",
            confidence: data.confidence ?? 100,
            threatVectors: data.threatVectors || []
          });
        });
        
        // Sort descending by createdAt locally to circumvent the need for a composite index
        results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        onUpdate(results);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, scansCollectionPath);
        onError(error);
      }
    );
  } catch (error: any) {
    handleFirestoreError(error, OperationType.LIST, scansCollectionPath);
    onError(error);
    return () => {};
  }
}
