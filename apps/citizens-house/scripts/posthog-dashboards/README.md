# PostHog Dashboard Setup

This directory contains scripts to programmatically create PostHog dashboards, cohorts, and alert definitions for the NEAR Citizens House analytics.

## Overview

The setup creates:
- **10 Dashboards** covering executive overview, web analytics, performance, verification funnels, error monitoring, UX, mobile, engagement, consent, and technical health
- **15 Cohorts** for user segmentation (verified users, platform-specific, behavioral)
- **11 Alert definitions** for monitoring critical metrics

## Prerequisites

1. **PostHog Personal API Key**
   - Go to PostHog → Settings → Personal API Keys
   - Create a new key with the following scopes:
     - `dashboard:write`
     - `insight:write`
     - `cohort:write`

2. **PostHog Project ID**
   - Find your Project ID in the PostHog URL: `https://us.posthog.com/project/<PROJECT_ID>/`

## Environment Setup

Set the required environment variables:

```bash
export POSTHOG_PERSONAL_API_KEY="phx_your_api_key_here"
export POSTHOG_PROJECT_ID="12345"
```

Or create a `.env.local` file:

```env
POSTHOG_PERSONAL_API_KEY=phx_your_api_key_here
POSTHOG_PROJECT_ID=12345
```

## Usage

### Verify Setup

Check that your environment is correctly configured:

```bash
npm run posthog:verify
# or
npx tsx scripts/posthog-dashboards/setup.ts verify
```

### List Available Resources

See all dashboards, cohorts, and alerts that can be created:

```bash
npm run posthog:list
# or
npx tsx scripts/posthog-dashboards/setup.ts list
```

### Create All Resources

Create all dashboards and cohorts:

```bash
npm run posthog:all
# or
npx tsx scripts/posthog-dashboards/setup.ts all
```

### Create Only Dashboards

```bash
npm run posthog:dashboards
# or
npx tsx scripts/posthog-dashboards/setup.ts dashboards
```

### Create Only Cohorts

```bash
npm run posthog:cohorts
# or
npx tsx scripts/posthog-dashboards/setup.ts cohorts
```

### Advanced Options

```bash
# Dry run (show what would be created without making changes)
npx tsx scripts/posthog-dashboards/setup.ts all --dry-run

# Skip existing items (don't fail if dashboard/cohort already exists)
npx tsx scripts/posthog-dashboards/setup.ts all --skip-existing

# Verbose output
npx tsx scripts/posthog-dashboards/setup.ts all --verbose

# Create a specific dashboard
npx tsx scripts/posthog-dashboards/setup.ts dashboards --dashboard="Executive Overview"

# Create a specific cohort
npx tsx scripts/posthog-dashboards/setup.ts cohorts --cohort="Verified Users"
```

## Dashboards

| # | Dashboard | Description |
|---|-----------|-------------|
| 1 | Executive Overview | High-level KPIs for stakeholders |
| 2 | Web Analytics & Traffic | Traffic sources, geography, devices |
| 3 | Performance & Web Vitals | Core Web Vitals monitoring |
| 4 | Verification Funnel | Conversion optimization |
| 5 | Error Monitoring | Error patterns and recovery |
| 6 | UX Issues & Frustration | Rage clicks, dead clicks |
| 7 | Mobile Experience | Mobile-specific flows |
| 8 | User Engagement | Lifecycle, retention, stickiness |
| 9 | Consent & Privacy | Analytics consent rates |
| 10 | Technical Health | Exception tracking |

## Cohorts

### Verification Cohorts
- Verified Users
- Desktop Verifiers
- Mobile Verifiers
- Passport Holders
- National ID Holders
- Aadhaar Holders
- New Verifications (7 days)
- Error Experiencers
- Retry Users
- High-Intent Dropoffs

### Behavioral Cohorts
- Frustrated Users (rage clicks)
- Engaged Readers
- Return Visitors
- Mobile Web Users
- Consent Granted

## Alerts

Alerts must be configured manually in PostHog after creating the insights. The script provides guidance for:

### Critical Alerts (Slack)
- Verification Complete Drop
- Error Spike
- Server Rejection Surge

### Warning Alerts (Email)
- Conversion Rate Drop
- Mobile Failure Rate
- Wallet Connect Issues
- Bounce Rate Spike
- LCP Degradation
- Rage Click Increase
- Exception Count High
- Exception Spike

## File Structure

```
scripts/posthog-dashboards/
├── README.md                    # This file
├── setup.ts                     # Main CLI script
├── api-client.ts               # PostHog API client
├── schemas.ts                  # TypeScript schemas
├── cohorts.ts                  # Cohort definitions
├── alerts.ts                   # Alert definitions
└── dashboards/
    ├── index.ts                # Dashboard exports
    ├── 01-executive-overview.ts
    ├── 02-web-analytics.ts
    ├── 03-performance-web-vitals.ts
    ├── 04-verification-funnel.ts
    ├── 05-error-monitoring.ts
    ├── 06-ux-frustration.ts
    ├── 07-mobile-experience.ts
    ├── 08-user-engagement.ts
    ├── 09-consent-privacy.ts
    └── 10-technical-health.ts
```

## API Reference

The setup uses the PostHog REST API:

- `POST /api/projects/{project_id}/dashboards/` - Create dashboard
- `POST /api/projects/{project_id}/insights/` - Create insight
- `POST /api/projects/{project_id}/cohorts/` - Create cohort
- `POST /api/projects/{project_id}/dashboards/{id}/tiles/` - Add tiles

Authentication uses a Personal API Key with Bearer token.

## Troubleshooting

### "POSTHOG_PERSONAL_API_KEY is not set"

Make sure to export the environment variable or add it to `.env.local`.

### "API connection failed"

1. Check that your API key has the required scopes
2. Verify the Project ID is correct
3. Ensure you're using the correct PostHog host (US: `us.posthog.com`)

### "Dashboard already exists"

Use the `--skip-existing` flag to skip items that already exist.

### Insight creation fails

The insight might be using an event that doesn't exist yet. Make sure the event names match what's being tracked in your application.

## Contributing

To add a new dashboard:

1. Create a new file in `dashboards/` following the naming convention
2. Define the dashboard using the `DashboardDefinition` type
3. Export it from `dashboards/index.ts`
4. Add it to the `allDashboards` array

To add a new cohort:

1. Add the definition to `cohorts.ts`
2. Add it to the `allCohorts` array

## References

- [PostHog API Documentation](https://posthog.com/docs/api)
- [PostHog Dashboards](https://posthog.com/docs/product-analytics/dashboards)
- [PostHog Cohorts](https://posthog.com/docs/product-analytics/cohorts)
- [PostHog Alerts](https://posthog.com/docs/alerts)
