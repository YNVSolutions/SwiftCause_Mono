// Global types and interfaces
export type Screen =
  | 'home'
  | 'login'
  | 'signup'
  | 'campaigns'
  | 'campaign'
  | 'payment'
  | 'result'
  | 'email-confirmation'
  | 'admin'
  | 'admin-dashboard'
  | 'admin-campaigns'
  | 'admin-kiosks'
  | 'admin-donations'
  | 'admin-subscriptions'
  | 'admin-gift-aid'
  | 'admin-users'
  | 'admin-bank-details'
  | 'admin-stripe-account'
  | 'about'
  | 'contact'
  | 'docs'
  | 'terms';

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'operator' | 'viewer' | 'kiosk';

export type Permission =
  | 'view_dashboard'
  | 'view_campaigns'
  | 'export_campaigns'
  | 'create_campaign'
  | 'edit_campaign'
  | 'delete_campaign'
  | 'view_kiosks'
  | 'export_kiosks'
  | 'create_kiosk'
  | 'edit_kiosk'
  | 'delete_kiosk'
  | 'assign_campaigns'
  | 'view_donations'
  | 'export_donations'
  | 'export_subscriptions'
  | 'export_giftaid'
  | 'download_giftaid_exports'
  | 'view_users'
  | 'create_user'
  | 'edit_user'
  | 'delete_user'
  | 'manage_permissions'
  | 'system_admin';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  createdAt?: string;
  lastLogin?: string;
  organizationId?: string;
  organizationName?: string;
  photoURL?: string;
}

export interface Organization {
  id: string;
  name: string;
  currency: string;
  type?: string;
  size?: string;
  website?: string;
  tags?: string[];
  createdAt?: string;
  stripe?: {
    accountId?: string;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
  };
}

export interface AdminSession {
  user: User;
  loginTime: string;
  permissions: Permission[];
}

export interface KioskSession {
  kioskId: string;
  kioskName: string;
  startTime: string;
  assignedCampaigns: string[];
  defaultCampaign?: string;
  settings: {
    displayMode?: 'grid' | 'list' | 'carousel';
    showAllCampaigns?: boolean;
    maxCampaignsDisplay?: number;
    autoRotateCampaigns?: boolean;
    rotationInterval?: number;
  };
  loginMethod: 'qr' | 'manual';
  organizationId?: string;
  organizationCurrency?: string;
}

export interface SignupFormData {
  firstName: string;
  lastName: string;
  email: string;
  organizationName: string;
  organizationType: string;
  organizationSize: string;
  organizationId: string;
  website?: string;
  password: string;
  confirmPassword: string;
  currency: string;
  agreeToTerms: boolean;
}
