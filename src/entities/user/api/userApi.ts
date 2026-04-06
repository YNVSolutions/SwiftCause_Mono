import {
  collection, query, where, getDocs, doc, getDoc,
  addDoc, updateDoc, deleteDoc, orderBy,
  limit, startAfter, DocumentSnapshot, QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import { User } from '../model';
import { PAGE_SIZE } from '../../../shared/lib/hooks/usePagination';

export interface UserFilters {
  role?: string;
}

export interface UserPage {
  users: User[];
  lastDoc: DocumentSnapshot | null;
  hasNextPage: boolean;
}

/**
 * Required Firestore composite indexes:
 *
 * Without filters:
 *   Collection: users
 *   Fields: organizationId ASC, createdAt DESC, __name__ DESC
 *
 * With role filter:
 *   Collection: users
 *   Fields: organizationId ASC, role ASC, createdAt DESC, __name__ DESC
 */
export async function fetchUsersPaginated(
  organizationId: string,
  cursor: DocumentSnapshot | null,
  filters: UserFilters = {}
): Promise<UserPage> {
  const constraints: Parameters<typeof query>[1][] = [
    where('organizationId', '==', organizationId),
  ];

  if (filters.role && filters.role !== 'all') {
    constraints.push(where('role', '==', filters.role));
  }

  constraints.push(
    orderBy('createdAt', 'desc'),
    orderBy('__name__', 'desc'),
    limit(PAGE_SIZE + 1),
  );

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const q = query(collection(db, 'users'), ...constraints);

  let snapshot;
  try {
    snapshot = await getDocs(q);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== 'failed-precondition') throw err;
    if (filters.role && filters.role !== 'all') {
      console.warn('fetchUsersPaginated: index not ready for filtered query, returning empty');
      return { users: [], lastDoc: null, hasNextPage: false };
    }
    const fallbackQ = query(
      collection(db, 'users'),
      where('organizationId', '==', organizationId),
      limit(PAGE_SIZE + 1),
    );
    snapshot = await getDocs(fallbackQ);
  }

  if (snapshot.empty) {
    return { users: [], lastDoc: null, hasNextPage: false };
  }

  const hasNextPage = snapshot.docs.length > PAGE_SIZE;
  const docs: QueryDocumentSnapshot[] = hasNextPage
    ? snapshot.docs.slice(0, PAGE_SIZE)
    : snapshot.docs;

  return {
    users: docs.map(d => ({ ...d.data(), id: d.id } as User)),
    lastDoc: docs[docs.length - 1] ?? null,
    hasNextPage,
  };
}

export const userApi = {
  // Get all users
  async getUsers(organizationId?: string): Promise<User[]> {
    try {
      let q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      
      if (organizationId) {
        q = query(
          collection(db, 'users'),
          where('organizationId', '==', organizationId),
          orderBy('createdAt', 'desc')
        );
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as User));
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },

  // Get user by ID
  async getUserById(id: string): Promise<User | null> {
    try {
      const docRef = doc(db, 'users', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as User;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  },

  // Create new user
  async createUser(user: Omit<User, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'users'), {
        ...user,
        createdAt: new Date().toISOString(),
        isActive: true
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  // Update user
  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    try {
      const docRef = doc(db, 'users', id);
      await updateDoc(docRef, updates);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  // Delete user
  async deleteUser(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'users', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
};
