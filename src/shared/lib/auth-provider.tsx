'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, db } from './firebase';
import {
  UserRole,
  User,
  KioskSession,
  AdminSession,
  SignupFormData,
  Permission,
} from '@/shared/types';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { isUsingFirebaseEmulators } from '@/shared/config/firebaseEmulators';
import { FUNCTION_URLS } from '@/shared/config/functions';

const auth = getAuth();
const firestore = getFirestore();
const TERMS_POLICY_VERSION_HASH =
  process.env.NEXT_PUBLIC_TERMS_VERSION_HASH?.trim() || 'terms-2026-05';
const PRIVACY_POLICY_VERSION_HASH =
  process.env.NEXT_PUBLIC_PRIVACY_VERSION_HASH?.trim() || 'privacy-2026-05';
const MARKETING_POLICY_VERSION_HASH =
  process.env.NEXT_PUBLIC_MARKETING_VERSION_HASH?.trim() || 'marketing-2026-05';

type NormalizedSignupProfile = Pick<
  SignupFormData,
  | 'legal_name'
  | 'charity_number'
  | 'registered_nation'
  | 'registered_postcode'
  | 'entity_type'
  | 'contact_full_name'
  | 'contact_role'
  | 'contact_work_email'
  | 'contact_phone'
  | 'authorised_signatory'
  | 'gift_aid_registered'
  | 'hmrc_charity_reference'
  | 'primary_setting'
  | 'estimated_monthly_volume_band'
  | 'terms_accepted'
  | 'privacy_accepted'
  | 'marketing_consent'
>;

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

const buildVerificationActionSettings = async (uid: string) => {
  const token = createVerificationToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await updateDoc(doc(firestore, 'users', uid), {
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
  user: import('firebase/auth').User,
  uid: string,
) => {
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

    // Fallback: send Firebase-hosted verification email so signup can complete.
    await sendEmailVerification(user);
  }
};

interface AuthContextType {
  userRole: UserRole | null;
  currentKioskSession: KioskSession | null;
  currentAdminSession: AdminSession | null;
  isLoadingAuth: boolean;
  handleLogin: (role: UserRole, sessionData?: KioskSession | AdminSession) => Promise<void>;
  handleLogout: () => void;
  handleSignup: (signupData: SignupFormData) => Promise<string>;
  hasPermission: (permission: Permission) => boolean;
  refreshCurrentKioskSession: (kioskIdToRefresh?: string) => Promise<void>;
  handleOrganizationSwitch: (organizationId: string, organizationName?: string) => void;
  resendVerificationEmail: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [currentKioskSession, setCurrentKioskSession] = useState<KioskSession | null>(null);
  const [currentAdminSession, setCurrentAdminSession] = useState<AdminSession | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Define refreshCurrentKioskSession function first
  const refreshCurrentKioskSession = async (kioskIdToRefresh?: string) => {
    const targetKioskId = kioskIdToRefresh || currentKioskSession?.kioskId;

    if (targetKioskId) {
      try {
        const kioskRef = doc(db, 'kiosks', targetKioskId);
        const kioskSnap = await getDoc(kioskRef);
        if (kioskSnap.exists()) {
          const kioskData = kioskSnap.data() as Record<string, unknown>;

          setCurrentKioskSession((prev) => ({
            ...prev!,
            ...kioskData,
          }));
        } else {
          console.warn('Kiosk document not found during refresh:', targetKioskId);
        }
      } catch (error) {
        console.error('Error refreshing kiosk session:', error);
      }
    }
  };

  useEffect(() => {
    // Set a timeout to prevent infinite loading if Firebase is not configured
    const timeout = setTimeout(() => {
      setIsLoadingAuth(false);
    }, 1000); // Reduced timeout for faster loading

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(timeout); // Clear timeout when auth state changes

      if (firebaseUser) {
        try {
          // Get ID token result to check custom claims
          if (!isUsingFirebaseEmulators()) {
            await firebaseUser.getIdToken(true);
          }
          const decodedToken = await firebaseUser.getIdTokenResult();

          // Check if this is a kiosk user (UID starts with "kiosk:")
          if (firebaseUser.uid.startsWith('kiosk:')) {
            const kioskId = firebaseUser.uid.replace('kiosk:', '');
            const customClaims = decodedToken.claims;

            // Build kiosk session from custom claims
            const kioskSession: KioskSession = {
              kioskId: kioskId,
              kioskName: (customClaims.kioskName as string) || kioskId,
              startTime: new Date().toISOString(),
              assignedCampaigns: (customClaims.assignedCampaigns as string[]) || [],
              settings: (customClaims.settings as KioskSession['settings']) || {
                displayMode: 'grid',
                showAllCampaigns: false,
                maxCampaignsDisplay: 6,
                autoRotateCampaigns: false,
              },
              loginMethod: 'manual',
              organizationId: customClaims.organizationId as string,
              organizationCurrency: (customClaims.organizationCurrency as string) || 'GBP',
            };

            setUserRole('kiosk');
            setCurrentKioskSession(kioskSession);
            setIsLoadingAuth(false);
            return;
          }

          // Only establish session if email is verified
          if (!firebaseUser.emailVerified) {
            console.warn('AuthProvider: User email not verified:', firebaseUser.email);
            // Don't establish session, but keep user authenticated for resend functionality
            setIsLoadingAuth(false);
            return;
          }

          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const rawUserData = userDocSnap.data() as User & {
              emailVerified?: boolean;
              emailVerifiedAt?: string;
            };

            if (firebaseUser.emailVerified && rawUserData.emailVerified !== true) {
              try {
                await updateDoc(userDocRef, {
                  emailVerified: true,
                  emailVerifiedAt: new Date().toISOString(),
                });
                rawUserData.emailVerified = true;
              } catch (error) {
                console.error('Error syncing emailVerified to Firestore:', error);
              }
            }

            const userData = rawUserData as User;

            // Fetch organization name if organizationId exists
            let organizationName: string | undefined = undefined;
            if (userData.organizationId) {
              try {
                const orgDocRef = doc(db, 'organizations', userData.organizationId);
                const orgDocSnap = await getDoc(orgDocRef);
                if (orgDocSnap.exists()) {
                  const orgData = orgDocSnap.data();
                  const settings = orgData.settings as { displayName?: string } | undefined;
                  organizationName =
                    settings?.displayName ||
                    orgData.name ||
                    orgData.organizationName ||
                    userData.organizationId;
                }
              } catch (error) {
                console.error('Error fetching organization name:', error);
              }
            }

            setUserRole(userData.role);
            setCurrentAdminSession({
              user: {
                ...userData,
                organizationName: organizationName,
              },
              loginTime: new Date().toISOString(),
              permissions: userData.permissions || [],
            });
          } else {
            console.warn('AuthProvider: User document not found for UID:', firebaseUser.uid);
            handleLogout();
          }
        } catch (error) {
          // Handle auth errors gracefully (e.g., network issues, token errors)
          console.error('AuthProvider: Error processing authenticated user:', error);
          // Don't block the app, just clear auth state
          setUserRole(null);
          setCurrentKioskSession(null);
          setCurrentAdminSession(null);
        }
      } else {
        // No Firebase user, clear all sessions
        setUserRole(null);
        setCurrentKioskSession(null);
        setCurrentAdminSession(null);
      }
      setIsLoadingAuth(false);
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const handleLogin = async (role: UserRole, sessionData?: KioskSession | AdminSession) => {
    setUserRole(role);
    if (
      role === 'admin' ||
      role === 'super_admin' ||
      role === 'manager' ||
      role === 'operator' ||
      role === 'viewer'
    ) {
      setCurrentAdminSession(sessionData as AdminSession);
    } else if (role === 'kiosk') {
      setCurrentKioskSession(sessionData as KioskSession);
    }
  };

  const handleLogout = () => {
    signOut(auth).catch((error) => {
      console.error('Error signing out:', error);
    });

    setUserRole(null);
    setCurrentKioskSession(null);
    setCurrentAdminSession(null);
  };

  const handleSignup = async (signupData: SignupFormData): Promise<string> => {
    try {
      // Verify reCAPTCHA with backend first
      if (signupData.recaptchaToken) {
        const verifyResponse = await fetch(FUNCTION_URLS.verifySignupRecaptcha, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recaptchaToken: signupData.recaptchaToken,
            email: signupData.contact_work_email || signupData.email,
          }),
        });

        if (!verifyResponse.ok) {
          const errorData = await verifyResponse.json().catch(() => ({}));
          throw new Error(errorData.error || 'reCAPTCHA verification failed');
        }
      }

      const validationResponse = await fetch(FUNCTION_URLS.validateSignupProfile, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          legal_name: signupData.legal_name,
          charity_number: signupData.charity_number,
          registered_nation: signupData.registered_nation,
          registered_postcode: signupData.registered_postcode,
          entity_type: signupData.entity_type,
          contact_full_name: signupData.contact_full_name,
          contact_role: signupData.contact_role,
          contact_work_email: signupData.contact_work_email,
          contact_phone: signupData.contact_phone,
          authorised_signatory: signupData.authorised_signatory,
          gift_aid_registered: signupData.gift_aid_registered,
          hmrc_charity_reference: signupData.hmrc_charity_reference,
          primary_setting: signupData.primary_setting,
          estimated_monthly_volume_band: signupData.estimated_monthly_volume_band,
          terms_accepted: signupData.terms_accepted,
          privacy_accepted: signupData.privacy_accepted,
          marketing_consent: signupData.marketing_consent,
        }),
      });

      const validationPayload = await validationResponse.json().catch(() => ({}));
      if (!validationResponse.ok) {
        if (
          validationResponse.status === 422 &&
          validationPayload &&
          typeof validationPayload.fieldErrors === 'object'
        ) {
          const firstFieldError = Object.values(validationPayload.fieldErrors).find(
            (value) => typeof value === 'string',
          );
          if (typeof firstFieldError === 'string' && firstFieldError.trim()) {
            throw new Error(firstFieldError);
          }
        }

        throw new Error(
          validationPayload.error ||
            validationPayload.message ||
            'Signup data validation failed. Please check your entries and try again.',
        );
      }

      const normalizedSignupData = validationPayload.data as NormalizedSignupProfile;
      if (!normalizedSignupData || !normalizedSignupData.contact_work_email) {
        throw new Error('Signup validation returned an unexpected response.');
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        normalizedSignupData.contact_work_email,
        signupData.password,
      );
      const userId = userCredential.user.uid;
      const signupTimestamp = new Date().toISOString();

      const userData = {
        username: normalizedSignupData.contact_full_name,
        email: normalizedSignupData.contact_work_email,
        role: 'admin' as UserRole,
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
        ] as Permission[],
        isActive: true,
        createdAt: signupTimestamp,
        organizationId: signupData.organizationId,
        emailVerified: false,
      };

      await setDoc(doc(firestore, 'users', userId), userData);

      await setDoc(doc(firestore, 'organizations', signupData.organizationId), {
        name: normalizedSignupData.legal_name,
        organizationName: normalizedSignupData.legal_name,
        type: normalizedSignupData.entity_type,
        currency: signupData.currency,
        tags: [],
        createdAt: signupTimestamp,
        legal_name: normalizedSignupData.legal_name,
        charity_number: normalizedSignupData.charity_number,
        registered_nation: normalizedSignupData.registered_nation,
        registered_postcode: normalizedSignupData.registered_postcode,
        entity_type: normalizedSignupData.entity_type,
        contact_full_name: normalizedSignupData.contact_full_name,
        contact_role: normalizedSignupData.contact_role,
        contact_work_email: normalizedSignupData.contact_work_email,
        contact_phone: normalizedSignupData.contact_phone,
        authorised_signatory: normalizedSignupData.authorised_signatory,
        authorised_signatory_at: signupTimestamp,
        authorised_signatory_legal_name: normalizedSignupData.legal_name,
        gift_aid_registered: normalizedSignupData.gift_aid_registered,
        hmrc_charity_reference: normalizedSignupData.hmrc_charity_reference,
        primary_setting: normalizedSignupData.primary_setting,
        estimated_monthly_volume_band: normalizedSignupData.estimated_monthly_volume_band,
        terms_accepted: normalizedSignupData.terms_accepted,
        terms_accepted_at: signupTimestamp,
        terms_policy_version_hash: TERMS_POLICY_VERSION_HASH,
        privacy_accepted: normalizedSignupData.privacy_accepted,
        privacy_accepted_at: signupTimestamp,
        privacy_policy_version_hash: PRIVACY_POLICY_VERSION_HASH,
        marketing_consent: normalizedSignupData.marketing_consent,
        marketing_consent_at: normalizedSignupData.marketing_consent ? signupTimestamp : null,
        marketing_policy_version_hash: normalizedSignupData.marketing_consent
          ? MARKETING_POLICY_VERSION_HASH
          : null,
      });

      // Send verification email
      await sendVerificationEmailWithFallback(userCredential.user, userId);

      // DON'T sign out - keep user authenticated so they can resend verification
      // But DON'T establish a session in our app (don't call handleLogin)

      // Return email for redirect
      return normalizedSignupData.contact_work_email;
    } catch (error) {
      if (error instanceof Error) {
        console.error('Signup error:', error);
        throw error;
      } else {
        console.error('Unknown signup error:', error);
        throw new Error('Signup failed due to an unknown error.');
      }
    }
  };

  const resendVerificationEmail = async (email: string): Promise<void> => {
    try {
      // Check if there's a current user
      const user = auth.currentUser;

      // If no current user, they need to sign up again
      if (!user) {
        throw new Error('Session expired. Please sign up again.');
      }

      // Verify the email matches
      if (user.email !== email) {
        throw new Error('Email does not match current user');
      }

      // Send verification email
      await sendVerificationEmailWithFallback(user, user.uid);
    } catch (error) {
      console.error('Error resending verification email:', error);
      throw error;
    }
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!currentAdminSession || !Array.isArray(currentAdminSession.user.permissions)) {
      return false;
    }
    return (
      currentAdminSession.user.permissions.includes(permission) ||
      currentAdminSession.user.permissions.includes('system_admin')
    );
  };

  const handleOrganizationSwitch = (organizationId: string, organizationName?: string) => {
    if (currentAdminSession) {
      setCurrentAdminSession((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          user: {
            ...prev.user,
            organizationId: organizationId,
            organizationName: organizationName,
          },
        };
      });
    }
  };

  const value: AuthContextType = {
    userRole,
    currentKioskSession,
    currentAdminSession,
    isLoadingAuth,
    handleLogin,
    handleLogout,
    handleSignup,
    hasPermission,
    refreshCurrentKioskSession,
    handleOrganizationSwitch,
    resendVerificationEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
