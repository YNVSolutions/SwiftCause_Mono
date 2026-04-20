'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { EmailConfirmationScreen } from '@/views/campaigns/EmailConfirmationScreen';
import { useAuth } from '@/shared/lib/auth-provider';
import { useState, useEffect, Suspense } from 'react';
import { KioskLoading } from '@/shared/ui/KioskLoading';
import { useOrganization } from '@/shared/lib/hooks/useOrganization';
import { Donation } from '@/shared/types';

function EmailConfirmationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userRole } = useAuth();
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [receiptReferenceId, setReceiptReferenceId] = useState<string | null>(null);
  const [campaignTitle, setCampaignTitle] = useState<string>('');
  const [donorEmail, setDonorEmail] = useState<string>('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const { organization } = useOrganization(organizationId);

  useEffect(() => {
    // Restore persisted donor email (survives payment redirect)
    const storedEmail = sessionStorage.getItem('donorEmail');
    if (storedEmail) {
      setDonorEmail(storedEmail);
    }
    const storedDonation = sessionStorage.getItem('donation');
    if (storedDonation) {
      try {
        const donation = JSON.parse(storedDonation) as Donation;
        setOrganizationId(donation.organizationId || null);
      } catch {
        setOrganizationId(null);
      }
    }

    // Get transaction ID from URL params or sessionStorage
    if (searchParams) {
      const urlTransactionId = searchParams.get('transactionId');
      const urlSubscriptionId = searchParams.get('subscriptionId');
      const urlCampaignTitle = searchParams.get('campaignTitle');
      const urlOrganizationId = searchParams.get('organizationId');
      if (urlOrganizationId) {
        setOrganizationId(urlOrganizationId);
      }
      if (urlTransactionId) {
        setTransactionId(urlTransactionId);
        setReceiptReferenceId(urlSubscriptionId || urlTransactionId);
        if (urlCampaignTitle) {
          setCampaignTitle(urlCampaignTitle);
        }
      }
      if (!urlTransactionId && urlCampaignTitle) {
        setCampaignTitle(urlCampaignTitle);
      }
    }

    // Fallback to sessionStorage
    const storedResult = sessionStorage.getItem('paymentResult');
    if (!searchParams?.get('transactionId') && storedResult) {
      const result = JSON.parse(storedResult);
      setTransactionId(result.transactionId);
      setReceiptReferenceId(result.subscriptionId || result.transactionId);
      if (result.campaignTitle) {
        setCampaignTitle(result.campaignTitle);
      }
    }
  }, [searchParams]);

  const handleComplete = () => {
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

  if (!transactionId) {
    return <KioskLoading organizationId={organizationId} />;
  }

  return (
    <EmailConfirmationScreen
      transactionId={transactionId}
      receiptReferenceId={receiptReferenceId || undefined}
      campaignName={campaignTitle || undefined}
      initialEmail={donorEmail}
      accentColorHex={organization?.settings?.accentColorHex}
      onComplete={handleComplete}
    />
  );
}

export default function EmailConfirmationPage() {
  return (
    <Suspense fallback={<KioskLoading />}>
      <EmailConfirmationContent />
    </Suspense>
  );
}
