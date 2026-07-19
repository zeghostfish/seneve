# Security Review

This document tracks the focused pre-Voting security review required by Phase 19.

## Current Status

Formal runtime-backed security review is pending.

Static architecture review indicates the following controls are implemented locally, but they still
require runtime validation:

- access-token verification through the authentication guard;
- backend-managed refresh-cookie strategy;
- CSRF origin controls;
- centralized permission evaluation;
- tenant context propagation;
- PostgreSQL RLS policy layer;
- immutable audit persistence;
- organization-scoped Campaign and Candidate APIs.

## Review Checklist

Before Voting begins, classify each item as `confirmed`, `requires correction`, or `deferred`:

- access-token handling;
- refresh-cookie attributes;
- cookie deletion compatibility;
- CSRF assumptions;
- CORS configuration;
- organization context establishment;
- permission evaluation;
- public error redaction;
- tenant isolation;
- audit persistence;
- lifecycle action authorization;
- sensitive URL-token cleanup;
- session revocation.

High-risk verified issues must be corrected before Phase 19 can close.
