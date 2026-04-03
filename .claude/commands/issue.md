Create a Linear issue: $ARGUMENTS

Quickly create a single Linear issue and return the issue identifier so it can be referenced in commits.

## Steps

1. **Parse the arguments** — the input is a free-form description of the issue. Extract:
   - A concise title (≤70 chars)
   - Type: bug / feature / security / tech-debt / chore (infer from context)
   - Priority: infer from urgency signals in the description (Urgent/High/Medium/Low)

2. **Fetch team and project** — call `list_teams` and `list_projects` to get the Wallet team and project IDs

3. **Fetch state** — call `list_issue_statuses` to get the Backlog state ID (or Todo if the user signals they're starting now)

4. **Fetch labels** — call `list_issue_labels` to find the right label IDs for the issue type

5. **Check for duplicates** — call `list_issues` and scan titles for similar issues. If a near-duplicate exists, show it and ask whether to create a new one or use the existing one.

6. **Create the issue** — call `save_issue` with:
   - title: concise title from step 1
   - description: full description from the arguments, expanded with any relevant context
   - priority: from step 1
   - label IDs: from step 4
   - state: Backlog (or Todo if starting now)
   - project: Wallet project

7. **Return the identifier** — output the Linear issue ID (e.g. `WALLET-42`) prominently so it can be copied into a commit message

## Usage examples

```
/issue users can't update their profile currency without refreshing
/issue [security] session tokens stored in localStorage, should use httpOnly cookies
/issue recurring transactions feature — detect and suggest recurring patterns from history
```
