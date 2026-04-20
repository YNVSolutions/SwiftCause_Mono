import React, { useCallback } from 'react';
import { Campaign } from '@/shared/types';
import { CampaignDetailsPage } from '../pages';
import { useCampaignDetailsState } from '../hooks';

interface CampaignDetailsContainerProps {
  campaign: Campaign | null;
  loading: boolean;
  error: string | null;
  currency: string;
  accentColorHex?: string;
  organizationId?: string | null;
  initialAmount?: number | null;
  onBack: () => void;
  onDonate: (
    campaign: Campaign,
    amount: number,
    options: { isRecurring: boolean; recurringInterval: 'monthly' | 'quarterly' | 'yearly' },
  ) => void;
}

/**
 * Container component that connects the CampaignDetailsPage to state and actions.
 */
export const CampaignDetailsContainer: React.FC<CampaignDetailsContainerProps> = ({
  campaign,
  loading,
  error,
  currency,
  accentColorHex,
  organizationId,
  initialAmount,
  onBack,
  onDonate,
}) => {
  const { state, actions } = useCampaignDetailsState({
    campaign,
    loading,
    error,
    initialAmount,
  });

  // Select a predefined amount
  const handleSelectAmount = useCallback(
    (amount: number) => {
      actions.setSelectedAmount(amount);
    },
    [actions],
  );

  // Donate button click - use selected or custom amount
  const handleDonate = useCallback(() => {
    const amount = actions.getEffectiveAmount();
    if (campaign && amount > 0) {
      // For recurring donations, validate email
      if (state.isRecurring) {
        const email = actions.getDonorEmail();
        if (!email || !email.includes('@')) {
          alert('Please enter a valid email address for recurring donations');
          return;
        }
        // Store donor info in sessionStorage
        sessionStorage.setItem('donorEmail', email);
        sessionStorage.setItem('donorName', actions.getDonorName());
      }

      onDonate(campaign, amount, {
        isRecurring: state.isRecurring,
        recurringInterval: state.recurringInterval,
      });
    }
  }, [campaign, actions, onDonate, state.isRecurring, state.recurringInterval]);

  return (
    <CampaignDetailsPage
      state={state}
      currency={currency}
      accentColorHex={accentColorHex}
      organizationId={organizationId}
      onBack={onBack}
      onSelectAmount={handleSelectAmount}
      onCustomAmountChange={actions.setCustomAmount}
      onRecurringToggle={actions.setIsRecurring}
      onRecurringIntervalChange={actions.setRecurringInterval}
      onDonate={handleDonate}
      onImageChange={actions.setCurrentImageIndex}
      onDonorEmailChange={actions.setDonorEmail}
      onDonorNameChange={actions.setDonorName}
      donorEmail={actions.getDonorEmail()}
      donorName={actions.getDonorName()}
    />
  );
};
