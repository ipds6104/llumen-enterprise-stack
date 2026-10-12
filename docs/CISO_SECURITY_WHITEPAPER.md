# 🛡️ CISO Security Whitepaper: Enterprise LLM Deployment

**Target Audience:** Chief Information Security Officers (CISO), SOC Leads, Cloud Security Architects, and Compliance Officers.  
**Standard Compliance:** SOC 2 Type II, ISO/IEC 27001:2022, NIST SP 800-53 Rev. 5, UU PDP (UU No. 27/2022).

---

## 1. Executive Summary & Problem Statement

Deploying internal AI interfaces ([pinkfuwa/llumen](https://github.com/pinkfuwa/llumen)) without enterprise guardrails creates severe security risks:
1. **Uncontrolled Credential Exposure**: Prompt injection leaks, hardcoded API keys.
2. **Identity Spoofing**: Trusting unauthenticated reverse proxy headers.
3. **Data Loss (PII/Secret Egress)**: Employees sending confidential citizen records or code secrets to external LLMs.
4. **Lack of Incident Response Controls**: Inability to revoke sessions or cut off LLM egress during an active threat.

This stack transforms Llumen into a hardened, compliant enterprise appliance.

---

## 2. The 8 CISO Control Dimensions

### 1. Identity & Zero-Trust Access Management
- **Enterprise SSO Enforcement**: Eliminates local passwords. All authentication terminates at the Identity Provider (OIDC PKCE / SAML 2.0).
- **Synthetic Password Generation**: Local SQLite records receive 64-byte unguessable Argon2id hashes (`$argon2id$v=19$...`), making brute-force attacks impossible.
- **Persistent Principal**: Uses persistent 18-digit NIP or immutable employee UUID as the primary identifier.

### 2. Role-Based Access Control (RBAC) & Group Scoping
- **Group Filtering (`ALLOWED_GROUPS`)**: Only employees in whitelisted Active Directory / LDAP groups (e.g. `6104`, `it-dept`, `verified-staff`) can access the gateway.
- **Tenant Scoping (`ALLOWED_TENANTS`)**: Restricts usage to designated organizational units.

### 3. Emergency Incident Response & Killswitches
- **Granular User Blocklist**: SOC analysts can immediately block compromised accounts via `/api/admin/blocklist` or `./scripts/revoke-session.sh block <user>`.
- **Global Emergency Killswitch**: Cuts off all LLM chat traffic within <10ms via `/api/admin/killswitch` during data spill incidents.
- **SCIM De-provisioning**: Terminated employees are purged from database via `/api/users/deactivate`.

### 4. Data Loss Prevention (DLP) & Model Governance
- **AI Gateway Overlay (`docker-compose.gateway.yml`)**: Routes LLM traffic through an internal gatekeeper (LiteLLM/Propylon) with regex PII masking (Indonesian NIK/NIP, Credit Cards, API Keys, RSA Private Keys).
- **Model Whitelisting**: Limits usage strictly to approved corporate models.

### 5. SIEM & Audit Trail Integration
- **Elastic Common Schema (ECS)**: Emits structured JSON events (`AUTH_SUCCESS`, `AUTH_FORBIDDEN_GROUP`, `USER_BLOCKED`, `KILLSWITCH_TRIGGERED`) compatible with Splunk, Elastic, and Wazuh.

### 6. Container Hardening & Supply Chain
- **Read-Only Root Filesystems**: Containers run with `read_only: true` and write-protected tmpfs.
- **Capability Dropping**: `cap_drop: [ALL]` across all containers.
- **Minimal Surface**: Llumen core runs from `scratch` (no shell, no libc vulnerability surface).

### 7. Anti-Spoofing & Network Perimeter
- **Ingress Header Stripping**: Traefik strips all incoming `X-Forwarded-User` headers from external clients.
- **Network Isolation**: Core workload connects only to `internal: true` network with zero host ports exposed.

### 8. Compliance Matrix

| Standard | Control ID | Implementation in Stack |
| :--- | :--- | :--- |
| **ISO 27001** | A.9.4.2 (Secure Log-on) | OAuth2-Proxy PKCE + JIT Provisioner |
| **NIST SP 800-53** | AC-3 (Access Enforcement) | RBAC Group Filter & Traefik ForwardAuth |
| **SOC 2 Type II** | CC6.1 (Logical Access) | SIEM Audit Logs + Blocklist Revocation |
| **UU PDP No. 27** | Pasal 35 (Data Protection) | AI Gateway PII Masking & Ingress TLS HSTS |
