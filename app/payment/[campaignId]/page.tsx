'use client';

import { useRouter } from 'next/navigation';
import { PaymentContainer } from '@/features/payment';
import { useState, useEffect, use } from 'react';
import { Campaign, Donation, PaymentResult } from '@/shared/types';
import { getCampaignById } from '@/shared/api/firestoreService';
import { isCampaignActiveForKioskDonation } from '@/shared/lib/campaignStatus';
import { KioskLoading } from '@/shared/ui/KioskLoading';

export default function PaymentPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [donation, setDonation] = useState<Donation | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const storedDonation = window.sessionStorage.getItem('donation');
      return storedDonation ? (JSON.parse(storedDonation) as Donation) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Unwrap the params Promise
  const { campaignId } = use(params);

  useEffect(() => {
    const fetchData = async () => {
      if (!campaignId) return;

      try {
        setLoading(true);
        setError(null);

        // Get donation data from sessionStorage
        const storedDonation = sessionStorage.getItem('donation');
        if (storedDonation) {
          setDonation(JSON.parse(storedDonation));
        }

        // Fetch campaign data based on campaignId
        const campaignData = await getCampaignById(campaignId);

        if (campaignData) {
          if (!isCampaignActiveForKioskDonation(campaignData as Campaign)) {
            setError('This campaign is not active for donations right now.');
            setCampaign(null);
            return;
          }
          setCampaign(campaignData as Campaign);
        } else {
          setError('Campaign not found');
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [campaignId]);

  const handlePaymentComplete = async (result: PaymentResult) => {
    const enrichedResult: PaymentResult = {
      ...result,
      campaignTitle: campaign?.title,
    };

    // Store payment result
    sessionStorage.setItem('paymentResult', JSON.stringify(enrichedResult));

    // Gift Aid declaration is captured before payment; webhook links donation outcome.
    if (enrichedResult.success && enrichedResult.transactionId) {
      try {
        const completeGiftAidData = sessionStorage.getItem('completeGiftAidData');
        if (completeGiftAidData) {
          // Clean up session storage and let the webhook handle persistence
          sessionStorage.removeItem('completeGiftAidData');
          sessionStorage.removeItem('giftAidData');
        }
      } catch (error) {
        console.error('Error cleaning up Gift Aid session data:', error);
        // Don't block the user flow if cleanup fails
      }
    }

    // Navigate to result page
    router.push('/result');
  };

  const handleBack = () => {
    try {
      const backPath = sessionStorage.getItem('paymentBackPath');
      if (backPath) {
        router.push(backPath);
        return;
      }
    } catch {
      // Fall back to history back
    }

    // Use router.back() to go to the actual previous page in history
    // This ensures consistent behavior with browser gestures
    router.back();
  };

  if (loading) {
    return (
      <KioskLoading
        message="Preparing payment..."
        submessage="Loading donation details."
        organizationId={donation?.organizationId || campaign?.organizationId || null}
      />
    );
  }

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>;
  }

  if (!campaign || !donation) {
    return <div>No data available</div>;
  }

  return (
    <PaymentContainer
      campaign={campaign}
      donation={donation}
      onPaymentComplete={handlePaymentComplete}
      onBack={handleBack}
    />
  );
}
