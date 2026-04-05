---
name: audit-security
description: Audit authentication, authorization, and overall security posture.
---

# Security Audit

## Steps

1. Read src/lib/auth.ts and all files in src/app/(auth)/
2. Check session management (JWT config, expiration, refresh strategy)
3. Verify every API endpoint has proper auth checks
4. Check for CSRF protection
5. Look for sensitive data exposure (passwords, tokens in URLs/logs/responses)
6. Check for proper input sanitization
7. Verify SQL injection prevention (parameterized queries)
8. Check for XSS vulnerabilities (dangerouslySetInnerHTML, unescaped rendering)
9. Look for hardcoded secrets in source code
10. Check security headers (CSP, HSTS, X-Frame-Options)
11. Verify rate limiting on sensitive endpoints
12. Check OTP security (generation method, expiration, attempt limiting)
13. Review password handling (hashing, salt rounds, complexity)

## Use OWASP-style ratings

- **CRITICAL**: Exploitable vulnerabilities (auth bypass, injection, data exposure)
- **HIGH**: Missing protections (no rate limiting, weak crypto)
- **MEDIUM**: Defense-in-depth gaps (missing headers, incomplete validation)
- **LOW**: Best practice improvements

Include attack scenarios and specific remediation steps.
