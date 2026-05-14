/**
 * Cloud Functions Configuration
 * Dynamically generates function URLs based on the current Firebase project
 */

import { FIREBASE_REGION, getFunctionsBaseUrl } from './firebaseEmulators';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

export const getFunctionUrl = (functionName: string): string => {
  return `${getFunctionsBaseUrl(PROJECT_ID || '', FIREBASE_REGION)}/${functionName}`;
};

export const FUNCTION_URLS = {
  verifySignupRecaptcha: getFunctionUrl('verifySignupRecaptcha'),
  createKioskPaymentIntent: getFunctionUrl('createKioskPaymentIntent'),
  createExpressDashboardLink: getFunctionUrl('createExpressDashboardLink'),
  createOnboardingLink: getFunctionUrl('createOnboardingLink'),
  createPaymentIntent: getFunctionUrl('createPaymentIntent'),
  exportGiftAidDeclarations: getFunctionUrl('exportGiftAidDeclarations'),
  exportGasdsCsv: getFunctionUrl('exportGasdsCsv'),
  downloadGasdsExportBatchFile: getFunctionUrl('downloadGasdsExportBatchFile'),
  downloadGiftAidExportBatchFile: getFunctionUrl('downloadGiftAidExportBatchFile'),
  exportDonations: getFunctionUrl('exportDonations'),
  exportSubscriptions: getFunctionUrl('exportSubscriptions'),
  exportKiosks: getFunctionUrl('exportKiosks'),
  exportCampaigns: getFunctionUrl('exportCampaigns'),
  kioskLogin: getFunctionUrl('kioskLogin'),
  adminCreateDeviceProfile: getFunctionUrl('adminCreateDeviceProfile'),
  adminListManagedDevices: getFunctionUrl('adminListManagedDevices'),
  adminUpdateManagedDeviceMetadata: getFunctionUrl('adminUpdateManagedDeviceMetadata'),
  adminQueueDeviceCommand: getFunctionUrl('adminQueueDeviceCommand'),
  adminListDeviceCommands: getFunctionUrl('adminListDeviceCommands'),
  adminListDeviceEvents: getFunctionUrl('adminListDeviceEvents'),
  createUser: getFunctionUrl('createUser'),
  updateUser: getFunctionUrl('updateUser'),
  deleteUser: getFunctionUrl('deleteUser'),
  updateOrganizationSettings: getFunctionUrl('updateOrganizationSettings'),
  // Subscription management (donor self-service portal)
  sendSubscriptionMagicLink: getFunctionUrl('sendSubscriptionMagicLink'),
  verifySubscriptionMagicLink: getFunctionUrl('verifySubscriptionMagicLink'),
  getSubscriptionsByEmail: getFunctionUrl('getSubscriptionsByEmail'),
  createCustomerPortalSession: getFunctionUrl('createCustomerPortalSession'),
  getPaymentHistory: getFunctionUrl('getPaymentHistory'),
  // Gift Aid magic link validation
  validateMagicLinkToken: getFunctionUrl('validateMagicLinkToken'),
} as const;

export default FUNCTION_URLS;
