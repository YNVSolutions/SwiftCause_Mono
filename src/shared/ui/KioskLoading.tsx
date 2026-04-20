import {
  getCachedAccentColor,
  getLastCachedAccentColor,
  normalizeAccentColor,
} from '@/shared/lib/organizationBrandingCache';

interface KioskLoadingProps {
  message?: string;
  submessage?: string;
  accentColorHex?: string;
  organizationId?: string | null;
}

export function KioskLoading({
  message = 'Loading...',
  submessage,
  accentColorHex,
  organizationId,
}: KioskLoadingProps) {
  const hasExplicitAccent =
    typeof accentColorHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(accentColorHex.trim());
  const accentColor = hasExplicitAccent
    ? normalizeAccentColor(accentColorHex)
    : organizationId
      ? getCachedAccentColor(organizationId)
      : getLastCachedAccentColor();
  const startColor = `${accentColor}14`;
  const endColor = `${accentColor}1A`;

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: `linear-gradient(to bottom, ${startColor}, #FFFFFF, ${endColor})` }}
    >
      <div className="text-center space-y-4">
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto"
          style={{ borderColor: `${accentColor}55`, borderBottomColor: accentColor }}
        />
        <p className="text-[#0A0A0A] text-base sm:text-lg font-medium">{message}</p>
        {submessage ? <p className="text-gray-500 text-sm">{submessage}</p> : null}
      </div>
    </div>
  );
}
