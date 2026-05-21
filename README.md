# BillScan POC — Luce & Gas

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
  └── email_contatto, telefono_contatto, consenso_trattamento/marketing/profilazione, consenso_at
documenti_originali (storage ref) ──> bollette
offerte (6 offerte reali da Excel Maggio 2026)
```

Migrazioni:
- `001_initial_schema.sql` — tabelle principali
- `002_offerte.sql` — (obsoleta, vedi 004)
- `003_gdpr_contact.sql` — campi GDPR su proposte_offerta
- `004_offerte_rewrite.sql` — tabella offerte riscritta da Excel

## Flusso utente

1. **Upload** → PDF o foto bolletta → drag & drop
2. **Estrazione** → Gemini analizza il documento → JSON validato Zod (~60s)
3. **Conferma/rettifica** → card riassuntiva con campi editabili inline
4. **Contatto + GDPR** → email (obbl.), telefono, 3 checkbox consenso
5. **Proposta** → confronto prezzi, dettaglio costi, sconto multiservice, codice personale
6. **Conferma download** → bottone "Conferma per scaricare e essere ricontattato" → PDF
7. **Login col codice** → `/proposal?code=XXX` → pagina proposta con accettazione

## Commodity deterministica

POD → luce, PDR → gas. Il validation Zod forza `tipo_fornitura` in base a `tipo_punto`, non si affida alla classificazione del LLM. Le offerte sono filtrate per `commodity` corrispondente.

## Offerte (Excel Maggio 2026)

6 offerte attive nel DB:

| Offerta | Commodity | Indice | Spread | CCV/mese | Sconto/mese | Durata |
|---------|----------|--------|--------|----------|-------------|--------|
| NEW START CASA SCONTO MULTISERVICE | Gas | PSV | 0.0965 €/Smc | 13€ | 5.5€ | 24m |
| NEW START CASA | Gas | PSV | 0.0965 €/Smc | 13€ | — | 24m |
| NEW START CASA SCONTO MULTISERVICE | Gas | PSV | 0.0965 €/Smc | 13€ | 5.5€ | 24m |
| NEW START CASA SCONTO MULTISERVICE | Luce | PUN | 0.0278 €/kWh | 13€ | 5.5€ | 24m |
| NEW START CASA SCONTO MULTISERVICE | Luce | PUN | 0.0278 €/kWh | 13€ | 5.5€ | 24m |
| SMARTPHONE PACK – New Start Casa Sconto Multiservice | Luce | PUN | 0.0278 €/kWh | 13€ | 5.5€ | 36m |

Matching: prezzo = indice (PUN/PSV) + spread × consumo + CCV − sconto + trasporto + oneri + accise + IVA.

## API Routes

| Route | Metodo | Descrizione |
|-------|--------|-------------|
| `/api/extract` | POST | Upload PDF → estrazione Gemini → JSON |
| `/api/confirm` | POST | Persistenza atomica + GDPR + matching offerta + generazione codice |
| `/api/auth-code` | GET | Lookup proposta by codice |
| `/api/auth-code` | POST | Accettazione offerta |

## Dettaglio costi nella proposta

Il dettaglio costi stimati mostra tutte le voci e la somma è matematicamente coerente:

```
Quota energia       +€X.XX
CCV                 +€X.XX
Sconto multiservice −€5.50  (solo se presente)
Trasporto e gestione +€X.XX
Oneri di sistema    +€X.XX
Accise              +€X.XX
IVA                 +€X.XX
────────────────────────────
Totale stimato       €XX.XX  (= somma righe sopra)
```

## GDPR

PRIMA di generare la proposta: email obbligatoria + 3 checkbox:
- ✅ Trattamento dati (obbligatorio, art. 6)
- ☐ Comunicazioni commerciali (facoltativo, art. 7)
- ☐ Profilazione (facoltativo, art. 7)

Tutti i consensi e il timestamp sono salvati in `proposte_offerta`.

## Golden Test (4 PDF di test)

| # | Fornitore | Tipo | Esito |
|---|-----------|------|-------|
| 1 | Fornitore A | Luce | ✅ |
| 2 | Fornitore A | Gas | ✅ |
| 3 | Fornitore B | Luce (chiusura) | ✅ |
| 4 | Fornitore C | Gas | ✅ |

_I file di test sono immagazzinati in Supabase Storage (non nel repo) e contengono dati fittizi._

## Environment Variables

| Var | Dove | Note |
|-----|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | client+server | URL progetto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client+server | Anon key (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Bypass RLS |
| `GEMINI_API_KEY` | server only | Google AI Studio |
| `RESEND_API_KEY` | server only | Email provider |
| `NEXT_PUBLIC_APP_URL` | client+server | URL pubblico (per link email) |

## Sviluppo locale

```bash
npm install
cp .env.local.example .env.local  # riempi le variabili
npm run dev
```

## Stato avanzamento

| Fase | Stato | Note |
|------|-------|------|
| F0 — Setup | ✅ Completata | DB, repo, build |
| F1 — Estrazione | ✅ Completata | 4/4 PDF golden passano |
| F2 — Conferma & persistenza | ✅ Completata | UI + salvataggio atomico |
| F3 — GDPR & contatti | ✅ Completata | Step contatto + 3 consensi |
| F4 — Proposta & matching | ✅ Completata | Offerte reali Excel, spread/CCV/sconto |
| F5 — UX polish & deploy | ✅ Completata | Countdown, PDF, conferma download |
| F5b — Validazione CF & UX contatti | ✅ Completata | CF check digit + normalizzazione OCR, email gestore filtrata, hint +39 |
| F6 — Produzione | ⬜ Da fare | Resend DNS, dominio, informativa privacy completa |