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