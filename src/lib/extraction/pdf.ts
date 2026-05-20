/**
 * PDF handling for BillScan POC
 *
 * Strategy: since we'll use Gemini's multimodal capabilities anyway,
 * we send the PDF as base64 directly to the vision-capable model.
 * For text-native PDFs we could extract text first, but Gemini handles
 * both cases natively, so we simplify: always send PDF to Gemini.
 */

/**
 * Convert a buffer to base64 string
 */
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

/**
 * Detect if a file is likely a scanned PDF (heuristic: small file size relative to pages)
 * For now, we always use Gemini's multimodal input — it handles both native and scanned PDFs
 */
export function isLikelyScanned(_buffer: Buffer, _fileSize: number): boolean {
  // POC: always use multimodal path
  return true;
}