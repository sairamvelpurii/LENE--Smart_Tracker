import type { IncomingMessage } from "node:http";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { extractTransactionsWithOpenAI } from "./server/openaiStatementExtract";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer | string) => {
      chunks.push(typeof c === "string" ? Buffer.from(c) : c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const openaiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";
  const openaiModel =
    env.OPENAI_EXTRACT_MODEL || process.env.OPENAI_EXTRACT_MODEL || "gpt-4o-mini";

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "lene-statement-extract",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = req.url?.split("?")[0] ?? "";
            if (url !== "/api/extract-statement" || req.method !== "POST") {
              return next();
            }

            if (!openaiKey) {
              res.statusCode = 503;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error: "no_api_key",
                  message:
                    "Add OPENAI_API_KEY to .env in the project root (dev server only; never committed).",
                }),
              );
              return;
            }

            let body: string;
            try {
              body = await readBody(req as IncomingMessage);
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "read_body_failed" }));
              return;
            }

            let json: { text?: string; fileHint?: string };
            try {
              json = JSON.parse(body) as { text?: string; fileHint?: string };
            } catch {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "invalid_json" }));
              return;
            }

            const text = json.text ?? "";
            if (!text.trim()) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "empty_text" }));
              return;
            }

            try {
              const transactions = await extractTransactionsWithOpenAI(
                text,
                openaiKey,
                openaiModel,
              );
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ transactions }));
            } catch (e) {
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error: "extract_failed",
                  message: String((e as Error).message).slice(0, 600),
                }),
              );
            }
          });
        },
      },
    ],
  };
});
