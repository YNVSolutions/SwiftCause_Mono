# Admin Flow

This document outlines the main admin-facing workflows in SwiftCause.

## Overview

Admin users manage campaigns, users, kiosks, subscriptions, donations, and Gift Aid workflows from the `/admin` area.

## Main Entry Points

- `app/admin/page.tsx`
- `app/admin/campaigns/page.tsx`
- `app/admin/campaigns/create/page.tsx`
- `app/admin/users/page.tsx`
- `app/admin/kiosks/page.tsx`
- `app/admin/donations/page.tsx`
- `app/admin/subscriptions/page.tsx`
- `app/admin/gift-aid/page.tsx`
- `src/views/admin/*`

## High-Level Flow

1. Verified admin user signs in.
2. The app restores the admin session.
3. The user is routed into the `/admin` area.
4. The dashboard loads organization-specific data.
5. The admin navigates into campaigns, users, kiosks, donations, subscriptions, and Gift Aid tools.

## Main Admin Workflows

### Campaign Management

- create campaigns
- edit campaign content and metadata
- manage campaign images
- control kiosk and organization relationships

### User Management

- view organization users
- create and update users
- manage permissions and role information

### Kiosk Management

- view kiosks
- create or update kiosk records
- link kiosks to campaigns
- support kiosk login and campaign assignments

### Donations And Subscriptions

- inspect donation activity
- review recurring subscription records
- monitor performance and reporting data

### Stripe Onboarding

- launch onboarding links
- view account status
- access express dashboard links where supported

## Standardized Admin List UX

Admin data-heavy pages (campaigns, users, kiosks, donations, subscriptions, and Gift Aid) now follow a shared composition:

- `AdminStatsGrid` + `AdminStatsGridLoading` for KPI card rows
- `AdminDataSection` + `AdminDataSectionLoading` for filter/table sections
- `AdminSearchFilterHeader` for standardized filter controls and actions
- `AdminRefreshButton` for consistent manual refresh behavior
- `AdminPageStatus` for initial page loading and error states

Reference: `docs/ADMIN_UI_CONVENTIONS.md`

## Filters, Pagination, And Data Fetching

- Filters are centralized through shared admin filter header components.
- List pages use backend-driven filtering and cursor-based pagination hooks.
- Pagination control UI is standardized (`Previous`, `Page N`, `Next`) for desktop and mobile.
- Default admin page size is `20` (via shared pagination hook), with per-screen overrides where required.
- Gift Aid export history uses cursor pagination with page size `2`.

## Mobile Behavior Standards

- Refresh actions in admin list sections are shown in the section header top-right on small screens.
- The same refresh action stays near filters/actions on desktop.
- Stats cards and table/list sections use shared responsive layouts so behavior is consistent across pages.

## Important Contributor Notes

- Many admin screens aggregate data from multiple features and shared hooks.
- Changes in admin flows often affect both UI composition and backend data assumptions.
- Authorization-sensitive changes should be reviewed carefully, especially around Stripe onboarding and organization scoping.
- New admin list screens should follow the shared component and pagination conventions instead of introducing page-specific patterns.
