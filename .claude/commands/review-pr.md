Review the current branch's pull request, or a specific PR if a number is provided as $ARGUMENTS. After analysis, **submit a real GitHub review** — approve, request changes, or comment — using `gh pr review`.

## 1. Identify the PR

```bash
# If $ARGUMENTS is a PR number, use it. Otherwise, use the current branch.
gh pr view ${ARGUMENTS:-""} --json number,title,body,files,additions,deletions,commits,baseRefName,headRefName,statusCheckRollup,reviews
gh pr diff ${ARGUMENTS:-""}
```

Note which **domains** the changed files touch — this determines which checks apply.

## 2. Check CI

```bash
gh pr checks ${ARGUMENTS:-""} 2>/dev/null || echo "(no CI configured)"
```

## 3. Apply domain-specific review checks

Work through every applicable check. Read the actual diff lines — don't guess.

**If `src/lib/services/` or `src/lib/ai/tools/` changed — Financial invariants:**
- All balance mutations go through `createJournalEntry` in `ledger.ts`? (no direct `db.insert(journalLines)` or `db.update(accounts)`)
- Every multi-step write wrapped in `db.transaction()`?
- Every query scoped to `userId`? (no bare `where(eq(table.id, id))` without AND userId)
- No cached FX rates on write operations?
- Monetary values converted with `toMinorUnits()`/`toMajorUnits()` at every boundary?
- New service functions: `userId` is the second parameter?

**If `src/app/api/` changed — API route correctness:**
- Every HTTP method (GET, POST, PUT, PATCH, DELETE) checks auth before any logic?
- Write methods call `rateLimit()`?
- No stack traces or internal error messages in responses?
- All inputs validated (UUID format, type, length)?
- Correct HTTP status codes (401 unauth, 403 forbidden, 404 not found, 400 bad input)?

**If `src/lib/auth.ts` or `src/app/(auth)/` changed — Auth correctness:**
- Auth errors use typed error classes (like `RateLimitError extends CredentialsSignin`), not raw `null` returns?
- Rate limiting present on login/signup?
- No sensitive data (passwords, tokens) in logs or responses?

**If `src/lib/db/schema.ts` or migrations changed — Migration safety:**
- No unintended `DROP COLUMN` or `DROP TABLE`?
- New `NOT NULL` columns have `DEFAULT` values?
- FK columns have corresponding indexes?
- Migration SQL file is in `_journal.json`?

**If `src/components/` or `src/app/(app)/` changed — UI correctness:**
- No DB or service imports in `"use client"` files?
- `cachedAuth()` used instead of raw `auth()` in Server Components and actions?
- Dashboard (`src/app/(app)/dashboard/`) has no mutation buttons added?
- `useEffect` data fetches have `AbortController` cleanup?

**Always check:**
- No `: any` type annotations or `@ts-ignore` suppressions?
- No `as unknown as SomeType` double-casts?
- No `.env*` file changes?
- If behavior changed: does it need a new E2E test in `tests/`?
- Existing tests still pass? If tests were touched, are the assertions correct?

## 4. Determine verdict

| Condition | Verdict |
|-----------|---------|
| Any CRITICAL or HIGH issue | REQUEST CHANGES |
| Only MEDIUM / LOW issues | COMMENT |
| No issues | APPROVE |

## 5. Submit the GitHub review

Compose a single review body covering all findings, then submit it with the appropriate `gh pr review` subcommand. Use the PR number from step 1.

**If APPROVE:**
```bash
gh pr review {number} --approve --body "$(cat <<'EOF'
[2-3 sentence summary of what was reviewed and why it's clean]

**Checked:**
- [domain]: [what was verified]
- ...

No issues found — ready to merge.
EOF
)"
```

**If REQUEST CHANGES:**
```bash
gh pr review {number} --request-changes --body "$(cat <<'EOF'
[2-3 sentence summary]

**Issues that must be fixed before merging:**

### [Issue 1 title] — [file:line]
[Description, why it matters, what the fix looks like]

### [Issue 2 title] — [file:line]
...

**Clean areas:** [list what was fine]
EOF
)"
```

**If COMMENT (MEDIUM/LOW only):**
```bash
gh pr review {number} --comment --body "$(cat <<'EOF'
[2-3 sentence summary]

**Findings (non-blocking):**

### [Issue 1 title] — [file:line]
[Description and suggested improvement]

**Clean areas:** [list what was fine]
EOF
)"
```

## 6. Report the outcome

After submitting, output:
- The verdict and a one-line rationale
- The GitHub review URL (from `gh pr view {number} --json reviews`)
- What needs to happen next (e.g. "address the 2 issues above and re-request review")
