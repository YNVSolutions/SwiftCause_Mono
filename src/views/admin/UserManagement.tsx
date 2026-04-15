import React, { useState, useEffect } from 'react';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Card, CardContent } from '../../shared/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../shared/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '../../shared/ui/table';
import {
  Plus,
  UserCog,
  Users,
  Shield,
  Activity,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  AlertTriangle,
  MoreVertical,
  X,
  Check,
  LayoutDashboard,
  Megaphone,
  Monitor,
  DollarSign,
  Settings,
  Info,
  Building2,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Ghost } from 'lucide-react';
import { Screen, User, UserRole, AdminSession, Permission } from '../../shared/types';
import { DEFAULT_USER_PERMISSIONS, PASSWORD_REQUIREMENTS } from '../../shared/config/constants';
import { calculateUserStats } from '../../shared/lib/userManagementHelpers';
import { useUsers } from '../../shared/lib/hooks/useUsers';
import { useUsersPaginated } from '../../shared/lib/hooks/useUsersPaginated';
import { PaginationControls } from '../../shared/ui/PaginationControls';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../shared/ui/dialog';
import { Label } from '../../shared/ui/label';
import { Checkbox } from '../../shared/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../shared/ui/tooltip';
import { AdminLayout } from './AdminLayout';
import {
  AdminSearchFilterHeader,
  AdminSearchFilterConfig,
} from './components/AdminSearchFilterHeader';
import { SortableTableHeader } from './components/SortableTableHeader';
import { useTableSort } from '../../shared/lib/hooks/useTableSort';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../shared/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../../shared/ui/avatar';

const allPermissions: Permission[] = [
  'create_user',
  'edit_user',
  'delete_user',
  'view_campaigns',
  'export_campaigns',
  'create_campaign',
  'edit_campaign',
  'delete_campaign',
  'view_kiosks',
  'export_kiosks',
  'create_kiosk',
  'edit_kiosk',
  'delete_kiosk',
  'assign_campaigns',
  'view_donations',
  'export_donations',
  'export_subscriptions',
  'export_giftaid',
  'download_giftaid_exports',
  'view_users',
];

const canAssignRole = (actorRole: UserRole, targetRole: UserRole): boolean => {
  const roleMatrix: Record<UserRole, UserRole[]> = {
    super_admin: ['super_admin', 'admin', 'manager', 'operator', 'viewer', 'kiosk'],
    admin: ['admin', 'manager', 'operator', 'viewer', 'kiosk'],
    manager: ['manager', 'operator', 'viewer', 'kiosk'],
    operator: ['operator', 'viewer', 'kiosk'],
    viewer: ['viewer', 'kiosk'],
    kiosk: [],
  };
  return roleMatrix[actorRole]?.includes(targetRole) ?? false;
};

const canAssignPermission = (actorSession: AdminSession, permission: Permission): boolean => {
  const actorPermissions = actorSession?.user?.permissions || [];
  return (
    actorSession?.user?.role === 'super_admin' ||
    actorPermissions.includes('system_admin') ||
    actorPermissions.includes(permission)
  );
};

const SPECIAL_CHARACTER_REGEX = /[!@#$%^&*(),.?":{}|<>]/;

// Helper function to get initials from username
const getInitials = (username: string): string => {
  const parts = username.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
};

// Helper function to generate consistent color from string
const getAvatarColor = (username: string): { bg: string; text: string } => {
  const colors = [
    { bg: 'bg-red-500/20', text: 'text-red-700' },
    { bg: 'bg-orange-500/20', text: 'text-orange-700' },
    { bg: 'bg-amber-500/20', text: 'text-amber-700' },
    { bg: 'bg-yellow-500/20', text: 'text-yellow-700' },
    { bg: 'bg-lime-500/20', text: 'text-lime-700' },
    { bg: 'bg-green-500/20', text: 'text-green-700' },
    { bg: 'bg-emerald-500/20', text: 'text-emerald-700' },
    { bg: 'bg-teal-500/20', text: 'text-teal-700' },
    { bg: 'bg-cyan-500/20', text: 'text-cyan-700' },
    { bg: 'bg-sky-500/20', text: 'text-sky-700' },
    { bg: 'bg-blue-500/20', text: 'text-blue-700' },
    { bg: 'bg-indigo-500/20', text: 'text-indigo-700' },
    { bg: 'bg-violet-500/20', text: 'text-violet-700' },
    { bg: 'bg-purple-500/20', text: 'text-purple-700' },
    { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-700' },
    { bg: 'bg-pink-500/20', text: 'text-pink-700' },
    { bg: 'bg-rose-500/20', text: 'text-rose-700' },
  ];

  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

// Helper function to get role-specific colors
const getRoleColors = (role: UserRole) => {
  switch (role) {
    case 'super_admin':
      return 'bg-purple-100/70 text-purple-700 ring-purple-600/30 shadow-sm';
    case 'admin':
      return 'bg-red-100/70 text-red-700 ring-red-600/30 shadow-sm';
    case 'manager':
      return 'bg-blue-100/70 text-blue-700 ring-blue-600/30 shadow-sm';
    case 'operator':
      return 'bg-amber-100/70 text-amber-700 ring-amber-600/30 shadow-sm';
    case 'viewer':
      return 'bg-green-100/70 text-green-700 ring-green-600/30 shadow-sm';
    case 'kiosk':
      return 'bg-gray-100/70 text-gray-700 ring-gray-600/30 shadow-sm';
    default:
      return 'bg-indigo-100/70 text-indigo-700 ring-indigo-600/30 shadow-sm';
  }
};

// Helper function to group permissions by category
const groupPermissionsByCategory = (permissions: Permission[]) => {
  const categories: Record<string, Permission[]> = {
    Dashboard: [],
    Users: [],
    Campaigns: [],
    Kiosks: [],
    Donations: [],
    System: [],
  };

  permissions.forEach((permission) => {
    if (permission.includes('dashboard')) {
      categories['Dashboard'].push(permission);
    } else if (permission.includes('user') || permission.includes('permission')) {
      categories['Users'].push(permission);
    } else if (permission.includes('campaign')) {
      categories['Campaigns'].push(permission);
    } else if (permission.includes('kiosk')) {
      categories['Kiosks'].push(permission);
    } else if (permission.includes('donation') || permission.includes('giftaid')) {
      categories['Donations'].push(permission);
    } else {
      categories['System'].push(permission);
    }
  });

  // Filter out empty categories
  return Object.entries(categories).filter(([, perms]) => perms.length > 0);
};

// Helper function to get icon for each category
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Dashboard':
      return <LayoutDashboard className="w-4 h-4 text-blue-600" />;
    case 'Users':
      return <Users className="w-4 h-4 text-purple-600" />;
    case 'Campaigns':
      return <Megaphone className="w-4 h-4 text-green-600" />;
    case 'Kiosks':
      return <Monitor className="w-4 h-4 text-orange-600" />;
    case 'Donations':
      return <DollarSign className="w-4 h-4 text-emerald-600" />;
    case 'System':
      return <Settings className="w-4 h-4 text-gray-600" />;
    default:
      return <Shield className="w-4 h-4 text-indigo-600" />;
  }
};

interface UserManagementProps {
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  userSession: AdminSession;
  hasPermission: (permission: Permission) => boolean;
}

export function UserManagement({
  onNavigate,
  onLogout,
  userSession,
  hasPermission,
}: UserManagementProps) {
  const { users, loading, error, updateUser, addUser, deleteUser } = useUsers(
    userSession.user.organizationId,
  );

  // Declare filters before the paginated hook so they can be passed as arguments
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const {
    users: pagedUsers,
    fetching,
    pageNumber,
    canGoNext,
    canGoPrev,
    goNext,
    goPrev,
    pageSize,
  } = useUsersPaginated(userSession.user.organizationId, {
    role: roleFilter === 'all' ? undefined : roleFilter,
  });

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'viewer' as UserRole,
    permissions: [
      'view_dashboard',
      'view_campaigns',
      'view_kiosks',
      'view_donations',
    ] as Permission[],
  });

  // Sidebar state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [dialogMessage, setDialogMessage] = useState<string | null>(null);

  // Delete confirmation dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    // Small delay to allow the DOM to render before animating
    setTimeout(() => {
      setIsSidebarOpen(true);
    }, 10);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
    setTimeout(() => setSelectedUser(null), 500);
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.username) {
      setDialogMessage('Username, email, and password are required.');
      return;
    }
    if (!canAssignRole(userSession.user.role, newUser.role)) {
      setDialogMessage('You do not have permission to assign this role.');
      return;
    }
    const hasUnauthorizedPermission = (newUser.permissions || []).some(
      (permission) => !canAssignPermission(userSession, permission),
    );
    if (hasUnauthorizedPermission) {
      setDialogMessage('You can only assign permissions that you already have.');
      return;
    }

    setIsCreatingUser(true);
    try {
      await addUser({ ...newUser, organizationId: userSession.user.organizationId! });
      setCreateDialogOpen(false);
      setNewUser({ username: '', email: '', password: '', role: 'viewer', permissions: [] });
    } catch (err) {
      setDialogMessage(`Error: ${(err as Error).message}`);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      await deleteUser(userToDelete.id);
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (err) {
      setDialogMessage(`Error: ${(err as Error).message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    if (updates.role && !canAssignRole(userSession.user.role, updates.role)) {
      const errorMessage = 'You do not have permission to assign this role.';
      setDialogMessage(errorMessage);
      throw new Error(errorMessage);
    }
    if (
      updates.permissions &&
      updates.permissions.some((permission) => !canAssignPermission(userSession, permission))
    ) {
      const errorMessage = 'You can only assign permissions that you already have.';
      setDialogMessage(errorMessage);
      throw new Error(errorMessage);
    }
    try {
      await updateUser(userId, updates);
      setEditingUser(null);
    } catch (err) {
      const errorMessage = (err as Error).message || 'Failed to update user.';
      console.error('Update user error:', err);
      setDialogMessage(`Error: ${errorMessage}`);
      throw err; // Re-throw to let the EditUserDialog handle it
    }
  };

  // Client-side search on current page only (Firestore can't do CONTAINS)
  const filteredUsersData = pagedUsers.filter((user) => {
    const matchesSearch =
      !searchTerm || user.username?.toLowerCase().includes(searchTerm.toLowerCase());
    // Role filter is server-side via useUsersPaginated — this guards super_admin visibility only
    const canViewSuperAdmin =
      userSession.user.role === 'super_admin' || user.role !== 'super_admin';
    return matchesSearch && canViewSuperAdmin;
  });

  // Use sorting hook
  const {
    sortedData: filteredUsers,
    sortKey,
    sortDirection,
    handleSort,
  } = useTableSort({
    data: filteredUsersData,
  });

  const stats = calculateUserStats(users);

  // Configuration for AdminSearchFilterHeader
  const searchFilterConfig: AdminSearchFilterConfig = {
    filters: [
      {
        key: 'roleFilter',
        label: 'Role',
        type: 'select',
        options: [
          { label: 'Admin', value: 'admin' },
          { label: 'Manager', value: 'manager' },
          { label: 'Operator', value: 'operator' },
          { label: 'Viewer', value: 'viewer' },
        ],
      },
    ],
  };

  const filterValues = {
    roleFilter,
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'roleFilter') {
      setRoleFilter(value);
    }
  };

  return (
    <AdminLayout
      onNavigate={onNavigate}
      onLogout={onLogout}
      userSession={userSession}
      hasPermission={hasPermission}
      activeScreen="admin-users"
      headerTitle={
        <div className="flex flex-col">
          {userSession.user.organizationName && (
            <div className="flex items-center gap-1.5 mb-1">
              <Building2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700 tracking-wide">
                {userSession.user.organizationName}
              </span>
            </div>
          )}
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Users</h1>
        </div>
      }
      headerSubtitle="Manage platform users and permissions"
      headerSearchPlaceholder="Search users..."
      headerSearchValue={searchTerm}
      onHeaderSearchChange={setSearchTerm}
      headerInlineActions={
        hasPermission('create_user') ? (
          <Button className="bg-indigo-600 text-white" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-6 sm:space-y-8">
        <main className="px-6 lg:px-8 pt-12 pb-8">
          {/* Stat Cards Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {/* Total Users Card */}
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                      Total Users
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-4xl font-bold text-gray-900">{stats.total}</p>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Administrators Card */}
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                      Administrators
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-4xl font-bold text-gray-900">{stats.admins}</p>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                    <UserCog className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Users Card */}
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                      Active Users
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-4xl font-bold text-gray-900">{stats.active}</p>
                      <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded">
                        Last 7 Days
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                    <Activity className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Unified Header Component */}
          <AdminSearchFilterHeader
            config={searchFilterConfig}
            filterValues={filterValues}
            onFilterChange={handleFilterChange}
          />

          {/* Modern Table Container */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
              ) : error ? (
                <div className="text-center text-red-600 p-12">
                  <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                  <p>{error}</p>
                </div>
              ) : (
                <>
                  <div className="md:hidden px-6 py-6 space-y-4">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <div
                          key={user.id}
                          className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback
                                  className={`${getAvatarColor(user.username).bg} ${getAvatarColor(user.username).text} font-semibold text-sm`}
                                >
                                  {getInitials(user.username)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="text-sm font-semibold text-gray-900">
                                  {user.username}
                                </div>
                                <div className="text-xs text-gray-500">{user.email}</div>
                              </div>
                            </div>
                            {(hasPermission('edit_user') ||
                              (hasPermission('delete_user') &&
                                user.id !== userSession.user.id)) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-gray-500 hover:bg-gray-100"
                                    aria-label="User actions"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {hasPermission('edit_user') && (
                                    <DropdownMenuItem
                                      onSelect={() => setEditingUser(user)}
                                      className="flex items-center gap-2"
                                    >
                                      <Pencil className="h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                  )}
                                  {hasPermission('delete_user') &&
                                    user.id !== userSession.user.id && (
                                      <DropdownMenuItem
                                        onSelect={() => handleDeleteUser(user)}
                                        className="flex items-center gap-2 text-red-600 focus:text-red-600"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Delete
                                      </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 capitalize ${getRoleColors(user.role)}`}
                            >
                              {user.role.replace('_', ' ')}
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#064e3b]/10 text-[#064e3b] ring-1 ring-[#064e3b]/20">
                              Active
                            </span>
                          </div>

                          <div className="mt-4 border-t border-gray-100 pt-4 text-sm">
                            <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                              Permissions
                            </div>
                            <div className="mt-1 text-sm text-gray-600">
                              {user.permissions?.length
                                ? `${user.permissions.length} permissions`
                                : 'None'}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Ghost className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-lg font-medium mb-2">No Users Found</p>
                        <p className="text-sm mb-4">No users match your filters.</p>
                      </div>
                    )}
                  </div>
                  <div className="hidden md:block overflow-hidden">
                    <Table className="w-full">
                      <colgroup>
                        <col style={{ width: '28%' }} />
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '16%' }} />
                      </colgroup>
                      <TableHeader>
                        <TableRow className="bg-gray-100 border-b-2 border-gray-300 text-gray-700">
                          <SortableTableHeader
                            sortKey="username"
                            currentSortKey={sortKey}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                            className="px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide text-center"
                          >
                            User Details
                          </SortableTableHeader>
                          <SortableTableHeader
                            sortKey="role"
                            currentSortKey={sortKey}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                            className="px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide text-center"
                          >
                            Role
                          </SortableTableHeader>
                          <SortableTableHeader
                            sortKey="status"
                            currentSortKey={sortKey}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                            className="px-3 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide text-left"
                          >
                            Status
                          </SortableTableHeader>
                          <SortableTableHeader
                            sortable={false}
                            sortKey="permissions"
                            currentSortKey={sortKey}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                            className="px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide text-left"
                          >
                            Permissions
                          </SortableTableHeader>
                          <SortableTableHeader
                            sortable={false}
                            sortKey="actions"
                            currentSortKey={sortKey}
                            currentSortDirection={sortDirection}
                            onSort={handleSort}
                            className="px-6 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide text-center"
                          >
                            Actions
                          </SortableTableHeader>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow
                            key={user.id}
                            className="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 cursor-pointer"
                            onClick={() => handleUserClick(user)}
                          >
                            <TableCell className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback
                                    className={`${getAvatarColor(user.username).bg} ${getAvatarColor(user.username).text} font-semibold text-sm`}
                                  >
                                    {getInitials(user.username)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {user.username}
                                  </div>
                                  <div className="text-sm text-gray-500">{user.email}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 capitalize ${getRoleColors(user.role)}`}
                              >
                                {user.role.replace('_', ' ')}
                              </span>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#064e3b]/10 text-[#064e3b] ring-1 ring-[#064e3b]/20">
                                Active
                              </span>
                            </TableCell>
                            <TableCell className="px-6 py-4">
                              <div className="text-sm text-gray-500">
                                {user.permissions?.length
                                  ? `${user.permissions.length} permissions`
                                  : 'None'}
                              </div>
                            </TableCell>
                            <TableCell className="px-6 py-4 text-center">
                              {(hasPermission('edit_user') ||
                                (hasPermission('delete_user') &&
                                  user.id !== userSession.user.id)) && (
                                <div
                                  className="flex items-center justify-center"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-gray-500 hover:bg-gray-100"
                                        aria-label="User actions"
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {hasPermission('edit_user') && (
                                        <DropdownMenuItem
                                          onSelect={() => setEditingUser(user)}
                                          className="flex items-center gap-2"
                                        >
                                          <Pencil className="h-4 w-4" />
                                          Edit
                                        </DropdownMenuItem>
                                      )}
                                      {hasPermission('delete_user') &&
                                        user.id !== userSession.user.id && (
                                          <DropdownMenuItem
                                            onSelect={() => handleDeleteUser(user)}
                                            className="flex items-center gap-2 text-red-600 focus:text-red-600"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                            Delete
                                          </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
              {/* Pagination */}
              {(filteredUsers.length > 0 || canGoPrev) && (
                <div className="border-t border-gray-100 px-4">
                  <PaginationControls
                    pageNumber={pageNumber}
                    pageSize={pageSize}
                    totalOnPage={filteredUsers.length}
                    canGoNext={canGoNext}
                    canGoPrev={canGoPrev}
                    onNext={goNext}
                    onPrev={goPrev}
                    loading={fetching}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        <CreateUserDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          newUser={newUser}
          onUserChange={setNewUser}
          onCreateUser={handleCreateUser}
          userSession={userSession}
          isCreating={isCreatingUser}
        />
        {editingUser && (
          <EditUserDialog
            user={editingUser}
            onUpdate={handleUpdateUser}
            onClose={() => setEditingUser(null)}
            userSession={userSession}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[400px] p-0 border-0 shadow-2xl">
            <DialogHeader className="sr-only">
              <DialogTitle>Delete user</DialogTitle>
              <DialogDescription>Confirm deletion of the selected user.</DialogDescription>
            </DialogHeader>
            <div className="bg-white rounded-2xl p-8 text-center">
              {/* Warning Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </div>
                </div>
              </div>

              {/* Title */}
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Delete user</h2>

              {/* Description */}
              <p className="text-gray-600 mb-8 leading-relaxed">
                Are you sure you want to delete this user?
                <br />
                This action cannot be undone.
              </p>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(false)}
                  disabled={isDeleting}
                  className="flex-1 h-11 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDeleteUser}
                  disabled={isDeleting}
                  className="flex-1 h-11 bg-red-500 hover:bg-red-600 text-white border-0"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {dialogMessage && (
          <Dialog open={true} onOpenChange={() => setDialogMessage(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Error</DialogTitle>
              </DialogHeader>
              <DialogDescription>{dialogMessage}</DialogDescription>
              <DialogFooter>
                <Button onClick={() => setDialogMessage(null)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* User Details Sidebar */}
      {(selectedUser || isSidebarOpen) && (
        <>
          {/* Overlay */}
          <div
            className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-500 ${
              isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={closeSidebar}
          />

          {/* Sidebar */}
          <div
            className={`fixed right-0 top-0 h-full w-[500px] shadow-2xl z-50 transform transition-all duration-500 ease-in-out overflow-hidden ${
              isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
            style={{ backgroundColor: '#f3f1ea' }}
          >
            {selectedUser && (
              <>
                {/* Header */}
                <div
                  className="sticky top-0 border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10"
                  style={{ backgroundColor: '#f3f1ea' }}
                >
                  <h2 className="text-lg font-semibold text-gray-900">User Details</h2>
                  <button
                    onClick={closeSidebar}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex flex-col h-full">
                  <div
                    className="flex-1 overflow-y-auto p-6 space-y-6"
                    style={{ paddingBottom: '180px' }}
                  >
                    {/* Avatar and Basic Info */}
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          User ID:
                        </p>
                        <p className="text-xs text-gray-900 font-mono">{selectedUser.id}</p>
                      </div>
                      <Avatar className="h-24 w-24">
                        <AvatarFallback
                          className={`${getAvatarColor(selectedUser.username).bg} ${getAvatarColor(selectedUser.username).text} font-bold text-2xl`}
                        >
                          {getInitials(selectedUser.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {selectedUser.username}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">{selectedUser.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ring-1 capitalize ${getRoleColors(selectedUser.role)}`}
                        >
                          {selectedUser.role.replace('_', ' ')}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#064e3b]/10 text-[#064e3b] ring-1 ring-[#064e3b]/20">
                          Active
                        </span>
                      </div>
                    </div>

                    {/* Permissions Section */}
                    <div className="border-t border-gray-200 pt-6">
                      <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
                        Permissions
                      </h4>
                      {selectedUser.permissions && selectedUser.permissions.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                          {groupPermissionsByCategory(selectedUser.permissions).map(
                            ([category, perms]) => (
                              <div
                                key={category}
                                className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                              >
                                <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                  {getCategoryIcon(category)}
                                  {category}
                                </h5>
                                <ul className="space-y-2">
                                  {perms.map((permission) => (
                                    <li
                                      key={permission}
                                      className="flex items-start gap-2 text-xs text-gray-700"
                                    >
                                      <Check className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                                      <span className="capitalize leading-tight">
                                        {permission.replace(/_/g, ' ')}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No permissions assigned</p>
                      )}
                    </div>
                  </div>

                  {/* Fixed Action Buttons */}
                  <div
                    className="absolute bottom-0 left-0 right-0 border-t border-gray-200 p-6 space-y-3"
                    style={{ backgroundColor: '#f3f1ea' }}
                  >
                    {hasPermission('edit_user') && (
                      <Button
                        onClick={() => {
                          setEditingUser(selectedUser);
                          closeSidebar();
                        }}
                        className="w-full text-white hover:bg-[#053d2f]"
                        style={{ backgroundColor: '#064e3b' }}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit User
                      </Button>
                    )}
                    {hasPermission('delete_user') && selectedUser.id !== userSession.user.id && (
                      <Button
                        onClick={() => {
                          handleDeleteUser(selectedUser);
                          closeSidebar();
                        }}
                        className="w-full bg-red-100 text-red-700 hover:bg-red-200 border border-red-300"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete User
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newUser: {
    username: string;
    email: string;
    password: string;
    role: UserRole;
    permissions: Permission[];
  };
  onUserChange: (nextUser: {
    username: string;
    email: string;
    password: string;
    role: UserRole;
    permissions: Permission[];
  }) => void;
  onCreateUser: () => void;
  userSession: AdminSession;
  isCreating: boolean;
}

function CreateUserDialog({
  open,
  onOpenChange,
  newUser,
  onUserChange,
  onCreateUser,
  userSession,
  isCreating,
}: CreateUserDialogProps) {
  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    role?: string;
    permissions?: string;
  }>({});
  const [showPassword, setShowPassword] = useState(false);

  const validateAndCreate = () => {
    const newErrors: {
      username?: string;
      email?: string;
      password?: string;
      role?: string;
      permissions?: string;
    } = {};

    if (!newUser.username || newUser.username.trim() === '') {
      newErrors.username = 'Username is required';
    }

    if (!newUser.email || newUser.email.trim() === '') {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!newUser.password || newUser.password.trim() === '') {
      newErrors.password = 'Password is required';
    } else if (newUser.password.length < PASSWORD_REQUIREMENTS.minLength) {
      newErrors.password = `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`;
    } else if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(newUser.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter';
    } else if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(newUser.password)) {
      newErrors.password = 'Password must contain at least one lowercase letter';
    } else if (PASSWORD_REQUIREMENTS.requireNumbers && !/[0-9]/.test(newUser.password)) {
      newErrors.password = 'Password must contain at least one number';
    } else if (
      PASSWORD_REQUIREMENTS.requireSpecialChars &&
      !SPECIAL_CHARACTER_REGEX.test(newUser.password)
    ) {
      newErrors.password = 'Password must contain at least one special character';
    }
    if (!canAssignRole(userSession?.user?.role, newUser.role)) {
      newErrors.role = 'You do not have permission to assign this role';
    }
    const hasUnauthorizedPermission = (newUser.permissions || []).some(
      (permission: Permission) => !canAssignPermission(userSession, permission),
    );
    if (hasUnauthorizedPermission) {
      newErrors.permissions = 'You can only assign permissions that you already have';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onCreateUser();
    }
  };

  const onPermissionChange = (permission: Permission, checked: boolean) => {
    if (!canAssignPermission(userSession, permission)) {
      setErrors((prev) => ({
        ...prev,
        permissions: 'You can only assign permissions that you already have',
      }));
      return;
    }
    const currentPermissions = newUser.permissions || [];
    const newPermissions = checked
      ? [...currentPermissions, permission]
      : currentPermissions.filter((p: Permission) => p !== permission);
    onUserChange({ ...newUser, permissions: newPermissions });
    if (errors.permissions) {
      setErrors((prev) => ({ ...prev, permissions: undefined }));
    }
  };

  const handleRoleChange = (role: UserRole) => {
    if (!canAssignRole(userSession?.user?.role, role)) {
      setErrors((prev) => ({ ...prev, role: 'You do not have permission to assign this role' }));
      return;
    }
    // Get default permissions for the selected role
    const defaultPermissions =
      DEFAULT_USER_PERMISSIONS[role as keyof typeof DEFAULT_USER_PERMISSIONS] || [];
    // Filter out manage_permissions and system_admin from UI
    const filteredPermissions = defaultPermissions.filter(
      (p) => p !== 'manage_permissions' && p !== 'system_admin',
    );
    onUserChange({
      ...newUser,
      role: role,
      permissions: [...filteredPermissions], // Set filtered default permissions for the role
    });
    if (errors.role) {
      setErrors((prev) => ({ ...prev, role: undefined }));
    }
  };

  const isSuperAdmin = userSession?.user?.role === 'super_admin';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Fill in the details to add a new user to your organization.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="username" className="text-right pt-3">
              Username
            </Label>
            <div className="col-span-3">
              <div
                className={`border rounded-lg focus-within:ring-1 transition-colors ${
                  errors.username
                    ? 'border-red-500 focus-within:border-red-500 focus-within:ring-red-100'
                    : 'border-gray-300 focus-within:border-indigo-500 focus-within:ring-indigo-100'
                }`}
              >
                <Input
                  id="username"
                  value={newUser.username}
                  onChange={(e) => {
                    onUserChange({ ...newUser, username: e.target.value });
                    if (errors.username) setErrors({ ...errors, username: undefined });
                  }}
                  className="w-full h-12 px-3 bg-transparent outline-none border-0 focus-visible:ring-0 focus-visible:border-transparent"
                  placeholder="Enter username"
                />
              </div>
              {errors.username && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.username}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="email" className="text-right pt-3">
              Email
            </Label>
            <div className="col-span-3">
              <div
                className={`border rounded-lg focus-within:ring-1 transition-colors ${
                  errors.email
                    ? 'border-red-500 focus-within:border-red-500 focus-within:ring-red-100'
                    : 'border-gray-300 focus-within:border-indigo-500 focus-within:ring-indigo-100'
                }`}
              >
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => {
                    onUserChange({ ...newUser, email: e.target.value });
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  className="w-full h-12 px-3 bg-transparent outline-none border-0 focus-visible:ring-0 focus-visible:border-transparent"
                  placeholder="Enter email address"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="password" className="text-right pt-3">
              Password
            </Label>
            <div className="col-span-3">
              <div
                className={`border rounded-lg focus-within:ring-1 transition-colors relative ${
                  errors.password
                    ? 'border-red-500 focus-within:border-red-500 focus-within:ring-red-100'
                    : 'border-gray-300 focus-within:border-indigo-500 focus-within:ring-indigo-100'
                }`}
              >
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={newUser.password}
                  onChange={(e) => {
                    onUserChange({ ...newUser, password: e.target.value });
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  className="w-full h-12 px-3 pr-10 bg-transparent outline-none border-0 focus-visible:ring-0 focus-visible:border-transparent"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.password}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">
              Role
            </Label>
            <div className="col-span-3">
              <div className="border border-gray-300 rounded-lg focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-100 transition-colors">
                <Select value={newUser.role} onValueChange={handleRoleChange}>
                  <SelectTrigger className="w-full h-12 px-3 bg-transparent outline-none border-0 focus-visible:ring-0 focus-visible:border-transparent">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                    {canAssignRole(userSession?.user?.role, 'admin') && (
                      <SelectItem value="admin">Admin</SelectItem>
                    )}
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {errors.role && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.role}
                </p>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Permissions
              </Label>
              <span className="text-xs text-slate-400">
                {allPermissions.length} total available
              </span>
            </div>
            {errors.permissions && (
              <p className="text-xs text-red-600 mb-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.permissions}
              </p>
            )}

            <div className="border border-slate-200 rounded-xl bg-slate-50/50">
              <div className="p-5 max-h-80 overflow-y-auto space-y-6">
                {/* User Permissions */}
                {(() => {
                  const userPerms = allPermissions.filter(
                    (p) => p.includes('user') || p.includes('permission'),
                  );
                  if (userPerms.length === 0) return null;
                  const hasViewUsers = newUser.permissions.includes('view_users');

                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                        Users
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                        {userPerms.map((p) => {
                          const isUserPermission = [
                            'create_user',
                            'edit_user',
                            'delete_user',
                          ].includes(p);
                          const userDisabled = isUserPermission && !hasViewUsers;
                          return (
                            <div key={p} className="flex items-center justify-between">
                              <div
                                className={`flex items-center space-x-3 ${userDisabled ? 'opacity-50' : ''}`}
                              >
                                <Checkbox
                                  id={`create-${p}`}
                                  checked={newUser.permissions.includes(p)}
                                  onCheckedChange={(c) => onPermissionChange(p, !!c)}
                                  disabled={userDisabled}
                                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                />
                                <Label
                                  htmlFor={`create-${p}`}
                                  className={`text-sm text-slate-700 font-medium ${userDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  {p.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                </Label>
                              </div>
                              {userDisabled && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="text-slate-400 hover:text-indigo-600"
                                      >
                                        <Info className="w-4 h-4" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">
                                        View users is mandatory to create/edit/delete users
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Campaign Permissions */}
                {(() => {
                  const campaignPerms = allPermissions.filter(
                    (p) => p.includes('campaign') || p === 'assign_campaigns',
                  );
                  if (campaignPerms.length === 0) return null;
                  const hasViewCampaigns = newUser.permissions.includes('view_campaigns');
                  const hasViewKiosks = newUser.permissions.includes('view_kiosks');

                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                        Campaigns
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                        {campaignPerms.map((p) => {
                          const isCampaignPermission = [
                            'create_campaign',
                            'edit_campaign',
                            'delete_campaign',
                          ].includes(p);
                          const isAssignCampaigns = p === 'assign_campaigns';

                          const campaignDisabled = isCampaignPermission && !hasViewCampaigns;
                          const assignDisabled =
                            isAssignCampaigns && !hasViewCampaigns && !hasViewKiosks;
                          const isDisabled = campaignDisabled || assignDisabled;

                          let tooltipMessage = '';
                          if (campaignDisabled) {
                            tooltipMessage =
                              'View campaigns is mandatory to create/edit/delete campaigns';
                          } else if (assignDisabled) {
                            tooltipMessage =
                              'Either select view campaigns or view kiosks to enable assign campaigns';
                          }
                          return (
                            <div key={p} className="flex items-center justify-between">
                              <div
                                className={`flex items-center space-x-3 ${isDisabled ? 'opacity-50' : ''}`}
                              >
                                <Checkbox
                                  id={`create-${p}`}
                                  checked={newUser.permissions.includes(p)}
                                  onCheckedChange={(c) => onPermissionChange(p, !!c)}
                                  disabled={isDisabled}
                                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                />
                                <Label
                                  htmlFor={`create-${p}`}
                                  className={`text-sm text-slate-700 font-medium ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  {p.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                </Label>
                              </div>
                              {isDisabled && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="text-slate-400 hover:text-indigo-600"
                                      >
                                        <Info className="w-4 h-4" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">{tooltipMessage}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Kiosk Permissions */}
                {(() => {
                  const kioskPerms = allPermissions.filter((p) => p.includes('kiosk'));
                  if (kioskPerms.length === 0) return null;
                  const hasViewKiosks = newUser.permissions.includes('view_kiosks');

                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                        Kiosks
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                        {kioskPerms.map((p) => {
                          const isKioskPermission = [
                            'create_kiosk',
                            'edit_kiosk',
                            'delete_kiosk',
                          ].includes(p);
                          const kioskDisabled = isKioskPermission && !hasViewKiosks;
                          return (
                            <div key={p} className="flex items-center justify-between">
                              <div
                                className={`flex items-center space-x-3 ${kioskDisabled ? 'opacity-50' : ''}`}
                              >
                                <Checkbox
                                  id={`create-${p}`}
                                  checked={newUser.permissions.includes(p)}
                                  onCheckedChange={(c) => onPermissionChange(p, !!c)}
                                  disabled={kioskDisabled}
                                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                />
                                <Label
                                  htmlFor={`create-${p}`}
                                  className={`text-sm text-slate-700 font-medium ${kioskDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  {p.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                </Label>
                              </div>
                              {kioskDisabled && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="text-slate-400 hover:text-indigo-600"
                                      >
                                        <Info className="w-4 h-4" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">
                                        View kiosks is mandatory to create/edit/delete kiosks
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Donation Permissions */}
                {(() => {
                  const donationPerms = allPermissions.filter(
                    (p) =>
                      p.includes('donation') || p.includes('subscription') || p.includes('giftaid'),
                  );
                  if (donationPerms.length === 0) return null;
                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                        Donations
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                        {donationPerms.map((p) => (
                          <div key={p} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id={`create-${p}`}
                                checked={newUser.permissions.includes(p)}
                                onCheckedChange={(c) => onPermissionChange(p, !!c)}
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                              <Label
                                htmlFor={`create-${p}`}
                                className="text-sm text-slate-700 font-medium cursor-pointer"
                              >
                                {p.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                              </Label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={validateAndCreate} disabled={isCreating}>
            {isCreating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create User'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  onUpdate,
  onClose,
  userSession,
}: {
  user: User;
  onUpdate: (userId: string, updates: Partial<User>) => Promise<void>;
  onClose: () => void;
  userSession: AdminSession;
}) {
  const [editedUser, setEditedUser] = useState(user);
  const [isSaving, setIsSaving] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  useEffect(() => {
    setEditedUser(user);
  }, [user]);

  const handlePermissionChange = (permission: Permission, checked: boolean) => {
    if (!canAssignPermission(userSession, permission)) {
      setPermissionError('You can only assign permissions that you already have');
      return;
    }
    const currentPermissions = editedUser.permissions || [];
    const newPermissions = checked
      ? [...currentPermissions, permission]
      : currentPermissions.filter((p: Permission) => p !== permission);
    setEditedUser((prev) => ({ ...prev, permissions: newPermissions }));
    if (permissionError) {
      setPermissionError(null);
    }
  };

  const handleRoleChange = (role: UserRole) => {
    if (!canAssignRole(userSession?.user?.role, role)) {
      setRoleError('You do not have permission to assign this role');
      return;
    }
    // Get default permissions for the selected role
    const defaultPermissions =
      DEFAULT_USER_PERMISSIONS[role as keyof typeof DEFAULT_USER_PERMISSIONS] || [];
    // Filter out manage_permissions and system_admin from UI
    const filteredPermissions = defaultPermissions.filter(
      (p) => p !== 'manage_permissions' && p !== 'system_admin',
    );
    setEditedUser((prev) => ({
      ...prev,
      role: role,
      permissions: [...filteredPermissions], // Set filtered default permissions for the role
    }));
    if (roleError) {
      setRoleError(null);
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      await onUpdate(editedUser.id, { role: editedUser.role, permissions: editedUser.permissions });
    } catch (error) {
      console.error('Error saving user changes:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const isSuperAdmin = userSession?.user?.role === 'super_admin';

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">
              Edit User: <span className="text-indigo-600">{editedUser.username}</span>
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">
              Update the user's role and individual permissions.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Role Selection */}
          <div className="space-y-2">
            <Label htmlFor="role" className="text-sm font-semibold text-slate-700">
              Role
            </Label>
            <Select value={editedUser.role} onValueChange={handleRoleChange}>
              <SelectTrigger className="w-full h-11 bg-white border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                {canAssignRole(userSession?.user?.role, 'admin') && (
                  <SelectItem value="admin">Admin</SelectItem>
                )}
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="operator">Operator</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            {roleError && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {roleError}
              </p>
            )}
          </div>

          {/* Permissions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Permissions
              </Label>
              <span className="text-xs text-slate-400">
                {allPermissions.length} total available
              </span>
            </div>
            {permissionError && (
              <p className="text-xs text-red-600 mb-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {permissionError}
              </p>
            )}

            <div className="border border-slate-200 rounded-xl bg-slate-50/50">
              <div className="p-5 max-h-80 overflow-y-auto space-y-6">
                {/* Dashboard Permissions */}
                {(() => {
                  const dashboardPerms = allPermissions.filter((p) => p.includes('dashboard'));
                  if (dashboardPerms.length === 0) return null;
                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                        Dashboard
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                        {dashboardPerms.map((p) => (
                          <div key={p} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id={`edit-${p}`}
                                checked={editedUser.permissions?.includes(p)}
                                onCheckedChange={(c) => handlePermissionChange(p, !!c)}
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                              <Label
                                htmlFor={`edit-${p}`}
                                className="text-sm text-slate-700 font-medium cursor-pointer"
                              >
                                {p.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                              </Label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* User Permissions */}
                {(() => {
                  const userPerms = allPermissions.filter(
                    (p) => p.includes('user') || p.includes('permission'),
                  );
                  if (userPerms.length === 0) return null;
                  const hasViewUsers = editedUser.permissions?.includes('view_users');

                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                        Users
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                        {userPerms.map((p) => {
                          const isUserPermission = [
                            'create_user',
                            'edit_user',
                            'delete_user',
                          ].includes(p);
                          const userDisabled = isUserPermission && !hasViewUsers;
                          return (
                            <div key={p} className="flex items-center justify-between">
                              <div
                                className={`flex items-center space-x-3 ${userDisabled ? 'opacity-50' : ''}`}
                              >
                                <Checkbox
                                  id={`edit-${p}`}
                                  checked={editedUser.permissions?.includes(p)}
                                  onCheckedChange={(c) => handlePermissionChange(p, !!c)}
                                  disabled={userDisabled}
                                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                />
                                <Label
                                  htmlFor={`edit-${p}`}
                                  className={`text-sm text-slate-700 font-medium ${userDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  {p.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                </Label>
                              </div>
                              {userDisabled && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="text-slate-400 hover:text-indigo-600"
                                      >
                                        <Info className="w-4 h-4" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">
                                        View users is mandatory to create/edit/delete users
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Campaign Permissions */}
                {(() => {
                  const campaignPerms = allPermissions.filter(
                    (p) => p.includes('campaign') || p === 'assign_campaigns',
                  );
                  if (campaignPerms.length === 0) return null;
                  const hasViewCampaigns = editedUser.permissions?.includes('view_campaigns');
                  const hasViewKiosks = editedUser.permissions?.includes('view_kiosks');

                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                        Campaigns
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                        {campaignPerms.map((p) => {
                          const isCampaignPermission = [
                            'create_campaign',
                            'edit_campaign',
                            'delete_campaign',
                          ].includes(p);
                          const isAssignCampaigns = p === 'assign_campaigns';

                          const campaignDisabled = isCampaignPermission && !hasViewCampaigns;
                          const assignDisabled =
                            isAssignCampaigns && !hasViewCampaigns && !hasViewKiosks;
                          const isDisabled = campaignDisabled || assignDisabled;

                          let tooltipMessage = '';
                          if (campaignDisabled) {
                            tooltipMessage =
                              'View campaigns is mandatory to create/edit/delete campaigns';
                          } else if (assignDisabled) {
                            tooltipMessage =
                              'Either select view campaigns or view kiosks to enable assign campaigns';
                          }
                          return (
                            <div key={p} className="flex items-center justify-between">
                              <div
                                className={`flex items-center space-x-3 ${isDisabled ? 'opacity-50' : ''}`}
                              >
                                <Checkbox
                                  id={`edit-${p}`}
                                  checked={editedUser.permissions?.includes(p)}
                                  onCheckedChange={(c) => handlePermissionChange(p, !!c)}
                                  disabled={isDisabled}
                                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                />
                                <Label
                                  htmlFor={`edit-${p}`}
                                  className={`text-sm text-slate-700 font-medium ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  {p.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                </Label>
                              </div>
                              {isDisabled && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="text-slate-400 hover:text-indigo-600"
                                      >
                                        <Info className="w-4 h-4" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">{tooltipMessage}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Kiosk Permissions */}
                {(() => {
                  const kioskPerms = allPermissions.filter((p) => p.includes('kiosk'));
                  if (kioskPerms.length === 0) return null;
                  const hasViewKiosks = editedUser.permissions?.includes('view_kiosks');

                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                        Kiosks
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                        {kioskPerms.map((p) => {
                          const isKioskPermission = [
                            'create_kiosk',
                            'edit_kiosk',
                            'delete_kiosk',
                          ].includes(p);
                          const kioskDisabled = isKioskPermission && !hasViewKiosks;
                          return (
                            <div key={p} className="flex items-center justify-between">
                              <div
                                className={`flex items-center space-x-3 ${kioskDisabled ? 'opacity-50' : ''}`}
                              >
                                <Checkbox
                                  id={`edit-${p}`}
                                  checked={editedUser.permissions?.includes(p)}
                                  onCheckedChange={(c) => handlePermissionChange(p, !!c)}
                                  disabled={kioskDisabled}
                                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                />
                                <Label
                                  htmlFor={`edit-${p}`}
                                  className={`text-sm text-slate-700 font-medium ${kioskDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  {p.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                </Label>
                              </div>
                              {kioskDisabled && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        className="text-slate-400 hover:text-indigo-600"
                                      >
                                        <Info className="w-4 h-4" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">
                                        View kiosks is mandatory to create/edit/delete kiosks
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Donation Permissions */}
                {(() => {
                  const donationPerms = allPermissions.filter(
                    (p) =>
                      p.includes('donation') || p.includes('subscription') || p.includes('giftaid'),
                  );
                  if (donationPerms.length === 0) return null;
                  return (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
                        Donations
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                        {donationPerms.map((p) => (
                          <div key={p} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id={`edit-${p}`}
                                checked={editedUser.permissions?.includes(p)}
                                onCheckedChange={(c) => handlePermissionChange(p, !!c)}
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                              />
                              <Label
                                htmlFor={`edit-${p}`}
                                className="text-sm text-slate-700 font-medium cursor-pointer"
                              >
                                {p.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                              </Label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* System Permissions - Removed system_admin option */}
                {/* System admin permission is not editable through the UI */}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 bg-slate-50 flex justify-end space-x-3 border-t border-slate-100">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveChanges}
            disabled={isSaving}
            className="px-6 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:opacity-90 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
