import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/client");
    const url = new URL(req.url);
    const path = url.searchParams.get("path");

    if (!path) {
      return NextResponse.json({ error: "path parameter required" }, { status: 400 });
    }

    // Generate a signed URL that expires in 60 seconds
    const { data, error } = await supabaseAdmin.storage
      .from("bollette-pdf")
      .createSignedUrl(path, 60);

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "File not found" }, { status: 404 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Errore" }, { status: 500 });
  }
}