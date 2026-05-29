import type {
  AiNarrative,
  AnalysisStatus,
  EvidenceItem,
  PublicAudit
} from "@/lib/types/forestry";

type NarrativeInput = {
  status: AnalysisStatus;
  headline: string;
  summary: string;
  whatHappened: string[];
  missingInfo: string[];
  warnings: string[];
  evidence: EvidenceItem[];
  publicAudit: PublicAudit;
};

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
};

type OllamaResponse = {
  message?: {
    content?: string;
  };
  response?: string;
};

const aiInstructions = [
  "Sa oled ettevaatlik Eesti avaliku sektori andmeselgitaja.",
  "Kirjuta eesti keeles ja lihtsas keeles.",
  "Kasuta ainult antud fakte.",
  "Ära süüdista kedagi rikkumises ega anna juriidilist nõu.",
  "Selgita, mida avalik kasutaja võib valesti mõista.",
  "Lõpeta konkreetse kuvamissoovitusega Keskkonnaportaali vaatele.",
  "Hoia vastus 4-6 lauset."
].join(" ");

function templateNarrative(input: NarrativeInput): AiNarrative {
  const { publicAudit } = input;
  const firstMisreading = publicAudit.possibleMisreadings[0];
  const recommendation = publicAudit.disclosureRecommendation;

  return {
    mode: "template",
    status: "ready",
    provider: "deterministic-template",
    summary: [
      publicAudit.publicSummary,
      firstMisreading,
      `Soovitus: ${recommendation.label.toLocaleLowerCase("et")}.`,
      recommendation.suggestedUiText[0]
    ]
      .filter(Boolean)
      .join(" "),
    note:
      "AI-liides on valmis. OPENAI_API_KEY või OLLAMA_BASE_URL lisamisel saab sama sisendi anda mudelile."
  };
}

function compactInput(input: NarrativeInput) {
  return {
    status: input.status,
    headline: input.headline,
    deterministicSummary: input.summary,
    publicAudit: input.publicAudit,
    whatHappened: input.whatHappened,
    missingInfo: input.missingInfo,
    warnings: input.warnings,
    evidence: input.evidence.map((item) => ({
      kind: item.kind,
      title: item.title,
      description: item.description,
      year: item.year
    }))
  };
}

function extractOpenAiText(payload: OpenAiResponse): string | null {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((item) => item.text)
    .filter(Boolean)
    .join("\n")
    .trim();

  return text || null;
}

async function openAiNarrative(input: NarrativeInput): Promise<AiNarrative> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return templateNarrative(input);
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions: aiInstructions,
      input: JSON.stringify(compactInput(input)),
      max_output_tokens: 450
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI narrative failed with ${response.status}`);
  }

  const payload = (await response.json()) as OpenAiResponse;
  const summary = extractOpenAiText(payload);

  if (!summary) {
    throw new Error("OpenAI narrative response did not include text.");
  }

  return {
    mode: "openai",
    status: "generated",
    provider: "openai-responses",
    model,
    summary
  };
}

async function ollamaNarrative(input: NarrativeInput): Promise<AiNarrative> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL ?? "llama3.1";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "system",
          content: aiInstructions
        },
        {
          role: "user",
          content: JSON.stringify(compactInput(input))
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama narrative failed with ${response.status}`);
  }

  const payload = (await response.json()) as OllamaResponse;
  const summary = payload.message?.content?.trim() ?? payload.response?.trim();

  if (!summary) {
    throw new Error("Ollama narrative response did not include text.");
  }

  return {
    mode: "ollama",
    status: "generated",
    provider: "ollama",
    model,
    summary
  };
}

function requestedProvider(): "template" | "openai" | "ollama" {
  if (process.env.NODE_ENV === "test") {
    return "template";
  }

  const configured = process.env.AI_PROVIDER?.toLocaleLowerCase("en");
  if (configured === "template" || configured === "openai" || configured === "ollama") {
    return configured;
  }

  if (process.env.OPENAI_API_KEY) {
    return "openai";
  }

  if (process.env.OLLAMA_BASE_URL) {
    return "ollama";
  }

  return "template";
}

export async function generateAiNarrative(
  input: NarrativeInput
): Promise<AiNarrative> {
  const fallback = templateNarrative(input);
  const provider = requestedProvider();

  if (provider === "template") {
    return fallback;
  }

  try {
    return provider === "openai"
      ? await openAiNarrative(input)
      : await ollamaNarrative(input);
  } catch (cause) {
    return {
      ...fallback,
      status: "fallback",
      note:
        cause instanceof Error
          ? `AI kutsumine ebaõnnestus, kasutati mallteksti: ${cause.message}`
          : "AI kutsumine ebaõnnestus, kasutati mallteksti."
    };
  }
}
