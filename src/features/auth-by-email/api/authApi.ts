import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  applyActionCode,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  verifyPasswordResetCode as firebaseVerifyPasswordResetCode,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  User as FirebaseAuthUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from '../../../shared/lib/firebase';
import { User } from '../../../entities/user';
import { SignupCredentials } from '../model';

const getFunctionUrl = (functionName: string) =>
  `https://us-central1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net/${functionName}`;

const createVerificationToken = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

const getVerificationBaseUrl = (): string => {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredBaseUrl) {
    try {
      return new URL(configuredBaseUrl).origin;
    } catch {
      console.error('Invalid NEXT_PUBLIC_APP_URL for verification links:', configuredBaseUrl);
    }
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'http://localhost';
};

const getPasswordResetActionSettings = () => ({
  handleCodeInApp: true,
  url: new URL('/login?source=password-reset', getVerificationBaseUrl()).toString(),
});

const buildVerificationActionSettings = async (uid: string) => {
  const token = createVerificationToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await updateDoc(doc(db, 'users', uid), {
    emailVerificationToken: token,
    emailVerificationTokenExpiresAt: expiresAt,
  });

  const continueUrl = new URL('/auth/verify-email', getVerificationBaseUrl());
  continueUrl.searchParams.set('verify_uid', uid);
  continueUrl.searchParams.set('verify_token', token);

  return {
    handleCodeInApp: true,
    url: continueUrl.toString(),
  };
};

const hasFirebaseAuthCode = (error: unknown, code: string): error is { code: string } => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === code
  );
};

const sendVerificationEmailWithFallback = async (
  user: FirebaseAuthUser,
  uid: string,
): Promise<void> => {
  const actionCodeSettings = await buildVerificationActionSettings(uid);

  try {
    await sendEmailVerification(user, actionCodeSettings);
  } catch (error) {
    if (!hasFirebaseAuthCode(error, 'auth/unauthorized-continue-uri')) {
      throw error;
    }

    console.error('Verification continue URL rejected by Firebase Auth', {
      runtimeOrigin: typeof window !== 'undefined' ? window.location.origin : null,
      continueUrl: actionCodeSettings.url,
      code: error.code,
    });

    // Fallback to Firebase-hosted verification email to avoid blocking signup.
    await sendEmailVerification(user);
  }
};

export const authApi = {
  async signInForVerificationCheck(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential;
    } catch (error: unknown) {
      const expectedErrors = [
        'auth/invalid-email',
        'auth/invalid-credential',
        'auth/user-not-found',
        'auth/wrong-password',
        'auth/user-disabled',
        'auth/too-many-requests',
      ];

      const hasCode = (err: unknown): err is { code: string } => {
        return typeof err === 'object' && err !== null && 'code' in err;
      };

      if (!hasCode(error) || !expectedErrors.includes(error.code)) {
        console.error('Unexpected error signing in:', error);
      }

      throw error;
    }
  },

  // Check if email exists in Firestore
  async checkEmailExists(email: string): Promise<boolean> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      return !querySnapshot.empty;
    } catch (error: unknown) {
      console.error('Error checking email existence:', error);
      return false;
    }
  },

  // Sign in with email and password
  async signIn(email: string, password: string): Promise<User | null> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDocRef = doc(db, 'users', userCredential.user.uid);

      // Update lastLogin timestamp
      await updateDoc(userDocRef, {
        lastLogin: new Date().toISOString(),
        emailVerified: userCredential.user.emailVerified,
        ...(userCredential.user.emailVerified ? { emailVerifiedAt: new Date().toISOString() } : {}),
      });

      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = {
          id: userDocSnap.id,
          ...userDocSnap.data(),
        } as User;

        // Fetch organization name if organizationId exists
        if (userData.organizationId) {
          try {
            const orgDocRef = doc(db, 'organizations', userData.organizationId);
            const orgDocSnap = await getDoc(orgDocRef);
            if (orgDocSnap.exists()) {
              userData.organizationName = orgDocSnap.data().name;
            }
          } catch (error) {
            console.error('Error fetching organization name during sign in:', error);
          }
        }

        return userData;
      }
      return null;
    } catch (error: unknown) {
      // Don't log expected authentication errors to console
      const expectedErrors = [
        'auth/invalid-email',
        'auth/invalid-credential',
        'auth/user-not-found',
        'auth/wrong-password',
        'auth/user-disabled',
        'auth/too-many-requests',
      ];

      // Type guard to check if error has a code property
      const hasCode = (err: unknown): err is { code: string } => {
        return typeof err === 'object' && err !== null && 'code' in err;
      };

      if (!hasCode(error) || !expectedErrors.includes(error.code)) {
        console.error('Unexpected error signing in:', error);
      }

      throw error;
    }
  },

  // Sign up with email and password
  async signUp(credentials: SignupCredentials): Promise<User | null> {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        credentials.email,
        credentials.password,
      );
      const userId = userCredential.user.uid;

      // Create user document
      const userData = {
        username: `${credentials.firstName} ${credentials.lastName}`,
        email: credentials.email,
        role: 'admin',
        permissions: [
          'view_dashboard',
          'view_campaigns',
          'export_campaigns',
          'create_campaign',
          'edit_campaign',
          'delete_campaign',
          'view_kiosks',
          'export_kiosks',
          'create_kiosk',
          'edit_kiosk',
          'delete_kiosk',
          'assign_campaigns',
          'view_donations',
          'export_subscriptions',
          'export_donations',
          'export_giftaid',
          'download_giftaid_exports',
          'view_users',
          'create_user',
          'edit_user',
          'delete_user',
          'change_org_identity',
          'change_org_branding',
          'manage_permissions',
        ],
        isActive: true,
        createdAt: new Date().toISOString(),
        organizationId: credentials.organizationId,
        emailVerified: false,
      };

      await setDoc(doc(db, 'users', userId), userData);

      // Create organization document
      await setDoc(doc(db, 'organizations', credentials.organizationId), {
        name: credentials.organizationName,
        type: credentials.organizationType,
        size: credentials.organizationSize,
        website: credentials.website,
        currency: credentials.currency,
        createdAt: new Date().toISOString(),
      });

      // Send verification email
      await sendVerificationEmailWithFallback(userCredential.user, userId);

      return {
        id: userId,
        ...userData,
      } as User;
    } catch (error: unknown) {
      // Don't log expected authentication errors to console
      const expectedErrors = [
        'auth/email-already-in-use',
        'auth/invalid-email',
        'auth/weak-password',
        'auth/operation-not-allowed',
      ];

      // Type guard to check if error has a code property
      const hasCode = (err: unknown): err is { code: string } => {
        return typeof err === 'object' && err !== null && 'code' in err;
      };

      if (!hasCode(error) || !expectedErrors.includes(error.code)) {
        console.error('Unexpected error signing up:', error);
      }

      throw error;
    }
  },

  // Sign out
  async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: unknown) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  // Get current user
  async getCurrentUser(): Promise<User | null> {
    try {
      const user = auth.currentUser;
      if (!user) return null;

      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        return {
          id: userDocSnap.id,
          ...userDocSnap.data(),
        } as User;
      }
      return null;
    } catch (error: unknown) {
      console.error('Error getting current user:', error);
      throw error;
    }
  },

  // Listen to auth state changes
  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, async (firebaseUser: FirebaseAuthUser | null) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = {
            id: userDocSnap.id,
            ...userDocSnap.data(),
          } as User;
          callback(userData);
        } else {
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  },

  // Send verification email to current user
  async sendVerificationEmail(user: FirebaseAuthUser): Promise<void> {
    try {
      await sendVerificationEmailWithFallback(user, user.uid);
    } catch (error: unknown) {
      console.error('Error sending verification email:', error);
      throw error;
    }
  },

  // Resend verification email
  async resendVerificationEmail(email: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found. Please sign up again.');
      }
      if (user.email !== email) {
        throw new Error('Email does not match current user');
      }
      await sendVerificationEmailWithFallback(user, user.uid);
    } catch (error: unknown) {
      console.error('Error resending verification email:', error);
      throw error;
    }
  },

  // Verify email with action code
  async verifyEmailCode(code: string): Promise<void> {
    try {
      await applyActionCode(auth, code);

      // Reload user to get updated emailVerified status
      const user = auth.currentUser;
      if (user) {
        await user.reload();
        if (user.emailVerified) {
          try {
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, {
              emailVerified: true,
              emailVerifiedAt: new Date().toISOString(),
            });
          } catch (syncError) {
            console.error(
              'Error syncing verified email to Firestore after verification:',
              syncError,
            );
          }
        }
      }
    } catch (error: unknown) {
      console.error('Error verifying email code:', error);
      throw error;
    }
  },

  async completeEmailVerification(uid: string, token: string): Promise<void> {
    const response = await fetch(getFunctionUrl('completeEmailVerification'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uid, token }),
    });

    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(responseData.error || 'Failed to complete email verification.');
    }
  },

  async sendPasswordResetEmail(email: string): Promise<void> {
    const actionCodeSettings = getPasswordResetActionSettings();

    try {
      await firebaseSendPasswordResetEmail(auth, email, actionCodeSettings);
    } catch (error) {
      if (!hasFirebaseAuthCode(error, 'auth/unauthorized-continue-uri')) {
        throw error;
      }

      console.error('Password reset continue URL rejected by Firebase Auth', {
        runtimeOrigin: typeof window !== 'undefined' ? window.location.origin : null,
        continueUrl: actionCodeSettings.url,
        code: error.code,
      });

      await firebaseSendPasswordResetEmail(auth, email);
    }
  },

  async verifyPasswordResetCode(code: string): Promise<string> {
    return firebaseVerifyPasswordResetCode(auth, code);
  },

  async confirmPasswordReset(code: string, newPassword: string): Promise<void> {
    await firebaseConfirmPasswordReset(auth, code, newPassword);
  },
};
