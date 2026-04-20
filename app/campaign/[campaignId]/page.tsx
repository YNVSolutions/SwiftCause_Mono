'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/shared/lib/auth-provider';
import { useState, useEffect, use } from 'react';
import { Campaign, GiftAidDetails } from '@/shared/types';
import { getCampaignById } from '@/shared/api/firestoreService';
import { isCampaignActiveForKioskDonation } from '@/shared/lib/campaignStatus';
import { CampaignDetailsContainer } from '@/features/kiosk-campaign-details';
import { GiftAidPage } from '@/features/kiosk-gift-aid';
import { submitGiftAidDeclaration } from '@/entities/giftAid/lib';
import { KioskLoading } from '@/shared/ui/KioskLoading';
import { useOrganization } from '@/shared/lib/hooks/useOrganization';

export default function CampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentKioskSession } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { organization } = useOrganization(campaign?.organizationId ?? null);
  const accentColorHex = organization?.settings?.accentColorHex;

  // Unwrap the params Promise
  const { campaignId } = use(params);

  // Get URL params
  const initialAmount = searchParams?.get('amount') ? parseInt(searchParams.get('amount')!) : null;
  const showGiftAid = searchParams?.get('giftaid') === 'true';
  const isCustomAmount = searchParams?.get('custom') === 'true';
  const isRecurringSelection = searchParams?.get('recurring') === 'true';
  const recurringIntervalParam =
    (searchParams?.get('interval') as 'monthly' | 'quarterly' | 'yearly') ||
    campaign?.configuration?.defaultRecurringInterval ||
    'monthly';
  const fromDetails = searchParams?.get('from') === 'details';
  const fromMagicLink = searchParams?.get('from') === 'magiclink';
  const tokenId = searchParams?.get('tokenId');

  useEffect(() => {
    const fetchCampaign = async () => {
      if (!campaignId) return;

      try {
        setLoading(true);
        setError(null);
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
        console.error('Error fetching campaign:', err);
        setError('Failed to load campaign. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [campaignId]);

  // Back to campaign list
  const handleBackToList = () => {
    router.push('/campaigns');
  };

  // Back from gift aid - go to details if came from there, otherwise list
  const handleBackFromGiftAid = () => {
    if (fromDetails && initialAmount) {
      router.push(`/campaign/${campaignId}?preselect=${initialAmount}`);
    } else if (fromDetails) {
      router.push(`/campaign/${campaignId}`);
    } else {
      router.push('/campaigns');
    }
  };

  // Donate from details screen - skip Gift Aid and go directly to payment
  const handleDonate = (
    _campaign: Campaign,
    amount: number,
    options: { isRecurring: boolean; recurringInterval: 'monthly' | 'quarterly' | 'yearly' },
  ) => {
    const amountPence = Math.round(amount * 100);

    // Get donor info from sessionStorage if recurring
    let donorEmail = '';
    let donorName = '';
    if (options.isRecurring) {
      donorEmail = sessionStorage.getItem('donorEmail') || '';
      donorName = sessionStorage.getItem('donorName') || '';
    }

    // Skip Gift Aid and go directly to payment
    // isGiftAid should be FALSE - donor hasn't opted in yet
    // Magic link will be generated based on campaign.configuration.giftAidEnabled
    const donation = {
      campaignId: _campaign.id,
      organizationId: _campaign.organizationId,
      amount: amountPence,
      isGiftAid: false, // Donor hasn't opted in yet
      giftAidAccepted: false,
      giftAidEnabled: _campaign.configuration.giftAidEnabled, // Campaign supports Gift Aid
      isRecurring: options.isRecurring,
      recurringInterval: options.isRecurring ? options.recurringInterval : undefined,
      kioskId: currentKioskSession?.kioskId,
      donorEmail: donorEmail,
      donorName: donorName || 'Anonymous',
    };
    sessionStorage.setItem('donation', JSON.stringify(donation));
    sessionStorage.setItem('paymentBackPath', `/campaign/${campaignId}`);
    router.push(`/payment/${campaignId}`);
  };

  // Gift Aid accepted - save details and go to payment (or thank you for magic link)
  const handleAcceptGiftAid = async (details: GiftAidDetails) => {
    if (!campaign) {
      setError('Campaign not loaded. Please try again.');
      return;
    }

    try {
      const declarationId = await submitGiftAidDeclaration(details, campaign.id, campaign.title);

      // Consume magic link token if present (from magic link flow)
      if (fromMagicLink && tokenId) {
        try {
          const response = await fetch(
            'https://us-central1-swiftcause-app.cloudfunctions.net/consumeMagicLinkToken',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ tokenId }),
            },
          );

          const data = await response.json();

          if (!response.ok || !data.success) {
            console.error('Failed to consume magic link token:', data.error);
            // Show error to user - token consumption failed
            setError(
              `Unable to complete Gift Aid submission: ${data.error || 'Unknown error'}. Please contact support.`,
            );
            return;
          }
        } catch (tokenError) {
          console.error('Failed to consume magic link token:', tokenError);
          setError('Unable to complete Gift Aid submission. Please contact support.');
          return;
        }

        // For magic link flow: Show thank you screen instead of payment
        // Payment was already completed before the magic link was sent
        const donationAmountPounds = details.donationAmount / 100;
        const giftAidBonus = donationAmountPounds * 0.25;
        const totalImpact = donationAmountPounds + giftAidBonus;

        // Store data for thank you screen
        sessionStorage.setItem(
          'giftAidThankYou',
          JSON.stringify({
            campaignTitle: campaign.title,
            donationAmount: donationAmountPounds,
            giftAidBonus,
            totalImpact,
            donorName: `${details.firstName} ${details.surname}`,
            declarationId,
            // No transactionId here — payment hasn't happened yet in this flow.
            // The receipt button will be disabled until a real donation ID is available.
          }),
        );

        // Redirect to thank you page
        router.push(`/gift-aid-thank-you?campaign=${campaignId}`);
        return;
      }

      // Regular flow: Continue to payment
      const donation = {
        campaignId: campaign.id,
        organizationId: campaign.organizationId,
        amount: details.donationAmount,
        isGiftAid: true,
        giftAidAccepted: true,
        isRecurring: isRecurringSelection,
        recurringInterval: isRecurringSelection ? recurringIntervalParam : undefined,
        giftAidDetails: {
          ...details,
          declarationId,
        },
        giftAidDeclarationId: declarationId,
        kioskId: currentKioskSession?.kioskId,
        donorName: `${details.firstName} ${details.surname}`,
        donorEmail: details.donorEmail || sessionStorage.getItem('donorEmail') || '',
      };
      sessionStorage.setItem('donation', JSON.stringify(donation));
      if (donation.donorEmail) {
        sessionStorage.setItem('donorEmail', donation.donorEmail);
      }
      sessionStorage.setItem('giftAidData', JSON.stringify({ ...details, declarationId }));
      sessionStorage.setItem(
        'paymentBackPath',
        `${window.location.pathname}${window.location.search}`,
      );

      // COMMENTED OUT: Payment flow for magic link (payment already completed)
      // Uncomment this line if you want to enable payment after Gift Aid for regular flow
      router.push(`/payment/${campaignId}`);
    } catch (submitError) {
      console.error('Failed to submit Gift Aid declaration before payment:', submitError);
      window.alert('We could not save your Gift Aid declaration. Please try again.');
    }
  };

  if (showGiftAid && loading) {
    return (
      <KioskLoading
        message="Loading Gift Aid details..."
        submessage="Preparing your Gift Aid options."
        accentColorHex={accentColorHex}
        organizationId={currentKioskSession?.organizationId || null}
      />
    );
  }

  // Show Gift Aid page (with sliding panels) - only if Gift Aid is enabled
  if (showGiftAid && campaign) {
    // Check if Gift Aid is enabled for this campaign
    if (!campaign.configuration.giftAidEnabled) {
      // Gift Aid is disabled, redirect to payment directly
      const amountPence = Math.round((initialAmount || 0) * 100);
      const donation = {
        campaignId: campaign.id,
        organizationId: campaign.organizationId,
        amount: amountPence,
        isGiftAid: false,
        giftAidAccepted: false, // Explicitly set to false when disabled
        isRecurring: isRecurringSelection,
        recurringInterval: isRecurringSelection ? recurringIntervalParam : undefined,
        kioskId: currentKioskSession?.kioskId,
        donorName: '',
      };
      sessionStorage.setItem('donation', JSON.stringify(donation));
      sessionStorage.setItem(
        'paymentBackPath',
        fromDetails ? `/campaign/${campaignId}` : '/campaigns',
      );
      router.push(`/payment/${campaignId}`);
      return null; // Prevent rendering while redirecting
    }

    return (
      <GiftAidPage
        campaign={campaign}
        amount={initialAmount || 0}
        isCustomAmount={isCustomAmount || !initialAmount}
        currency={currentKioskSession?.organizationCurrency || 'GBP'}
        accentColorHex={accentColorHex}
        initialDonorName={sessionStorage.getItem('donorName') || ''}
        initialDonorEmail={sessionStorage.getItem('donorEmail') || ''}
        onAcceptGiftAid={handleAcceptGiftAid}
        onBack={handleBackFromGiftAid}
      />
    );
  }

  // Get preselected amount for details screen (when coming back from gift aid)
  const preselectAmount = searchParams?.get('preselect')
    ? parseInt(searchParams.get('preselect')!)
    : null;

  // Show Campaign Details
  return (
    <CampaignDetailsContainer
      campaign={campaign}
      loading={loading}
      error={error}
      currency={currentKioskSession?.organizationCurrency || 'GBP'}
      accentColorHex={accentColorHex}
      organizationId={currentKioskSession?.organizationId || null}
      initialAmount={preselectAmount || initialAmount}
      onBack={handleBackToList}
      onDonate={handleDonate}
    />
  );
}
