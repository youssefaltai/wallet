---
paths:
  - "src/lib/auth.ts"
  - "src/app/(auth)/**"
---

# Auth Rules

Rules for modifying `src/lib/auth.ts` (NextAuth v5 config) and the auth routes in `src/app/(auth)/`.

## Use `cachedAuth()` Everywhere — Not Raw `auth()`

`src/lib/auth.ts` exports both `auth` (raw NextAuth handler) and `cachedAuth` (wrapped in React `cache()`). Always use `cachedAuth()` in Server Components and Server Actions:

```typescript
import { cachedAuth } from '@/lib/auth'

// ✓ Server Component / Server Action
const session = await cachedAuth()

// ✗ Only use raw auth() inside the NextAuth config itself and route handlers
import { auth } from '@/lib/auth'
```

`cachedAuth()` deduplicates the session call within a single request tree. Raw `auth()` re-validates on every call.

## JWT Callback — Type Safely

JWT fields must be explicitly typed via module augmentation. Never cast with `as string` without a runtime guard:

```typescript
// ✓ Correct — guard before use
if (typeof token.id === 'string') {
  user.id = token.id
}

// ✗ Wrong — cast without guard
user.id = token.id as string
```

The `next-auth.d.ts` module augmentation is the canonical place for JWT/session type extensions.

## Session Callback — Populate from JWT

Session fields must be populated from the `token` object (JWT strategy), not re-fetched from the database:

```typescript
// ✓ Correct — copy from token
session.user.id = token.id as string

// ✗ Wrong — re-fetches DB on every session access
const user = await db.query.users.findFirst(...)
```

Re-fetching in the session callback causes a DB query on every authenticated request.

## Route Authorization — `authorized` Callback

The `authorized` callback in the config handles route-level protection. It must:
1. Allow all `(auth)` routes (login, signup, verify-email) without a valid session
2. Require a valid `auth.user?.id` for all `(app)` routes
3. Return `false` (redirect to login) when session is missing on protected routes

Do not add business logic to the `authorized` callback — it's a gate check only.

## Auth Errors — Typed Classes

Use the typed error class pattern (NextAuth v5) for login errors. Do NOT return `null` or throw generic errors:

```typescript
// ✓ Correct — typed CredentialsSignin subclass
class InvalidCredentialsError extends CredentialsSignin {
  code = 'invalid_credentials'
}
throw new InvalidCredentialsError()

// ✗ Wrong — null return breaks the typed error flow
return null
```

The login page reads `error.code` to show the appropriate message. Typed errors are required for this to work correctly.

## Rate Limiting on Auth Routes

Login and signup routes must have rate limiting. Check that:
- The login API route calls `rateLimit()` before `signIn()`
- The signup route calls `rateLimit()` before creating the user
- Rate limit keys are scoped to the identifier (email or IP), not globally

## Sensitive Data — Never Log

Auth callbacks handle passwords, tokens, and session secrets. Never log:
- Raw passwords (even hashed)
- JWT tokens
- Session tokens
- User emails in error messages visible to other users
