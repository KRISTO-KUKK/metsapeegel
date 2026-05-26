import { NextRequest, NextResponse } from "next/server";
import { realDataProvider } from "@/lib/data/RealDataProvider";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const results = await realDataProvider.searchAreas(query);

  return NextResponse.json({ results });
}
