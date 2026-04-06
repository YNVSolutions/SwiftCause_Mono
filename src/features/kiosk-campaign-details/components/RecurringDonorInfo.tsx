import React from 'react';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Mail, User } from 'lucide-react';

interface RecurringDonorInfoProps {
  email: string;
  name: string;
  onEmailChange: (email: string) => void;
  onNameChange: (name: string) => void;
}

export const RecurringDonorInfo: React.FC<RecurringDonorInfoProps> = ({
  email,
  name,
  onEmailChange,
  onNameChange,
}) => {
  return (
    <div className="space-y-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
          <Mail className="w-3.5 h-3.5 text-white" />
        </div>
        <p className="text-sm font-semibold text-blue-900">Recurring donation details</p>
      </div>
      <p className="text-xs text-blue-800 mb-3">
        We need your email to manage your recurring donation and send receipts.
      </p>

      <div className="space-y-2">
        <Label htmlFor="donor-email" className="text-sm font-medium text-slate-700">
          Email address <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            id="donor-email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="your.email@example.com"
            className="pl-10 h-11 bg-white"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="donor-name" className="text-sm font-medium text-slate-700">
          Full name (optional)
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            id="donor-name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="John Doe"
            className="pl-10 h-11 bg-white"
          />
        </div>
      </div>
    </div>
  );
};
