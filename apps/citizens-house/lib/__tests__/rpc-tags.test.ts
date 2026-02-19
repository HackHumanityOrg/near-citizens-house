import {
  citizensTags,
  getGovernanceInvalidationTags,
  getVerificationMutationRevalidateTags,
  governanceTags,
  normalizeCitizensPagination,
  normalizeGovernanceAdminsPagination,
  normalizeGovernanceBlocklistPagination,
  normalizeGovernanceProposalsPagination,
  normalizeGovernancePublicProposalsPagination,
  normalizeGovernanceVotesPagination,
  verificationTags,
} from "../cache/rpc-tags"

describe("rpc-tags helpers", () => {
  it("normalizes proposal pagination to supported page sizes", () => {
    expect(normalizeGovernanceProposalsPagination({ page: -2, pageSize: 999 })).toEqual({ page: 0, pageSize: 10 })
    expect(normalizeGovernanceProposalsPagination({ page: 3.8, pageSize: 9 })).toEqual({ page: 3, pageSize: 9 })
  })

  it("normalizes other paginations to fixed sizes", () => {
    expect(normalizeGovernancePublicProposalsPagination({ page: 1, pageSize: 10 })).toEqual({ page: 1, pageSize: 9 })
    expect(normalizeGovernanceVotesPagination({ page: 0, pageSize: 99 })).toEqual({ page: 0, pageSize: 10 })
    expect(normalizeGovernanceAdminsPagination({ page: 0, pageSize: 10 })).toEqual({ page: 0, pageSize: 100 })
    expect(normalizeGovernanceBlocklistPagination({ page: 0, pageSize: 10 })).toEqual({ page: 0, pageSize: 100 })
    expect(normalizeCitizensPagination({ page: 0, pageSize: 25 })).toEqual({ page: 0, pageSize: 10 })
  })

  it("returns proposal and vote tags for vote_cast invalidation", () => {
    const tags = getGovernanceInvalidationTags({ op: "vote_cast", proposalId: 42 })

    expect(tags).toContain(governanceTags.root)
    expect(tags).toContain(governanceTags.proposals)
    expect(tags).toContain(governanceTags.publicProposals)
    expect(tags).toContain(governanceTags.votes)
    expect(tags).toContain(governanceTags.proposal(42))
    expect(tags).toContain(governanceTags.proposalVotes(42))
    expect(tags).toContain(governanceTags.pendingVotesForProposal(42))
  })

  it("returns citizens-impact tags for blocklist updates", () => {
    const tags = getGovernanceInvalidationTags({ op: "blocklist_update" })

    expect(tags).toContain(governanceTags.blocklist)
    expect(tags).toContain(governanceTags.blocklistAll)
    expect(tags).toContain(citizensTags.pages)
  })

  it("returns verification mutation tags for route handlers", () => {
    const tags = getVerificationMutationRevalidateTags()

    expect(tags).toContain(verificationTags.root)
    expect(tags).toContain(verificationTags.pages)
    expect(tags).toContain(verificationTags.summaries)
    expect(tags).toContain(citizensTags.pages)
  })
})
