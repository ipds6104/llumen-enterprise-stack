# Context, Engineering Standards & Old-Coder Governance

> [!IMPORTANT]
> Repository ini diatur secara deterministik oleh **Old-Coder Engineering Protocol** dan prinsip arsitektur enterprise bersih.

---

## 1. Old-Coder Protocol & Evidence-First Development
- **Skill Lokal**: Terpasang di [.agents/skills/old-coder/SKILL.md](.agents/skills/old-coder/SKILL.md) dan [.agents/skills/old-coder-api/SKILL.md](.agents/skills/old-coder-api/SKILL.md).
- **Upstream Source**: [https://github.com/amazingang/old-coder](https://github.com/amazingang/old-coder).
- **Core Loop**:
  `SPEC → (human approval) → RED → GREEN → REFACTOR → GAUNTLET → EVIDENCE`
- **Filosofi**: *"Don't read the code — make it run the gauntlet."* Kepercayaan dibangun atas bukti eksekusi gauntlet (*evidence report*), bukan inspeksi baris demi baris secara manual.

---

## 2. Interface-First Design Principle (Kontrak Sebelum Implementasi)
1. **DILARANG KERAS** menulis implementasi konkret sebelum trait/interface abstraksi didefinisikan dan disepakati.
2. Interface/trait adalah kontrak spesifikasi; struct/class konkret hanyalah adaptor detail.
3. Seluruh dependensi wajib disuntikkan via *Dependency Injection* (DIP) untuk menjamin decoupling dan testability.

---

## 3. SOLID Principles Enforcement
- **Single Responsibility (SRP)**: Setiap file dan modul hanya bertanggung jawab atas satu domain terbatas (ingres, auth gateway, JIT provisioner, audit logging, blocklist).
- **Open/Closed (OCP)**: Penambahan fitur baru (misal: IdP baru, provider LLM, format audit) dilakukan via komposisi/overlay tanpa memodifikasi core orchestrator.
- **Liskov Substitution (LSP)**: Seluruh implementasi driver atau mock pengujian dapat saling menggantikan melalui interface tanpa merusak ekspektasi gateway.
- **Interface Segregation (ISP)**: Kontrak interface dipisah ramping (`IUserProvisioner`, `IBlocklistService`, `IAuthMediator`).
- **Dependency Inversion (DIP)**: Modul tingkat tinggi bergantung pada abstraksi, bukan detail konkret.

---

## 4. Batas Maksimal 350 Baris per File (Hard Deterministic Limit)
> [!CAUTION]
> **TIDAK BOLEH ADA 1 FILE PUN YANG MELEBIHI 350 BARIS KODE** (`wc -l < 350`) di seluruh repositori (termasuk `services/`, `scripts/`, `docs/`, dan `.agents/skills/`).

- **Mekanisme Pengecekan Deterministik**:
  Wajib menjalankan:
  ```bash
  bash scripts/check-line-limits.sh
  ```
- Jika ada berkas mendekati 300 baris, segera pecah ke submodule terpisah.

---

## 5. Zero-Mock di Jalur Produksi & Security Hardening
- Dilarang menaruh mock atau stubs dummy di jalur runtime produksi.
- Seluruh container wajib mematuhi standar CIS hardening (`read_only: true`, `cap_drop: ["ALL"]`, `no-new-privileges: true`).

---

## 6. Enterprise Roadmap Tracking (docs/roadmap/)
Setiap penambahan atau pengembangan fitur wajib mengikuti dan memperbarui status checklist di [docs/roadmap/00_ROADMAP_OVERVIEW.md](docs/roadmap/00_ROADMAP_OVERVIEW.md):
- [Phase 1: Identity & Hierarchical RBAC](docs/roadmap/01_PHASE_1_IDENTITY_FEDERATION_AND_RBAC.md)
- [Phase 2: High Availability & Litestream S3](docs/roadmap/02_PHASE_2_HIGH_AVAILABILITY_AND_REPLICATION.md)
- [Phase 3: Advanced DLP & Prompt Guardrails](docs/roadmap/03_PHASE_3_ADVANCED_DLP_AND_PROMPT_GUARDRAILS.md)
- [Phase 4: FinOps, Token Budgeting & Telemetry](docs/roadmap/04_PHASE_4_FINOPS_TOKEN_BUDGETING_AND_METRICS.md)
- [Phase 5: Enterprise Document RAG & Knowledge Vault](docs/roadmap/05_PHASE_5_ENTERPRISE_RAG_AND_KNOWLEDGE_VAULT.md)
- [Phase 6: Multi-Model Routing & Local vLLM Fallback](docs/roadmap/06_PHASE_6_MODEL_FAILOVER_AND_PRIVATE_VLLM.md)
- [Phase 7: Centralized SIEM & Compliance Gauntlet](docs/roadmap/07_PHASE_7_SIEM_AUDIT_LOGGING_AND_COMPLIANCE.md)
