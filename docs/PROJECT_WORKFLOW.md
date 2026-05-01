# SwiftCause - Project Workflow Documentation

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [User Flows](#user-flows)
4. [Technical Stack](#technical-stack)
5. [Key Features](#key-features)
6. [Data Flow](#data-flow)
7. [Security & Performance](#security--performance)
8. [Database Schema](#database-schema)

---

## 🎯 Project Overview

**SwiftCause** is a donation management platform that enables organizations to:

- Create and manage fundraising campaigns
- Deploy donation kiosks (physical or virtual)
- Process payments securely via Stripe
- Track donations and analytics in real-time
- Manage users with role-based permissions

### Core Concept

Organizations create campaigns → Assign campaigns to kiosks → Donors use kiosks to donate → Admins track everything via dashboard

---

## 🏗️ Architecture

### Frontend Architecture

```
Next.js 14 (App Router)
├── /app                    # Next.js pages
│   ├── /admin             # Admin dashboard pages
│   ├── /campaign          # Campaign donation pages
│   └── /login             # Authentication
├── /src
│   ├── /views             # Page components
│   │   └── /admin         # Admin UI components
│   ├── /shared            # Shared utilities
│   │   ├── /ui            # Reusable UI components
│   │   ├── /lib           # Utilities & hooks
│   │   ├── /api           # API services
│   │   └── /types         # TypeScript types
│   └── /entities          # Domain entities
└── /backend               # Firebase Cloud Functions
```

### Backend Architecture

```
Firebase
├── Firestore              # NoSQL Database
├── Authentication         # User management
├── Storage                # File uploads (images)
├── Cloud Functions        # Server-side logic
└── Hosting                # Static site hosting
```

---

## 👥 User Flows

### 1. Organization Setup Flow

```
1. Super Admin creates Organization
2. Organization connects Stripe account
3. Admin users are invited with specific permissions
4. Organization is ready to create campaigns
```

### 2. Campaign Creation Flow

```
Admin Dashboard
    ↓
Create Campaign
    ↓
Configure:
    - Title, Description, Goal
    - Donation amounts (predefined/custom)
    - Images, videos, branding
    - Recurring donation options
    - Form fields (required/optional)
    ↓
Assign to Kiosks (or mark as Global)
    ↓
Campaign goes Live
```

### 3. Kiosk Setup Flow

```
Admin Dashboard
    ↓
Create Kiosk
    ↓
Configure:
    - Name, Location
    - Device info (OS, browser)
    - Access code / QR code
    - Default campaign
    ↓
Assign Campaigns
    ↓
Kiosk is Active
```

### 4. Donation Flow

```
Donor visits Kiosk URL
    ↓
Selects Campaign
    ↓
Chooses Donation Amount
    ↓
Fills Donor Information (optional)
    ↓
Payment via Stripe
    ↓
Confirmation & Receipt
    ↓
Data saved to Firestore
    ↓
Dashboard updates in real-time
```

### 5. Admin Monitoring Flow

```
Admin logs in
    ↓
Dashboard shows:
    - Total raised, donations count
    - Active campaigns & kiosks
    - Recent activity feed
    - Donation distribution charts
    - Campaign progress
    ↓
Admin can:
    - View detailed analytics
    - Manage campaigns/kiosks
    - Export data (CSV)
    - View individual donations
```

---

## 🛠️ Technical Stack

### Frontend

- **Framework:** Next.js 14 (React 18)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** Shadcn/ui (Radix UI)
- **Charts:** Recharts
- **Forms:** React Hook Form
- **State Management:** React Hooks + Context + TanStack Query (admin data queries)

### Backend

- **Database:** Firebase Firestore (NoSQL)
- **Authentication:** Firebase Auth
- **Storage:** Firebase Storage
- **Functions:** Firebase Cloud Functions (Node.js)
- **Payments:** Stripe API

### DevOps

- **Hosting:** Firebase Hosting / Vercel
- **Version Control:** Git
- **Package Manager:** npm

---

## ✨ Key Features

### 1. Campaign Management

- **CRUD Operations:** Create, Read, Update, Delete campaigns
- **Rich Configuration:**
  - Custom donation amounts
  - Recurring donations (monthly/quarterly/yearly)
  - Visual customization (colors, themes, images)
  - Impact metrics tracking
  - Social sharing features
- **Status Management:** Active, Paused, Completed
- **Progress Tracking:** Real-time goal completion percentage

### 2. Kiosk System

- **Multi-Device Support:** iOS, Android, Windows, ChromeOS
- **Access Control:** QR codes and secure access codes
- **Campaign Assignment:** Multiple campaigns per kiosk
- **Status Monitoring:** Online/Offline tracking
- **Location-Based Analytics:** Track donations by location

### 3. Payment Processing

- **Stripe Integration:**
  - Secure payment processing
  - PCI compliance
  - Multiple payment methods
  - Recurring billing support
- **Onboarding:** Stripe Connect for organizations
- **Payout Management:** Automatic transfers to organization accounts

### 4. Analytics Dashboard

- **Real-Time Metrics:**
  - Total raised across all campaigns
  - Total donation count
  - Active campaigns/kiosks count
- **Visualizations:**
  - Campaign goal comparison (bar chart)
  - Average donation per campaign (line chart)
  - Donation distribution by amount (line chart)
  - Top performing campaigns (progress bars)
- **Activity Feed:** Recent donations with details
- **Alerts:** System notifications (offline kiosks, etc.)

### 5. User Management

- **Role-Based Access Control (RBAC):**
  - Super Admin (system-wide access)
  - Admin (organization-level access)
  - Manager (limited permissions)
  - Viewer (read-only)
- **Permissions:**
  - view_campaigns, create_campaign, edit_campaign
  - view_kiosks, create_kiosk, assign_campaigns
  - view_donations, view_users, create_user
  - system_admin (super admin only)

### 6. Data Export

- **CSV Export:** Campaign data, donations, analytics
- **Filtering:** By status, category, date range
- **Sorting:** By title, goal, end date, created date

---

## 🔄 Data Flow

### Campaign Creation Flow

```
Admin UI (CampaignManagement.tsx)
    ↓
useCampaignManagement hook
    ↓
createCampaignWithImage()
    ↓
Firebase Storage (upload image)
    ↓
Firestore (save campaign document)
    ↓
UI updates with new campaign
```

### Donation Processing Flow

```
Donor submits payment
    ↓
Stripe API (process payment)
    ↓
Cloud Function (webhook)
    ↓
Firestore updates:
    - Create donation document
    - Update campaign.raised
    - Update campaign.donationCount
    ↓
Dashboard refreshes automatically
```

### Dashboard Data Loading Flow

```
AdminDashboard mounts
    ↓
useDashboardData hook
    ↓
Parallel queries:
    - getCampaigns(organizationId)
    - getKiosks(organizationId)
    - getRecentDonations(10, organizationId)
    - getCountFromServer() for donation distribution
    ↓
Data aggregation & calculations
    ↓
State updates → UI renders
```

### Admin List Data Loading Flow (Standardized)

```
Admin list page mounts (campaigns/users/kiosks/donations/subscriptions/gift aid)
    ↓
Shared filter state updates
    ↓
usePagination cursor state (page number + current cursor)
    ↓
TanStack Query with stable primitive query key
    ↓
Backend/Firestore paginated query (PAGE_SIZE + 1)
    ↓
updatePage(lastDoc, hasNextPage)
    ↓
Unified Previous / Page N / Next controls
```

---

## 🔒 Security & Performance

### Security Measures

#### 1. Authentication

- Firebase Authentication with email/password
- Session management with secure tokens
- Protected routes (admin-only pages)

#### 2. Authorization

- Role-based access control (RBAC)
- Permission checks before every action
- Organization-level data isolation

#### 3. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read their own data
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
    }

    // Organization members can access org data
    match /campaigns/{campaignId} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid))
        .data.organizationId == resource.data.organizationId;
    }
  }
}
```

#### 4. Data Validation

- Input sanitization on client-side
- Server-side validation in Cloud Functions
- Type safety with TypeScript

#### 5. PII Protection

⚠️ **Current Issue:** Donation data with PII (email, phone, name) is exposed to client
**Recommendation:** Use Cloud Functions to sanitize sensitive data

### Performance Optimizations

#### 1. Efficient Queries

- **Before:** Fetching all donations (10,000+ reads)
- **After:** Using `getCountFromServer()` (6 reads)
- Parallel queries with `Promise.all()`
- Indexed queries for fast lookups

#### 2. Code Splitting

- Next.js automatic code splitting
- Lazy loading of components
- Dynamic imports for heavy libraries

#### 3. Caching Strategy

- Browser caching for static assets
- Firebase SDK caching
- TanStack Query cache + targeted query invalidation for admin sections

#### 4. Image Optimization

- Next.js Image component
- Lazy loading images
- Responsive images with srcset

#### 5. Bundle Optimization

- Tree shaking unused code
- Minification in production
- Compression (gzip/brotli)

---

## 💾 Database Schema

### Collections Structure

#### 1. **organizations**

```typescript
{
  id: string;
  name: string;
  stripe: {
    accountId: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  }
  createdAt: Timestamp;
}
```

#### 2. **users**

```typescript
{
  id: string;
  email: string;
  username: string;
  role: 'super_admin' | 'admin' | 'manager' | 'viewer';
  organizationId: string;
  permissions: string[];
  createdAt: Timestamp;
}
```

#### 3. **campaigns**

```typescript
{
  id: string;
  organizationId: string;
  title: string;
  description: string;
  longDescription?: string;
  goal: number;
  raised: number;
  donationCount: number;
  status: 'active' | 'paused' | 'completed';
  coverImageUrl?: string;
  videoUrl?: string;
  tags: string[];
  category?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  isGlobal: boolean;
  assignedKiosks: string[];

  configuration: {
    predefinedAmounts: number[];
    allowCustomAmount: boolean;
    minCustomAmount: number;
    maxCustomAmount: number;
    enableRecurring: boolean;
    recurringIntervals: string[];
    displayStyle: 'grid' | 'list';
    showProgressBar: boolean;
    accentColor: string;
    theme: 'default' | 'dark' | 'light';
    requiredFields: string[];
    optionalFields: string[];
    enableAnonymousDonations: boolean;
  };

  organizationInfo?: {
    name: string;
    description: string;
    website: string;
    logo: string;
  };

  impactMetrics?: {
    peopleHelped: number;
    itemsProvided: number;
    customMetric?: {
      label: string;
      value: number;
      unit: string;
    };
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### 4. **kiosks**

```typescript
{
  id: string;
  organizationId: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  accessCode: string;
  qrCode?: string;
  defaultCampaignId?: string;
  assignedCampaigns: string[];
  totalRaised: number;

  deviceInfo: {
    os: string;
    browser: string;
    userAgent: string;
  };

  createdAt: Timestamp;
  lastActive: Timestamp;
}
```

#### 5. **donations**

```typescript
{
  id: string;
  organizationId: string;
  campaignId: string;
  kioskId?: string;
  amount: number;

  // Donor information (PII)
  donorName?: string;
  donorEmail?: string;
  donorPhone?: string;
  donorMessage?: string;
  isAnonymous: boolean;

  // Payment details
  transactionId: string;
  paymentMethod: string;

  // Recurring
  isRecurring: boolean;
  recurringInterval?: 'monthly' | 'quarterly' | 'yearly';

  // Tax
  isGiftAid: boolean;

  // Metadata
  platform?: string;
  timestamp: Timestamp;
  createdAt: Timestamp;
}
```

### Indexes Required

For optimal query performance, create these composite indexes in Firestore:

1. **campaigns**
   - `organizationId` (ASC) + `status` (ASC)
   - `organizationId` (ASC) + `raised` (DESC)
   - `organizationId` (ASC) + `endDate` (ASC)

2. **donations**
   - `organizationId` (ASC) + `timestamp` (DESC)
   - `organizationId` (ASC) + `amount` (ASC)
   - `campaignId` (ASC) + `timestamp` (DESC)

3. **kiosks**
   - `organizationId` (ASC) + `status` (ASC)

4. **giftAidExportBatches**
   - `organizationId` (ASC) + `createdAt` (DESC) + `__name__` (DESC)

---

## 🚀 Deployment Workflow

### Development

```bash
npm install
npm run dev
# Runs on http://localhost:3000
```

### Production Build

```bash
npm run build
npm start
```

### Firebase Deployment

```bash
# Deploy functions
cd backend/functions
npm run deploy

# Deploy hosting
firebase deploy --only hosting
```

---

## 📊 Key Metrics & KPIs

### Business Metrics

- Total funds raised
- Number of active campaigns
- Average donation amount
- Donor retention rate
- Campaign completion rate

### Technical Metrics

- Page load time (< 3s)
- API response time (< 500ms)
- Error rate (< 1%)
- Uptime (99.9%)
- Database read/write costs

---

## 🔮 Future Enhancements

### Planned Features

1. **Mobile App:** Native iOS/Android apps
2. **Email Campaigns:** Automated donor communications
3. **Advanced Analytics:** Predictive analytics, donor insights
4. **Multi-Currency:** Support for international donations
5. **Webhooks:** Integration with third-party services
6. **API:** Public API for external integrations
7. **White-Label:** Custom branding for organizations

### Performance Improvements

1. Expand TanStack Query usage and cache tuning for non-admin flows
2. Add service workers for offline support
3. Optimize images with WebP format
4. Implement virtual scrolling for large lists
5. Add database connection pooling

### Security Enhancements

1. Two-factor authentication (2FA)
2. Audit logging for all actions
3. Data encryption at rest
4. Regular security audits
5. GDPR compliance tools

---

## 📞 Support & Maintenance

### Monitoring

- Firebase Console for real-time metrics
- Error tracking with Sentry (recommended)
- Performance monitoring with Lighthouse
- User analytics with Google Analytics

### Backup Strategy

- Firestore automatic backups (daily)
- Manual exports for critical data
- Version control for code (Git)

### Update Process

1. Test in development environment
2. Deploy to staging
3. Run automated tests
4. Deploy to production
5. Monitor for issues

---

## 📝 Common Questions & Answers

### Q: How do organizations get paid?

**A:** Organizations connect their Stripe account during onboarding. Donations are processed through Stripe and automatically transferred to the organization's bank account according to their Stripe payout schedule.

### Q: Can one kiosk show multiple campaigns?

**A:** Yes! Kiosks can be assigned multiple campaigns. Donors can browse and select which campaign to support.

### Q: How are permissions managed?

**A:** The system uses role-based access control (RBAC). Each user has a role (super_admin, admin, manager, viewer) with specific permissions. Admins can create users and assign roles.

### Q: Is donor information secure?

**A:** Yes, all payment processing is handled by Stripe (PCI compliant). Donor information is stored in Firestore with security rules. However, we recommend implementing additional PII sanitization for production.

### Q: Can campaigns be scheduled?

**A:** Yes, campaigns have start and end dates. They can be set to activate/deactivate automatically.

### Q: How is the donation distribution calculated?

**A:** The system uses Firestore's `getCountFromServer()` to efficiently count donations in different amount ranges without downloading all documents. This is much more efficient than fetching all donations.

### Q: What happens if a kiosk goes offline?

**A:** The dashboard shows an alert for offline kiosks. Admins are notified and can investigate. Donations cannot be processed while offline.

### Q: Can donors get receipts?

**A:** Yes, Stripe automatically sends payment receipts. Organizations can also implement custom thank-you emails via Cloud Functions.

---

## 🎓 Learning Resources

### For Developers

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)

### For Admins

- User guide (to be created)
- Video tutorials (to be created)
- FAQ section (to be created)

---

**Last Updated:** April 29, 2026
**Version:** 1.1.0
**Maintained by:** SwiftCause Development Team
