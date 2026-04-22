import { NextRequest, NextResponse } from "next/server";
import { MODEL_OPTIONS } from "@/lib/models";

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
};

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

const createAuthHeader = (rawKey: string | undefined) => {
  const key = rawKey?.trim();
  if (!key || key.startsWith("YOUR_")) {
    return undefined;
  }
  return `Bearer ${key}`;
};

const getNetworkErrorMessage = (error: unknown, url: string) => {
  if (error instanceof Error) {
    const cause = error.cause as
      | { code?: string; errno?: string; address?: string; port?: number }
      | undefined;
    const causeDetails = cause
      ? [cause.code, cause.errno, cause.address, cause.port]
          .filter(Boolean)
          .join(" ")
      : "";
    return `Network error calling ${url}: ${error.message}${causeDetails ? ` (${causeDetails})` : ""}`;
  }
  return `Network error calling ${url}`;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      modelKey?: string;
      message?: string;
      messages?: Array<{ role: "user" | "assistant" | "system"; content: string | Array<{
        type: "text" | "image_url";
        text?: string;
        image_url?: { url: string };
      }>; }>;
      fileName?: string;
    };

    const modelKey = body.modelKey?.trim();
    const message = body.message?.trim();
    const messages = body.messages; // may be undefined'

    if (!modelKey || (!message && !messages)) {
        return NextResponse.json(
            { error: "Missing modelKey or message." },
            { status: 400 },
        );
    }

    const selectedModel = MODEL_OPTIONS[modelKey];
    if (!selectedModel) {
      return NextResponse.json({ error: "Unknown model selected." }, { status: 400 });
    }

    // Always include the selected model config in the response
    const modelConfig = { ...selectedModel };

    if (selectedModel.provider === "openai-compatible") {
        const url = `${normalizeBaseUrl(selectedModel.apiBase)}/chat/completions`;
        const authHeader = createAuthHeader(selectedModel.apiKey);

        const openaiMessages = messages
            ? messages
            : [{ role: "user" as const, content: message }];

        let response: Response;
        try {
            response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(authHeader ? { Authorization: authHeader } : {}),
            },
            body: JSON.stringify({
                model: selectedModel.model,
                temperature: selectedModel.temperature ?? 0.2,
                stream: false,
                messages: openaiMessages,
            }),
            });
        } catch (error) {
            return NextResponse.json(
            { error: getNetworkErrorMessage(error, url) },
            { status: 500 },
            );
        }

        if (!response.ok) {
            const details = await response.text();
            return NextResponse.json(
            {
                error: `Upstream error (${response.status}): ${details || response.statusText}`,
            },
            { status: 500 },
            );
        }

        const payload = (await response.json()) as OpenAIChatResponse;
        const output = payload.choices?.[0]?.message?.content?.trim();
        return NextResponse.json({
          output: output || "(No content returned).",
          modelConfig,
        });
    }

    // Handle Ollama models
    if (selectedModel.provider === "ollama") {
        const isEmbedding = selectedModel.model_type === "embedding";
        const endpoint = isEmbedding ? "/api/embeddings" : "/api/chat";
        
        const payload = isEmbedding
            ? {
                model: selectedModel.model,
                prompt: message,
            }
            : {
                model: selectedModel.model,
                stream: false,
                messages: [{ role: "user", content: message }],
                options: {
                temperature: selectedModel.temperature ?? 0.2,
                },
            };
        const ollamaUrl = `${normalizeBaseUrl(selectedModel.apiBase)}${endpoint}`;
        let response: Response;

        try{
            response = await fetch(ollamaUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
        }
        catch (error) {
            return NextResponse.json(
                { error: getNetworkErrorMessage(error, ollamaUrl) },
                { status: 500 },
            );
        }
       

        if (!response.ok) {
            const details = await response.text();
            return NextResponse.json(
            {
                error: `Ollama error (${response.status}): ${details || response.statusText}`,
            },
            { status: 500 },
            );
        }

        const result = await response.json();
        if (selectedModel.model_type === "embedding") {
            // Return embedding vector or error
            console.log("Received embedding response:", result);
            return NextResponse.json({
              embedding: result.embedding ?? null,
              modelConfig,
            });
        } else {
            // chat
            const output = result.message?.content?.trim();
            return NextResponse.json({
              output: output || "(No content returned).",
              modelConfig,
            });
        }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
