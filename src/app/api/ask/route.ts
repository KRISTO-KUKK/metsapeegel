import { NextRequest, NextResponse } from "next/server";
import { generateAreaQuestionAnswer } from "@/lib/ai/areaQuestion";
import type { AnalysisResult } from "@/lib/types/forestry";

function isAnalysisResult(value: unknown): value is AnalysisResult {
  return Boolean(
    value &&
      typeof value === "object" &&
      "area" in value &&
      "publicAudit" in value &&
      "rawFacts" in value &&
      "sources" in value
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      analysis?: unknown;
      question?: unknown;
      history?: unknown;
    };
    const question =
      typeof body.question === "string" ? body.question.trim().slice(0, 700) : "";

    if (!question) {
      return NextResponse.json(
        { error: "Question is required." },
        { status: 400 }
      );
    }

    if (!isAnalysisResult(body.analysis)) {
      return NextResponse.json(
        { error: "Current area analysis is required." },
        { status: 400 }
      );
    }

    const answer = await generateAreaQuestionAnswer({
      analysis: body.analysis,
      question,
      history: Array.isArray(body.history)
        ? body.history
            .filter(
              (item): item is { question: string; answer: string } =>
                Boolean(
                  item &&
                    typeof item === "object" &&
                    "question" in item &&
                    "answer" in item &&
                    typeof item.question === "string" &&
                    typeof item.answer === "string"
                )
            )
            .slice(-6)
        : []
    });

    return NextResponse.json({ answer });
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Question answering failed."
      },
      { status: 500 }
    );
  }
}
