---
name: audit-api-routes
description: Audit API routes for error handling, authentication, validation, and consistency.
---

# API Route Audit

## Steps

1. Read all files in src/app/api/ recursively
2. Check every route handler for try-catch error handling
3. Check every protected route for authentication checks
4. Look for inconsistent response types (Response vs NextResponse.json)
5. Check for input validation on request bodies and query params
6. Look for hardcoded values that should be config/env
7. Check for proper HTTP method handling
8. Look for duplicated logic across routes
9. Check for rate limiting on sensitive endpoints
10. Verify routes are actually called from the frontend

## Per-Route Report

For each route file:
- **Auth**: Present / Missing / N/A
- **Error Handling**: Try-catch / Partial / None
- **Input Validation**: Complete / Partial / None
- **Issues**: Specific problems with line numbers

Summarize cross-cutting concerns (patterns, inconsistencies, missing middleware).
