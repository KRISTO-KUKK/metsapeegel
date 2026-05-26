import { NextResponse } from "next/server";
import { analyzeArea } from "@/lib/analysis/analyzeArea";

type RouteContext = {
  params: Promise<{
    areaId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { areaId } = await params;

  try {
    const result = await analyzeArea(decodeURIComponent(areaId));
    return NextResponse.json(result);
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Analüüsi koostamine ebaõnnestus."
      },
      { status: 404 }
    );
  }
}
