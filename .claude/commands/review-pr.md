Review the current branch's pull request, or PR #$ARGUMENTS if a number is provided.

Dispatch the **`reviewer`** agent with the PR number (or no number to default to the current branch).

The reviewer:
1. Fetches the PR diff and metadata
2. Applies domain-specific checks (financial invariants, auth, API routes, migrations, UI)
3. Determines verdict (approve / request-changes / comment)
4. Submits a real GitHub review via `gh pr review`

Return the verdict, rationale, and GitHub review URL.
