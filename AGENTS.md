<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent Architecture

The main conversation thread is an **orchestrator only**. It receives user requests, decomposes them into tasks, and dispatches specialized agents. It never does the work itself.

Every task is handled by a dedicated agent. Agents run in parallel whenever their inputs are independent.

## Agent Team

| Agent | Role | Tools |
|-------|------|-------|
| `planner` | Designs implementation plans. Reads code, maps files to change, estimates appetite, identifies risks. Does NOT modify files. | Read, Grep, Glob, Bash |
| `implementer` | Executes a plan from `planner`. Writes code in dependency order (schema → services → tools → routes → UI → tests). | Read, Write, Edit, Bash, Glob, Grep |
| `fixer` | Implements a specific bug fix. Traces root cause, makes the minimal change. | Read, Write, Edit, Bash, Glob, Grep |
| `migrator` | Handles DB schema changes. Edits schema.ts, generates + reviews migration SQL, applies it, updates all dependent files. | Read, Write, Edit, Bash, Glob, Grep |
| `checker` | Runs all quality gates: TypeScript, ESLint, migration sync, financial invariant grep, E2E tests. Returns pass/fail per gate. | Bash, Glob, Grep, Read |
| `shipper` | Pushes branch + creates PR with full metadata (title, labels, body, assignee, reviewer). Returns PR number and URL. | Bash |
| `reviewer` | Reviews a PR diff with domain-specific checks, then submits `gh pr review` (approve / request-changes / comment). | Bash, Glob, Grep, Read |
| `auditor` | 13-domain codebase audit. Produces a unified severity-ranked findings report. | Read, Grep, Glob, Bash |
| `triager` | Takes audit findings and creates Linear issues. Deduplicates, sets priority/labels/project correctly. | Bash, Glob, Grep, Read |

## Parallelism rules

Run agents in parallel when their inputs don't depend on each other:

```
/feature:  planner ∥ Linear lookup  →  [migrator?] →  implementer  →  checker  →  shipper → reviewer
/fix:      Linear lookup  →  fixer  →  checker  →  shipper  →  reviewer
/ship:     checker  →  shipper  →  reviewer
/triage:   auditor  →  triager
```

## Commands

| Command | What the orchestrator does |
|---------|---------------------------|
| `/feature <desc>` | Dispatches `planner` ∥ Linear lookup → confirms plan → [`migrator`?] → `implementer` → `checker` → `shipper` → `reviewer` |
| `/fix <issue>` | Linear lookup → branch → `fixer` → `checker` → `shipper` → `reviewer` |
| `/ship` | `checker` → `shipper` → Linear update → `reviewer` |
| `/review-pr [number]` | Dispatches `reviewer` with PR number (or current branch) |
| `/migrate <desc>` | Dispatches `migrator` |
| `/check` | Dispatches `checker` |
| `/triage` | `auditor` → `triager` |
| `/evolve` | Self-improvement: audits `.claude/` setup, fixes gaps, commits to main |
| `/issue <desc>` | Creates a Linear issue via MCP, returns `WALLET-XX` |

# Git & PR Workflow

Every change goes through a branch and a PR — never directly to `main`.

| Step | What happens |
|------|-------------|
| Start work | `git checkout -b {type}/WALLET-XX-description` |
| Implement | Commits on the branch via `implementer` or `fixer` |
| `/ship` | `checker` → `shipper` → PR opened → Linear "In Review" → `reviewer` self-reviews |
| Review | `reviewer` submits `gh pr review` (approve / request-changes / comment) |
| Fix & re-review | Address review issues on branch → push → `checker` → `reviewer` again |
| Merge | Squash merge via GitHub — one clean commit per PR on main |
| Done | Linear issue → Done |

**Branch format:** `feat/WALLET-42-recurring-transactions`, `fix/WALLET-5-overdraft`
**PR title format:** `feat: add recurring transactions [WALLET-42]`

# Linear Integration

All planned work is tracked in Linear:

- **Workflow**: Backlog → In Progress (branch) → In Review (PR open) → Done (merged)
- **Priority**: CRITICAL=Urgent, HIGH=High, MEDIUM=Medium, LOW=Low
- **Labels**: bug, security, ai, database, ui, performance, tech-debt, feature
- Linear state transitions happen in the orchestrator (main thread), not in agents

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
