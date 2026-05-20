// BillScan POC — TypeScript types mirroring the Supabase schema

export interface Cliente {
  codice_fiscale: string;
  nome: string;
  cognome: string;
  email?: string;
  email_contatto_bolletta?: string;
  telefono?: string;
  created_at: string;
  updated_at: string;
}

export interface Fornitura {
  id: string;
  codice_fiscale: string;
  tipo_punto: "POD" | "PDR";
  codice_punto: string;
  tipo_fornitura: "luce" | "gas";
  indirizzo_fornitura?: string;
  cap?: string;
  comune?: string;
  provincia?: string;
  tipologia_cliente?: string;
  tipologia_uso?: string;
  classe_contatore?: string;
  matricola_contatore?: string;
  potenza_impegnata_kw?: number;
  tensione?: string;
  codice_remi?: string;
  pcs?: number;
  coeff_correttivo_c?: number;
  created_at: string;
}

export interface Contratto {
  id: string;
  fornitura_id: string;
  brand_commerciale?: string;
  societa_vendita?: string;
  piva_venditore?: string;
  mercato?: "libero" | "tutela";
  nome_offerta?: string;
  codice_offerta?: string;
  tipo_prezzo?: "fisson" | "variabile" | "monorario";
  indice_riferimento?: string;
  data_decorrenza?: string;
  data_scadenza_offerta?: string;
  data_scadenza_contratto?: string;
  data_cessazione?: string;
  penali_recesso?: boolean;
  metodo_pagamento?: string;
  codice_utenza?: string;
  attivo?: boolean;
  created_at: string;
}

export interface Bolletta {
  id: string;
  codice_fiscale: string;
  fornitura_id: string;
  contratto_id?: string;
  numero_fattura?: string;
  tipo_bolletta: "periodica" | "chiusura" | "conguaglio";
  data_emissione?: string;
  periodo_dal?: string;
  periodo_al?: string;
  consumo_fatturato?: number;
  unita_consumo?: "Smc" | "kWh";
  consumo_annuo?: number;
  totale_bolletta?: number;
  totale_da_pagare?: number;
  valuta?: string;
  data_scadenza_pagamento?: string;
  stato_pagamenti?: string;
  created_at: string;
}

export interface BollettaVoceCosto {
  id: string;
  bolletta_id: string;
  categoria: "materia_energia" | "trasporto" | "oneri_sistema" | "imposte" | "iva" | "altre_voci";
  descrizione?: string;
  quantita?: number;
  unita?: string;
  prezzo_unitario?: number;
  imponibile?: number;
  cod_iva?: string;
}

export interface BollettaLettura {
  id: string;
  bolletta_id: string;
  data_lettura?: string;
  valore?: number;
  tipo?: "rilevata" | "stimata" | "autolettura";
  fascia?: string;
}

export interface BollettaConsumoStorico {
  id: string;
  bolletta_id: string;
  periodo: string;
  consumo?: number;
  unita?: string;
}

export interface PropostaOfferta {
  id: string;
  codice_fiscale: string;
  codice_redenzione: string;
  offerta_proposta?: Record<string, unknown>;
  prezzo_proposto?: number;
  risparmio_stimato?: number;
  stato: "inviata" | "vista" | "accettata" | "scaduta";
  email_inviata_a?: string;
  inviata_at: string;
  vista_at?: string;
  accettata_at?: string;
  scade_at: string;
}

export interface DocumentoOriginale {
  id: string;
  bolletta_id: string;
  storage_path: string;
  nome_file?: string;
  mime_type?: string;
  hash_sha256?: string;
  uploaded_at: string;
}

// Offerte FornitoreA (mirrors Supabase "offerte" table — v2 from Excel May 2026)
export interface Offerta {
  id: string;
  codice_offerta: string;
  nome_offerta: string;
  commodity: "gas" | "luce";
  tipo_uso: string;
  durata_mesi: number;
  data_inizio_commerc?: string;
  data_fine_commerc?: string;
  segmento?: string;
  bolletta_web?: string;
  domiciliazione?: string;
  green: boolean;
  co2: boolean;
  // Luce
  comp_ee?: string;                    // "PUN" or null
  corr_var_lordo_eur_kwh?: number;      // spread €/kWh
  contrib_mese_no_iva_luce?: number;    // CCV mensile luce
  contrib_anno_no_iva_luce?: number;    // CCV annuo luce
  sconto_mese_luce?: number;            // sconto multiservice €/mese
  // Gas
  comp_gas?: string;                    // "PSV" or null
  corr_var_eur_smc?: number;            // spread €/Smc
  contrib_mese_no_iva_gas?: number;     // CCV mensile gas
  contrib_anno_no_iva_gas?: number;     // CCV annuo gas
  sconto_mese_gas?: number;             // sconto multiservice €/mese
  // Derived for matching
  tipo_prezzo: "fisso" | "variabile" | "tutela";
  indice_riferimento?: string;          // PUN / PSV
  ccv_mensile?: number;
  ccv_annuo?: number;
  attivo: boolean;
  created_at: string;
}

// LLM extraction output schema
export interface ExtractedBillData {
  cliente: {
    codice_fiscale: string;
    nome: string;
    cognome: string;
    email_contatto_bolletta?: string;
    telefono?: string;
  };
  fornitura: {
    tipo_punto: "POD" | "PDR";
    codice_punto: string;
    tipo_fornitura: "luce" | "gas";
    indirizzo_fornitura?: string;
    cap?: string;
    comune?: string;
    provincia?: string;
    classe_contatore?: string;
    matricola_contatore?: string;
    potenza_impegnata_kw?: number;
    tensione?: string;
    codice_remi?: string;
    pcs?: number;
    coeff_correttivo_c?: number;
  };
  contratto: {
    brand_commerciale?: string;
    societa_vendita?: string;
    piva_venditore?: string;
    mercato?: "libero" | "tutela";
    nome_offerta?: string;
    codice_offerta?: string;
    tipo_prezzo?: "fisso" | "variabile" | "monorario";
    indice_riferimento?: string;
    data_decorrenza?: string;
    data_scadenza_contratto?: string;
    penali_recesso?: boolean;
    metodo_pagamento?: string;
    codice_utenza?: string;
  };
  bolletta: {
    numero_fattura?: string;
    tipo_bolletta: "periodica" | "chiusura" | "conguaglio";
    data_emissione?: string;
    periodo_dal?: string;
    periodo_al?: string;
    consumo_fatturato?: number;
    unita_consumo?: "Smc" | "kWh";
    consumo_annuo?: number;
    totale_bolletta?: number;
    totale_da_pagare?: number;
    data_scadenza_pagamento?: string;
    stato_pagamenti?: string;
  };
  voci_costo?: Array<{
    categoria: BollettaVoceCosto["categoria"];
    descrizione?: string;
    quantita?: number;
    unita?: string;
    prezzo_unitario?: number;
    imponibile?: number;
    cod_iva?: string;
  }>;
  letture?: Array<{
    data_lettura?: string;
    valore?: number;
    tipo?: BollettaLettura["tipo"];
    fascia?: string;
  }>;
  consumi_storici?: Array<{
    periodo: string;
    consumo?: number;
    unita?: string;
  }>;
}