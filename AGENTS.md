<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agents

## auditor
Comprehensive codebase auditor. Runs 13 domain checks (security, database, AI, TypeScript, routing, services, hooks, API routes, components, CSS, config, dependencies, dead files). Produces a unified severity-ranked report.

Invoke: "audit the codebase" or a specific skill like `/audit-security`.

## fixer
Focused implementation agent. Takes a Linear issue ID (WALLET-XX) or a description, reads the relevant code, implements the minimal fix, and verifies types pass. Does not expand scope.

Invoke: "fix issue WALLET-5" or `/fix WALLET-5`.

## planner
Architecture and feature design agent. Reads the relevant code, applies appetite-bounded Shape Up thinking, and produces a structured implementation plan with files affected, risks, and definition of done. Does NOT modify files.

Invoke: "plan the recurring transactions feature" or `/feature <description>`.

# Commands

| Command | Description |
|---------|-------------|
| `/feature <desc>` | Plan + implement a feature: Linear issue → branch → code → PR |
| `/fix <issue>` | Fix a bug or audit issue: Linear issue → branch → fix → PR |
| `/ship` | Validate → push branch → open PR → set Linear to "In Review" |
| `/migrate <desc>` | Full DB migration workflow: schema → generate → review → apply |
| `/check` | Run all quality gates + financial invariant spot-check |
| `/evolve` | Self-improvement: audit .claude/ setup, fix gaps, update rules |
| `/triage` | Live audit → create Linear issues for all findings |
| `/issue <desc>` | Quick-create a Linear issue, returns `WALLET-XX` |

# Git & PR Workflow

Every change goes through a branch and a PR — never directly to `main`.

| Step | What happens |
|------|-------------|
| Start work | `git checkout -b {type}/WALLET-XX-description` |
| Implement | Commits on the branch with conventional messages |
| `/ship` | Validates → pushes → opens PR → Linear → "In Review" |
| CI | TypeScript + lint run automatically on every PR |
| Merge | Squash merge via GitHub — one commit per PR on main |
| Done | Linear issue → Done |

**Branch format:** `feat/WALLET-42-recurring-transactions`, `fix/WALLET-5-overdraft`
**PR title format:** `feat: add recurring transactions [WALLET-42]`

# Linear Integration

All planned work is tracked in Linear. Conventions:

- **Workflow**: Backlog → In Progress (branch) → In Review (PR open) → Done (merged)
- **Priority mapping**: CRITICAL=Urgent, HIGH=High, MEDIUM=Medium, LOW=Low
- **Labels**: bug, security, ai, database, ui, performance, tech-debt, feature
- `/fix` and `/feature` automatically manage the full Linear lifecycle

# Rules (contextual, auto-loaded)

| Rule file | Activates when editing |
|-----------|----------------------|
| `.claude/rules/financial-invariants.md` | services/, ai/tools/, actions.ts, api/ |
| `.claude/rules/api-routes.md` | src/app/api/ |
| `.claude/rules/ai-tools.md` | src/lib/ai/tools/, system-prompt.ts |
| `.claude/rules/services.md` | src/lib/services/ |
| `.claude/rules/migrations.md` | src/lib/db/ |
| `.claude/rules/ui-components.md` | src/app/(app)/**, src/components/**, src/hooks/** |
| `.claude/rules/linear.md` | all files — always active |
| `.claude/rules/git-workflow.md` | all files — always active |

# Hooks

| Hook | Trigger | Purpose |
|------|---------|---------|
| `session-start.sh` | Session start | Load git status, recent commits, migration state |
| `post-edit-typecheck.sh` | After Edit/Write on src/**/*.ts(x) | Run `pnpm tsc --noEmit` + `eslint <file>`, show errors immediately |
| `pre-commit-branch-guard.sh` | Before any `git commit` Bash call | Block commits to `main` unless only `.claude/`, `AGENTS.md`, or `CLAUDE.md` files are staged |
