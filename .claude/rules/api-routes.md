---
paths:
  - "src/app/api/**"
---

# API Route Rules

Rules for writing and modifying REST endpoints in `src/app/api/`.

## Auth — Every Handler, Every Method

Every HTTP method on every route must authenticate before any logic runs:

```typescript
const session = await auth()
if (!session?.user?.id) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
const userId = session.user.id
```

No exceptions. A route file where `DELETE` checks auth but `GET` does not is a security bug.

## Rate Limiting — Write Routes Always, Read Routes if Scrapeable

Apply `rateLimit()` to:
- All mutating methods (POST, PUT, PATCH, DELETE)
- GET routes that return user data or could be scraped

If the project has a `rateLimit()` utility, use it. If not, the pattern should be implemented before shipping.

## Input Validation

Validate all inputs at the route boundary before passing to services:

```typescript
// UUID fields
const id = params.id
if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
  return Response.json({ error: 'Invalid ID' }, { status: 400 })
}

// FormData fields
const value = formData.get('field')
if (typeof value !== 'string' || value.trim() === '') {
  return Response.json({ error: 'Missing field' }, { status: 400 })
}
```

Never cast `formData.get('x') as string` without a null/type check — `FormData.get` returns `string | File | null`.

## HTTP Status Codes

Use the correct status for each response:

| Situation | Status |
|-----------|--------|
| Missing/invalid auth | 401 |
| Authenticated but not authorized | 403 |
| Resource not found | 404 |
| Invalid input | 400 |
| Success with body | 200 |
| Created | 201 |
| Server error | 500 |

## No Stack Traces to the Client

Never return `error.stack`, raw `Error` objects, or internal error messages to the client:

```typescript
// ✓ Correct
return Response.json({ error: 'Internal server error' }, { status: 500 })

// ✗ Wrong — leaks internals
return Response.json({ error: error.message }, { status: 500 })
```

Log the full error server-side (`console.error(error)`) but send a generic message to the client.

## User Data Isolation

Route handlers must scope all data access to `userId`. Never query by resource ID alone — always AND with the userId:

```typescript
// ✓ Correct — calls service which scopes to userId
const account = await getAccount(db, userId, accountId)

// ✗ Wrong — no userId scoping
const account = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId) })
```

All queries must go through `src/lib/services/` — no raw DB access in route handlers.

## Route File Structure

```typescript
export async function GET(request: Request) {
  // 1. Auth
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  // 2. Rate limit (if applicable)
  // 3. Parse and validate input
  // 4. Call service
  // 5. Return response
}

export async function POST(request: Request) {
  // Same pattern
}
```
