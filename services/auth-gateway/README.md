# 🛡️ Services: Auth Gateway (OAuth2-Proxy / SAML Bridge)

The Auth Gateway terminates enterprise SSO authentication flows and acts as an **Enterprise Integration Pattern: Channel Adapter**.

---

## 🎯 Architecture & Responsibilities

1. **Protocol Termination**: Terminates OpenID Connect (OIDC) Authorization Code Flow with PKCE, or SAML 2.0 via Identity Broker.
2. **Session Life-Cycle**: Secure HTTP-only encrypted cookies stored either in client cookies or in distributed **Valkey** (Redis-compatible).
3. **Claim Forwarding**: Injects verified claims (`X-Auth-Request-User`, `X-Auth-Request-Email`, `X-Auth-Request-Groups`) to downstream services (`jit-provisioner`).

---

## ⚙️ Configuration Variables

| Variable | Description | Example |
| :--- | :--- | :--- |
| `OIDC_ISSUER_URL` | OIDC Issuer discovery endpoint | `https://auth.dvlpid.my.id/t/bps` |
| `OIDC_CLIENT_ID` | Client ID registered at IdP | `llumen-enterprise-app` |
| `OIDC_CLIENT_SECRET` | Client Secret from IdP | `******` |
| `OIDC_USER_CLAIM` | Claim mapped to Llumen username | `nip` (or `preferred_username`) |
| `COOKIE_SECRET` | 32-byte base64 encryption key | `openssl rand -base64 32` |
| `VALKEY_PASSWORD` | Password for Valkey cache | `******` |

---

## 🔄 Supported Identity Providers

- **rIDM (BPS Regional IdP)**: `https://auth.dvlpid.my.id/t/bps` (Native OIDC & SAML 2.0).
- **Keycloak**: Standard OIDC Realm (`http://keycloak:8080/realms/enterprise`).
- **Microsoft Entra ID (Azure AD)**: `https://login.microsoftonline.com/<tenant-id>/v2.0`.
- **Okta / Auth0**: Standard OIDC Applications.
- **SAML 2.0 Enterprise IdPs**: Via Dex SAML connector or Keycloak Identity Broker.
