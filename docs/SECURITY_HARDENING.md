# 🔒 Security Hardening & Zero-Trust Architecture

This document outlines the security controls and defense-in-depth measures implemented in the Llumen Enterprise Stack.

---

## 1. Anti-Spoofing & Network Boundary Defense

Header-based authentication systems (`TRUSTED_HEADER`) are vulnerable to identity spoofing if exposed directly to clients. This stack prevents header injection attacks through multi-layered isolation:

1. **Ingress Header Stripping**:
   Traefik middleware `strip-inbound-spoofing` forcibly removes `X-Forwarded-User`, `Remote-User`, and `X-Auth-Request-*` headers from all inbound external requests before internal routing.
2. **Internal Network Isolation**:
   Llumen Core (`llumen`) and the database sidecar (`jit-provisioner`) attach exclusively to the `internal: true` Docker bridge network. They expose zero host ports. Only the hardened Traefik container can communicate with them.
3. **Verified Header Injection**:
   The `X-Forwarded-User` header is injected exclusively by `jit-provisioner` after cryptographic token verification by `auth-gateway`.

---

## 2. Unguessable Argon2id Credentials for SSO Users

When an enterprise user authenticates via SSO for the first time, `jit-provisioner` creates their record in SQLite:
- It generates a cryptographically random, non-guessable hash:
  `$argon2id$v=19$m=65536,t=3,p=4$sso_<random_salt>$<random_entropy>`
- This prevents local password bruteforcing while ensuring all access strictly routes through the enterprise Identity Provider and MFA.

---

## 3. Container Hardening & Least Privilege

- **No New Privileges**: `security_opt: ["no-new-privileges:true"]` is set across all services.
- **Non-Root Execution**: `jit-provisioner` runs under the unprivileged `bun` user (`uid=1000`).
- **Minimal Core Image**: Llumen runs as a static musl binary on a minimal `scratch` image with no shell or package managers.

---

## 4. HTTPS, HSTS & Content Security Policy

Traefik enforces:
- **HSTS**: `max-age=63072000` (2 years) with `includeSubDomains` and `preload`.
- **MIME Sniffing Prevention**: `X-Content-Type-Options: nosniff`.
- **Clickjacking Protection**: `X-Frame-Options: DENY`.
- **Referrer Policy**: `strict-origin-when-cross-origin`.
- **Robots Isolation**: `X-Robots-Tag: noindex, nofollow` to prevent search engine indexing of internal corporate LLM portals.

---

## 5. Secret Management with Infisical

For enterprise automated secret injection without committing `.env`:
```bash
infisical run --projectId f13379e0-9661-4f8e-81ef-0e81d1502da1 --env dev -- docker compose up -d
```
All secrets (`COOKIE_SECRET`, `VALKEY_PASSWORD`, `OIDC_CLIENT_SECRET`, `OPENROUTER_API_KEY`) are injected dynamically into memory.
