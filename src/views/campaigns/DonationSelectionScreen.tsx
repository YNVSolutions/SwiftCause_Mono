import React, { useMemo, useState } from 'react';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../shared/ui/card';
import { Badge } from '../../shared/ui/badge';
import { Switch } from '../../shared/ui/switch';
import { Checkbox } from '../../shared/ui/checkbox';
import { Progress } from '../../shared/ui/progress';
import { ImageWithFallback } from '../../shared/ui/figma/ImageWithFallback';
import {
  ArrowLeft,
  Heart,
  ArrowRight,
  Users,
  Clock,
  Share2,
  Gift,
  Percent,
  Calendar,
  CalendarRange,
  CalendarClock,
  ShieldCheck,
} from 'lucide-react';
import { Campaign, Donation } from '../../shared/types';
import { formatCurrency, formatCurrencyFromMajor } from '../../shared/lib/currencyFormatter';

interface FrequencyOption {
  value: 'monthly' | 'quarterly' | 'yearly';
  label: string;
  savings?: number;
  icon: React.ReactNode;
  description: string;
}

const intervalLabelMap: Record<FrequencyOption['value'], string> = {
  monthly: 'month',
  quarterly: 'quarter',
  yearly: 'year',
};

const formatDisplayDate = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

function RecurringToggle({
  isRecurring,
  onChange,
  discount,
}: {
  isRecurring: boolean;
  onChange: (value: boolean) => void;
  discount?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 border rounded-xl bg-white/70">
      <div className="space-y-1">
        <p className="font-semibold">Make this recurring</p>
        <p className="text-sm text-gray-600">Support this cause regularly</p>
        {discount ? (
          <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-100">
            Save {discount}% with recurring
          </Badge>
        ) : null}
      </div>
      <Switch
        aria-label="Toggle recurring donation"
        checked={isRecurring}
        onCheckedChange={onChange}
        className="shrink-0"
      />
    </div>
  );
}

function FrequencyCard({
  option,
  isActive,
  onSelect,
}: {
  option: FrequencyOption;
  isActive: boolean;
  onSelect: (value: FrequencyOption['value']) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      onClick={() => onSelect(option.value)}
      className={`flex flex-col items-start gap-2 p-4 rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        isActive
          ? 'border-indigo-500 bg-indigo-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-indigo-300'
      }`}
    >
      <div className="flex items-center gap-2">
        {option.icon}
        <span className="font-semibold">{option.label}</span>
        {option.savings ? (
          <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-100">
            Save {option.savings}%
          </Badge>
        ) : null}
      </div>
      <p className="text-sm text-gray-600 text-left">{option.description}</p>
      <span
        className={`text-xs font-medium px-2 py-1 rounded-full ${
          isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'
        }`}
      >
        Renews every {intervalLabelMap[option.value]}
      </span>
    </button>
  );
}

function ImpactPreview({ amount, interval }: { amount: number; interval: string }) {
  const annualImpact =
    interval === 'monthly' ? amount * 12 : interval === 'quarterly' ? amount * 4 : amount;

  return (
    <Card aria-live="polite" className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Your Impact</CardTitle>
        <CardDescription>Preview your yearly contribution</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-3xl font-bold">{formatCurrencyFromMajor(annualImpact)}</p>
        <p className="text-gray-600">Annual impact</p>
        <p className="text-sm mt-2 text-gray-700">
          Your {formatCurrencyFromMajor(amount)}/
          {intervalLabelMap[interval as keyof typeof intervalLabelMap]} donation helps us plan
          long-term
        </p>
      </CardContent>
    </Card>
  );
}

interface DonationSelectionScreenProps {
  campaign: Campaign;
  onSubmit: (donation: Donation) => void;
  onBack: () => void;
}

interface DonorInfo {
  email: string;
  name: string;
  phone: string;
  address: string;
  message: string;
  isAnonymous: boolean;
}

export function DonationSelectionScreen({
  campaign,
  onSubmit,
  onBack,
}: DonationSelectionScreenProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<'monthly' | 'quarterly' | 'yearly'>(
    campaign.configuration.defaultRecurringInterval || 'monthly',
  );
  const [donorInfo, setDonorInfo] = useState<DonorInfo>({
    email: '',
    name: '',
    phone: '',
    address: '',
    message: '',
    isAnonymous: false,
  });

  const [isGiftAid, setIsGiftAid] = useState(false);

  const config = campaign.configuration;
  const allowRecurring = config.enableRecurring ?? true;
  const availableIntervals = useMemo<('monthly' | 'quarterly' | 'yearly')[]>(
    () =>
      config.recurringIntervals && config.recurringIntervals.length > 0
        ? config.recurringIntervals
        : ['monthly', 'quarterly', 'yearly'],
    [config.recurringIntervals],
  );

  const frequencyOptions: FrequencyOption[] = availableIntervals.map((interval) => ({
    value: interval,
    label: interval === 'monthly' ? 'Monthly' : interval === 'quarterly' ? 'Quarterly' : 'Annual',
    savings: interval === 'yearly' ? config.recurringDiscount : undefined,
    icon:
      interval === 'monthly' ? (
        <Calendar className="w-4 h-4" aria-hidden="true" />
      ) : interval === 'quarterly' ? (
        <CalendarRange className="w-4 h-4" aria-hidden="true" />
      ) : (
        <CalendarClock className="w-4 h-4" aria-hidden="true" />
      ),
    description:
      interval === 'monthly'
        ? 'Steady monthly support for ongoing needs'
        : interval === 'quarterly'
          ? 'Great for seasonal campaigns and milestone goals'
          : 'Best annual value with predictable funding',
  }));

  const getAnnualAmount = (amount: number, interval: 'monthly' | 'quarterly' | 'yearly') => {
    switch (interval) {
      case 'monthly':
        return amount * 12;
      case 'quarterly':
        return amount * 4;
      default:
        return amount;
    }
  };

  const getCurrentAmount = () => {
    if (selectedAmount !== null) return selectedAmount;
    const custom = parseFloat(customAmount);
    return isNaN(custom) ? 0 : custom;
  };

  const isValidAmount = () => {
    const amount = getCurrentAmount();
    if (!config.allowCustomAmount && selectedAmount === null) return false;
    return amount >= (config.minCustomAmount || 1) && amount <= (config.maxCustomAmount || 10000);
  };

  const getDiscountedAmount = () => {
    const amount = getCurrentAmount();
    if (isRecurring && config.recurringDiscount) {
      return amount * (1 - config.recurringDiscount / 100);
    }
    return amount;
  };

  const getNextChargeDate = () => {
    const nextDate = new Date();
    if (recurringInterval === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (recurringInterval === 'quarterly') {
      nextDate.setMonth(nextDate.getMonth() + 3);
    } else {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    }
    return nextDate;
  };

  const getThemeClasses = () => {
    switch (config.theme) {
      case 'vibrant':
        return {
          gradient: 'from-purple-500 via-pink-500 to-red-500',
          button:
            'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700',
          accent: 'text-purple-600',
        };
      case 'minimal':
        return {
          gradient: 'from-gray-100 to-gray-200',
          button: 'bg-gray-900 hover:bg-gray-800',
          accent: 'text-gray-700',
        };
      case 'elegant':
        return {
          gradient: 'from-indigo-100 via-blue-50 to-purple-100',
          button:
            'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700',
          accent: 'text-indigo-600',
        };
      default:
        return {
          gradient: 'from-blue-50 to-indigo-100',
          button: 'bg-indigo-600 hover:bg-indigo-700',
          accent: 'text-blue-600',
        };
    }
  };

  const themeClasses = getThemeClasses();

  React.useEffect(() => {
    if (!availableIntervals.includes(recurringInterval)) {
      setRecurringInterval(availableIntervals[0]);
    }
  }, [availableIntervals, recurringInterval]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAmount()) return;

    const donationAmountPence = Math.round(getCurrentAmount() * 100);
    const donation: Donation = {
      campaignId: campaign.id,
      amount: donationAmountPence,
      isRecurring,
      recurringInterval: isRecurring ? recurringInterval : undefined,
      isAnonymous: donorInfo.isAnonymous,
      isGiftAid: campaign.configuration.giftAidEnabled ? isGiftAid : false, // Only allow Gift Aid if enabled
      donorName: '', // No gift aid details collected yet, so no donor name
    };

    onSubmit(donation);
  };

  const handlePresetSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null);
  };

  const updateDonorInfo = (updates: Partial<DonorInfo>) => {
    setDonorInfo((prev) => ({ ...prev, ...updates }));
  };

  const progress = (campaign.raised / 100 / campaign.goal) * 100;
  const intervalLabel = intervalLabelMap[recurringInterval];
  const discountedAmount = getDiscountedAmount();
  const annualizedAmount = getAnnualAmount(discountedAmount, recurringInterval);
  const undiscountedAnnual = getAnnualAmount(getCurrentAmount(), recurringInterval);
  const firstChargeDate = formatDisplayDate(new Date());
  const nextChargeDate = formatDisplayDate(getNextChargeDate());
  const hasRecurringDiscount =
    isRecurring && !!config.recurringDiscount && getCurrentAmount() !== discountedAmount;

  // Mock recent donations for display
  const recentDonations = [
    { name: 'Sarah M.', amount: 100, time: '2 minutes ago', isAnonymous: false },
    { name: 'Anonymous', amount: 50, time: '5 minutes ago', isAnonymous: true },
    { name: 'Michael C.', amount: 250, time: '12 minutes ago', isAnonymous: false },
    { name: 'Anonymous', amount: 75, time: '18 minutes ago', isAnonymous: true },
    { name: 'Emily R.', amount: 200, time: '23 minutes ago', isAnonymous: false },
  ];

  return (
    <div className={`min-h-screen bg-linear-to-br ${themeClasses.gradient}`}>
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <Button
            variant="ghost"
            onClick={onBack}
            className="p-2 sm:p-3 rounded-full border border-gray-200 bg-transparent shadow-sm hover:bg-white/30"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span className="text-sm sm:text-base">Back to Campaign</span>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Campaign Info */}
          <Card className="lg:col-span-1">
            <div className="aspect-16/10 relative overflow-hidden rounded-t-lg">
              <ImageWithFallback
                src={campaign.coverImageUrl}
                alt={campaign.title}
                className="w-full h-full object-cover"
              />
              <Badge className="absolute top-4 left-4 bg-white/90 text-gray-800">
                {campaign.category}
              </Badge>
              {config.urgencyMessage && (
                <Badge className="absolute top-4 right-4 bg-orange-500 text-white">
                  {config.urgencyMessage}
                </Badge>
              )}
            </div>

            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-2">{campaign.title}</h2>
              <p className="text-gray-600 mb-4">{campaign.description}</p>

              {config.showProgressBar && (
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span>Raised: {formatCurrency(campaign.raised)}</span>
                    <span>Goal: {formatCurrencyFromMajor(campaign.goal)}</span>
                  </div>
                  <Progress value={Math.min(progress, 100)} className="h-2" />
                  <p className="text-sm text-gray-600">{progress.toFixed(1)}% funded</p>
                </div>
              )}

              {config.showDonorCount && (
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                  <div className="flex items-center space-x-1">
                    <Users className="w-4 h-4" />
                    <span>1,247 donors</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Heart className="w-4 h-4" />
                    <span>{formatCurrencyFromMajor(151)} avg</span>
                  </div>
                </div>
              )}

              {config.showRecentDonations && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Recent Donations</h4>
                  <div className="space-y-2">
                    {recentDonations.slice(0, config.maxRecentDonations).map((donation, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">
                          {donation.isAnonymous ? 'Anonymous' : donation.name}
                        </span>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(donation.amount)}</div>
                          <div className="text-xs text-gray-500">{donation.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {config.enableSocialSharing && (
                <div className="border-t pt-4 mt-4">
                  <Button variant="outline" size="sm" className="w-full">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Campaign
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Donation Form */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <Heart className={`mr-3 h-6 w-6 ${themeClasses.accent}`} />
                {config.primaryCTAText}
              </CardTitle>
              <CardDescription>
                Choose your donation amount and support this important cause
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Donation Amounts */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Select Amount</Label>

                  {/* Preset Amounts */}
                  <div
                    className={`grid ${
                      config.predefinedAmounts.length <= 3
                        ? 'grid-cols-3'
                        : config.predefinedAmounts.length <= 4
                          ? 'grid-cols-2 sm:grid-cols-4'
                          : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
                    } gap-3`}
                  >
                    {config.predefinedAmounts.map((amount: number) => (
                      <Button
                        key={amount}
                        type="button"
                        variant={selectedAmount === amount ? 'default' : 'outline'}
                        onClick={() => handlePresetSelect(amount)}
                        className={`h-14 flex flex-col ${
                          selectedAmount === amount ? themeClasses.button : ''
                        }`}
                      >
                        <span className="text-lg font-semibold">
                          {formatCurrencyFromMajor(amount)}
                        </span>
                        {allowRecurring && isRecurring && config.recurringDiscount && (
                          <span className="text-xs opacity-75">
                            {formatCurrencyFromMajor(amount * (1 - config.recurringDiscount / 100))}{' '}
                            after discount
                          </span>
                        )}
                      </Button>
                    ))}
                  </div>

                  {/* Custom Amount */}
                  {config.allowCustomAmount && (
                    <div className="space-y-2">
                      <Label htmlFor="customAmount">Custom Amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                          $
                        </span>
                        <Input
                          id="customAmount"
                          type="number"
                          min={config.minCustomAmount}
                          max={config.maxCustomAmount}
                          step="0.01"
                          placeholder={`${config.minCustomAmount} - ${config.maxCustomAmount}`}
                          value={customAmount}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            handleCustomAmountChange(e.target.value)
                          }
                          className="pl-8 h-12"
                          inputMode="decimal"
                        />
                      </div>
                      <p className="text-sm text-gray-500">
                        Enter between {formatCurrencyFromMajor(config.minCustomAmount)} and{' '}
                        {formatCurrencyFromMajor(config.maxCustomAmount)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Recurring Donation */}
                {allowRecurring && (
                  <div className="space-y-4 p-4 border rounded-xl bg-white/70 shadow-sm">
                    <RecurringToggle
                      isRecurring={isRecurring}
                      onChange={setIsRecurring}
                      discount={config.recurringDiscount}
                    />

                    {isRecurring ? (
                      <div className="space-y-4">
                        {frequencyOptions.length > 1 ? (
                          <div>
                            <Label className="text-sm font-semibold">Recurring frequency</Label>
                            <div
                              role="radiogroup"
                              aria-label="Recurring frequency"
                              className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                            >
                              {frequencyOptions.map((option) => (
                                <FrequencyCard
                                  key={option.value}
                                  option={option}
                                  isActive={recurringInterval === option.value}
                                  onSelect={setRecurringInterval}
                                />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600" aria-live="polite">
                            Renews every {intervalLabel}
                          </p>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <ImpactPreview amount={discountedAmount} interval={recurringInterval} />
                          <div className="p-4 rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-gray-700">Cost preview</p>
                              {hasRecurringDiscount ? (
                                <Badge
                                  variant="secondary"
                                  className="bg-green-50 text-green-700 border-green-100"
                                >
                                  Recurring savings
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-2xl font-bold" aria-live="polite">
                              {formatCurrencyFromMajor(discountedAmount)}/{intervalLabel}
                            </p>
                            <p className="text-sm text-gray-700">
                              Equals {formatCurrencyFromMajor(annualizedAmount)} per year
                            </p>
                            {hasRecurringDiscount && (
                              <p className="text-xs text-green-700 flex items-center gap-2 mt-2">
                                <Percent className="w-4 h-4" aria-hidden="true" />
                                Saving {config.recurringDiscount}% vs one-time (
                                {formatCurrencyFromMajor(undiscountedAnnual)} yearly)
                              </p>
                            )}
                            <div className="mt-3 space-y-1 text-sm text-gray-700">
                              <div className="flex items-center gap-2">
                                <CalendarClock className="w-4 h-4" aria-hidden="true" />
                                <span>First charge: Today ({firstChargeDate})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" aria-hidden="true" />
                                <span>
                                  Renews every {intervalLabel} on {nextChargeDate}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 text-xs text-gray-600">
                          <ShieldCheck className="w-4 h-4 mt-0.5" aria-hidden="true" />
                          <span>
                            By enabling recurring donations, you agree to our
                            <a
                              className="underline ml-1"
                              href="/terms"
                              aria-label="Read subscription terms"
                            >
                              subscription terms
                            </a>
                            and understand you can cancel anytime.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600" aria-live="polite">
                        Keep this off for a one-time gift. Turn it on to schedule ongoing impact.
                      </p>
                    )}
                  </div>
                )}

                {/* Anonymous donation option only */}
                {/* Gift Aid option - only show if enabled in campaign configuration */}
                {campaign.configuration.giftAidEnabled && (
                  <div className="flex items-center space-x-2 p-3 bg-green-50/50 rounded-lg">
                    <Checkbox
                      id="giftAid"
                      checked={isGiftAid}
                      onCheckedChange={(checked: boolean) => setIsGiftAid(checked)}
                    />
                    <Label htmlFor="giftAid" className="text-sm flex-1">
                      Yes, add Gift Aid. I am a UK taxpayer and understand that if I pay less Income
                      Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my
                      donations in that tax year it is my responsibility to pay any difference.
                    </Label>
                    <Gift className="w-5 h-5 text-green-600" />
                  </div>
                )}

                {config.enableAnonymousDonations && (
                  <div className="flex items-center justify-center space-x-2 p-3 bg-gray-50 rounded-lg">
                    <Checkbox
                      id="anonymous"
                      checked={donorInfo.isAnonymous}
                      onCheckedChange={(checked: boolean) =>
                        updateDonorInfo({ isAnonymous: checked })
                      }
                    />
                    <Label htmlFor="anonymous" className="text-sm">
                      Make this donation anonymous
                    </Label>
                  </div>
                )}

                {/* Summary */}
                {isValidAmount() && (
                  <div
                    className={`p-4 rounded-lg border-2 ${
                      config.theme === 'vibrant'
                        ? 'bg-linear-to-r from-purple-50 to-pink-50 border-purple-200'
                        : config.theme === 'minimal'
                          ? 'bg-gray-50 border-gray-200'
                          : config.theme === 'elegant'
                            ? 'bg-linear-to-r from-indigo-50 to-purple-50 border-indigo-200'
                            : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Your donation:</span>
                      <div className="text-right">
                        <div className="text-xl font-semibold">
                          {formatCurrencyFromMajor(getDiscountedAmount())}
                        </div>
                        {isRecurring &&
                          config.recurringDiscount &&
                          getCurrentAmount() !== getDiscountedAmount() && (
                            <div className="text-sm text-gray-500 line-through">
                              {formatCurrencyFromMajor(getCurrentAmount())}
                            </div>
                          )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                      {isRecurring && (
                        <Badge variant="secondary" className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span className="capitalize">{recurringInterval}</span>
                        </Badge>
                      )}
                      {isRecurring && config.recurringDiscount && (
                        <Badge
                          variant="secondary"
                          className="flex items-center space-x-1 bg-green-100 text-green-800"
                        >
                          <Percent className="w-3 h-3" />
                          <span>{config.recurringDiscount}% saved</span>
                        </Badge>
                      )}
                      {donorInfo.isAnonymous && <Badge variant="secondary">Anonymous</Badge>}
                      {campaign.configuration.giftAidEnabled && isGiftAid && (
                        <Badge
                          variant="secondary"
                          className="flex items-center space-x-1 bg-green-100 text-green-800"
                        >
                          <Gift className="w-3 h-3" />
                          <span>Gift Aid</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={!isValidAmount()}
                  size="lg"
                  className={`w-full h-14 text-base ${themeClasses.button}`}
                >
                  <Gift className="mr-2 h-5 w-5" />
                  Donate
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>

                {config.secondaryCTAText && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full h-12"
                    onClick={onBack}
                  >
                    {config.secondaryCTAText}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
