import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported as analyticsSupported } from 'firebase/analytics'
import { GoogleAuthProvider, getAuth } from 'firebase/auth'

/**
 * Firebase client SDK init (v10+).
 *
 * Provide these via Vite env vars (do NOT hardcode credentials):
 * - VITE_FIREBASE_API_KEY
 * - VITE_FIREBASE_AUTH_DOMAIN
 * - VITE_FIREBASE_PROJECT_ID
 * - VITE_FIREBASE_STORAGE_BUCKET
 * - VITE_FIREBASE_MESSAGING_SENDER_ID
 * - VITE_FIREBASE_APP_ID
 * - VITE_FIREBASE_MEASUREMENT_ID (optional, for Analytics)
 */
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD6AQev0qTFI4P7TOrTRy4lfTaEb2VAkmw",
  authDomain: "fileshareapp-30d04.firebaseapp.com",
  projectId: "fileshareapp-30d04",
  storageBucket: "fileshareapp-30d04.firebasestorage.app",
  messagingSenderId: "410388389048",
  appId: "1:410388389048:web:1ed8aafe029fcb1d35a84d",
  measurementId: "G-RY8JBVTTTZ"
};

export const firebaseApp = initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(firebaseApp)
export const googleProvider = new GoogleAuthProvider()

// Analytics is optional and only runs in supported browser contexts.
export async function getFirebaseAnalytics() {
  if (!firebaseConfig.measurementId) return null
  if (typeof window === 'undefined') return null
  if (!(await analyticsSupported())) return null
  return getAnalytics(firebaseApp)
}

