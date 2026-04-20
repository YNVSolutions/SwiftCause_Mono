'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ResultScreen } from '@/views/campaigns/ResultScreen';
import { useAuth } from '@/shared/lib/auth-provider';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { Donation, PaymentResult } from '@/shared/types';
import { KioskLoading } from '@/shared/ui/KioskLoading';
import { useOrganization } from '@/shared/lib/hooks/useOrganization';
import { getCampaignById } from '@/shared/api/firestoreService';

function ResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userRole } = useAuth();
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const { organization } = useOrganization(organizationId);

  const fetchMagicLinkToken = useCallback(async (transactionId: string, retryCount = 0) => {
    const maxRetries = 15; // Increased from 5 to 15 (30 seconds total)
    const retryDelay = 2000; // 2 seconds between retries

    try {
      // Import Firestore
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');
      const db = getFirestore();

      // Fetch ephemeral token document (separate collection for security)
      const ephemeralDoc = await getDoc(doc(db, 'magicLinkEphemeral', transactionId));

      if (ephemeralDoc.exists()) {
        const ephemeralData = ephemeralDoc.data();
        const plainToken = ephemeralData.plainToken;

        if (plainToken) {
          // Update payment result with magic link token
          setPaymentResult((prev) =>
            prev
              ? {
                  ...prev,
                  magicLinkToken: plainToken,
                }
              : null,
          );
        } else {
          console.warn('Plain token not found in ephemeral document');
        }
      } else {
        // Token not created yet - retry if we haven't exceeded max retries
        if (retryCount < maxRetries) {
          // Retry silently - token creation may be delayed
          setTimeout(() => {
            fetchMagicLinkToken(transactionId, retryCount + 1);
          }, retryDelay);
        } else {
          console.warn('Magic link token not available after maximum retries');
        }
      }
    } catch (error: unknown) {
      // Check if it's a permissions error (token doesn't exist yet)
      const errorCode = (error as { code?: string })?.code;
      if (errorCode === 'permission-denied' && retryCount < maxRetries) {
        // Retry silently - token creation may be delayed
        setTimeout(() => {
          fetchMagicLinkToken(transactionId, retryCount + 1);
        }, retryDelay);
      } else if (retryCount >= maxRetries) {
        console.warn('Magic link token not available after maximum retries');
      } else {
        console.error('Failed to fetch magic link token:', error);
      }
      // Non-critical error - don't block the UI
    }
  }, []);

  useEffect(() => {
    // Get payment result from sessionStorage or URL params
    const storedResult = sessionStorage.getItem('paymentResult');
    const storedDonation = sessionStorage.getItem('donation');
    if (storedResult) {
      const result = JSON.parse(storedResult);
      setPaymentResult(result);
      if (storedDonation) {
        try {
          const donation = JSON.parse(storedDonation) as Donation;
          if (donation.organizationId) {
            setOrganizationId(donation.organizationId);
          } else if (donation.campaignId) {
            void getCampaignById(donation.campaignId).then((campaign) => {
              if (campaign?.organizationId) {
                setOrganizationId(campaign.organizationId);
              }
            });
          }
        } catch {
          // ignore parse failures
        }
      }

      // Fetch magic link token if transaction was successful
      if (result.success && result.transactionId) {
        fetchMagicLinkToken(result.transactionId);
      }
    } else if (searchParams) {
      // Fallback to URL params
      const success = searchParams.get('success');
      const transactionId = searchParams.get('transactionId');
      if (success && transactionId) {
        const result = {
          success: success === 'true',
          transactionId: transactionId,
        };
        setPaymentResult(result);

        // Fetch magic link token if successful
        if (result.success) {
          fetchMagicLinkToken(transactionId);
        }
      }
    }
  }, [searchParams, fetchMagicLinkToken]);

  const handleEmailConfirmation = () => {
    const params = new URLSearchParams();
    if (paymentResult?.transactionId) {
      params.set('transactionId', paymentResult.transactionId);
    }
    if (paymentResult?.subscriptionId) {
      params.set('subscriptionId', paymentResult.subscriptionId);
    }
    if (paymentResult?.campaignTitle) {
      params.set('campaignTitle', paymentResult.campaignTitle);
    }
    if (organizationId) {
      params.set('organizationId', organizationId);
    }
    const query = params.toString();
    router.push(query ? `/email-confirmation?${query}` : '/email-confirmation');
  };

  const handleReturnToStart = () => {
    // Clear stored data
    sessionStorage.removeItem('donation');
    sessionStorage.removeItem('paymentResult');
    sessionStorage.removeItem('donorEmail');
    sessionStorage.removeItem('donorName');

    if (
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      userRole === 'manager' ||
      userRole === 'operator' ||
      userRole === 'viewer'
    ) {
      router.push('/admin');
    } else {
      router.push('/campaigns');
    }
  };

  const handleRetry = () => {
    try {
      const storedDonation = sessionStorage.getItem('donation');
      if (storedDonation) {
        const donation = JSON.parse(storedDonation) as { campaignId?: string };
        if (donation?.campaignId) {
          router.push(`/payment/${donation.campaignId}`);
          return;
        }
      }
    } catch {
      // Fall through to campaign list
    }

    router.push('/campaigns');
  };

  if (!paymentResult) {
    return <KioskLoading message="Loading result..." />;
  }

  return (
    <ResultScreen
      result={paymentResult}
      onEmailConfirmation={paymentResult.success ? handleEmailConfirmation : undefined}
      onReturnToStart={handleReturnToStart}
      onRetry={paymentResult.success ? undefined : handleRetry}
      accentColorHex={organization?.settings?.accentColorHex}
      thankYouMessage={organization?.settings?.thankYouMessage}
      organizationDisplayName={organization?.settings?.displayName || organization?.name}
      organizationLogoUrl={organization?.settings?.logoUrl}
    />
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<KioskLoading />}>
      <ResultContent />
    </Suspense>
  );
}
