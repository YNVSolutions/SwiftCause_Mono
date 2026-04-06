# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Authenticated admin change-password flow with current-password reauthentication, password policy validation, and inline success/error feedback.

### Changed

- Moved the admin change-password UI into a dedicated modal with show/hide password toggles and improved small-screen responsiveness.

## [0.1.0] - 2026-03-20

### Added

- Initial public release of SwiftCause.
- Authentication flows for forgot-password requests and password resets.
- Gift Aid declaration support and related admin workflow updates.
- GitHub issue templates for bug reports, feature requests, and questions.
- A pull request template for contributor submissions.
- Dependabot configuration for npm and GitHub Actions updates.

### Changed

- Tightened Stripe onboarding and webhook authorization handling.
- Renamed `LICENCE` to `LICENSE` for GitHub license detection.

### Removed

- Tracked `dist/` build artifacts and stray root-level development files.
