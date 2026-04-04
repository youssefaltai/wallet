Run all quality gates on the current codebase state.

Dispatch the **`checker`** agent. Return its report verbatim.

The checker runs in parallel: TypeScript, ESLint, migration sync, financial invariant grep, and E2E tests. It reports pass/fail for every gate with full details.

If all gates pass: ready to ship.
If any gate fails: report failures and stop — do not proceed to `/ship`.
