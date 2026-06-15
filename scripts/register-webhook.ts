import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const ULTRAVOX_API_KEY = process.env.ULTRAVOX_API_KEY;
const TRELX_URL = process.env.TRELX_URL ?? "https://trelx.vercel.app";

if (!ULTRAVOX_API_KEY) {
  console.error("Missing ULTRAVOX_API_KEY in .env.local");
  process.exit(1);
}

const targetWebhookUrl = `${TRELX_URL}/api/webhook/ultravox`;

async function main() {
  console.log(`Checking existing webhooks...`);
  
  // Try to GET existing webhooks to avoid duplicates (if supported)
  const listResp = await fetch("https://api.ultravox.ai/api/webhooks", {
    headers: { "X-API-Key": ULTRAVOX_API_KEY! }
  });
  
  if (listResp.ok) {
    const data = await listResp.json() as { results?: { url: string; webhookId: string }[] };
    if (data.results) {
      const existing = data.results.find((w) => w.url === targetWebhookUrl);
      if (existing) {
        console.log(`✅ Webhook already registered for ${targetWebhookUrl} (ID: ${existing.webhookId})`);
        return;
      }
    }
  }

  console.log(`Registering webhook for ${targetWebhookUrl}...`);
  const reqBody = {
    url: targetWebhookUrl,
    events: ["call.ended"]
  };

  const createResp = await fetch("https://api.ultravox.ai/api/webhooks", {
    method: "POST",
    headers: {
      "X-API-Key": ULTRAVOX_API_KEY!,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(reqBody)
  });

  if (!createResp.ok) {
    const text = await createResp.text();
    console.error(`❌ Failed to register webhook: ${createResp.status} ${createResp.statusText}`);
    console.error(text);
    process.exit(1);
  }

  const result = await createResp.json() as { webhookId: string };
  console.log(`✅ Successfully registered webhook! ID: ${result.webhookId}`);
}

main().catch(console.error);
