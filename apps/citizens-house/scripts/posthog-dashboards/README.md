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
- Verification Funnel (8 steps: flow_started → cta_clicked → wallet_connect_succeeded → sign_completed → sumsub_sdk_loaded → sumsub_submitted → stored_onchain → success_displayed)
- User Paths (granular verification events showing user journey)
- Key metrics (total, this week, conversion rate, daily trend)
- Rejection Reasons (pie chart)
- Platform Breakdown (desktop vs mobile)

## Files

```
├── setup.ts              # CLI script
├── api-client.ts         # PostHog API wrapper
├── schemas.ts            # Zod schemas
└── dashboards/
    ├── index.ts
    └── verification-analytics.ts
```
