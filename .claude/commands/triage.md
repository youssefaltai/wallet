Audit the codebase for issues and create a Linear issue for each finding.

## Step 1: Audit — dispatch `auditor` agent

Dispatch the **`auditor`** agent. It runs all 13 domain checks and returns a unified severity-ranked report.

## Step 2: Triage — dispatch `triager` agent

Dispatch the **`triager`** agent with the full audit report from step 1.

The triager:
1. Fetches existing Linear issues to deduplicate
2. Creates a Linear issue for each new finding (correct priority, labels, project)
3. Skips findings already tracked
4. Returns a summary of what was created vs skipped

## Step 3: Return

Output the triager's summary: issues created, issues skipped, total findings processed.

> Both agents can be dispatched sequentially only — triager needs the auditor's output. However, the auditor's 13 domain checks run with maximum internal parallelism.
