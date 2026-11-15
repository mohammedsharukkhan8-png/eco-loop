
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import { auth, googleProvider } from "./firebase";

// Create an account using email and password
export function registerWithEmail(email, password) {
  return createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
}

// Sign in using email and password
export function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
}

// Sign in using Google
export function loginWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

// Listen for login, logout and session changes
export function subscribeToAuthChanges(callback) {
  return onAuthStateChanged(auth, callback);
}

// Sign out the current user
export function logoutUser() {
  return signOut(auth);
}
