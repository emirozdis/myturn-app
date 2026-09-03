import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { addDiagnosticBreadcrumb } from './diagnostics';

let initialized = false;
let currentUser: FirebaseAuthTypes.User | null = null;
let resolveInitialization: (() => void) | null = null;

const initializationPromise = new Promise<void>((resolve) => {
  resolveInitialization = resolve;
});

auth().onAuthStateChanged((user) => {
  currentUser = user;
  addDiagnosticBreadcrumb({
    category: 'auth',
    name: 'auth_state_changed',
    outcome: 'success',
    context: { state: user ? 'authenticated' : 'anonymous' },
  });
  if (!initialized) {
    initialized = true;
    resolveInitialization?.();
    resolveInitialization = null;
  }
});

export async function waitForAuthInitialization(): Promise<FirebaseAuthTypes.User | null> {
  if (!initialized) {
    await initializationPromise;
  }
  return currentUser;
}

// Changelog:
// - Created centralized auth initialization observer to prevent null responses on cold start.
