export type ProviderKind = "openai-compatible" | "ollama";

export type ModelOption = {
  name: string;
  provider: ProviderKind;
  model: string;
  apiBase: string;
  apiKey?: string;
  model_type?: "chat" | "embedding" | "vision";
  temperature?: number;
};

import config from "../../config.json";

export const MODEL_OPTIONS: Record<string, ModelOption> = config;
