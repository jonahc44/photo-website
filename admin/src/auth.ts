import { signOut, onAuthStateChanged, type User } from 'firebase/auth'
import { auth, apiUrl } from './config'

/**
 * Raised whenever the admin session is no longer usable - the Firebase user is
 * gone, its id token can't be refreshed, or the backend rejected the request
 * with 401/403 (including an expired Adobe session).
 */
export class AuthError extends Error {
  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message);
    this.name = 'AuthError';
  }
}

/** Resolves once Firebase has restored (or failed to restore) the persisted user. */
export const authInitializedPromise = new Promise<User | null>((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    resolve(user);
    unsubscribe();
  });
});

let redirecting = false;

/** Clear the stale session and send the user to the login page. */
export const redirectToLogin = async () => {
  if (redirecting || window.location.pathname === '/login') return;
  redirecting = true;

  try {
    await signOut(auth);
  } catch (err) {
    console.error('Error signing out after a stale session: ', err);
  }

  const redirect = encodeURIComponent(window.location.pathname);
  window.location.replace(`/login?redirect=${redirect}`);
}

/** Fresh id token for the signed in user, or an AuthError if there isn't one. */
export const getIdToken = async () => {
  await authInitializedPromise;

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new AuthError();
  }

  try {
    return await currentUser.getIdToken(true);
  } catch (err) {
    // Refresh fails when the user was deleted, disabled, or the token revoked.
    console.error('Could not refresh the id token: ', err);
    throw new AuthError();
  }
}

/**
 * fetch against the API with the current id token attached. Any authentication
 * failure - client or server side - comes back as an AuthError so callers never
 * have to tell "the session died" apart from "the request failed".
 */
export const authFetch = async (path: string, init: RequestInit = {}) => {
  const idToken = await getIdToken();

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
      'Authorization': `Bearer ${idToken}`
    }
  });

  if (response.status === 401 || response.status === 403) {
    throw new AuthError(await authErrorMessage(response));
  }

  return response;
}

const authErrorMessage = async (response: Response) => {
  try {
    const body = await response.json();
    if (body && typeof body.message === 'string') return body.message;
  } catch {
    // Not every 401 has a JSON body - fall back to the default message.
  }

  return undefined;
}
