'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { GiftAidDetailsPanel } from '../../src/features/kiosk-gift-aid/components/GiftAidDetailsPanel';
import { GiftAidDetails } from '../../src/entities/giftAid/model/types';

interface TokenData {
  valid: boolean;
  tokenId?: string;
  donationId?: string;
  campaignId?: string;
  charityId?: string;
  campaignTitle?: string;
  amount?: number;
  currency?: string;
  expiresAt?: string;
  error?: string;
}

interface Campaign {
  title?: string;
  name?: string;
}

function GiftAidFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  // Token validation state
  const [validating, setValidating] = useState(true);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [campaignTitle, setCampaignTitle] = useState<string>('Your Donation');

  // Validate token on mount with caching to prevent race conditions
  useEffect(() => {
    if (!token) {
      setTokenError('No token provided');
      setValidating(false);
      return;
    }

    validateTokenWithCache();

    // Cleanup function to clear cache if component unmounts before completion
    return () => {
      // Cache is intentionally preserved — user may navigate back to this page
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const validateTokenWithCache = async () => {
    if (!token) return;

    const cacheKey = `tokenValidation_${token}`;

    // Attempt to read from cache — wrapped in try-catch for restricted environments
    try {
      const cachedData = sessionStorage.getItem(cacheKey);
      if (cachedData) {
        const parsedData: TokenData = JSON.parse(cachedData);

        // Bound cache validity by the token's actual server-side expiry,
        // not just a local TTL. If expiresAt is missing or already past,
        // fall through to a fresh API call.
        const tokenExpiresAt = parsedData.expiresAt ? new Date(parsedData.expiresAt).getTime() : 0;
        const now = Date.now();
        // Also enforce a 5-minute local cap as a secondary safety net
        const cacheTimestamp = sessionStorage.getItem(`${cacheKey}_timestamp`);
        const localAge = cacheTimestamp ? now - parseInt(cacheTimestamp, 10) : Infinity;
        const fiveMinutes = 5 * 60 * 1000;

        if (tokenExpiresAt > now && localAge < fiveMinutes) {
          setTokenData(parsedData);

          if (parsedData.campaignId && !parsedData.campaignTitle) {
            await fetchCampaignTitle(parsedData.campaignId);
          } else if (parsedData.campaignTitle) {
            setCampaignTitle(parsedData.campaignTitle);
          }

          setValidating(false);
          return;
        }

        // Cache is stale or token already expired — clear and revalidate
        sessionStorage.removeItem(cacheKey);
        sessionStorage.removeItem(`${cacheKey}_timestamp`);
      }
    } catch {
      // Storage unavailable or corrupted — fall through to API
    }

    // No valid cache — perform fresh validation
    await validateToken();
  };

  const validateToken = async () => {
    if (!token) return;

    try {
      const response = await fetch(
        'https://us-central1-swiftcause-app.cloudfunctions.net/validateMagicLinkToken',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        },
      );

      const data: TokenData = await response.json();

      if (!response.ok || !data.valid) {
        setTokenError(getErrorMessage(data.error || 'UNKNOWN_ERROR'));
        setValidating(false);
        return;
      }

      // Cache the validation result to prevent duplicate calls
      const cacheKey = `tokenValidation_${token}`;
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        sessionStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
      } catch {
        // Storage unavailable — validation still proceeds without caching
      }

      setTokenData(data);

      // Fetch campaign title if we have campaignId but no campaignTitle
      if (data.campaignId && !data.campaignTitle) {
        await fetchCampaignTitle(data.campaignId);
      } else if (data.campaignTitle) {
        setCampaignTitle(data.campaignTitle);
      }

      setValidating(false);
    } catch (error) {
      console.error('Token validation error:', error);
      setTokenError('Unable to validate link. Please try again.');
      setValidating(false);
    }
  };

  const fetchCampaignTitle = async (campaignId: string) => {
    try {
      // Import Firebase dynamically to avoid SSR issues
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');
      const { initializeApp, getApps } = await import('firebase/app');

      // Initialize Firebase if not already initialized
      if (getApps().length === 0) {
        initializeApp({
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
      }

      const db = getFirestore();
      const campaignRef = doc(db, 'campaigns', campaignId);
      const campaignSnap = await getDoc(campaignRef);

      if (campaignSnap.exists()) {
        const campaign = campaignSnap.data() as Campaign;
        const title = campaign.title || campaign.name || 'Your Donation';
        setCampaignTitle(title);
      }
    } catch (error) {
      console.error('Error fetching campaign title:', error);
      // Keep default 'Your Donation' if fetch fails
    }
  };

  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'TOKEN_NOT_FOUND':
        return 'This link is invalid or has been removed.';
      case 'TOKEN_EXPIRED':
        return 'This link has expired. Please request a new one.';
      case 'TOKEN_CONSUMED':
        return 'This link has already been used.';
      case 'TOKEN_BLOCKED':
        return 'This link has been blocked.';
      default:
        return 'This link is no longer valid.';
    }
  };

  const handleSubmit = async (details: GiftAidDetails) => {
    if (!token) return;

    setSubmitError(null);

    try {
      const response = await fetch(
        'https://us-central1-swiftcause-app.cloudfunctions.net/completeGiftAidFlow',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            formData: {
              donorTitle: details.donorTitle,
              firstName: details.firstName,
              surname: details.surname,
              houseNumber: details.houseNumber,
              addressLine1: details.addressLine1,
              addressLine2: details.addressLine2,
              town: details.town,
              postcode: details.postcode,
              donorEmail: undefined,
              consents: {
                giftAidConsent: details.giftAidConsent,
                ukTaxpayerConfirmation: details.ukTaxpayerConfirmation,
                dataProcessingConsent: details.dataProcessingConsent,
                homeAddressConfirmed: details.homeAddressConfirmed,
              },
            },
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setSubmitError(data.message || 'Failed to submit Gift Aid declaration');
        return;
      }

      // Success - clear saved form data and store data for thank you page
      try {
        sessionStorage.removeItem(`giftAidForm_${campaignTitle}_${(tokenData?.amount || 0) / 100}`);
        const cacheKey = `tokenValidation_${token}`;
        sessionStorage.removeItem(cacheKey);
        sessionStorage.removeItem(`${cacheKey}_timestamp`);
      } catch {
        // Storage unavailable — proceed with redirect regardless
      }
      const donationAmountPounds = (tokenData?.amount || 0) / 100;
      const giftAidBonus = data.giftAidAmount / 100;
      const totalImpact = data.totalImpact / 100;

      try {
        sessionStorage.setItem(
          'giftAidThankYou',
          JSON.stringify({
            campaignTitle: campaignTitle,
            donationAmount: donationAmountPounds,
            giftAidBonus,
            totalImpact,
            donorName: `${details.firstName} ${details.surname}`,
            declarationId: data.declarationId,
            transactionId: tokenData?.donationId || '',
          }),
        );
      } catch {
        // Storage unavailable — proceed with redirect regardless
      }

      // Redirect to thank you page
      router.push('/gift-aid-thank-you');
    } catch (error) {
      console.error('Submit error:', error);
      setSubmitError('An unexpected error occurred. Please try again.');
    }
  };

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Loading Gift Aid form...</h1>
          <p className="text-gray-600">Please wait a moment</p>
        </div>
      </div>
    );
  }

  // Token error state
  if (tokenError || !tokenData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-6">{tokenError || 'Unable to load Gift Aid form'}</p>
          <button
            onClick={() => router.push('/campaigns')}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-xl transition-colors"
          >
            Browse Campaigns
          </button>
        </div>
      </div>
    );
  }

  const amount = (tokenData.amount || 0) / 100; // Convert pence to pounds

  return (
    <>
      {submitError && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg">
            <p className="text-red-700 text-sm text-center">{submitError}</p>
          </div>
        </div>
      )}
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <GiftAidDetailsPanel
          amount={amount}
          currency={tokenData.currency || 'GBP'}
          campaignTitle={campaignTitle}
          organizationId={tokenData.charityId || ''}
          collectDonorEmail={false}
          enableAutoLookup={false}
          onSubmit={handleSubmit}
          onBack={() => router.push('/campaigns')}
        />
      </div>
    </>
  );
}

export default function GiftAidFormPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Loading...</h1>
          </div>
        </div>
      }
    >
      <GiftAidFormContent />
    </Suspense>
  );
}
