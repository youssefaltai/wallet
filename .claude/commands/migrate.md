Database migration workflow: $ARGUMENTS

Dispatch the **`migrator`** agent with the schema change description.

The migrator:
1. Reads `schema.ts` fully
2. Applies the change following schema conventions
3. Runs `pnpm db:generate` to produce migration SQL
4. Reviews the SQL for safety (stops if dangerous — DROP, missing DEFAULT, etc.)
5. Applies with `pnpm db:migrate`
6. Updates all affected services, AI tools, and API routes
7. Verifies TypeScript compiles clean

Returns: migration file name, SQL summary, files updated, compile status.
