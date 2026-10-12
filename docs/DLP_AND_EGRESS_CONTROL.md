# 🛡️ Data Loss Prevention (DLP) & AI Egress Control

This guide explains how to activate the **Enterprise AI Gateway Overlay** (`docker-compose.gateway.yml`) to govern and protect outbound LLM inference queries.

---

## 1. Why Egress Governance Matters

Without an egress gateway, internal user queries are transmitted directly to external cloud providers (OpenRouter, Anthropic, OpenAI). This creates substantial regulatory liabilities:
1. **Accidental PII Leakage**: Employees pasting citizen identity numbers (NIK 16 digit), employee NIP (18 digit), or financial records.
2. **Credential Bleed**: Accidental pasting of `.env` contents, database passwords, or private SSH keys.
3. **Uncapped Model Spend**: Users invoking expensive reasoning models without budget controls.

---

## 2. Architecture of the DLP Egress Gateway

```
[Employee Chat] 
      │
      ▼
[Llumen Core] 
      │ (Internal HTTP)
      ▼
[AI Gateway (LiteLLM / Propylon)] ──► [DLP Regex & PII Scanner]
      │                                       │
      ├─► (Blocked / Masked) ◄────────────────┘
      ▼
[Outbound TLS] ──► [Approved Corporate LLM Provider]
```

---

## 3. Activation & Configuration

### A. Run Stack with Gateway Overlay
```bash
docker compose -f docker-compose.yml -f docker-compose.gateway.yml up -d
```

### B. Configure DLP Regex Patterns (`services/gateway/config.yaml`)
The gateway actively scans all outbound prompts against regular expression rules:
```yaml
litellm_settings:
  content_policy:
    enforce_pii_masking: true
    blocked_patterns:
      - "(?i)password\\s*[:=]\\s*['\"][^'\"]+['\"]"
      - "(?i)api[_-]?key\\s*[:=]\\s*['\"][^'\"]+['\"]"
      - "(?i)BEGIN\\s+(RSA|OPENSSH|EC|PRIVATE)\\s+KEY"
      - "\\b[1-9][0-9]{15}\\b" # 16-digit credit card & NIK
```

### C. Model Whitelisting
Restricts users strictly to approved cost-effective models:
```yaml
model_list:
  - model_name: "moonshotai/kimi-k3"
  - model_name: "openai/gpt-4o-mini"
  - model_name: "anthropic/claude-3-5-haiku"
```

Any attempt to query unlisted models returns `400 Bad Request: Model not permitted by enterprise policy`.
