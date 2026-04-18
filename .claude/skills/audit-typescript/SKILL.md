---
name: audit-typescript
description: Audit TypeScript usage for type safety, strictness, and quality.
---

# TypeScript Quality Audit

## Steps

### 1. Check tsconfig.json strictness
- `strict: true` must be enabled
- `strictNullChecks`, `noImplicitAny`, `noUncheckedIndexedAccess` — note if any are explicitly overridden
- `skipLibCheck: true` is acceptable; `skipDefaultLibCheck` is a red flag

### 2. Grep for `any` type usage
```
grep -rn ': any\b\|as any\b' src/
```
- List every instance with file:line
- Categorize: framework-forced (acceptable) vs lazy shortcut (must fix)
- Common false positives: `catch (e: any)` — prefer `catch (e)` with `instanceof` guards

### 3. Grep for suppression comments
```
grep -rn '@ts-ignore\|@ts-expect-error\|@ts-nocheck' src/
```
- Every `@ts-ignore` is a bug waiting to happen — require a reason comment or fix
- `@ts-expect-error` with an explanation is acceptable in test files only

### 4. Audit type assertions (`as X`)
- `as string` on `FormData.get(...)` — HIGH RISK, must guard null: `?? ""` or `if (!field) return`
- `token.someField as string` in NextAuth callbacks — check module augmentation instead
- `as unknown as SomeType` double-cast — always a type-safety bypass, flag CRITICAL
- `as string` on `process.env.X` — acceptable only if checked elsewhere, otherwise use `!`

### 5. Non-null assertions (`!`)
```
grep -rn '[^!]!\.' src/
```
- Flag assertions on values that could legitimately be null at runtime
- Common safe uses: refs in event handlers after DOM mount
- Common unsafe uses: `.find()` results used without null check (`items.find(...)!.id`)

### 6. JWT and session type safety (NextAuth-specific)
- Look for `session.user.id as string` — requires module augmentation in `auth.ts`
- Look for `token.id as string` — same issue
- Correct pattern: extend `Session` and `JWT` interfaces via `declare module "next-auth"`
- Check that `auth.ts` exports `Session` type extensions visible throughout the app

### 7. FormData / API boundary safety
- Every `formData.get("field")` must handle null (it returns `null` when field is absent)
- Every `searchParams.get("x")` must handle null
- Every `params.id` from route params should be validated as UUID before service call

### 8. Zod schemas and runtime types
- Service functions should not accept `any` as input
- Zod schemas in AI tools: verify `.regex()`, `.uuid()`, `.min(1)` are applied
- Check that Zod inferred types are used (`z.infer<typeof schema>`) not manual type duplication

### 9. Return type annotations
- Exported service functions should have explicit return types (not inferred)
- API route handlers should return `NextResponse<T>` with a typed `T`
- AI tool `execute()` functions should return `Promise<Record<string, unknown>>`

### 10. Wallet-specific patterns (high signal)
```
# Check for unsafe env access
grep -rn 'process\.env\.[A-Z_]*\s*||' src/

# Check for unsafe FormData
grep -rn 'formData\.get(' src/ | grep -v '?? \|null\|undefined'

# Check for double-cast
grep -rn 'as unknown as' src/

# Check for inline any
grep -rn ': any' src/ | grep -v 'catch\|//\|eslint'
```

## Report Format

| Category | Count | Severity |
|----------|-------|----------|
| `any` usage | N | HIGH if in service layer, MEDIUM elsewhere |
| `@ts-ignore` / `@ts-expect-error` | N | HIGH (unless in test files with comment) |
| Unsafe `as` casts | N | CRITICAL for `as unknown as`, HIGH for unchecked `as string` |
| Non-null assertions on find()/optional | N | HIGH |
| Missing return type on exported fn | N | LOW |
| `process.env \|\|` fallback | N | MEDIUM |

Each finding: file:line, code snippet, risk level, recommended fix.

Severity guide:
- **CRITICAL**: Type cast that could mask a runtime crash or data corruption
- **HIGH**: Missing null guard on a value that's null in production
- **MEDIUM**: Type unsafety that hasn't caused a bug yet but will under edge cases
- **LOW**: Style or annotation gap with no immediate runtime impact
