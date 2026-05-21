/**
 * Validazione Codice Fiscale italiano con calcolo del carattere di controllo.
 *
 * Specifica: 16 caratteri — 15 dati + 1 check digit (carattere di controllo).
 * Algoritmo ufficiale basato su D.Lgs. 241/2000.
 */

// Tabella dei valori per i caratteri dispari (posizione 1,3,5,...)
const VALORI_DISPARI: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
  'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
  'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23,
};

// Tabella dei valori per i caratteri pari (posizione 2,4,6,...)
const VALORI_PARI: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
  'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18,
  'T': 19, 'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25,
};

// Carattere di controllo: resto modulo 26
const CARATTERE_CONTROLLO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Regex base: 6 lettere + 2 cifre + 1 lettera (anno) + 2 cifre (mese) + 1 lettera (comune) + 3 cifre/lettere + 1 check
const CF_REGEX = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i;

/**
 * Calcola il carattere di controllo dati i primi 15 caratteri del CF.
 */
export function calcolaCarattereControllo(cf15: string): string {
  let somma = 0;
  for (let i = 0; i < 15; i++) {
    const ch = cf15[i].toUpperCase();
    if (i % 2 === 0) {
      // posizione dispari (1-based)
      somma += VALORI_DISPARI[ch] ?? 0;
    } else {
      // posizione pari (1-based)
      somma += VALORI_PARI[ch] ?? 0;
    }
  }
  return CARATTERE_CONTROLLO[somma % 26];
}

/**
 * Normalizza il CF: maiuscolo, O→0 e I→1 nelle posizioni numeriche (7-8, 12-14).
 * È un errore comune di OCR scambiare O/0 e I/1.
 */
export function normalizzaCF(cf: string): string {
  const upper = cf.toUpperCase();
  const chars = upper.split('');
  // Posizioni numeriche (0-indexed): 6,7 (anno), 9,10 (mese), 12,13,14 (progressivo)
  // In realtà le posizioni numeriche sono: 6-7 (cifre anno), 9-10 (cifre mese), 12-14 (cifre progressivo)
  const posizioneNumeriche = [6, 7, 9, 10, 12, 13, 14];
  for (const pos of posizioneNumeriche) {
    if (chars[pos] === 'O') chars[pos] = '0';
    if (chars[pos] === 'I') chars[pos] = '1';
  }
  return chars.join('');
}

export type ValidationResult = {
  valid: boolean;
  error?: string;
  normalized?: string;
};

/**
 * Valida un Codice Fiscale italiano completo (16 caratteri).
 * Ritorna { valid, error, normalized }.
 */
export function validaCodiceFiscale(cf: string): ValidationResult {
  if (!cf || cf.trim().length === 0) {
    return { valid: false, error: 'Codice Fiscale mancante' };
  }

  const trimmed = cf.trim().toUpperCase();

  // Prova normalizzazione OCR (O→0, I→1 nelle posizioni numeriche)
  const normalized = normalizzaCF(trimmed);

  // Lunghezza
  if (normalized.length !== 16) {
    return { valid: false, error: `Il Codice Fiscale deve avere 16 caratteri (attuali: ${normalized.length})`, normalized };
  }

  // Formato
  if (!CF_REGEX.test(normalized)) {
    return { valid: false, error: 'Formato Codice Fiscale non valido — contiene caratteri in posizioni errate', normalized };
  }

  // Check digit
  const primi15 = normalized.slice(0, 15);
  const carattereAtteso = calcolaCarattereControllo(primi15);
  const carattereEffettivo = normalized[15];

  if (carattereAtteso !== carattereEffettivo) {
    return {
      valid: false,
      error: `Carattere di controllo non corretto — atteso ${carattereAtteso}, trovato ${carattereEffettivo}. Verifica che non ci siano errori di battitura o OCR.`,
      normalized,
    };
  }

  return { valid: true, normalized };
}