import React from 'react';
import { PaymentScreen } from '../../../views/campaigns/PaymentScreen';
import { Campaign, Donation, PaymentResult } from '../../../shared/types';
import { usePayment } from '../hooks/usePayment';
import { useOrganization } from '../../../shared/lib/hooks/useOrganization';

interface PaymentContainerProps {
  campaign: Campaign;
  donation: Donation;
  onPaymentComplete: (result: PaymentResult) => void;
  onBack: () => void;
}

export function PaymentContainer({
  campaign,
  donation,
  onPaymentComplete,
  onBack,
}: PaymentContainerProps) {
  const {
    isProcessing,
    error,
    handlePaymentSubmit: processPayment,
  } = usePayment(onPaymentComplete);
  const { organization } = useOrganization(campaign.organizationId || null);
  const organizationCurrency = organization?.currency;

  const submitPayment = async (
    amount: number,
    metadata: Record<string, unknown>,
    currency: string,
  ) => {
    await processPayment(amount, metadata, organizationCurrency || currency);
  };

  return (
    <PaymentScreen
      campaign={campaign}
      donation={donation}
      isProcessing={isProcessing}
      error={error}
      handlePaymentSubmit={submitPayment}
      onBack={onBack}
      organizationCurrency={organizationCurrency}
      accentColorHex={organization?.settings?.accentColorHex}
      organizationDisplayName={organization?.settings?.displayName || organization?.name}
      organizationLogoUrl={organization?.settings?.logoUrl}
    />
  );
}
