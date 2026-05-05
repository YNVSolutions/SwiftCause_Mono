'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { Loader2 } from 'lucide-react';
import { FUNCTION_URLS } from '@/shared/config/functions';

export default function MagicLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const { token } = use(params);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    validateToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateToken = async () => {
    setValidating(true);
    setError(null);

    try {
      // Try subscription management magic link first
      const response = await fetch(FUNCTION_URLS.verifySubscriptionMagicLink, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success && data.email && data.token) {
          // Store email and Firebase auth token in session storage
          sessionStorage.setItem('donor_email', data.email);
          sessionStorage.setItem('donor_auth_token', data.token);

          // Sign in with custom token
          const { getAuth, signInWithCustomToken } = await import('firebase/auth');
          const auth = getAuth();

          try {
            await signInWithCustomToken(auth, data.token);
            // Authenticated successfully
          } catch (authError) {
            console.error('Firebase auth error:', authError);
            setError('Unable to start your secure session. Please request a new link.');
            setValidating(false);
            return;
          }

          // Redirect to dashboard
          router.push(`/manage/dashboard?email=${encodeURIComponent(data.email)}`);
          return;
        }
      }

      // If subscription link fails, try gift aid link (existing functionality)
      const giftAidResponse = await fetch(FUNCTION_URLS.validateMagicLinkToken, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (giftAidResponse.ok) {
        const giftAidData = await giftAidResponse.json();

        if (giftAidData.valid) {
          // Cache the validation result
          const cacheKey = `tokenValidation_${token}`;
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(giftAidData));
            sessionStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
          } catch {
            // Storage unavailable
          }

          // Redirect to Gift Aid form
          router.push(`/gift-aid?token=${token}`);
          return;
        }
      }

      // Both failed
      setError('This link is invalid or has expired.');
      setValidating(false);
    } catch (err) {
      console.error('Validation error:', err);
      setError('Unable to validate link. Please try again.');
      setValidating(false);
    }
  };

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EEEFF3]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Validating your link...</h1>
          <p className="text-gray-600">Please wait a moment</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EEEFF3] px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-6">{error}</p>

          <div className="space-y-3">
            <button
              onClick={() => router.push('/manage')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-6 rounded-xl transition-colors"
            >
              Request New Link
            </button>
            <button
              onClick={() => router.push('/campaigns')}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-xl transition-colors"
            >
              Browse Campaigns
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
