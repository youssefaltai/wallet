Self-improvement session. Review and evolve the Claude setup for this project.

Work through this systematically:

## 1. Audit the current setup

Read every file in `.claude/`:
- `settings.json` and `settings.local.json` — are permissions still accurate? Any stale entries?
- `hooks/` — are hooks working as intended? Any that should be added or removed?
- `rules/` — do the rules cover current active development areas? Are any rules stale?
- `agents/` — are all agents still needed? Are their descriptions accurate?
- `commands/` — are all commands still useful? Are any missing?
- `skills/` — are all 13 audit skills current? Does the audit-guide.md need updating?
- `audit-guide.md` — have any known issues been fixed? Mark them resolved.

## 2. Review memory for patterns

Read `/Users/youssef/.claude/projects/-Users-youssef-wallet/memory/MEMORY.md` and all linked files.

Look for:
- Recurring mistakes → should become a rule in `.claude/rules/`
- Repeated confirmations needed → should become pre-approved in `settings.local.json`
- Patterns the user has corrected → should be reinforced as rules
- Stale memories → should be updated or deleted

## 3. Review recent git history

Run `git log --oneline -20` and `git log --oneline -20 -- .claude/`

Look for:
- What types of work have been most common recently?
- Are there rules that should be added for patterns in the recent changes?
- Are there hooks that should validate common change types?

## 4. Identify the highest-value gap

Based on the above, what single addition or change to `.claude/` would have the most positive impact on development velocity or quality? State it explicitly before implementing.

## 5. Implement the improvements

Make the changes you identified. For each change:
- State what you're changing and why
- Make the edit
- If it's a new rule, ensure the `paths` frontmatter targets the right files
- If it's a new hook, make the script executable

## 6. Update AGENTS.md

Update `/Users/youssef/wallet/AGENTS.md` to reflect any agents or commands that changed.

## 7. Commit

`.claude/` config changes are the one exception to the no-direct-commits-to-main rule — they configure the agent environment, not the product. Commit directly to main:

```bash
git add -f .claude/ AGENTS.md CLAUDE.md
git commit -m "chore(.claude): [brief summary of what evolved]"
```

Report: what changed, why, and what problem it solves.
