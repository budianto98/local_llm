"use client";

import { FormEvent, useMemo, useState, ChangeEvent } from "react";
import { MODEL_OPTIONS } from "@/lib/models";
import { Typography } from '@mui/material';

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export default function Home() {
  const modelEntries = useMemo(
    () => Object.entries(MODEL_OPTIONS),
    []
  );
  console.log(
    "Available models:",
    modelEntries.map(([key, value]) => `${key} (${value.provider})`)
  );

  const [selectedModel, setSelectedModel] = useState(
    modelEntries[0]?.[0] ?? ""
  );
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "system",
      content:
        "Assistant UI local model tester is ready. This chat is stateless and sends only your latest prompt.",
    },
  ]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((!input.trim() && !file) || !selectedModel || loading) return;

    const prompt = input.trim();
    setInput("");
    setError("");
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content:
          prompt +
          (file ? ` [file: ${file.name}]` : ""),
      },
    ]);

    let fileData: string | undefined;
    let fileType: string | undefined;

    if (file) {
      fileType = file.type;
      fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(reader.result as string); // this is data:...;base64,...
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    try {
      const modelConfig = MODEL_OPTIONS[selectedModel];

      let body: any = {
        modelKey: selectedModel,
        message: prompt,
      };

      if (
        modelConfig?.model_type === "vision" &&
        fileData &&
        fileType &&
        // Check extensions safely
        ["image/png", "image/jpeg", "image/jpg"].includes(fileType)
      ) {
        // Reader already gives data:image/...;base64
        const imageUrl =
          fileData.startsWith("data:image/")
            ? fileData
            : `data:${fileType};base64,${fileData}`;

        body = {
          modelKey: selectedModel,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: imageUrl },
                },
                {
                  type: "text",
                  text: prompt || "Describe the image.",
                },
              ],
            },
          ],
          // optional metadata
          fileName: file?.name,
        };
      } else {
        body.file = fileData;
        body.fileType = fileType;
        body.fileName = file?.name;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Request failed.");
      }

      const payload = (await response.json()) as {
        output: string;
        embedding?: number[];
      };
      console.log("Received response:", payload);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            payload.output ||
            "len of embedding: " +
              (payload.embedding?.length
                ? `Embedding vector (length: ${payload.embedding.length})`
                : "(No response text)"),
        },
      ]);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unknown error";

      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${message}`,
        },
      ]);
    } finally {
      setLoading(false);
      setFile(null);
      setFilePreview(null);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null;
    setFile(selected);

    if (selected && selected.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () =>
        setFilePreview(reader.result as string);
      reader.readAsDataURL(selected);
    } else {
      setFilePreview(null);
    }
  };

  return (
    <main className="layout">
      <aside className="sidebar">
        <h1>Assistant UI Chat Bot</h1>
        <p className="muted">Choose a model, then test prompts.</p>

        <label htmlFor="model-select">Model</label>
        <select
          id="model-select"
          value={selectedModel}
          onChange={(event) =>
            setSelectedModel(event.target.value)
          }
        >
          {modelEntries.map(([key, value]) => (
            <option key={key} value={key}>
              {value.name} ({value.provider})
            </option>
          ))}
        </select>

        <div className="model-meta">
          <p>
            <span className="muted">Config:</span>
            <pre
              style={{
                fontSize: "0.8em",
                background: "#111",
                color: "#fff",
                padding: "8px",
                borderRadius: "4px",
                overflowX: "auto",
              }}
            >
              {JSON.stringify(
                MODEL_OPTIONS[selectedModel],
                null,
                2
              )}
            </pre>
          </p>

          <p>
            <span className="muted">Memory:</span> Disabled (single prompt only)
          </p>
        </div>
      </aside>

      <section className="chat-panel">
        <div className="messages">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`bubble ${message.role}`}
            >
              <strong>{message.role}</strong>
              <p>{message.content}</p>
            </div>
          ))}
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(event) =>
              setInput(event.target.value)
            }
            placeholder="Type a prompt and press Send..."
            rows={4}
          />
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt,.md,.rtf,.odt"
            onChange={handleFileChange}
            style={{ margin: "8px 0" }}
          />
          {filePreview && (
            <div style={{ marginBottom: 8 }}>
              <img
                src={filePreview}
                alt="Preview"
                style={{
                  maxWidth: 180,
                  maxHeight: 120,
                  borderRadius: 4,
                }}
              />
            </div>
          )}
          {file && !filePreview && (
            <div style={{ marginBottom: 8 }}>
              <span>Selected file: {file.name}</span>
            </div>
          )}
          <div className="composer-footer">
            {error ? (
              <span className="error">{error}</span>
            ) : (
              <span className="muted">Stateless run</span>
            )}
            <button
              type="submit"
              disabled={loading || (!input.trim() && !file)}
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}