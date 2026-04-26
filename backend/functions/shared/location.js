const admin = require('firebase-admin');

/**
 * Resolve location_id and location_snapshot for a kiosk-originated donation.
 *
 * Rule: if kioskId is present, location_id and location_snapshot MUST be present
 * and complete. Throws if the location doc is missing or has incomplete required
 * fields (name, postcode, city). Returns null fields for non-kiosk donations.
 *
 * This is the single source of truth for location validation across all donation
 * creation paths (one-time webhook, recurring webhook, subscription creation,
 * payment intent creation).
 *
 * @param {string|null} locationId - location_id from kiosk doc or Stripe metadata
 * @param {string|null} kioskId - kioskId to determine if this is a kiosk donation
 * @param {string} context - label for error messages (e.g. payment intent id)
 * @return {Promise<{location_id: string|null, location_snapshot: object|null}>}
 */
const resolveLocationForDonation = async (locationId, kioskId, context) => {
  // Non-kiosk donation — location fields are intentionally absent
  if (!kioskId) {
    return { location_id: null, location_snapshot: null };
  }

  // Kiosk donation — location_id must be present
  if (!locationId) {
    throw new Error(
      `[Location] Kiosk donation missing location_id (kiosk: ${kioskId}, context: ${context})`,
    );
  }

  const locationSnap = await admin.firestore().collection('locations').doc(locationId).get();
  if (!locationSnap.exists) {
    throw new Error(
      `[Location] Location doc not found: ${locationId} (kiosk: ${kioskId}, context: ${context})`,
    );
  }

  const loc = locationSnap.data();
  const toStr = (v) => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : null);
  const name = toStr(loc.name);
  const postcode = toStr(loc.postcode);
  const city = toStr(loc.city);

  if (!name || !postcode || !city) {
    throw new Error(
      `[Location] Location ${locationId} missing required fields (name, postcode, city) — context: ${context}`,
    );
  }

  return { location_id: locationId, location_snapshot: { name, postcode, city } };
};

/**
 * Resolve location_id from a kiosk document.
 * Used by payment intent creation to validate location before charging.
 *
 * @param {string|null} kioskId
 * @param {string} context
 * @return {Promise<string|null>} location_id or null for non-kiosk
 */
const resolveLocationIdFromKiosk = async (kioskId, context) => {
  if (!kioskId) return null;

  const kioskSnap = await admin.firestore().collection('kiosks').doc(kioskId).get();
  if (!kioskSnap.exists) {
    throw new Error(`[Location] Kiosk not found: ${kioskId} (context: ${context})`);
  }

  const locationId =
    typeof kioskSnap.data().location_id === 'string' ? kioskSnap.data().location_id.trim() : null;

  if (!locationId) {
    throw new Error(`[Location] Kiosk ${kioskId} has no location_id set (context: ${context})`);
  }

  return locationId;
};

module.exports = { resolveLocationForDonation, resolveLocationIdFromKiosk };
