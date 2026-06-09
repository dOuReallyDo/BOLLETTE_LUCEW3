import { GoogleGenerativeAI } from "@google/generative-ai";
import { extractedBillDataSchema, type ValidatedBillData } from "./validation";

// Lazy + memoized: Workers expose env only per-request, not at module load.
let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  return (_genAI ??= new GoogleGenerativeAI(process.env.GEMINI_API_KEY!));
}

const EXTRACTION_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `Sei un estrattore di dati da bollette energetiche italiane.
Analizza il testo della bolletta e restituisci UNICAMENTE un oggetto JSON conforme allo schema seguente.
Non inventare dati che non sono presenti nella bolletta. Se un campo non è trovabile, omettilo o usa null.

SCHEMA JSON RICHIESTO:
{
  "cliente": {
    "codice_fiscale": "string (16 caratteri italiani)",
    "nome": "string",
    "cognome": "string",
    "email_contatto_bolletta": "string (email trovata nella bolletta, potrebbe NON essere dell'intestatario)",
    "telefono": "string"
  },
  "fornitura": {
    "tipo_punto": "POD o PDR",
    "codice_punto": "string (codice POD o PDR completo)",
    "tipo_fornitura": "luce o gas",
    "indirizzo_fornitura": "string",
    "cap": "string",
    "comune": "string",
    "provincia": "string (2 lettere)",
    "classe_contatore": "string (es. G4, elettronico 2G, BT 230V)",
    "matricola_contatore": "string",
    "potenza_impegnata_kw": "number (solo luce)",
    "tensione": "string (solo luce, es. 230V)",
    "codice_remi": "string (solo gas)",
    "pcs": "number (solo gas)",
    "coeff_correttivo_c": "number (solo gas)"
  },
  "contratto": {
    "brand_commerciale": "string (es. FornitoreA Luce&Gas, FornitoreB, FornitoreC Energia)",
    "societa_vendita": "string (società legale, es. Società Vendita S.p.A.)",
    "piva_venditore": "string",
    "mercato": "libero o tutela",
    "nome_offerta": "string",
    "codice_offerta": "string",
    "tipo_prezzo": "fisso, variabile o monorario",
    "indice_riferimento": "string (es. PSV, PUN)",
    "data_decorrenza": "YYYY-MM-DD",
    "data_scadenza_contratto": "YYYY-MM-DD",
    "penali_recesso": "boolean",
    "metodo_pagamento": "string",
    "codice_utenza": "string (codice cliente/utenza del fornitore)"
  },
  "bolletta": {
    "numero_fattura": "string",
    "tipo_bolletta": "periodica, chiusura o conguaglio",
    "data_emissione": "YYYY-MM-DD",
    "periodo_dal": "YYYY-MM-DD",
    "periodo_al": "YYYY-MM-DD",
    "consumo_fatturato": "number",
    "unita_consumo": "Smc o kWh",
    "consumo_annuo": "number",
    "totale_bolletta": "number",
    "totale_da_pagare": "number",
    "data_scadenza_pagamento": "YYYY-MM-DD",
    "stato_pagamenti": "string"
  },
  "voci_costo": [
    {
      "categoria": "materia_energia, trasporto, oneri_sistema, imposte, iva o altre_voci",
      "descrizione": "string (es. Canone RAI)",
      "quantita": "number",
      "unita": "string",
      "prezzo_unitario": "number",
      "imponibile": "number",
      "cod_iva": "string (es. V1=10%, VF=fuori campo)"
    }
  ],
  "letture": [
    {
      "data_lettura": "YYYY-MM-DD",
      "valore": "number",
      "tipo": "rilevata, stimata o autolettura",
      "fascia": "F1, F2 o F3 (solo luce)"
    }
  ],
  "consumi_storici": [
    {
      "periodo": "YYYY-MM",
      "consumo": "number",
      "unita": "string"
    }
  ]
}

REGOLE IMPORTANTI:
- Il codice_fiscale DEVE essere esattamente 16 caratteri nel formato italiano
- POD inizia sempre con IT seguito da 12 caratteri alfanumerici (es. IT012E00ABCDEF)
- PDR è un numero di 14 cifre
- brand_commerciale ≠ societa_vendita (es. "FornitoreA Luce&Gas" vs "Società Vendita S.p.A.")
- tipo_bolletta: "chiusura" se la bolletta indica cessazione/switch
- Se c'è il Canone RAI, mettilo in voci_costo con categoria "altre_voci" e cod_iva "VF"
- L'email in bolletta PUO' NON essere dell'intestatario
- Restituisci SOLO il JSON, nessun testo prima o dopo`;

/**
 * Extract bill data from text (PDF native text extraction path)
 */
export async function extractFromText(text: string): Promise<ValidatedBillData> {
  const model = getGenAI().getGenerativeModel({
    model: EXTRACTION_MODEL,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent([
    { text: SYSTEM_PROMPT },
    { text: `Estrai i dati dalla seguente bolletta:\n\n${text}` },
  ]);

  const responseText = result.response.text();

  try {
    const parsed = JSON.parse(responseText);
    return extractedBillDataSchema.parse(parsed);
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`LLM non ha restituito JSON valido: ${responseText.slice(0, 200)}`);
    }
    throw e;
  }
}

/**
 * Extract bill data from image (OCR/photo path)
 */
export async function extractFromImage(imageBase64: string, mimeType: string): Promise<ValidatedBillData> {
  const model = getGenAI().getGenerativeModel({
    model: EXTRACTION_MODEL,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent([
    { text: SYSTEM_PROMPT },
    {
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    },
    { text: "Estrai i dati dalla bolletta nell'immagine sopra." },
  ]);

  const responseText = result.response.text();

  try {
    const parsed = JSON.parse(responseText);
    return extractedBillDataSchema.parse(parsed);
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`LLM non ha restituito JSON valido: ${responseText.slice(0, 200)}`);
    }
    throw e;
  }
}