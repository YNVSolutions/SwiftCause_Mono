import React from 'react';
import { CampaignGridProps } from '../types';
import { CampaignCard } from './CampaignCard';

export const CampaignGrid: React.FC<CampaignGridProps> = ({
  campaigns,
  currency,
  accentColorHex,
  onSelectCampaign,
  onViewDetails,
}) => {
  return (
    <div
      className="mx-auto"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 380px))',
        justifyContent: 'center',
        gap: '2.5rem 1.75rem',
        maxWidth: '1200px',
        width: '100%',
      }}
    >
      {campaigns.map((campaign) => (
        <CampaignCard
          key={campaign.id}
          campaign={campaign}
          currency={currency}
          accentColorHex={accentColorHex}
          onSelectAmount={(amount) => onSelectCampaign(campaign, amount)}
          onDonate={() => onViewDetails(campaign)}
          onCardClick={() => onViewDetails(campaign)}
        />
      ))}
    </div>
  );
};
