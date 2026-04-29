import { RefreshCw } from 'lucide-react';
import { Button } from '../../../shared/ui/button';

interface AdminRefreshButtonProps {
  onRefresh: () => void;
  refreshing?: boolean;
  disabled?: boolean;
  label?: string;
  ariaLabel?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  hideLabelOnMobile?: boolean;
}

export function AdminRefreshButton({
  onRefresh,
  refreshing = false,
  disabled = false,
  label = 'Refresh',
  ariaLabel,
  className,
  variant = 'outline',
  size = 'sm',
  hideLabelOnMobile = false,
}: AdminRefreshButtonProps) {
  const isDisabled = disabled || refreshing;
  const baseClassName =
    'rounded-xl border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 disabled:opacity-50';

  return (
    <Button
      variant={variant}
      size={size}
      onClick={onRefresh}
      disabled={isDisabled}
      aria-label={ariaLabel ?? `Refresh ${label.toLowerCase()}`}
      className={className ? `${baseClassName} ${className}` : baseClassName}
    >
      <RefreshCw
        className={refreshing ? 'h-4 w-4 motion-safe:animate-[spin_1s_linear_infinite]' : 'h-4 w-4'}
      />
      <span className={hideLabelOnMobile ? 'ml-2 hidden sm:inline' : 'ml-2'}>
        {refreshing ? 'Refreshing...' : label}
      </span>
    </Button>
  );
}
