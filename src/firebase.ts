import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer,
  collection,
  setDoc,
  getDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize core Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore & Auth per mandatory skill pattern
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Google Sign-In Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Hardcoded Master Admin Email address
export const ADMIN_EMAIL = 'jasoncaswell2217@gmail.com';

export enum UserRole {
  ADMIN = 1,
  GUEST = 2
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  createdAt: any;
}

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

// Global Exception Handler conformant to skill parameters
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Secure Access Block: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Mandatory test connection pattern on startup
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test_connection_probe', 'probe'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration or internet parameters.");
    }
  }
}
testConnection();

/**
 * Handles Google Login, Auth, and registers/syncs users securely with their Role assignment.
 */
export async function signInWithGoogle(): Promise<UserProfile | null> {
  try {
    const credentials = await signInWithPopup(auth, googleProvider);
    const user = credentials.user;
    if (!user) return null;

    // Check if profile exists already
    const profileRef = doc(db, 'users', user.uid);
    let profileSnap;
    try {
      profileSnap = await getDoc(profileRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      return null;
    }

    if (profileSnap && profileSnap.exists()) {
      return { uid: user.uid, ...profileSnap.data() } as UserProfile;
    } else {
      // User does not exist, build new profile with strict roles assignment
      const assignedRole = user.email === ADMIN_EMAIL ? UserRole.ADMIN : UserRole.GUEST;
      const newProfile: Omit<UserProfile, 'uid'> = {
        email: user.email || '',
        role: assignedRole,
        createdAt: serverTimestamp()
      };

      try {
        await setDoc(profileRef, newProfile);
        return { uid: user.uid, ...newProfile } as UserProfile;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
        return null;
      }
    }
  } catch (error) {
    console.error("Sign-in execution exception:", error);
    throw error;
  }
}

/**
 * Log Out
 */
export async function logOutUser() {
  await signOut(auth);
}

/**
 * Fetch and watch user profile updates
 */
export function syncUserProfile(uid: string, callback: (profile: UserProfile | null) => void) {
  const docRef = doc(db, 'users', uid);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ uid, ...docSnap.data() } as UserProfile);
    } else {
      callback(null);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, `users/${uid}`);
  });
}
