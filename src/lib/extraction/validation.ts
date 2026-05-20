import { z } from "zod";

// Helper: accept null as undefined (LLMs return null for missing fields)
const nullableString = z.string().nullable().optional().transform(v => v ?? undefined);
const nullableNumber = z.number().nullable().optional().transform(v => v ?? undefined);
const nullableBoolean = z.boolean().nullable().optional().transform(v => v ?? undefined);

const clienteSchema = z.object({
  codice_fiscale: z.string().min(6, "CF troppo corto — verifica nel passo successivo"),
  nome: z.string().min(1),
  cognome: z.string().min(1),
  email_contatto_bolletta: nullableString,
  telefono: nullableString,
});

const fornituraSchema = z.object({
  tipo_punto: z.enum(["POD", "PDR"]),
  codice_punto: z.string().min(1),
  tipo_fornitura: z.enum(["luce", "gas"]),
  indirizzo_fornitura: nullableString,
  cap: nullableString,
  comune: nullableString,
  provincia: nullableString,
  classe_contatore: nullableString,
  matricola_contatore: nullableString,
  potenza_impegnata_kw: nullableNumber,
  tensione: nullableString,
  codice_remi: nullableString,
  pcs: nullableNumber,
  coeff_correttivo_c: nullableNumber,
});

const contrattoSchema = z.object({
  brand_commerciale: nullableString,
  societa_vendita: nullableString,
  piva_venditore: nullableString,
  mercado: z.enum(["libero", "tutela"]).nullable().optional().transform(v => v ?? undefined),
  nome_offerta: nullableString,
  codice_offerta: nullableString,
  tipo_prezzo: z.enum(["fisso", "variabile", "monorario"]).nullable().optional().transform(v => v ?? undefined),
  indice_riferimento: nullableString,
  data_decorrenza: nullableString,
  data_scadenza_contratto: nullableString,
  penali_recesso: nullableBoolean,
  metodo_pagamento: nullableString,
  codice_utenza: nullableString,
});

const bollettaSchema = z.object({
  numero_fattura: nullableString,
  tipo_bolletta: z.enum(["periodica", "chiusura", "conguaglio"]),
  data_emissione: nullableString,
  periodo_dal: nullableString,
  periodo_al: nullableString,
  consumo_fatturato: nullableNumber,
  unita_consumo: z.enum(["Smc", "kWh"]).nullable().optional().transform(v => v ?? undefined),
  consumo_annuo: nullableNumber,
  totale_bolletta: nullableNumber,
  totale_da_pagare: z.number().nullable().optional().transform(v => v ?? 0),
  data_scadenza_pagamento: nullableString,
  stato_pagamenti: nullableString,
});

const voceCostoSchema = z.object({
  categoria: z.enum(["materia_energia", "trasporto", "oneri_sistema", "imposte", "iva", "altre_voci"]),
  descrizione: nullableString,
  quantita: nullableNumber,
  unita: nullableString,
  prezzo_unitario: nullableNumber,
  imponibile: nullableNumber,
  cod_iva: nullableString,
});

const letturaSchema = z.object({
  data_lettura: nullableString,
  valore: nullableNumber,
  tipo: z.enum(["rilevata", "stimata", "autolettura"]).nullable().optional().transform(v => v ?? undefined),
  fascia: nullableString,
});

const consumoStoricoSchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM richiesto"),
  consumo: nullableNumber,
  unita: nullableString,
});

export const extractedBillDataSchema = z.object({
  cliente: clienteSchema,
  fornitura: fornituraSchema,
  contratto: contrattoSchema,
  bolletta: bollettaSchema,
  voci_costo: z.array(voceCostoSchema).nullable().optional().transform(v => v ?? undefined),
  letture: z.array(letturaSchema).nullable().optional().transform(v => v ?? undefined),
  consumi_storici: z.array(consumoStoricoSchema).nullable().optional().transform(v => v ?? undefined),
});

export type ValidatedBillData = z.infer<typeof extractedBillDataSchema>;