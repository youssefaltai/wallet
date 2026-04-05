---
paths:
  - "src/lib/ai/tools/**"
  - "src/lib/ai/system-prompt.ts"
---

# AI Tool Development Rules

Rules for writing, editing, and reviewing AI tools in `src/lib/ai/tools/`.

## Tool Structure

Every tool must follow this structure:

```typescript
export const myTool = tool({
  description: 'One clear sentence. What it does, not how.',
  parameters: z.object({
    // All inputs validated with Zod
    // Dates: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format')
    // Money: use schemas from amount-schemas.ts
    // Optional fields get z.optional() with explicit description of default behavior
  }),
  execute: async ({ ...params }) => {
    const session = await cachedAuth()
    if (!session?.user?.id) throw new Error('Unauthorized')
    const userId = session.user.id

    try {
      // ... business logic via services only, never direct DB
      return { success: true, ... }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
})
```

## Rules

**1. Always validate auth at the top of `execute`.** Don't rely on the calling route for auth checks.

**2. Call services, never DB directly.** All DB access goes through `src/lib/services/`. No `db.select()` inside tool files.

**3. Money inputs from AI/users are in major units (decimals).** Convert with `toMinorUnits()` before passing to services. Return values in major units.

**4. Use amount-schemas.ts for monetary parameters.** Don't reinvent Zod schemas for currency/amount pairs — import from `src/lib/ai/tools/amount-schemas.ts`.

**5. Date parameters must be validated.** Never use `z.string()` alone for dates. Use `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`.

**6. Idempotency keys must be UUIDs.** If a tool has an `idempotencyKey` parameter, validate it: `z.string().uuid()`.

**7. Batch tools must be all-or-nothing.** Wrap batch operations in a transaction. If one item fails, roll back all.

**8. Read tools should never have side effects.** If a tool starts with `get_` or `list_`, it must be purely read.

**9. Destructive tools must note that confirmation is needed.** The system prompt handles the confirmation UX, but the tool description should say "deletes X" explicitly so the AI knows to confirm.

**10. Return structured errors, not throws.** Tools should `return { error: message }` rather than throwing from `execute`. The AI handles the error message gracefully. Only throw for auth failures.

## System Prompt Rules

The system prompt (`src/lib/ai/system-prompt.ts`) must remain static across all users and requests. This is required for Anthropic prompt caching — the cached prefix must never vary.

Do NOT:
- Inject user-specific data directly into the prompt
- Add dynamic content that changes per request

DO:
- Keep the system prompt as static instructions only
- Pass user-specific context via the memory tool results
- Pass conversation context via message history

The memory system (`{memories}` XML block) is the correct mechanism for personalization.
