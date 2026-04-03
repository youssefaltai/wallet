## Summary

<!-- What changed and why. 2-4 sentences max. -->

## Linear Issue

<!-- https://linear.app/walletai/issue/WALLET-XX -->

Closes WALLET-

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / code health
- [ ] Chore / dependency update
- [ ] Docs

## How to test

<!-- Step-by-step. What should the reviewer try? What does success look like? -->

1. 
2. 

## Screenshots

<!-- For UI changes: before / after. Delete section if not applicable. -->

## Financial invariants

<!-- If this touches services/, ledger.ts, transactions.ts, or AI tools — confirm: -->

- [ ] All balance mutations go through `ledger.ts`
- [ ] Journal entries are zero-sum
- [ ] No cached FX rates used on write paths
- [ ] Every query scopes to `userId`

<!-- Delete this section if no financial logic was touched. -->

## Checklist

- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] Migrations applied if schema changed (`pnpm db:migrate`)
- [ ] E2E test added or updated if user-facing behaviour changed
- [ ] Linear issue is set to "In Review"
