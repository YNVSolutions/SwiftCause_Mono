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
  | 'admin-organization-settings'
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
  | 'change_org_identity'
  | 'change_org_branding'
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

export interface OrganizationSettings {
  displayName: string;
  logoUrl: string | null;
  idleImageUrl: string | null;
  accentColorHex: string;
  thankYouMessage: string | null;
  updatedAt?: string;
  updatedBy?: string;
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
  settings?: OrganizationSettings;
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

export type RegisteredNation = 'england_wales' | 'scotland' | 'northern_ireland';
export type EntityType = 'registered_charity' | 'cio' | 'cic' | 'other';
export type ContactRole = 'trustee' | 'ceo' | 'treasurer' | 'fundraising' | 'ops' | 'other';
export type GiftAidRegistered = 'yes' | 'no' | 'dont_know';
export type PrimarySetting =
  | 'mosque'
  | 'church'
  | 'temple'
  | 'scout'
  | 'pta'
  | 'charity_shop'
  | 'events'
  | 'other';
export type EstimatedMonthlyVolumeBand = '0_500' | '500_2k' | '2k_10k' | '10k_plus';

export interface SignupFormData {
  email: string;
  organizationId: string;
  password: string;
  confirmPassword: string;
  currency: string;
  legal_name: string;
  charity_number: string;
  registered_nation: RegisteredNation | '';
  registered_postcode: string;
  entity_type: EntityType | '';
  contact_full_name: string;
  contact_role: ContactRole | '';
  contact_work_email: string;
  contact_phone: string;
  authorised_signatory: boolean;
  gift_aid_registered: GiftAidRegistered | '';
  hmrc_charity_reference: string;
  primary_setting: PrimarySetting | '';
  estimated_monthly_volume_band: EstimatedMonthlyVolumeBand | '';
  terms_accepted: boolean;
  privacy_accepted: boolean;
  marketing_consent: boolean;
  recaptchaToken?: string;
}
