# BillScan POC — FornitoreA Luce & Gas

Tool di ingestion e standardizzazione bollette energetiche con proposta commerciale automatica.

**Live:** https://bollette-lucew-3.vercel.app  
**Repo:** https://github.com/dOuReallyDo/BOLLETTE_LUCEW3  
**Supabase:** `rtrobuenxvjvgbtqndmh.supabase.co`

## Stack

- **Frontend:** Next.js 16 + TypeScript + Tailwind CSS
- **Backend:** Next.js API Routes (serverless)
- **Database:** Supabase (Postgres + Storage + RLS)
- **Estrazione dati:** Gemini 2.5 Flash (multimodal — PDF + immagini)
- **Validazione:** Zod v4 (schema JSON forzato)
- **Email:** Resend (modalità test → `doureallydo@gmail.com`)
- **Deploy:** Vercel (auto-deploy da `main`)

## Schema DB (9 tabelle)

```
clienti (PK: codice_fiscale)
   ├──< forniture (POD/PDR, tipo luce/gas, indirizzo)
   │     └──< contratti (offerta, prezzo, scadenze, fornitore, N nel tempo per switch)
   └──< bollette (1 per PDF caricato)
         ├──< bolletta_voci_costo (scontrino energia / dettaglio atomico)
         ├──< bolletta_letture (letture contatore)
         └──< bolletta_consumi_storici (storico mensile)

proposte_offerta (PK interna, codice_redenzione 6 char [A-Z2-9]) ──> clienti
documenti_originali (storage ref) ──> bollette
```

Vedi migrazione completa: `../supabase/migrations/001_initial_schema.sql`

## Flusso utente

1. **Upload** → PDF o foto bolletta → drag & drop
2. **Estrazione** → Gemini analizza il documento → JSON validato Zod
3. **Conferma/rettifica** → card riassuntiva con campi editabili inline
4. **Email** → proposta con codice 6 char + link
5. **Login col codice** → pagina proposta con confronto prezzi
6. **Accettazione** → stato aggiornato con timestamp

## API Routes

| Route | Metodo | Descrizione |
|-------|--------|-------------|
| `/api/extract` | POST | Upload PDF → estrazione Gemini → JSON |
| `/api/confirm` | POST | Persistenza atomica + generazione codice + invio email |
| `/api/auth-code` | GET | Lookup proposta by codice |
| `/api/auth-code` | POST | Accettazione offerta |

## Golden Test (4 PDF reali)

| PDF | Fornitore | Tipo | POD/PDR | Totale | Esito |
|-----|-----------|------|---------|--------|-------|
| test_fattura_1.pdf | FornitoreA/SocietaA | Luce | IT012E00ABCDEF | €135.82 | ✅ |
| test_fattura_2.pdf | FornitoreA/SocietaA | Gas | 01234567890123 | €26.30 | ✅ |
| test_fattura_3.pdf | FornitoreC | Luce (chiusura) | IT012E00ABCDEF | €402.90 | ✅ |
| test_bolletta_gas…pdf | FornitoreB | Gas | 01234567890123 | €49.51 | ✅ |

Stesso intestatario (Mario Rossi, RSSMRA85M01H501Z), stesso POD con switch FornitoreC→FornitoreA rilevato.

## Environment Variables

| Var | Dove | Note |
|-----|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | client+server | URL progetto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client+server | Anon key (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Bypass RLS |
| `GEMINI_API_KEY` | server only | Google AI Studio |
| `RESEND_API_KEY` | server only | Email provider |
| `RESEND_TEST_TO` | server only | Override destinatario in test mode |
| `NEXT_PUBLIC_APP_URL` | client+server | URL pubblico (per link email) |

## Sviluppo locale

```bash
npm install
cp .env.local.example .env.local  # riempi le variabili
npm run dev
```

## Stato avanzamento

Vedi `../PRD_BillScan_POC.md` §11 per il piano fasi.

| Fase | Stato | Note |
|------|-------|------|
| F0 — Setup | ✅ Completata | DB, repo, build |
| F1 — Estrazione | ✅ Completata | 4/4 PDF golden passano |
| F2 — Conferma & persistenza | ✅ Completata | UI + salvataggio atomico |
| F3 — Email & codice | ✅ Completata | Resend test mode, codice [A-Z2-9] |
| F4 — Login & accettazione | ✅ Completata | Codice → proposta → accetta |
| F5 — UX polish & deploy | 🟡 In corso | Deploy Vercel live, manca: offerta reale, logo, polish UI |
| ** TODO prossimo** | ⬜ | Tabella offerte FornitoreA nel DB + logica matching |