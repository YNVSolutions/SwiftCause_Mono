<div align="center">
  <img src="./logo.png" alt="SwiftCause Logo" width="250" height="250">

  <h1>SwiftCause</h1>

  <p>A modern donation platform for UK-based nonprofits.</p>

  <p>
    <a href="https://swift-cause-web.vercel.app"><img src="https://img.shields.io/badge/deployment-Vercel-black.svg?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel Deployment"></a>
    <img src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" alt="React">
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/firebase-%23FFCA28.svg?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase">
    <img src="https://img.shields.io/badge/stripe-%23626CD9.svg?style=for-the-badge&logo=stripe&logoColor=white" alt="Stripe">
  </p>
</div>

---

## Key Features

- Nonprofit campaign management with admin tooling
- Stripe-powered one-time and recurring donations
- Gift Aid declaration support
- Kiosk donation flows for in-person fundraising
- Analytics, campaign reporting, and user management

## Live Demo

The project is deployed at [SwiftCause](https://swiftcause--swiftcause-app.us-east4.hosted.app/).

## Contributor Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or later for the frontend
- Node.js v22 for Firebase Functions compatibility
- [npm](https://www.npmjs.com/)
- [Firebase CLI](https://firebase.google.com/docs/cli)

### 1. Install dependencies

```bash
npm install
cd backend/functions
npm install
cd ../..
```

### 2. Create `.env.local`

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=...
```

These values are client-side configuration. Do not commit server secrets, Firebase admin credentials, Stripe secret keys, or reCAPTCHA secret keys.

### 3. Run the Firebase emulator

From `backend`:

```bash
firebase emulators:start
```

If you only want the Functions emulator:

```bash
cd backend/functions
npm run serve
```

### 4. Run the frontend

From the repository root:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### 5. Run contributor checks

From the repository root:

```bash
npm run lint
npm run format:check
npm run build
npm run test:run
```

Note:

- `npm run test:run` now runs the Vitest suite with coverage.
- The repository still has a backlog of pre-existing lint and formatting issues outside the latest tooling additions.

## Product Flows

For contributor-facing product behavior, start with these docs:

- [Authentication Flow](./docs/AUTHENTICATION_FLOW.md)
- [Donation Flow](./docs/DONATION_FLOW.md)
- [Admin Flow](./docs/ADMIN_FLOW.md)
- [Gift Aid Flow](./docs/GIFTAID_FLOW.md)

High-level flow overview:

- Authentication: signup, login, email verification, forgot password, reset password
- Donation: campaign selection, donor details, payment, recurring donations, result screens
- Admin: dashboard access, campaign management, user management, kiosk management, Stripe onboarding
- Gift Aid: donor declaration capture, storage, admin review, and export/reporting workflows

## Architecture

SwiftCause uses a Next.js App Router frontend with Feature-Sliced Design modules under `src/`, plus Firebase Functions under `backend/functions`.

Start here:

- [Architecture Diagrams](./docs/ARCHITECTURE_DIAGRAMS.md)
- [FSD Architecture](./docs/FSD/FSD_ARCHITECTURE.md)
- [Project Workflow](./docs/PROJECT_WORKFLOW.md)

## Project Structure

```text
app/                 Next.js route entrypoints and layouts
src/views/           Route-level screen composition
src/widgets/         Composite UI blocks
src/features/        User workflows and feature logic
src/entities/        Domain entities and related UI/model code
src/shared/          Shared UI, config, API helpers, and utilities
backend/functions/   Firebase Cloud Functions and webhook handlers
docs/                Contributor and architecture documentation
```

## Tech Stack

| Area      | Technology                                   |
| :-------- | :------------------------------------------- |
| Framework | Next.js 16                                   |
| Frontend  | React 19                                     |
| Language  | TypeScript                                   |
| Styling   | Tailwind CSS 4                               |
| Backend   | Firebase                                     |
| Payments  | Stripe                                       |
| Tooling   | ESLint, Prettier, Vitest, Husky, lint-staged |

## Development Workflow

1. Branch from `main`.
2. Keep changes focused.
3. Run local checks before opening a PR.
4. Use Conventional Commits.
5. Open a PR with the repository template.

The pre-commit hook runs `lint-staged` on changed files only.

## Contributing

Use these contributor docs:

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [ROADMAP.md](./ROADMAP.md)
- [CHANGELOG.md](./CHANGELOG.md)
- [SUPPORT.md](./SUPPORT.md)

## Visual Studio Code

Recommended extensions are tracked in:

- [`.vscode/extensions.json`](./.vscode/extensions.json)

Workspace settings are tracked in:

- [`.vscode/settings.json`](./.vscode/settings.json)

For debugging Next.js in VS Code, use the built-in Node.js and browser debuggers through your local `launch.json`.

## Troubleshooting

### PowerShell blocks `npm` or `npx`

If PowerShell script execution blocks `npm` or `npx`, use `npm.cmd` or `npx.cmd` instead.

### Firebase emulator issues

- Run `firebase login` first
- Make sure you are targeting the correct Firebase project
- Confirm `backend/firebase.json` exists and Functions dependencies are installed

### Build and test expectations

- `npm run build` is important because it catches production and type issues that unit tests do not
- Some payment and webhook flows still depend on external Stripe test configuration even in local development

## License

This project is distributed under the license found in the [LICENSE](./LICENSE) file.

## Contributors

<a href="https://github.com/YNVSolutions/SwiftCause_Web/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=YNVSolutions/SwiftCause_Web" alt="Contributors">
</a>

