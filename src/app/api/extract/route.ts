import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { extractFromText, extractFromImage } from "@/lib/extraction/llm";
import { bufferToBase64 } from "@/lib/extraction/pdf";
import type { ValidatedBillData } from "@/lib/extraction/validation";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "Nessun file caricato" }, { status: 400 });
    }

    // 1. Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const storagePath = `${hash.slice(0, 12)}_${Date.now()}_${file.name}`;
    const { error: storageError } = await supabaseAdmin.storage
      .from("bollette-pdf")
      .upload(storagePath, buffer, { contentType: file.type });

    if (storageError) {
      return NextResponse.json({ error: `Storage: ${storageError.message}` }, { status: 500 });
    }

    // 2. Extract data via Gemini multimodal
    let extractedData: ValidatedBillData;
    const base64 = bufferToBase64(buffer);
    const mimeType = file.type || "application/pdf";

    // Gemini handles both native PDFs and images — always use multimodal
    extractedData = await extractFromImage(base64, mimeType);

    // 3. Return extracted data for user confirmation
    return NextResponse.json({
      data: extractedData,
      storagePath,
      fileName: file.name,
      mimeType,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Errore durante l'estrazione";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}