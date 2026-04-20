import React from 'react';
import { KioskLoading } from '@/shared/ui/KioskLoading';
import { LoadingStateProps } from '../types';

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading campaigns...',
  submessage = 'Fetching the latest assignments for this kiosk.',
  accentColorHex,
  organizationId,
}) => {
  return (
    <KioskLoading
      message={message}
      submessage={submessage}
      accentColorHex={accentColorHex}
      organizationId={organizationId}
    />
  );
};
