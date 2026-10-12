# 🛡️ Phase 3: Advanced DLP & Prompt Guardrails

Fase ini memperkuat pertahanan data loss prevention (DLP) dan pelindung prompt (*prompt guardrails*) untuk kepatuhan penuh terhadap **UU Perlindungan Data Pribadi (UU PDP No. 27/2022)**.

---

## 🎯 Sasaran Utama

1. **Deteksi Data Pribadi Indonesia (Context-Aware PII Scanner)**:
   - **NIK (16 Digit)**: Verifikasi format tanggal lahir & kode wilayah Kemendagri.
   - **NIP (18 Digit)**: Deteksi nomor induk pegawai BPS / ASN.
   - **Data Finansial**: Kartu kredit (Luhn algorithm), nomor rekening bank nasional, token API, dan private key.
2. **Sanitasi Dua Arah (Bidirectional Masking)**:
   - *Outbound Prompt*: Mengaburkan data sensitif sebelum dikirim ke penyedia LLM luar (`[TERDAFTAR_NIK_xxxx]`).
   - *Inbound Response*: Mencegah model menghasilkan output halusinasi yang menyerupai rahasia institusi.
3. **Pelindung Injeksi Prompt (Jailbreak & Prompt Injection Defense)**:
   - Memfilter serangan *ignore previous instructions*, *system prompt leak*, dan *DAN (Do Anything Now)* exploits.

---

## 📐 Arsitektur PII & Guardrails Pipeline

```mermaid
flowchart LR
    UserPrompt["Prompt Pegawai\n'Data NIK 320101...'"] --> PIIFilter["PII Detector & Masker\n(Regex + Presidio)"]
    PIIFilter -->|Masked: 'NIK [REDACTED]'| SafetyScan["Jailbreak / Injection Guard\n(Llama Guard / Heuristics)"]
    SafetyScan -->|Approved| LLM["Upstream LLM Provider"]
    LLM --> OutFilter["Output Hallucination & Leak Filter"]
    OutFilter --> Client["Jawaban Bersih ke Pegawai"]
```

### Kontrak Interface (`IPromptGuardrailEngine`)
```typescript
export interface GuardrailScanResult {
  allowed: boolean;
  sanitizedPrompt: string;
  detectedEntities: Array<{ type: string; score: number; text: string }>;
  blockReason?: string;
}

export interface IPromptGuardrailEngine {
  scanOutbound(prompt: string, userId: string): Promise<GuardrailScanResult>;
  scanInbound(completion: string): Promise<{ safe: boolean; sanitized: string }>;
}
```

---

## 📦 Rencana Luaran & Komponen

1. `services/gateway/guardrails/pii-detector.ts`: Modul deteksi PII spesifik format Indonesia (NIK, NIP, KK).
2. `services/gateway/guardrails/injection-shield.ts`: Filter heuristik pencegahan prompt injection.
3. `tests/guardrails.test.ts`: Gauntlet pengujian dengan ratusan contoh prompt berbahaya dan variasi NIK.

---

## 🧪 Kriteria Keberhasilan & Gauntlet

- [ ] 100% sampel prompt berisi NIK 16 digit dan API key berhasil disamarkan sebelum paket keluar jaringan.
- [ ] Upaya injeksi prompt teridentifikasi dan menghasilkan respon penolakan terstandar tanpa kebocoran system prompt.
- [ ] Latensi tambahan pemeriksaan DLP berada di bawah <25ms per request.
- [ ] 100% berkas berukuran `< 350 lines` dan lolos audit `make audit`.
