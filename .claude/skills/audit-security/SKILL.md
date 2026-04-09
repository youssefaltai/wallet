---
name: audit-security
description: Audit authentication, authorization, and overall security posture.
---

# Security Audit

## Steps

### 1. Authentication — NextAuth v5 config
Read `src/lib/auth.ts` and verify:
- `authorized` callback in the `config` object guards ALL routes in `(app)/`
- `cachedAuth()` wrapper (React `cache()`) is used in Server Components and Server Actions
- `auth()` (uncached) is used only in API route handlers where caching is wrong
- JWT `secret` is set and sourced from env, not hardcoded
- `session.strategy` is `"jwt"` and expiry is explicit (`maxAge`)
- Module augmentation extends `Session` and `JWT` interfaces for `id` field — no `as string` casts

### 2. Authorization — per-route and per-action
For every API route handler in `src/app/api/`:
- Check first line calls `auth()` (or `cachedAuth()` for RSC)
- Check `if (!session?.user?.id) return NextResponse.json(..., { status: 401 })`
- Check all HTTP methods (GET, POST, PUT, DELETE, PATCH) individually — missing one method is a bypass
- Verify the handler uses `session.user.id` as the `userId` scope, never accepts `userId` from client input

For every Server Action in `src/app/(app)/actions.ts`:
- Check that `getAuthUserId()` or `cachedAuth()` is called at the top
- No action trusts form fields for `userId`

For every service function in `src/lib/services/`:
- Every query that returns user data must have `WHERE user_id = $userId` (or equivalent)
- Verify ownership checks happen at the service layer (not just at the API layer)

### 3. OTP & Email verification
Read `src/app/api/auth/` and verify:
- OTP codes are generated with `crypto.randomInt()` or equivalent — NOT `Math.random()`
- OTPs have a short expiry (≤15 minutes stored in DB)
- OTP verification enforces attempt limits (e.g., 5 attempts before invalidation)
- After successful verification, OTP is deleted from DB (not just marked used)
- Email lookup is case-insensitive (`lower(email)`) or normalized before storage

### 4. Rate limiting
Check every write route AND sensitive read route for `rateLimit()` calls:
```
grep -rn 'rateLimit\|rateLimiter\|rate-limit' src/app/api/
```
Required:
- `/api/auth/signin` — 5 per email per 15 minutes
- `/api/auth/signup` — 3 per email per hour
- `/api/auth/verify-email` — 10 per IP per 15 minutes
- `/api/chat` — per userId, not per IP (authenticated route)
- All mutation routes (POST/PUT/PATCH/DELETE) — at minimum 100/min per userId

Flag routes that are missing rate limiting entirely — list them.

### 5. Input validation
For every route and action:
- UUIDs from path params are validated (`/^[0-9a-f-]{36}$/i` or `.uuid()`) before DB lookup
- Enum values are validated against an allowlist before use in queries
- String lengths are bounded (no unbounded `z.string()` on user input)
- Currency codes validated as ISO 4217 (3-letter uppercase)
- Amount values validated as positive numbers with precision limits

### 6. Sensitive data exposure
```
# Check for passwords/tokens in logs
grep -rn 'console\.log\|console\.error' src/ | grep -iE 'password|token|secret|key|otp'

# Check for stack traces in error responses
grep -rn 'error\.stack\|\.stack' src/app/api/ src/app/\(app\)/actions.ts

# Check for PII in response bodies (should return sanitized objects)
grep -rn 'password\|salt\|hash' src/app/api/ src/app/\(app\)/actions.ts
```
- Error responses must NEVER include stack traces
- User records returned by API must exclude `password`, `salt`, any hashed fields

### 7. SQL injection prevention
- Drizzle ORM parameterizes queries by default — verify no raw `sql\`` template literals use string interpolation with user input
```
grep -rn 'sql`' src/ | grep -E '\$\{[^}]+\}'
```
- Any `sql\`` usage with dynamic parts must use parameterized placeholders, not template vars

### 8. XSS vulnerabilities
```
grep -rn 'dangerouslySetInnerHTML' src/
```
- Any `dangerouslySetInnerHTML` must sanitize with DOMPurify or equivalent
- Check that AI-generated content is never rendered without escaping

### 9. Security headers
Read `next.config.ts` or equivalent headers config:
- `Content-Security-Policy` must not allow `script-src: 'unsafe-inline'` or `'unsafe-eval'`
- `Strict-Transport-Security` must be present with `max-age ≥ 31536000`
- `X-Frame-Options: DENY` or `frame-ancestors 'none'` in CSP
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

### 10. Secrets management
```
grep -rn 'NEXTAUTH_SECRET\|DATABASE_URL\|OPENAI_API_KEY' src/ | grep -v 'process\.env'
grep -rn '"sk-\|"ey\|password.*=.*"' src/
```
- All secrets must come from `process.env` — never hardcoded
- `.env.example` should exist with placeholders, not real values
- Check `.gitignore` includes `.env*`

### 11. Financial-specific security
- Verify idempotency keys prevent duplicate journal entries on AI tool retries
- Verify balance-check + debit operations use `SELECT FOR UPDATE` (no TOCTOU)
- Verify no write operation uses cached FX rates (user must provide explicit amounts)
- Verify all `userId` scoping is done in services, not assumed from tool parameters

## Use OWASP-style ratings

- **CRITICAL**: Exploitable vulnerabilities — auth bypass, IDOR, injection, data exposure, hardcoded secrets
- **HIGH**: Missing protections — no rate limiting, weak crypto, missing null auth check
- **MEDIUM**: Defense-in-depth gaps — missing headers, incomplete validation, stack traces in errors
- **LOW**: Best practice gaps — weak CSP, missing `nosniff`, unbounded strings

Include:
1. The exact file:line of each finding
2. The attack scenario that exploits it
3. Specific remediation code or config change
