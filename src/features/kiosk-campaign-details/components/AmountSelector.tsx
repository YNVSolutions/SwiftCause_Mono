import React from 'react';
import { formatCurrencyFromMajor } from '@/shared/lib/currencyFormatter';
import { AmountSelectorProps } from '../types';
import { Calendar, Repeat } from 'lucide-react';
import { RecurringDonorInfo } from './RecurringDonorInfo';

export const AmountSelector: React.FC<AmountSelectorProps> = ({
  amounts,
  selectedAmount,
  customAmount,
  currency,
  enableRecurring = false,
  recurringIntervals = [],
  isRecurring = false,
  recurringInterval = 'monthly',
  donorEmail = '',
  donorName = '',
  accentColorHex,
  onSelectAmount,
  onCustomAmountChange,
  onRecurringToggle,
  onRecurringIntervalChange,
  onDonorEmailChange,
  onDonorNameChange,
}) => {
  const accentColor =
    typeof accentColorHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(accentColorHex.trim())
      ? accentColorHex.trim().toUpperCase()
      : '#0E8F5A';

  // Format amount without decimals
  const formatAmount = (amount: number) => formatCurrencyFromMajor(amount, currency);

  const handleCustomFocus = () => {
    // Clear preset selection when focusing on custom input
    onSelectAmount(0);
  };

  const handleCustomChange = (value: string) => {
    onCustomAmountChange(value);
    // Clear preset selection when typing custom amount
    if (value) {
      onSelectAmount(0);
    }
  };

  const getCurrencySymbol = () => '£';

  // Get effective amount for display
  const effectiveAmount = customAmount ? parseFloat(customAmount) : selectedAmount || 0;

  // Get recurring label
  const getRecurringLabel = () => {
    switch (recurringInterval) {
      case 'monthly':
        return 'Monthly';
      case 'quarterly':
        return 'Quarterly';
      case 'yearly':
        return 'Yearly';
      default:
        return 'Monthly';
    }
  };

  return (
    <div className="space-y-4 font-lexend">
      {/* Recurring Toggle */}
      {enableRecurring && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4" style={{ color: accentColor }} />
            <span className="text-sm font-medium text-slate-700">Make this recurring</span>
          </div>
          <button
            type="button"
            onClick={() => onRecurringToggle?.(!isRecurring)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isRecurring ? 'bg-gray-300' : 'bg-gray-300'
            }`}
            style={isRecurring ? { backgroundColor: accentColor } : undefined}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isRecurring ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      )}

      {/* Recurring Interval Selector */}
      {enableRecurring && isRecurring && recurringIntervals.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {recurringIntervals.map((interval) => (
            <button
              key={interval}
              type="button"
              onClick={() =>
                onRecurringIntervalChange?.(interval as 'monthly' | 'quarterly' | 'yearly')
              }
              className={`h-10 rounded-lg border text-sm font-medium transition-all ${
                recurringInterval === interval
                  ? 'text-white border-transparent'
                  : 'bg-white text-slate-700 border-gray-200 hover:bg-gray-50'
              }`}
              style={recurringInterval === interval ? { backgroundColor: accentColor } : undefined}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {interval.charAt(0).toUpperCase() + interval.slice(1)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Recurring Donor Info */}
      {enableRecurring && isRecurring && onDonorEmailChange && onDonorNameChange && (
        <RecurringDonorInfo
          email={donorEmail}
          name={donorName}
          onEmailChange={onDonorEmailChange}
          onNameChange={onDonorNameChange}
        />
      )}

      {/* Recurring Preview */}
      {enableRecurring && isRecurring && effectiveAmount > 0 && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">{formatAmount(effectiveAmount)}</span> will be charged{' '}
            {getRecurringLabel().toLowerCase()}
          </p>
        </div>
      )}

      {/* Preset Amounts */}
      <div className="grid grid-cols-3 gap-3">
        {amounts.slice(0, 3).map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => {
              onSelectAmount(amount);
              onCustomAmountChange('');
            }}
            className={`h-12 rounded-full font-semibold text-[17px] transition-all duration-150 ease-out border ${
              selectedAmount === amount
                ? 'text-white border-transparent shadow-[0_12px_32px_rgba(15,23,42,0.08)] scale-[1.02]'
                : 'bg-[#FFFBF7] border-gray-200 hover:bg-gray-100/50 hover:border-gray-300 hover:brightness-[1.02]'
            }`}
            style={
              selectedAmount === amount ? { backgroundColor: accentColor } : { color: accentColor }
            }
          >
            {formatAmount(amount)}
          </button>
        ))}
      </div>

      {/* Custom Amount Input */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-[18px] font-normal">
          {getCurrencySymbol()}
        </span>
        <input
          type="number"
          value={customAmount}
          onChange={(e) => handleCustomChange(e.target.value)}
          onFocus={handleCustomFocus}
          placeholder="Custom amount"
          className="w-full h-12 pl-10 pr-4 rounded-lg border border-gray-200 text-[17px] font-normal focus:outline-none transition-all duration-150 ease-out bg-[#FFFBF7]"
          style={{
            borderColor: customAmount ? `${accentColor}55` : undefined,
            boxShadow: customAmount ? `0 0 0 1px ${accentColor}33` : undefined,
          }}
        />
      </div>
    </div>
  );
};
