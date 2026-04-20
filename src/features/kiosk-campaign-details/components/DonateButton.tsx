import React from 'react';
import { DonateButtonProps } from '../types';

const resolveAccentColor = (accentColorHex?: string) =>
  typeof accentColorHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(accentColorHex.trim())
    ? accentColorHex.trim().toUpperCase()
    : '#0E8F5A';

export const DonateButton: React.FC<DonateButtonProps> = ({
  disabled,
  onClick,
  label = 'Donate',
  accentColorHex,
}) => {
  const accentColor = resolveAccentColor(accentColorHex);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full h-[52px] rounded-full font-semibold text-[17px] text-white transition-all duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-[1.02] active:brightness-[0.98] shadow-[0_12px_32px_rgba(15,23,42,0.08)] font-lexend tracking-[0.01em]"
      style={{ backgroundColor: accentColor }}
    >
      {label}
    </button>
  );
};
