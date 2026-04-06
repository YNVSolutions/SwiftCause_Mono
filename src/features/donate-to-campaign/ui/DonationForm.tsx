import React, { useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card';
import { Checkbox } from '../../../shared/ui/checkbox';
import { Textarea } from '../../../shared/ui/textarea';
import { Switch } from '../../../shared/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select';
import { Campaign } from '../../../entities/campaign';
import { DonationFormData } from '../model';
import { formatCurrencyFromMajor } from '../../../shared/lib/currencyFormatter';

interface DonationFormProps {
  campaign: Campaign;
  onSubmit: (formData: DonationFormData) => void;
  onBack: () => void;
  predefinedAmounts?: number[];
  allowCustomAmount?: boolean;
  minCustomAmount?: number;
  maxCustomAmount?: number;
  suggestedAmounts?: number[];
  enableRecurring?: boolean;
  recurringIntervals?: ('monthly' | 'quarterly' | 'yearly')[];
  defaultRecurringInterval?: 'monthly' | 'quarterly' | 'yearly';
  requiredFields?: ('email' | 'name' | 'phone' | 'address' | 'message')[];
  optionalFields?: ('email' | 'name' | 'phone' | 'address' | 'message')[];
  enableAnonymousDonations?: boolean;
  enableGiftAid?: boolean;
}

export function DonationForm({
  campaign,
  onSubmit,
  onBack,
  predefinedAmounts = [10, 25, 50, 100],
  allowCustomAmount = true,
  minCustomAmount = 1,
  maxCustomAmount = 10000,
  enableRecurring = false,
  recurringIntervals = ['monthly', 'yearly'],
  defaultRecurringInterval = 'monthly',
  requiredFields = ['email'],
  optionalFields = ['name', 'message'],
  enableAnonymousDonations = true,
  enableGiftAid = false,
}: DonationFormProps) {
  const [formData, setFormData] = useState<DonationFormData>({
    amount: predefinedAmounts[0] || 10,
    isRecurring: false,
    recurringInterval: defaultRecurringInterval,
    isAnonymous: false,
    isGiftAid: false,
  });

  const [customAmount, setCustomAmount] = useState('');
  const [useCustomAmount, setUseCustomAmount] = useState(false);

  const handleAmountChange = (amount: number) => {
    setFormData((prev) => ({ ...prev, amount }));
    setUseCustomAmount(false);
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const amount = parseFloat(value);
    if (!isNaN(amount) && amount >= minCustomAmount && amount <= maxCustomAmount) {
      setFormData((prev) => ({ ...prev, amount }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  type DonorField = 'email' | 'name' | 'phone' | 'address' | 'message';
  const isFieldRequired = (field: DonorField) => requiredFields.includes(field);
  const isFieldOptional = (field: DonorField) => optionalFields.includes(field);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Donate to {campaign.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Amount Selection */}
          <div className="space-y-4">
            <Label>Donation Amount</Label>
            <div className="grid grid-cols-2 gap-2">
              {predefinedAmounts.map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant={formData.amount === amount && !useCustomAmount ? 'default' : 'outline'}
                  onClick={() => handleAmountChange(amount)}
                >
                  {formatCurrencyFromMajor(amount)}
                </Button>
              ))}
            </div>

            {allowCustomAmount && (
              <div className="space-y-2">
                <Button
                  type="button"
                  variant={useCustomAmount ? 'default' : 'outline'}
                  onClick={() => setUseCustomAmount(true)}
                >
                  Custom Amount
                </Button>
                {useCustomAmount && (
                  <Input
                    type="number"
                    placeholder={`Enter amount (${formatCurrencyFromMajor(minCustomAmount)}-${formatCurrencyFromMajor(maxCustomAmount)})`}
                    value={customAmount}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                    min={minCustomAmount}
                    max={maxCustomAmount}
                  />
                )}
              </div>
            )}
          </div>

          {/* Recurring Donation */}
          {enableRecurring && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="recurring"
                  checked={formData.isRecurring}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isRecurring: checked }))
                  }
                />
                <Label htmlFor="recurring" className="cursor-pointer">
                  Make this a recurring donation
                </Label>
              </div>

              {formData.isRecurring && (
                <div className="space-y-2">
                  <Label htmlFor="interval">Frequency</Label>
                  <Select
                    value={formData.recurringInterval}
                    onValueChange={(value: 'monthly' | 'quarterly' | 'yearly') =>
                      setFormData((prev) => ({ ...prev, recurringInterval: value }))
                    }
                  >
                    <SelectTrigger id="interval">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {recurringIntervals.map((interval) => (
                        <SelectItem key={interval} value={interval}>
                          {interval.charAt(0).toUpperCase() + interval.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    You will be charged {formatCurrencyFromMajor(formData.amount)}{' '}
                    {formData.recurringInterval === 'monthly'
                      ? 'every month'
                      : formData.recurringInterval === 'yearly'
                        ? 'every year'
                        : 'every quarter'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Donor Information */}
          {!formData.isAnonymous && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Donor Information</h3>

              {isFieldRequired('email') && (
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.donorEmail || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, donorEmail: e.target.value }))
                    }
                    required
                  />
                </div>
              )}

              {isFieldOptional('name') && (
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.donorName || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, donorName: e.target.value }))
                    }
                  />
                </div>
              )}

              {isFieldOptional('phone') && (
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.donorPhone || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, donorPhone: e.target.value }))
                    }
                  />
                </div>
              )}

              {isFieldOptional('message') && (
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={formData.donorMessage || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, donorMessage: e.target.value }))
                    }
                    placeholder="Leave a message (optional)"
                  />
                </div>
              )}
            </div>
          )}

          {/* Anonymous Donation */}
          {enableAnonymousDonations && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="anonymous"
                checked={formData.isAnonymous}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isAnonymous: !!checked }))
                }
              />
              <Label htmlFor="anonymous">Donate anonymously</Label>
            </div>
          )}

          {/* Gift Aid */}
          {enableGiftAid && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="giftAid"
                checked={formData.isGiftAid}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, isGiftAid: !!checked }))
                }
              />
              <Label htmlFor="giftAid">I would like to add Gift Aid to my donation</Label>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button type="submit" className="flex-1">
              Continue to Payment
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
