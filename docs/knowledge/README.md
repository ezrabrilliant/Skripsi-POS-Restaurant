# Knowledge Base — Sistem POS Ayam Bakar Banjar Monosuko

Dokumentasi lengkap tentang semua diagram skripsi. Setiap file berisi:
- Pengertian diagram (teori + ADSI reference)
- Kegunaan untuk skripsi
- Elemen + konvensi
- Isi spesifik diagram proyek ini
- Narasi paste-ready untuk Bab 3
- Bad practices yang dihindari

## 📚 File dalam folder ini

| File | Fokus | Saat dibutuhkan |
|---|---|---|
| [**FULL.md**](FULL.md) | Kompilasi semua (self-contained) | Overview cepat, orientasi baru, share ke reviewer |
| [USE-CASE.md](USE-CASE.md) | Use Case Diagram detail | Bab 3.4.1 writing, UC review |
| [ACTIVITY.md](ACTIVITY.md) | 7 Activity Diagrams detail | Bab 3.4.2 writing, alur bisnis review |
| [ERD.md](ERD.md) | Entity Relationship Diagram | Bab 3.5 writing, database design |

**Sequence Diagram** (5 diagram) — dijelaskan singkat di [FULL.md §6](FULL.md#6-sequence-diagrams). Tidak ada file terpisah karena struktur sama untuk semua 5.

## 📁 File terkait di luar folder ini

- [`../DIAGRAM-SPEC.md`](../DIAGRAM-SPEC.md) — design spec awal (pre-build decisions)
- [`../DATA-DICTIONARY.md`](../DATA-DICTIONARY.md) — 8 tabel data dictionary paste-ready untuk Bab 3
- [`../diagrams/`](../diagrams/) — 13 PNG hasil render + INDEX.md gallery
- [`../planning/DIAGRAM-PLAN.md`](../planning/DIAGRAM-PLAN.md) — 6 keputusan design awal
- [`../../Skripsi.mdj`](../../Skripsi.mdj) — StarUML project (editable source)

## 🎯 Cara pakai saat menulis Bab 3

1. **Buka dokumen yang relevan** (misal untuk sub-bab Use Case: USE-CASE.md).
2. **Salin "Narasi untuk Bab 3 Skripsi"** — ini paragraf paste-ready yang sudah disiapkan.
3. **Lihat diagram PNG** di folder `diagrams/` (sudah di-link dari tiap doc).
4. **Untuk data dictionary** (Tabel 3.1 - 3.8), pakai [`DATA-DICTIONARY.md`](../DATA-DICTIONARY.md) langsung.

## 🔄 Cara update kalau design berubah

Jika kamu edit diagram di StarUML:
1. Update `Skripsi.mdj` via StarUML GUI atau MCP tools
2. Re-render PNG via `mcp__staruml__get_diagram_image_by_id`
3. Update section terkait di file knowledge ini (terutama "Isi diagram" + "Narasi untuk Bab 3")
4. Update `DATA-DICTIONARY.md` jika struktur entitas/kolom berubah

## 📖 Referensi konvensi

- ADSI Bab 5 (UC), 7 (Activity), 8 (Class/ERD), 10 (Sequence) — `../extracted/adsi.txt`
- 3 contoh skripsi POS UK Petra — `../pdf-pages/`
- Skills: `.claude/skills/{use-case,activity,erd,sequence,block-diagram,flowchart,class}-diagram/SKILL.md`
