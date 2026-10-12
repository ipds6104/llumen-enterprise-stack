# 📘 Enterprise SSO & Identity Provider Integration Guide

This guide walks through configuring enterprise identity providers (IdPs) with the Llumen Enterprise Stack.

---

## 1. Integrasi rIDM (IdP Terpusat BPS)

Stack ini secara bawaan (*out-of-the-box*) telah dioptimalkan untuk terhubung dengan **rIDM** (`https://auth.dvlpid.my.id/t/bps`).

### A. Pendaftaran Client di rIDM
Daftarkan client baru di admin console rIDM:
- **Client ID**: `llumen-enterprise-app`
- **Client Type**: `Confidential (Web)`
- **Grant Types**: `authorization_code`, `refresh_token`
- **Redirect URIs**: `https://llumen.dvlpid.my.id/oauth2/callback`
- **Post-Logout Redirect URI**: `https://llumen.dvlpid.my.id/`
- **Scopes**: `openid`, `profile`, `email`

### B. Konfigurasi Environment (`.env`)
```bash
OIDC_ISSUER_URL=https://auth.dvlpid.my.id/t/bps
OIDC_CLIENT_ID=llumen-enterprise-app
OIDC_CLIENT_SECRET=<secret_dari_ridm>
OIDC_USER_CLAIM=nip
LOGOUT_REDIRECT_URL=https://auth.dvlpid.my.id/t/bps/sessions/logout?post_logout_redirect_uri=https://llumen.dvlpid.my.id
```

---

## 2. Keycloak (Standard Enterprise OIDC)

### A. Client Configuration
1. Buka Keycloak Admin Console -> Pilih Realm (misal: `master` atau `enterprise`).
2. Masuk ke **Clients** -> **Create Client**:
   - **Client type**: `OpenID Connect`
   - **Client ID**: `llumen-chat`
   - **Client authentication**: `ON` (Confidential)
   - **Valid redirect URIs**: `https://llumen.yourcompany.com/oauth2/callback`
3. Salin **Client Secret** dari tab *Credentials*.

### B. Environment (`.env`)
```bash
OIDC_ISSUER_URL=https://sso.yourcompany.com/realms/enterprise
OIDC_CLIENT_ID=llumen-chat
OIDC_CLIENT_SECRET=<keycloak_client_secret>
OIDC_USER_CLAIM=preferred_username
LOGOUT_REDIRECT_URL=https://sso.yourcompany.com/realms/enterprise/protocol/openid-connect/logout?post_logout_redirect_uri=https://llumen.yourcompany.com
```

---

## 3. Microsoft Entra ID (Azure Active Directory)

1. Buka Azure Portal -> **Microsoft Entra ID** -> **App registrations** -> **New registration**.
2. **Redirect URI (Web)**: `https://llumen.yourcompany.com/oauth2/callback`.
3. Buat Client Secret di **Certificates & secrets**.
4. Di `.env`:
```bash
OIDC_ISSUER_URL=https://login.microsoftonline.com/<TENANT_ID>/v2.0
OIDC_CLIENT_ID=<CLIENT_ID>
OIDC_CLIENT_SECRET=<CLIENT_SECRET>
OIDC_USER_CLAIM=preferred_username
```

---

## 4. SAML 2.0 Enterprise Federation (via Dex Broker)

Untuk organisasi yang mewajibkan SAML 2.0 (Active Directory ADFS, Shibboleth, Okta SAML):
1. Aktifkan overlay: `docker compose -f docker-compose.yml -f docker-compose.saml.yml up -d`.
2. Masukkan metadata IdP ke `services/auth-gateway/dex-saml.yml.example`.
3. Endpoint Assertion Consumer Service (ACS) di stack:
   `https://llumen.yourcompany.com/dex/callback`
4. SP Entity ID:
   `https://llumen.yourcompany.com/saml/metadata`
