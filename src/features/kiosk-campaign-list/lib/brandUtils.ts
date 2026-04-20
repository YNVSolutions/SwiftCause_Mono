const DEFAULT_ACCENT_COLOR = '#0E8F5A';
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export const resolveAccentColor = (accentColorHex?: string): string => {
  if (!accentColorHex) {
    return DEFAULT_ACCENT_COLOR;
  }

  const trimmed = accentColorHex.trim();
  if (!HEX_COLOR_REGEX.test(trimmed)) {
    return DEFAULT_ACCENT_COLOR;
  }

  return trimmed.toUpperCase();
};

export const darkenHexColor = (hexColor: string, amount = 0.12): string => {
  const resolved = resolveAccentColor(hexColor);
  const channel = (start: number) => parseInt(resolved.slice(start, start + 2), 16);
  const clamp = (value: number) => Math.max(0, Math.min(255, value));
  const darken = (value: number) => clamp(Math.round(value * (1 - amount)));

  const toHex = (value: number) => value.toString(16).padStart(2, '0');

  const red = darken(channel(1));
  const green = darken(channel(3));
  const blue = darken(channel(5));

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`.toUpperCase();
};
