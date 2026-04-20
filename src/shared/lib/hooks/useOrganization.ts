import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Organization } from '../../types';
import {
  clearCachedOrganization,
  getCachedOrganization,
  setCachedOrganization,
} from '../organizationBrandingCache';

export interface StripeAccountInfo {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

export const useOrganization = (organizationId: string | null) => {
  const [organization, setOrganization] = useState<Organization | null>(() =>
    organizationId ? getCachedOrganization(organizationId) : null,
  );
  const [loading, setLoading] = useState(
    () => !organizationId || !getCachedOrganization(organizationId),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setOrganization(null);
      setLoading(false);
      return;
    }

    const cachedOrganization = getCachedOrganization(organizationId);
    setOrganization(cachedOrganization);
    setLoading(!cachedOrganization);
    setError(null);

    const orgRef = doc(db, 'organizations', organizationId);

    const unsubscribe = onSnapshot(
      orgRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const nextOrganization = { id: docSnap.id, ...docSnap.data() } as Organization;
          setOrganization(nextOrganization);
          setCachedOrganization(organizationId, nextOrganization);
        } else {
          setOrganization(null);
          setError('Organization not found.');
          clearCachedOrganization(organizationId);
        }
        setLoading(false);
      },
      (e) => {
        console.error('Error fetching organization:', e);
        setError('Failed to load organization data.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [organizationId]);

  return { organization, loading, error };
};
