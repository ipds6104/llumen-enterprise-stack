# 📚 Phase 5: Enterprise RAG & Knowledge Vault

Fase ini melengkapi Llumen dengan kapabilitas *Retrieval-Augmented Generation* (RAG) cerdas yang terisolasi berdasarkan hak akses peran (*Role-Gated Document Access*).

---

## 🎯 Sasaran Utama

1. **Pencarian Semantik Berbasis Hak Akses (Role-Gated Vector RAG)**:
   - Dokumen SOP publik dapat diakses seluruh pegawai.
   - Dokumen anggaran (DIPA, RKA-K/L) hanya dapat diakses oleh PPK, PPSPM, Bendahara, dan Kepala Satker.
   - Hasil pencarian semantik difilter otomatis pada tingkat basis data vektor sebelum konteks disuntikkan ke prompt.
2. **Pencarian Cepat Hibrida (Hybrid Search BM25 + Vector)**:
   - Mengintegrasikan mesin pencari dokumen berkecepatan tinggi (seperti MediaVault / LanceDB / Meilisearch) dengan latensi sub-50ms.
3. **Ekstraksi Dokumen & Tabel Kompleks Bebas Beban CPU**:
   - Integrasi pipa ekstraksi PDF cerdas (`agy-doc-extract` / multimodal VLM) yang menjaga keutuhan tabel dinas berbingkai maupun tanpa garis.

---

## 📐 Arsitektur RAG Berpartisi Peran

```mermaid
flowchart TD
    UserQuery["Query Pegawai: 'Berapa pagu anggaran revisi?'"] --> ExtractClaims["Ekstrak NIP & Roles Pegawai\n(e.g., role: 'pegawai')"]
    ExtractClaims --> VectorSearch["Pencarian Vektor Hibrida\n(LanceDB / MediaVault)"]
    
    subgraph DocumentVault ["Knowledge Vault Berpartisi"]
        DocPublic[("Dokumen Umum / SOP\n[Permit: All]")]
        DocRestricted[("Dokumen DIPA / Keuangan\n[Permit: PPK, KPA]")]
    end
    
    VectorSearch -.->|Diizinkan| DocPublic
    VectorSearch -.x|Ditolak: Filter RLS| DocRestricted
    
    VectorSearch --> AugmentedPrompt["Prompt Diperkaya Konteks Sah"]
    AugmentedPrompt --> LlumenEngine["Llumen Core Engine"]
    LlumenEngine --> Response["Jawaban Faktual Berdasar Dokumen Sah"]
```

### Kontrak Interface (`ISecureRagEngine`)
```typescript
export interface DocumentChunk {
  id: string;
  documentTitle: string;
  content: string;
  allowedRoles: string[];
  allowedUnits: string[];
  relevanceScore: number;
}

export interface ISecureRagEngine {
  searchAuthorizedKnowledge(query: string, userRoles: string[], unitKerja: string, topK: number): Promise<DocumentChunk[]>;
  ingestDocument(title: string, content: string, accessPolicy: { roles: string[]; units: string[] }): Promise<string>;
}
```

---

## 📦 Rencana Luaran & Komponen

1. `services/rag-bridge/src/secure-retriever.ts`: Adaptor pencarian vektor dengan klausul filter otorisasi peran.
2. `services/rag-bridge/src/document-loader.ts`: Ingestion pipeline dokumen PDF/Office.
3. `tests/secure-rag.test.ts`: Pengujian pemisahan dokumen rahasia antar pengguna.

---

## 🧪 Kriteria Keberhasilan & Gauntlet

- [ ] Pegawai biasa yang menanyakan isi dokumen rahasia tidak pernah menerima potongan teks dokumen tersebut dalam konteks LLM.
- [ ] Pencarian dokumen hibrida selesai dalam waktu <80ms.
- [ ] 100% berkas berukuran `< 350 lines` dan lolos pengujian `scripts/check-line-limits.sh`.
