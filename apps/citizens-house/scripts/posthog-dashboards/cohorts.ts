import type { CohortDefinition } from "./schemas"

/**
 * Cohort definitions for user segmentation
 * These cohorts can be used to filter dashboards and create targeted analyses
 */

// === Verification Cohorts ===

export const verifiedUsersCohort: CohortDefinition = {
  name: "Verified Users",
  description: "Users who have completed verification (verification_status = verified)",
  groups: [
    {
      properties: [
        {
          key: "verification_status",
          value: "verified",
          operator: "exact",
          type: "person",
        },
      ],
    },
  ],
}

export const desktopVerifiersCohort: CohortDefinition = {
  name: "Desktop Verifiers",
  description: "Users who verified using the desktop platform",
  groups: [
    {
      properties: [
        {
          key: "verification_platform",
          value: "desktop",
          operator: "exact",
          type: "person",
        },
      ],
    },
  ],
}

export const mobileVerifiersCohort: CohortDefinition = {
  name: "Mobile Verifiers",
  description: "Users who verified using the mobile platform",
  groups: [
    {
      properties: [
        {
          key: "verification_platform",
          value: "mobile",
          operator: "exact",
          type: "person",
        },
      ],
    },
  ],
}

export const passportHoldersCohort: CohortDefinition = {
  name: "Passport Holders",
  description: "Users who verified with passport attestation",
  groups: [
    {
      properties: [
        {
          key: "attestation_type",
          value: "passport",
          operator: "exact",
          type: "person",
        },
      ],
    },
  ],
}

export const nationalIdHoldersCohort: CohortDefinition = {
  name: "National ID Holders",
  description: "Users who verified with national ID attestation",
  groups: [
    {
      properties: [
        {
          key: "attestation_type",
          value: "national_id",
          operator: "exact",
          type: "person",
        },
      ],
    },
  ],
}

export const aadhaarHoldersCohort: CohortDefinition = {
  name: "Aadhaar Holders",
  description: "Users who verified with Aadhaar attestation",
  groups: [
    {
      properties: [
        {
          key: "attestation_type",
          value: "aadhaar",
          operator: "exact",
          type: "person",
        },
      ],
    },
  ],
}

export const newVerificationsCohort: CohortDefinition = {
  name: "New Verifications (7 days)",
  description: "Users who verified in the last 7 days",
  groups: [
    {
      properties: [
        {
          key: "first_verification_date",
          value: "-7d",
          operator: "is_date_after",
          type: "person",
        },
      ],
    },
  ],
}

export const errorExperiencersCohort: CohortDefinition = {
  name: "Error Experiencers",
  description: "Users who saw an error during verification in the last 30 days",
  groups: [
    {
      properties: [
        {
          key: "verification:error_shown",
          value: "performed_event",
          type: "behavioral",
          event_type: "verification:error_shown",
          time_value: 30,
          time_interval: "day",
        },
      ],
    },
  ],
}

export const retryUsersCohort: CohortDefinition = {
  name: "Retry Users",
  description: "Users who clicked retry after an error in the last 30 days",
  groups: [
    {
      properties: [
        {
          key: "verification:error_retry_clicked",
          value: "performed_event",
          type: "behavioral",
          event_type: "verification:error_retry_clicked",
          time_value: 30,
          time_interval: "day",
        },
      ],
    },
  ],
}

export const highIntentDropoffsCohort: CohortDefinition = {
  name: "High-Intent Dropoffs",
  description: "Users who completed sign but did not complete verification (QR/polling friction)",
  groups: [
    {
      properties: [
        {
          key: "verification:sign_completed",
          value: "performed_event",
          type: "behavioral",
          event_type: "verification:sign_completed",
          time_value: 30,
          time_interval: "day",
        },
        {
          key: "verification:stored_onchain",
          value: "not_performed_event",
          type: "behavioral",
          event_type: "verification:stored_onchain",
          time_value: 30,
          time_interval: "day",
        },
      ],
    },
  ],
}

// === Behavioral Cohorts (Native Events) ===

export const frustratedUsersCohort: CohortDefinition = {
  name: "Frustrated Users",
  description: "Users who experienced rage clicks in the last 7 days",
  groups: [
    {
      properties: [
        {
          key: "$rageclick",
          value: "performed_event",
          type: "behavioral",
          event_type: "$rageclick",
          time_value: 7,
          time_interval: "day",
        },
      ],
    },
  ],
}

export const engagedReadersCohort: CohortDefinition = {
  name: "Engaged Readers",
  description: "Users who viewed citizens details pages in the last 30 days",
  groups: [
    {
      properties: [
        {
          key: "citizens:details_viewed",
          value: "performed_event",
          type: "behavioral",
          event_type: "citizens:details_viewed",
          time_value: 30,
          time_interval: "day",
        },
      ],
    },
  ],
}

export const returnVisitorsCohort: CohortDefinition = {
  name: "Return Visitors",
  description: "Users with more than 1 session in the last 30 days",
  groups: [
    {
      properties: [
        {
          key: "$pageview",
          value: "performed_event_multiple",
          type: "behavioral",
          event_type: "$pageview",
          time_value: 30,
          time_interval: "day",
        },
      ],
    },
  ],
}

export const mobileWebUsersCohort: CohortDefinition = {
  name: "Mobile Web Users",
  description: "Users accessing from mobile devices",
  groups: [
    {
      properties: [
        {
          key: "$device_type",
          value: "Mobile",
          operator: "exact",
          type: "person",
        },
      ],
    },
  ],
}

export const consentGrantedCohort: CohortDefinition = {
  name: "Consent Granted",
  description: "Users who granted analytics consent",
  groups: [
    {
      properties: [
        {
          key: "consent:response",
          value: "performed_event_with_property",
          type: "behavioral",
          event_type: "consent:response",
          time_value: 365,
          time_interval: "day",
        },
      ],
    },
  ],
}

// === Traffic Source Cohorts ===

export const bouncedVisitorsCohort: CohortDefinition = {
  name: "Bounced Visitors",
  description: "Users who had only one pageview in their first session (likely bounced)",
  groups: [
    {
      properties: [
        {
          key: "$pageview",
          value: "performed_event_first_time",
          type: "behavioral",
          event_type: "$pageview",
          time_value: 30,
          time_interval: "day",
        },
      ],
    },
  ],
}

export const organicTrafficCohort: CohortDefinition = {
  name: "Organic Traffic",
  description: "Users who arrived from search engines (based on referring domain)",
  groups: [
    {
      properties: [
        {
          key: "$initial_referring_domain",
          value: ["google.com", "bing.com", "duckduckgo.com", "yahoo.com", "baidu.com"],
          operator: "exact",
          type: "person",
        },
      ],
    },
  ],
}

export const paidTrafficCohort: CohortDefinition = {
  name: "Paid Traffic",
  description: "Users who arrived via UTM campaigns (has initial UTM source)",
  groups: [
    {
      properties: [
        {
          key: "$initial_utm_source",
          value: "is_set",
          operator: "is_set",
          type: "person",
        },
      ],
    },
  ],
}

// === Export all cohorts ===

export const allCohorts: CohortDefinition[] = [
  // Verification Cohorts
  verifiedUsersCohort,
  desktopVerifiersCohort,
  mobileVerifiersCohort,
  passportHoldersCohort,
  nationalIdHoldersCohort,
  aadhaarHoldersCohort,
  newVerificationsCohort,
  errorExperiencersCohort,
  retryUsersCohort,
  highIntentDropoffsCohort,
  // Behavioral Cohorts
  frustratedUsersCohort,
  engagedReadersCohort,
  returnVisitorsCohort,
  mobileWebUsersCohort,
  consentGrantedCohort,
  // Traffic Source Cohorts
  bouncedVisitorsCohort,
  organicTrafficCohort,
  paidTrafficCohort,
]

export const cohortNames = allCohorts.map((c) => c.name)
