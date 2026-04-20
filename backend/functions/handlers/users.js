const admin = require('firebase-admin');
const { verifyAuth } = require('../middleware/auth');
const cors = require('../middleware/cors');

const ROLE_ASSIGNMENT_MATRIX = {
  super_admin: ['super_admin', 'admin', 'manager', 'operator', 'viewer', 'kiosk'],
  admin: ['admin', 'manager', 'operator', 'viewer', 'kiosk'],
  manager: ['manager', 'operator', 'viewer', 'kiosk'],
  operator: ['operator', 'viewer', 'kiosk'],
  viewer: ['viewer', 'kiosk'],
};
const ORG_SETTINGS_ADMIN_ONLY_PERMISSIONS = ['change_org_identity', 'change_org_branding'];

const canAssignRole = (callerRole, targetRole) => {
  const allowedRoles = ROLE_ASSIGNMENT_MATRIX[callerRole] || [];
  return allowedRoles.includes(targetRole);
};

const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialCharacter: true,
};

const SPECIAL_CHARACTER_REGEX = /[!@#$%^&*(),.?":{}|<>]/;

const validatePasswordStrength = (password) => {
  if (typeof password !== 'string' || password.length < PASSWORD_POLICY.minLength) {
    return 'Password must be at least 8 characters';
  }

  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }

  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }

  if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }

  if (PASSWORD_POLICY.requireSpecialCharacter && !SPECIAL_CHARACTER_REGEX.test(password)) {
    return 'Password must contain at least one special character';
  }

  return null;
};

const canAssignPermissions = (callerData, targetPermissions) => {
  if (!Array.isArray(targetPermissions)) return false;

  // Super admins can assign any permission set.
  if (callerData?.role === 'super_admin') return true;

  const callerPermissions = Array.isArray(callerData?.permissions) ? callerData.permissions : [];
  if (callerPermissions.includes('system_admin')) return true;

  // Non-super-admin users cannot grant system_admin.
  if (targetPermissions.includes('system_admin')) return false;

  return targetPermissions.every((permission) => callerPermissions.includes(permission));
};

const validateRoleScopedPermissions = (targetRole, targetPermissions) => {
  if (!Array.isArray(targetPermissions)) {
    return true;
  }

  if (targetRole === 'super_admin' || targetRole === 'admin') {
    return true;
  }

  return ORG_SETTINGS_ADMIN_ONLY_PERMISSIONS.every(
    (permission) => !targetPermissions.includes(permission),
  );
};

const isSameOrganization = (callerData, targetOrganizationId) => {
  return (
    callerData?.organizationId &&
    targetOrganizationId &&
    callerData.organizationId === targetOrganizationId
  );
};

/**
 * Create a new user with role and permissions
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const createUser = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const auth = await verifyAuth(req);

      // Get caller's user data to check permissions
      const callerDoc = await admin.firestore().collection('users').doc(auth.uid).get();

      if (!callerDoc.exists) {
        return res.status(403).send({ error: 'Caller is not a valid user' });
      }

      const callerData = callerDoc.data();
      const callerPermissions = callerData?.permissions || [];

      // Check if caller has create_user permission
      if (
        !callerPermissions.includes('create_user') &&
        callerData?.role !== 'admin' &&
        callerData?.role !== 'super_admin'
      ) {
        return res.status(403).send({
          error: 'You do not have permission to create users',
        });
      }

      const { email, password, username, role, permissions, organizationId } = req.body;

      if (!email || !password || !username || !role || !organizationId) {
        return res.status(400).send({ error: 'Missing required fields for user creation.' });
      }

      const passwordValidationError = validatePasswordStrength(password);
      if (passwordValidationError) {
        return res.status(400).send({ error: passwordValidationError });
      }

      // Enforce same-organization user management for non-super admins.
      if (callerData?.role !== 'super_admin' && !isSameOrganization(callerData, organizationId)) {
        return res.status(403).send({
          error: 'You can only create users within your organization',
        });
      }

      // Enforce role hierarchy:
      // super_admin > admin > manager > operator > viewer.
      if (!canAssignRole(callerData?.role, role)) {
        return res.status(403).send({
          error: 'You do not have permission to assign this role',
        });
      }

      // Enforce permission subset assignment.
      if (!canAssignPermissions(callerData, permissions || [])) {
        return res.status(403).send({
          error: 'You can only assign permissions that you already have',
        });
      }
      if (!validateRoleScopedPermissions(role, permissions || [])) {
        return res.status(403).send({
          error:
            'Organization settings permissions can only be assigned to admin or super admin roles',
        });
      }

      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: username,
      });

      const userDocData = {
        username,
        email,
        role,
        permissions: permissions || [],
        organizationId,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await admin.firestore().collection('users').doc(userRecord.uid).set(userDocData);

      return res.status(200).send({
        success: true,
        message: `Successfully created user ${username}.`,
        uid: userRecord.uid,
      });
    } catch (error) {
      console.error('Error creating user:', error);
      if (error.code && (error.code === 401 || error.code === 403)) {
        return res.status(error.code).send({ error: error.message });
      }
      return res.status(500).send({ error: error.message || 'An unknown error occurred.' });
    }
  });
};

/**
 * Update a user's role and permissions
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const updateUser = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const auth = await verifyAuth(req);

      // Get caller's user data to check permissions
      const callerDoc = await admin.firestore().collection('users').doc(auth.uid).get();

      if (!callerDoc.exists) {
        return res.status(403).send({ error: 'Caller is not a valid user' });
      }

      const callerData = callerDoc.data();
      const callerPermissions = callerData?.permissions || [];

      // Check if caller has edit_user permission
      if (
        !callerPermissions.includes('edit_user') &&
        callerData?.role !== 'admin' &&
        callerData?.role !== 'super_admin'
      ) {
        return res.status(403).send({
          error: 'You do not have permission to edit users',
        });
      }

      const { userId, data } = req.body;
      if (!userId || !data) {
        return res.status(400).send({
          error: "The 'userId' and 'data' are required.",
        });
      }

      // Get the target user's current data
      const targetUserDoc = await admin.firestore().collection('users').doc(userId).get();

      if (!targetUserDoc.exists) {
        return res.status(404).send({
          error: 'Target user not found',
        });
      }

      const targetUserData = targetUserDoc.data();

      // Enforce same-organization user management for non-super admins.
      if (
        callerData?.role !== 'super_admin' &&
        !isSameOrganization(callerData, targetUserData?.organizationId)
      ) {
        return res.status(403).send({
          error: 'You can only edit users in your organization',
        });
      }

      // Prevent non-super_admin users from editing super_admin users.
      if (targetUserData?.role === 'super_admin' && callerData?.role !== 'super_admin') {
        return res.status(403).send({
          error: 'Only super admins can edit super admin users',
        });
      }

      // Enforce role hierarchy for role changes.
      if (data.role !== undefined && !canAssignRole(callerData?.role, data.role)) {
        return res.status(403).send({
          error: 'You do not have permission to assign this role',
        });
      }

      // Enforce permission subset assignment.
      if (data.permissions !== undefined && !canAssignPermissions(callerData, data.permissions)) {
        return res.status(403).send({
          error: 'You can only assign permissions that you already have',
        });
      }

      const nextRole = data.role !== undefined ? data.role : targetUserData?.role;
      const nextPermissions =
        data.permissions !== undefined ? data.permissions : targetUserData?.permissions || [];
      if (!validateRoleScopedPermissions(nextRole, nextPermissions)) {
        return res.status(403).send({
          error:
            'Organization settings permissions can only be assigned to admin or super admin roles',
        });
      }

      // Prepare update data
      const updateData = {};
      if (data.role !== undefined) updateData.role = data.role;
      if (data.permissions !== undefined) {
        updateData.permissions = data.permissions;
      }
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      // Update Firestore document
      await admin.firestore().collection('users').doc(userId).update(updateData);

      return res.status(200).send({
        success: true,
        message: `Successfully updated user with ID ${userId}.`,
      });
    } catch (error) {
      console.error('Error updating user:', error);
      if (error.code && (error.code === 401 || error.code === 403)) {
        return res.status(error.code).send({ error: error.message });
      }
      return res.status(500).send({ error: error.message || 'Failed to update user.' });
    }
  });
};

/**
 * Delete a user by ID
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const deleteUser = (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).send({ error: 'Method not allowed' });
      }

      const auth = await verifyAuth(req);

      // Get caller's user data to check permissions
      const callerDoc = await admin.firestore().collection('users').doc(auth.uid).get();

      if (!callerDoc.exists) {
        return res.status(403).send({ error: 'Caller is not a valid user' });
      }

      const callerData = callerDoc.data();
      const callerPermissions = callerData?.permissions || [];

      // Check if caller has delete_user permission
      if (
        !callerPermissions.includes('delete_user') &&
        callerData?.role !== 'admin' &&
        callerData?.role !== 'super_admin'
      ) {
        return res.status(403).send({
          error: 'You do not have permission to delete users',
        });
      }

      const { userId } = req.body;
      if (!userId) {
        return res.status(400).send({ error: "The 'userId' is required." });
      }

      if (auth.uid === userId) {
        return res.status(403).send({ error: 'You cannot delete your own account.' });
      }

      // Get the target user's data before deletion
      const targetUserDoc = await admin.firestore().collection('users').doc(userId).get();

      if (!targetUserDoc.exists) {
        return res.status(404).send({
          error: 'Target user not found',
        });
      }

      const targetUserData = targetUserDoc.data();

      // Enforce same-organization user management for non-super admins.
      if (
        callerData?.role !== 'super_admin' &&
        !isSameOrganization(callerData, targetUserData?.organizationId)
      ) {
        return res.status(403).send({
          error: 'You can only delete users in your organization',
        });
      }

      // Prevent non-super_admin users from deleting super_admin users
      if (targetUserData?.role === 'super_admin' && callerData?.role !== 'super_admin') {
        return res.status(403).send({
          error: 'Only super admins can delete super admin users',
        });
      }

      await admin.auth().deleteUser(userId);
      await admin.firestore().collection('users').doc(userId).delete();

      return res.status(200).send({
        success: true,
        message: `Successfully deleted user with ID ${userId}.`,
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      if (error.code && (error.code === 401 || error.code === 403)) {
        return res.status(error.code).send({ error: error.message });
      }
      return res.status(500).send({ error: error.message || 'Failed to delete user.' });
    }
  });
};

module.exports = {
  createUser,
  updateUser,
  deleteUser,
  validatePasswordStrength,
};
