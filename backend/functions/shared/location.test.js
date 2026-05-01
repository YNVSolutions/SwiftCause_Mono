jest.mock('firebase-admin', () => require('../testUtils/mockFirebaseAdmin'));

const admin = require('firebase-admin');
const { resolveLocationForDonation, resolveLocationIdFromKiosk } = require('./location');

const VALID_LOCATION = {
  name: "St Mary's Hall",
  postcode: 'SW1A 1AA',
  city: 'London',
};

beforeEach(() => {
  admin.__reset();
});

// ─── resolveLocationForDonation ───────────────────────────────────────────────

describe('resolveLocationForDonation', () => {
  it('returns null fields for non-kiosk donations (no kioskId)', async () => {
    const result = await resolveLocationForDonation(null, null, 'test');
    expect(result).toEqual({ location_id: null, location_snapshot: null });
  });

  it('throws when kioskId is present but locationId is null', async () => {
    await expect(resolveLocationForDonation(null, 'kiosk_1', 'pi_test')).rejects.toThrow(
      'missing location_id',
    );
  });

  it('throws when location doc does not exist', async () => {
    // No location doc seeded — Firestore returns not-exists
    await expect(resolveLocationForDonation('loc_missing', 'kiosk_1', 'pi_test')).rejects.toThrow(
      'Location doc not found',
    );
  });

  it('throws when location doc is missing name', async () => {
    await admin.firestore().collection('locations').doc('loc_no_name').set({
      postcode: 'SW1A 1AA',
      city: 'London',
    });
    await expect(resolveLocationForDonation('loc_no_name', 'kiosk_1', 'pi_test')).rejects.toThrow(
      'missing required fields',
    );
  });

  it('throws when location doc is missing postcode', async () => {
    await admin.firestore().collection('locations').doc('loc_no_postcode').set({
      name: "St Mary's Hall",
      city: 'London',
    });
    await expect(
      resolveLocationForDonation('loc_no_postcode', 'kiosk_1', 'pi_test'),
    ).rejects.toThrow('missing required fields');
  });

  it('throws when location doc is missing city', async () => {
    await admin.firestore().collection('locations').doc('loc_no_city').set({
      name: "St Mary's Hall",
      postcode: 'SW1A 1AA',
    });
    await expect(resolveLocationForDonation('loc_no_city', 'kiosk_1', 'pi_test')).rejects.toThrow(
      'missing required fields',
    );
  });

  it('throws when postcode is an empty string', async () => {
    await admin.firestore().collection('locations').doc('loc_empty_postcode').set({
      name: "St Mary's Hall",
      postcode: '   ',
      city: 'London',
    });
    await expect(
      resolveLocationForDonation('loc_empty_postcode', 'kiosk_1', 'pi_test'),
    ).rejects.toThrow('missing required fields');
  });

  it('returns location_id and trimmed snapshot when all fields are valid', async () => {
    await admin.firestore().collection('locations').doc('loc_valid').set(VALID_LOCATION);

    const result = await resolveLocationForDonation('loc_valid', 'kiosk_1', 'pi_test');
    expect(result.location_id).toBe('loc_valid');
    expect(result.location_snapshot).toEqual(VALID_LOCATION);
  });
});

// ─── resolveLocationIdFromKiosk ───────────────────────────────────────────────

describe('resolveLocationIdFromKiosk', () => {
  it('returns null for non-kiosk (no kioskId)', async () => {
    const result = await resolveLocationIdFromKiosk(null, 'test');
    expect(result).toBeNull();
  });

  it('throws when kiosk doc does not exist', async () => {
    await expect(resolveLocationIdFromKiosk('kiosk_missing', 'pi_test')).rejects.toThrow(
      'Kiosk not found',
    );
  });

  it('throws when kiosk has no location_id', async () => {
    await admin.firestore().collection('kiosks').doc('kiosk_no_loc').set({
      name: 'Kiosk A',
      organizationId: 'org_1',
    });
    await expect(resolveLocationIdFromKiosk('kiosk_no_loc', 'pi_test')).rejects.toThrow(
      'has no location_id',
    );
  });

  it('returns location_id when kiosk is valid', async () => {
    await admin.firestore().collection('kiosks').doc('kiosk_valid').set({
      name: 'Kiosk A',
      organizationId: 'org_1',
      location_id: 'loc_abc',
    });
    const result = await resolveLocationIdFromKiosk('kiosk_valid', 'pi_test');
    expect(result).toBe('loc_abc');
  });
});
