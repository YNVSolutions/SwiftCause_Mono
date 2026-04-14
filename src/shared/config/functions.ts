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
  downloadGiftAidExportBatchFile: getFunctionUrl('downloadGiftAidExportBatchFile'),
  exportDonations: getFunctionUrl('exportDonations'),
  exportSubscriptions: getFunctionUrl('exportSubscriptions'),
  kioskLogin: getFunctionUrl('kioskLogin'),
  createUser: getFunctionUrl('createUser'),
  updateUser: getFunctionUrl('updateUser'),
  deleteUser: getFunctionUrl('deleteUser'),
} as const;

export default FUNCTION_URLS;
