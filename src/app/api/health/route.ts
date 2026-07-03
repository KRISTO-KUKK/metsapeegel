import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  return NextResponse.json({
    ok: true,
    service: "metsatark",
    aiConfigured,
    aiAvailable: aiConfigured,
    aiStatus: aiConfigured
      ? "configured"
      : "missing_api_key",
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini"
  });
}
