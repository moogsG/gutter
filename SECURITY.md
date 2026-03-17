# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Instead, please report security issues by emailing the maintainer directly or using [GitHub's private vulnerability reporting](https://github.com/moogsG/gutter/security/advisories/new).

### What to include:

- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Suggested fix (if any)

### Response timeline:

- **Acknowledgment:** Within 48 hours
- **Initial assessment:** Within 1 week
- **Fix timeline:** Depends on severity, typically within 2 weeks for critical issues

### What happens next:

1. We'll confirm the vulnerability and assess severity
2. We'll work on a fix in a private branch
3. We'll release a patch and credit you (unless you prefer anonymity)
4. We'll publish a security advisory

## Security Best Practices for Deployment

- Always set `AUTH_PASSWORD_HASH` in production (never leave auth disabled)
- Use HTTPS via a reverse proxy (nginx, Caddy)
- Keep Gutter behind a firewall — it's designed for personal/small-team use
- Regularly update dependencies (`bun update`)
- Back up your databases (`scripts/backup.sh`)
- Review `gutter-security.log` for suspicious activity

## Scope

This policy covers the Gutter application code. Third-party dependencies (Ollama, whisper.cpp, accli) have their own security policies.
