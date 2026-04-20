import React from 'react';
import { KioskLoading } from '@/shared/ui/KioskLoading';
import { LoadingStateProps } from '../types';

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading campaign details...',
  accentColorHex,
  organizationId,
}) => {
  return (
    <KioskLoading
      message={message}
      accentColorHex={accentColorHex}
      organizationId={organizationId}
    />
  );
};
