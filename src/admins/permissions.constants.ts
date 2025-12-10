/**
 * Permission Constants
 * Defines all available permissions for the admin management system
 */

export enum Permission {
  // Credit Requests Module
  CREDIT_REQUESTS_VIEW = 'credit_requests:view',
  CREDIT_REQUESTS_APPROVE = 'credit_requests:approve',
  CREDIT_REQUESTS_REJECT = 'credit_requests:reject',

  // Onboarding Module
  ONBOARDING_VIEW = 'onboarding:view',
  ONBOARDING_COMPLETE = 'onboarding:complete',

  // Payouts Module
  PAYOUTS_VIEW = 'payouts:view',
  PAYOUTS_PROCESS = 'payouts:process',
  PAYOUTS_REJECT = 'payouts:reject',

  // Users Module
  USERS_VIEW = 'users:view',
  USERS_SUSPEND = 'users:suspend',
  USERS_UNSUSPEND = 'users:unsuspend',

  // Transactions Module
  TRANSACTIONS_VIEW = 'transactions:view',

  // Finance Report Module
  FINANCE_VIEW = 'finance:view',

  // Admin Management Module
  ADMINS_VIEW = 'admins:view',
  ADMINS_CREATE = 'admins:create',
  ADMINS_UPDATE = 'admins:update',
  ADMINS_SUSPEND = 'admins:suspend',
  ADMINS_DELETE = 'admins:delete',

  // Settings Module
  SETTINGS_VIEW = 'settings:view',
  SETTINGS_UPDATE = 'settings:update',
}

/**
 * Permission Groups - Organized by module for easy assignment
 */
export const PermissionGroups = {
  CREDIT_REQUESTS: [
    Permission.CREDIT_REQUESTS_VIEW,
    Permission.CREDIT_REQUESTS_APPROVE,
    Permission.CREDIT_REQUESTS_REJECT,
  ],
  ONBOARDING: [
    Permission.ONBOARDING_VIEW,
    Permission.ONBOARDING_COMPLETE,
  ],
  PAYOUTS: [
    Permission.PAYOUTS_VIEW,
    Permission.PAYOUTS_PROCESS,
    Permission.PAYOUTS_REJECT,
  ],
  USERS: [
    Permission.USERS_VIEW,
    Permission.USERS_SUSPEND,
    Permission.USERS_UNSUSPEND,
  ],
  TRANSACTIONS: [
    Permission.TRANSACTIONS_VIEW,
  ],
  FINANCE: [
    Permission.FINANCE_VIEW,
  ],
  ADMINS: [
    Permission.ADMINS_VIEW,
    Permission.ADMINS_CREATE,
    Permission.ADMINS_UPDATE,
    Permission.ADMINS_SUSPEND,
    Permission.ADMINS_DELETE,
  ],
  SETTINGS: [
    Permission.SETTINGS_VIEW,
    Permission.SETTINGS_UPDATE,
  ],
};

/**
 * All permissions as a flat array
 */
export const ALL_PERMISSIONS = Object.values(Permission);

/**
 * Default permissions for regular admin role
 */
export const DEFAULT_ADMIN_PERMISSIONS = [
  ...PermissionGroups.CREDIT_REQUESTS,
  ...PermissionGroups.ONBOARDING,
  ...PermissionGroups.PAYOUTS,
  ...PermissionGroups.USERS,
  ...PermissionGroups.TRANSACTIONS,
  ...PermissionGroups.FINANCE,
];

/**
 * Super admin has all permissions (handled in guard)
 */
export const SUPER_ADMIN_PERMISSIONS = ALL_PERMISSIONS;

