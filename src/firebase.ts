import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth } from 'firebase/auth'

/**
 * Firebase client initialization (Firebase v10+).
 */
const firebaseConfig = {
  apiKey: 'AIzaSyD6AQev0qTFI4P7TOrTRy4lfTaEb2VAkmw',
  authDomain: 'fileshareapp-30d04.firebaseapp.com',
  projectId: 'fileshareapp-30d04',
  storageBucket: 'fileshareapp-30d04.firebasestorage.app',
  messagingSenderId: '410388389048',
  appId: '1:410388389048:web:1ed8aafe029fcb1d35a84d',
  measurementId: 'G-RY8JBVTTTZ',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const googleProvider = new GoogleAuthProvider()

