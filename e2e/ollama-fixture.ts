import { createServer } from "node:http";

const host = "127.0.0.1";
const port = 11435;

createServer(async (request, response) => {
  if (request.method === "GET") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ models: [] }));
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const prompt = String(payload.messages?.at(-1)?.content ?? "");
  const date = prompt.match(/^Current date: (\d{4}-\d{2}-\d{2})/m)?.[1];
  const task = prompt.match(/^Command: Create a task: (.+)$/m)?.[1]?.trim();

  if (!date || !task) {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Unsupported E2E prompt" }));
    return;
  }

  const content = JSON.stringify({
    actions: [{
      method: "POST",
      path: "/api/journal",
      body: { date, signifier: "task", text: task },
    }],
    message: `Captured task: ${task}`,
  });

  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ message: { content } }));
}).listen(port, host, () => {
  console.log(`E2E Ollama fixture listening on http://${host}:${port}`);
});
