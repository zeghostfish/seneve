# Epic 004 - Voting

## Phase 20: Authenticated Free Voting Foundation

Status: merged; CI validation passed.

Delivered:

- VoteAttempt aggregate and eligibility policy;
- immutable confirmed-vote persistence;
- UUID idempotency and per-voter quota;
- authenticated tenant context without Organization membership escalation;
- PostgreSQL RLS policies and audit events;
- authenticated submit and own-vote HTTP contracts;
- domain, application, HTTP and PostgreSQL-gated tests.

## Phase 21: Authenticated Ballot Experience

Status: merged; CI validation passed.

Delivered:

- authenticated ballot read contract for active `PUBLIC` and `UNLISTED` free Campaigns;
- tenant-scoped Campaign and eligible-Candidate projection;
- remaining-vote calculation based on confirmed vote facts;
- responsive ballot page using the existing in-memory access token and idempotent submission API;
- administrative Campaign link to the ballot when the Campaign is active and non-private;
- domain, application, persistence, HTTP and frontend API tests.

The ballot is a read projection and submission experience, not a new mutable aggregate. The
`VoteAttempt` aggregate remains the authoritative vote fact.

Deferred:

- anonymous admission and public voting without an authenticated Seneve identity;
- paid and hybrid voting execution;
- Payment, SMS, Fraud and verification-provider integrations;
- vote totals, rankings and public results.

No public results or vote-count projection is exposed by the ballot endpoint.

## Phase 22: Atomic Multi-Candidate Ballots

Status: implemented on `codex/voting-multiselection`; validation pending.

Delivered:

- atomic multi-Candidate submission for authenticated free Campaigns;
- per-selection UUID idempotency without a second mutable aggregate;
- Campaign-wide enforcement of `allowMultipleCandidates`;
- combined quota validation and duplicate-selection rejection;
- checkbox-based responsive Ballot interaction;
- domain, application, persistence, HTTP and frontend API tests.

Deferred:

- anonymous admission and public voting without an authenticated Seneve identity;
- paid and hybrid voting execution;
- Payment, SMS, Fraud and verification-provider integrations;
- vote totals, rankings and public results.
