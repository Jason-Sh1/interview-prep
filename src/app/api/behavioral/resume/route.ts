import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { MAX_PDF_BYTES, PdfError, pdfToText } from "@/lib/behavioral/pdf";
import { saveResume } from "@/lib/behavioral/stories";

/**
 * Uploads a resume PDF (multipart field "file"). The text is extracted here
 * and saved; the file itself is not stored. A route handler rather than a
 * server action, so the upload isn't held to the 1 MB server action limit.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_PDF_BYTES + 64 * 1024) return NextResponse.json({ error: "That PDF is over 5 MB." }, { status: 413 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF to upload." }, { status: 400 });
  if (file.size > MAX_PDF_BYTES) return NextResponse.json({ error: "That PDF is over 5 MB." }, { status: 413 });
  try {
    const text = await pdfToText(new Uint8Array(await file.arrayBuffer()));
    await saveResume(user.id, text, file.name.slice(0, 200));
    return NextResponse.json({ ok: true, chars: text.length });
  } catch (e) {
    if (e instanceof PdfError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error("Resume upload failed", e);
    return NextResponse.json({ error: "Couldn't read that PDF. Try pasting the text instead." }, { status: 500 });
  }
}
