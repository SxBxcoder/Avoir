// Helper functions for authentication
// These are like your JWT middleware functions in MERN

import { getCurrentUser, fetchAuthSession, signOut } from 'aws-amplify/auth';

// Check if user is logged in (like verifyToken middleware in MERN)
export async function isAuthenticated(): Promise<boolean> {
  try {
    await getCurrentUser();
    return true;
  } catch {
    return false;
  }
}

// Get current user details (like req.user in MERN after JWT verification)
export async function getUser() {
  try {
    const user = await getCurrentUser();
    return user;
  } catch {
    return null;
  }
}

// Get JWT access token (like the token you store in localStorage in MERN)
export async function getAccessToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() || null;
  } catch {
    return null;
  }
}

// Logout user (like clearing JWT token in MERN)
export async function logout() {
  try {
    await signOut();
  } catch (error) {
    console.error('Logout error:', error);
  }
}
