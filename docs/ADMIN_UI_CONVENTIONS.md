# Admin UI Conventions

This document defines the shared conventions for admin list pages.

## 1) Purpose

Use shared components and shared data-loading patterns so admin pages behave consistently across:

- desktop and mobile layouts
- refresh interactions
- filtering and pagination
- loading and error states

## 2) Shared UI Primitives

Core components:

- `src/views/admin/components/AdminStatsGrid.tsx`
- `src/views/admin/components/AdminStatsGridLoading.tsx`
- `src/views/admin/components/AdminDataSection.tsx`
- `src/views/admin/components/AdminDataSectionLoading.tsx`
- `src/views/admin/components/AdminSearchFilterHeader.tsx`
- `src/views/admin/components/AdminRefreshButton.tsx`
- `src/views/admin/components/AdminPageStatus.tsx`

Typical composition:

1. top-level page wraps in `AdminLayout`
2. initial states use `AdminPageLoader` / `AdminPageError`
3. KPI cards render in `AdminStatsGrid`
4. list/filter area renders in `AdminDataSection`
5. list-loading skeleton uses `AdminDataSectionLoading`

## 3) Refresh Behavior

Centralized refresh behavior is provided by `AdminDataSection` + `AdminRefreshButton`.

- Desktop: refresh appears with section actions near filters.
- Mobile: refresh appears in the section header top-right.
- Manual refresh uses the same visual treatment (light overlay + "Refreshing data...") across sections.

Do not implement custom per-page refresh buttons unless a page has a unique product requirement.

## 4) Filters And Pagination Contract

Filter controls are centralized with `AdminSearchFilterHeader`.

Pagination behavior:

- Cursor-based pagination is managed with `usePagination`.
- UI controls are standardized: `Previous`, `Page N`, `Next`.
- Pagination state resets when organization or filter state changes.
- Query keys should use stable primitive segments (`string`/`number`), not raw objects.

Page sizes:

- Standard admin list page size: `20` (`PAGE_SIZE` in `usePagination`).
- Gift Aid export history page size: `2` (`useGiftAidExportBatches` override).

## 5) Backend-Driven Filtering

For admin list pages:

- filter state should be applied in paginated backend/Firestore queries
- list pagination should not be done by client-side slicing
- refresh should invalidate query cache for that section key

If backend indexes are not available yet, temporary fallback logic is acceptable but should be documented and removed once indexes are deployed.

## 6) Firestore Index Notes

Gift Aid export history pagination uses:

- `where('organizationId', '==', ...)`
- `orderBy('createdAt', 'desc')`
- `orderBy('__name__', 'desc')`

This requires a composite index for `giftAidExportBatches`.

## 7) New Admin Page Checklist

Before merging a new admin list page:

1. Uses `AdminDataSection` for filters + list container.
2. Uses shared refresh behavior (no duplicate mobile refresh placements).
3. Uses `usePagination`-based cursor flow.
4. Uses standardized pagination control UI.
5. Uses shared loading/error components.
6. Confirms required Firestore indexes for query shape.
