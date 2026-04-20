import React, { useCallback } from 'react';
import { Campaign, KioskSession } from '@/shared/types';
import { CampaignListPage } from '../pages';
import { useCampaignListState } from '../hooks';
import { useOrganization } from '@/shared/lib/hooks/useOrganization';

interface CampaignListContainerProps {
  kioskSession: KioskSession | null;
  onSelectCampaign: (campaign: Campaign, amount?: number) => void;
  onViewDetails: (campaign: Campaign) => void;
  onLogout: () => void;
  refreshCurrentKioskSession: () => Promise<void>;
}

/**
 * Container component that connects the CampaignListPage to state and actions.
 * Handles all business logic and passes pure state to the presentational component.
 */
export const CampaignListContainer: React.FC<CampaignListContainerProps> = ({
  kioskSession,
  onSelectCampaign,
  onViewDetails,
  onLogout,
}) => {
  const { state } = useCampaignListState({ kioskSession });
  const { organization } = useOrganization(kioskSession?.organizationId || null);

  const handleSelectCampaign = useCallback(
    (campaign: Campaign, amount?: number) => {
      onSelectCampaign(campaign, amount);
    },
    [onSelectCampaign],
  );

  const handleViewDetails = useCallback(
    (campaign: Campaign) => {
      onViewDetails(campaign);
    },
    [onViewDetails],
  );

  return (
    <CampaignListPage
      state={state}
      kioskSession={kioskSession}
      organizationBranding={{
        displayName: organization?.settings?.displayName || organization?.name,
        logoUrl: organization?.settings?.logoUrl || null,
        accentColorHex: organization?.settings?.accentColorHex,
        idleImageUrl: organization?.settings?.idleImageUrl || null,
      }}
      onSelectCampaign={handleSelectCampaign}
      onViewDetails={handleViewDetails}
      onLogout={onLogout}
    />
  );
};
