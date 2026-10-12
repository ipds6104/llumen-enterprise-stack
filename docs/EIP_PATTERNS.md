# 🧩 Enterprise Integration Patterns (EIP) Reference

This architecture incorporates canonical **Enterprise Integration Patterns** (Hohpe & Woolf) to modernize and enterprise-harden [pinkfuwa/llumen](https://github.com/pinkfuwa/llumen) without modifying its core upstream codebase.

---

## 1. Pipes and Filters Pattern

The ingress traffic processing pipeline operates as a sequence of decoupled filters:

```
[Inbound Request]
       │
       ▼
[Filter 1: TLS Termination & Rate Limiter] (Traefik)
       │
       ▼
[Filter 2: Anti-Spoofing Header Sanitizer] (Strips unverified claims)
       │
       ▼
[Filter 3: Authentication Gatekeeper] (OAuth2-Proxy / SAML Broker)
       │
       ▼
[Filter 4: JIT Provisioner & Content Enricher] (Bun SQLite Adapter)
       │
       ▼
[Filter 5: Core Application Processor] (Llumen Axum Engine)
```

Each filter executes a distinct transformation and passes sanitized context downstream.

---

## 2. Channel Adapter Pattern

- **Context**: Llumen natively only accepts static pre-authenticated HTTP headers (`TRUSTED_HEADER`). It has no intrinsic knowledge of complex enterprise identity protocols like SAML 2.0 assertions or OpenID Connect JSON Web Tokens.
- **Solution**: `auth-gateway` acts as a **Channel Adapter**. It adapts external enterprise auth channels (OIDC Authorization Code Flow, SAML Post Binding) into standard internal HTTP cookies and headers.

---

## 3. Message Translator Pattern

- **Context**: Enterprise Identity Providers output tokens with differing identity claims:
  - BPS rIDM uses `nip` (18-digit national employee identifier).
  - Corporate Okta / Azure AD uses `preferred_username` or `userPrincipalName`.
  - Google Workspace uses `email`.
- **Solution**: The `ForwardAuthMediator` in `jit-provisioner` translates these disparate claims into the canonical Llumen `TRUSTED_HEADER: X-Forwarded-User`.

---

## 4. Content Enricher Pattern

- **Context**: Llumen enforces a relational foreign key constraint requiring users to exist in SQLite (`user` table) before issuing a session token. Without this record, header-authenticated requests fail with `404 User not found`.
- **Solution**: `jit-provisioner` intercepts the authenticated request, checks the local data store, and dynamically **enriches** the environment by inserting the user record just-in-time with randomized unguessable password hashes and default preferences.

---

## 5. Gatekeeper & Anti-Spoofing Pattern

- **Context**: If header-based authentication is exposed directly to external networks, attackers can spoof `X-Forwarded-User: admin` and gain full unauthorized access.
- **Solution**:
  1. The Traefik edge reverse proxy is the only service binding public ports (`80/443`).
  2. Traefik explicitly strips any client-provided `X-Forwarded-User` or `Remote-User` headers.
  3. Llumen runs on an `internal: true` Docker network with zero host port exposure, ensuring only the verified Ingress pipeline can transmit identity headers.
