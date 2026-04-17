// Application constants
export const APP_NAME = 'SwiftCause';
export const APP_VERSION = '1.0.0';

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  CAMPAIGNS: '/campaigns',
  CAMPAIGN_DETAIL: '/campaign',
  PAYMENT: '/payment',
  RESULT: '/result',
  EMAIL_CONFIRMATION: '/email-confirmation',
  ADMIN_DASHBOARD: '/admin-dashboard',
  ADMIN_CAMPAIGNS: '/admin-campaigns',
  ADMIN_KIOSKS: '/admin-kiosks',
  ADMIN_DONATIONS: '/admin-donations',
  ADMIN_USERS: '/admin-users',
  ABOUT: '/about',
  CONTACT: '/contact',
  DOCS: '/docs',
  TERMS: '/terms',
} as const;

export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
  KIOSK: 'kiosk',
} as const;

export const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_CAMPAIGNS: 'view_campaigns',
  CREATE_CAMPAIGN: 'create_campaign',
  EDIT_CAMPAIGN: 'edit_campaign',
  DELETE_CAMPAIGN: 'delete_campaign',
  VIEW_KIOSKS: 'view_kiosks',
  CREATE_KIOSK: 'create_kiosk',
  EDIT_KIOSK: 'edit_kiosk',
  DELETE_KIOSK: 'delete_kiosk',
  ASSIGN_CAMPAIGNS: 'assign_campaigns',
  VIEW_DONATIONS: 'view_donations',
  EXPORT_DONATIONS: 'export_donations',
  EXPORT_GIFTAID: 'export_giftaid',
  DOWNLOAD_GIFTAID_EXPORTS: 'download_giftaid_exports',
  VIEW_USERS: 'view_users',
  CREATE_USER: 'create_user',
  EDIT_USER: 'edit_user',
  DELETE_USER: 'delete_user',
  CHANGE_ORG_IDENTITY: 'change_org_identity',
  CHANGE_ORG_BRANDING: 'change_org_branding',
  MANAGE_PERMISSIONS: 'manage_permissions',
  SYSTEM_ADMIN: 'system_admin',
} as const;

// Campaign-related constants
export const CAMPAIGN_CATEGORIES = [
  'Global Health',
  'Education',
  'Emergency Relief',
  'Food Security',
  'Environmental',
  'Community Development',
  'Animal Welfare',
  'Arts & Culture',
] as const;

export const CAMPAIGN_THEMES = [
  { value: 'default', label: 'Default', description: 'Clean, professional design' },
  { value: 'minimal', label: 'Minimal', description: 'Simple, distraction-free' },
  { value: 'vibrant', label: 'Vibrant', description: 'Bold colors and gradients' },
  { value: 'elegant', label: 'Elegant', description: 'Sophisticated typography' },
] as const;

export const PREDEFINED_AMOUNT_SETS = [
  { name: 'Small Donations', amounts: [5, 10, 25, 50, 100] },
  { name: 'Medium Donations', amounts: [25, 50, 100, 250, 500] },
  { name: 'Large Donations', amounts: [100, 250, 500, 1000, 2500] },
  { name: 'Major Gifts', amounts: [500, 1000, 2500, 5000, 10000] },
] as const;

export const DEFAULT_CAMPAIGN_CONFIG = {
  predefinedAmounts: [25, 50, 100, 250, 500],
  allowCustomAmount: true,
  minCustomAmount: 1,
  maxCustomAmount: 10000,
  suggestedAmounts: [25, 50, 100],
  enableRecurring: true,
  recurringIntervals: ['monthly', 'quarterly', 'yearly'] as const,
  defaultRecurringInterval: 'monthly' as const,
  recurringDiscount: 0,
  displayStyle: 'grid' as const,
  showProgressBar: true,
  showDonorCount: true,
  showRecentDonations: true,
  maxRecentDonations: 5,
  primaryCTAText: 'Donate',
  secondaryCTAText: 'Learn More',
  theme: 'default' as const,
  requiredFields: ['email'] as const,
  optionalFields: ['name'] as const,
  enableAnonymousDonations: true,
  enableSocialSharing: true,
  enableDonorWall: true,
  enableComments: false,
  giftAidEnabled: false,
} as const;

export const DEFAULT_CAMPAIGN_VALUES = {
  goal: 10000,
  raised: 0,
  status: 'active' as const,
  category: '',
  organizationId: 'ORG-NEW',
  isGlobal: false,
  assignedKiosks: [],
  galleryImages: [],
  impactMetrics: {
    peopleHelped: 0,
    itemsProvided: 0,
  },
} as const;

export const CAMPAIGN_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
] as const;

export const RECURRING_INTERVALS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
] as const;

export const DISPLAY_STYLES = [
  { value: 'grid', label: 'Grid' },
  { value: 'list', label: 'List' },
  { value: 'carousel', label: 'Carousel' },
] as const;

export const FORM_FIELDS = [
  { value: 'email', label: 'Email' },
  { value: 'name', label: 'Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'address', label: 'Address' },
  { value: 'message', label: 'Message' },
] as const;

// UI and validation constants
export const VALIDATION_LIMITS = {
  campaign: {
    title: { min: 3, max: 100 },
    description: { min: 10, max: 500 },
    goal: { min: 1, max: 10000000 },
    maxCustomAmount: { min: 1, max: 100000 },
    maxRecentDonations: { min: 1, max: 50 },
  },
  user: {
    username: { min: 3, max: 30 },
    email: { max: 100 },
    firstName: { min: 1, max: 50 },
    lastName: { min: 1, max: 50 },
  },
  organization: {
    name: { min: 2, max: 100 },
    website: { max: 200 },
    displayName: { min: 1, max: 40 },
    thankYouMessage: { max: 140 },
    accentColorHexPattern: '^#[0-9A-Fa-f]{6}$',
  },
} as const;

export const FILE_UPLOAD_LIMITS = {
  image: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxDimensions: { width: 4000, height: 4000 },
  },
  document: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['application/pdf', 'text/plain', 'application/msword'],
  },
} as const;

export const PAGINATION_DEFAULTS = {
  campaigns: { pageSize: 12, maxPageSize: 50 },
  donations: { pageSize: 20, maxPageSize: 100 },
  users: { pageSize: 10, maxPageSize: 50 },
  kiosks: { pageSize: 10, maxPageSize: 50 },
} as const;

export const TOAST_DEFAULTS = {
  duration: 2500,
  position: 'top-right',
} as const;

export const LOADING_STATES = {
  short: 500,
  medium: 1000,
  long: 2000,
} as const;

export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1050,
  desktop: 1050,
} as const;

export const ANIMATION_DURATIONS = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

// User and organization-related constants
export const ORGANIZATION_TYPES = [
  'Non-Profit',
  'Charity',
  'Foundation',
  'Religious Organization',
  'Educational Institution',
  'Healthcare Organization',
  'Environmental Group',
  'Community Organization',
  'International NGO',
  'Other',
] as const;

export const ORGANIZATION_SIZES = [
  '1-10 employees',
  '11-50 employees',
  '51-200 employees',
  '201-500 employees',
  '500+ employees',
] as const;

export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'US Dollar ($)', symbol: '$' },
  { value: 'EUR', label: 'Euro (€)', symbol: '€' },
  { value: 'GBP', label: 'British Pound (£)', symbol: '£' },
  { value: 'CAD', label: 'Canadian Dollar (C$)', symbol: 'C$' },
  { value: 'AUD', label: 'Australian Dollar (A$)', symbol: 'A$' },
  { value: 'JPY', label: 'Japanese Yen (¥)', symbol: '¥' },
  { value: 'CHF', label: 'Swiss Franc (CHF)', symbol: 'CHF' },
  { value: 'SEK', label: 'Swedish Krona (kr)', symbol: 'kr' },
  { value: 'NOK', label: 'Norwegian Krone (kr)', symbol: 'kr' },
  { value: 'DKK', label: 'Danish Krone (kr)', symbol: 'kr' },
] as const;

export const DEFAULT_USER_PERMISSIONS = {
  super_admin: [
    'view_dashboard',
    'view_campaigns',
    'create_campaign',
    'edit_campaign',
    'delete_campaign',
    'view_kiosks',
    'create_kiosk',
    'edit_kiosk',
    'delete_kiosk',
    'assign_campaigns',
    'view_donations',
    'export_donations',
    'export_giftaid',
    'download_giftaid_exports',
    'view_users',
    'create_user',
    'edit_user',
    'delete_user',
    'change_org_identity',
    'change_org_branding',
    'manage_permissions',
    'system_admin',
  ],
  admin: [
    'view_dashboard',
    'view_campaigns',
    'create_campaign',
    'edit_campaign',
    'delete_campaign',
    'view_kiosks',
    'create_kiosk',
    'edit_kiosk',
    'delete_kiosk',
    'assign_campaigns',
    'view_donations',
    'export_donations',
    'export_giftaid',
    'download_giftaid_exports',
    'view_users',
    'create_user',
    'edit_user',
    'delete_user',
    'change_org_identity',
    'change_org_branding',
    'manage_permissions',
  ],
  manager: [
    'view_dashboard',
    'view_campaigns',
    'create_campaign',
    'edit_campaign',
    'view_kiosks',
    'create_kiosk',
    'edit_kiosk',
    'assign_campaigns',
    'view_donations',
    'export_donations',
    'download_giftaid_exports',
    'view_users',
    'create_user',
    'edit_user',
  ],
  operator: [
    'view_dashboard',
    'view_campaigns',
    'create_campaign',
    'edit_campaign',
    'view_kiosks',
    'create_kiosk',
    'edit_kiosk',
    'assign_campaigns',
    'view_donations',
    'export_donations',
  ],
  viewer: ['view_dashboard', 'view_campaigns', 'view_kiosks', 'view_donations'],
} as const;

export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
} as const;

// HMRC-compliant Gift Aid declaration text
// LEGAL REQUIREMENT - DO NOT MODIFY WITHOUT COMPLIANCE REVIEW
export const HMRC_DECLARATION_TEXT =
  'I confirm that I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax in the current tax year than the amount of Gift Aid claimed on all my donations, it is my responsibility to pay any difference.' as const;
export const HMRC_DECLARATION_TEXT_VERSION = 'hmrc-ch3-2026-03' as const;

export function getHmrcDeclarationText(charityName: string): string {
  const resolvedCharityName = charityName.trim() || 'This Charity';
  return `${resolvedCharityName}: I want to Gift Aid my donation and any donations I make in the future or have made in the past four years to ${resolvedCharityName}. I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year, it is my responsibility to pay any difference.`;
}
