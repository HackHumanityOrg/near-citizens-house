# PostHog Dashboard Setup

Scripts to create the Verification Analytics dashboard in PostHog.

## Quick Start

```bash
# Set environment variables (or use Doppler)
export POSTHOG_PERSONAL_API_KEY="phx_..."
export POSTHOG_PROJECT_ID="12345"

# Preview what will be created
npx tsx scripts/posthog-dashboards/setup.ts --dry-run

# Create dashboard and actions
npx tsx scripts/posthog-dashboards/setup.ts

# Delete all dashboards (reset)
npx tsx scripts/posthog-dashboards/setup.ts clean
```

## What Gets Created

**Dashboard: Verification Analytics**
- Verification Funnel (8 steps, CTA → success)
- User Paths (navigation patterns)
- Verifications by Nationality (WorldMap)
- Rejection Reasons (pie chart)
- Platform Breakdown (desktop vs mobile)
- Key metrics (total, this week, trend, conversion rate)

**Action: Desktop/Mobile OR**
- Combines `verification:qr_displayed` and `verification:deeplink_opened`
- Enables single funnel step for both desktop (QR) and mobile (deeplink) flows

## Country Code Mapping

Self.xyz returns alpha-3 codes (`USA`, `GBR`), PostHog WorldMap needs alpha-2 (`US`, `GB`).

Solution: HogQL `multiIf()` transforms codes at query time. See `country-codes.ts`.

## Files

```
├── setup.ts              # CLI script
├── api-client.ts         # PostHog API wrapper
├── schemas.ts            # Zod schemas
├── actions.ts            # Action definitions
├── country-codes.ts      # Alpha-3 → Alpha-2 mapping
├── cohorts.ts            # (unused) Cohort definitions
├── alerts.ts             # (unused) Alert definitions
└── dashboards/
    ├── index.ts
    └── verification-analytics.ts
```
