const STORAGE_KEY = 'fileshare.firebaseIdToken'

export function getIdToken() {
  return localStorage.getItem(STORAGE_KEY)
}

export function setIdToken(token: string | null) {
  if (!token) localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, token)
}

