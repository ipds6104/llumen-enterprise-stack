# 🏛️ Architecture: Llumen Enterprise Container Stack

This document details the high-assurance, enterprise-grade architecture for self-hosting **Llumen** ([pinkfuwa/llumen](https://github.com/pinkfuwa/llumen)) with SSO (OIDC/SAML 2.0), JIT Provisioning, and Zero-Trust Edge Security.

---

## 📐 High-Level Component Topology

```mermaid
flowchart TD
    Client["Client Browser / Employee Desktop"] -->|HTTPS :443| Ingress["Traefik Edge Ingress\n(TLS & Anti-Spoofing Filter)"]
    
    subgraph ZeroTrustNetwork ["Internal Isolated Network"]
        Ingress -->|ForwardAuth Check| JIT["JIT Provisioner & Mediator\n(EIP Content Enricher)"]
        JIT -->|Verify Session| AuthGateway["OAuth2-Proxy / SAML SP\n(EIP Channel Adapter)"]
        AuthGateway -->|Token / Session Cache| Valkey[("Valkey 8.0\nSession Store")]
        
        JIT -->|Auto-provision / Check| SQLite[("Llumen SQLite\n/data/db.sqlite")]
        
        Ingress -->|Enriched Traffic\nX-Forwarded-User| Llumen["Llumen Core\n(Rust Axum Engine)"]
        Llumen --> SQLite
        Llumen --> Redb[("Blobs Redb\n/data/blobs.redb")]
        Llumen -->|Inference Stream| UpstreamLLM["OpenRouter / Enterprise vLLM"]
    end
    
    subgraph EnterpriseIdP ["Enterprise Identity Layer"]
        AuthGateway -->|OIDC PKCE / SAML 2.0| rIDM["rIDM / Keycloak / Entra ID\n(auth.dvlpid.my.id/t/bps)"]
    end
```

---

## 🔄 Authentication & JIT Provisioning Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User as Employee Browser
    participant Ingress as Traefik Ingress
    participant JIT as JIT Provisioner
    participant Auth as OAuth2-Proxy
    participant IdP as Enterprise IdP (rIDM)
    participant Core as Llumen Core (/backend)
    participant DB as SQLite (db.sqlite)

    User->>Ingress: GET https://llumen.company.com/
    Ingress->>JIT: ForwardAuth Request (/auth)
    JIT->>Auth: Verify Session (/oauth2/auth)
    
    alt Unauthenticated / No Cookie
        Auth-->>JIT: 401 Unauthorized
        JIT-->>Ingress: 401 / Redirect to IdP
        Ingress-->>User: 302 Redirect to /oauth2/start
        User->>IdP: Authenticate (NIP, MFA, Passkey)
        IdP-->>User: Authorization Code Callback
        User->>Auth: /oauth2/callback
        Auth-->>User: Set-Cookie _llumen_sso
    else Authenticated Session
        Auth-->>JIT: 200 OK (X-Auth-Request-User: 199503112022031001)
        JIT->>DB: SELECT * FROM user WHERE name = '199503112022031001'
        alt User Does Not Exist (First Login)
            JIT->>DB: INSERT INTO user (name, password, preference)
            Note over JIT,DB: User JIT-provisioned seamlessly
        end
        JIT-->>Ingress: 200 OK (X-Forwarded-User: 199503112022031001)
        Ingress->>Core: Forward request with X-Forwarded-User
        Core->>DB: Verify user & issue Paseto token
        Core-->>User: 200 OK (Llumen Chat UI Loaded)
    end
```

---

## 💎 SOLID Principles Application

1. **Single Responsibility Principle (SRP)**:
   - `Traefik`: Only handles edge routing, TLS certificates, and rate limiting.
   - `OAuth2-Proxy`: Only terminates SSO tokens, cookies, and IdP handshakes.
   - `JIT Provisioner`: Only bridges user identities and provisions database records.
   - `Llumen Core`: Only handles chat completion streaming and prompt management.
2. **Open/Closed Principle (OCP)**:
   - Pluggable auth profiles (`docker-compose.saml.yml`, `docker-compose.dev.yml`) extend functionality without altering core services.
3. **Liskov Substitution Principle (LSP)**:
   - Traefik ForwardAuth and OAuth2-Proxy satisfy standard HTTP specifications and can be substituted with any compliant enterprise gateway.
4. **Interface Segregation Principle (ISP)**:
   - Administrative hooks (`/api/users`) and metric endpoints are segregated from public end-user ingress paths.
5. **Dependency Inversion Principle (DIP)**:
   - All modules depend on environment abstractions (`.env.example`) rather than concrete container hostnames or local credentials.
