---
name: audit-routing
description: Audit Next.js page structure, routing, metadata, and component boundaries.
---

# Page Structure & Routing Audit

## Steps

1. Map the full route structure under src/app/
2. Read all layout.tsx files — check nesting and shared logic
3. Read all page.tsx files — check patterns and consistency
4. Check route groups (app) and (auth) for proper separation
5. Verify error.tsx and loading.tsx boundaries exist where needed
6. Check metadata exports on all pages (title, description)
7. Analyze server vs client component usage — look for unnecessary "use client"
8. Check data fetching patterns (server components fetching, client receiving props)
9. Verify authentication checks on all protected pages
10. Look for missing not-found.tsx pages

## Report Format

Route map with status:
```
/dashboard  [Server] [Auth:OK] [Meta:OK] [Error:Parent]
/chat       [Server] [Auth:??] [Meta:OK] [Error:Parent]
```

Issues by category: Security, SEO, UX, Architecture.
