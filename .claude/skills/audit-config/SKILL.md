---
name: audit-config
description: Audit project configuration files for misconfigurations, missing entries, and inconsistencies.
---

# Configuration Audit

## Steps

1. Read: next.config.ts, tsconfig.json, package.json, postcss.config.mjs, eslint.config.mjs, drizzle.config.ts
2. Read: docker-compose.yml, docker/Dockerfile, docker/Caddyfile
3. Check .gitignore and .dockerignore for missing entries
4. Check for unnecessary or default config options that add noise
5. Look for misconfigurations or deprecated options
6. Check environment variable usage across all files for consistency
7. Look for config duplication (same value in multiple places)
8. Check Docker setup (multi-stage builds, pinned versions, health checks)
9. Verify scripts in package.json work correctly
10. Check for missing convenience scripts (db:migrate, db:seed, etc.)

## Per-File Report

- **Status**: Clean / Issues Found
- **Issues**: Specific problems with line numbers
- **Recommendations**: What to fix and why

Conclude with cross-file consistency analysis.
