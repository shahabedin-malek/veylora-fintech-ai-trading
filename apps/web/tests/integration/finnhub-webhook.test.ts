import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/webhooks/finnhub/route";
import { prisma } from "@/lib/db";
import { deriveFinnhubEventId } from "@/lib/finnhub/webhook";

/**
 * The Finnhub receiver is a value-in surface, so the properties that matter are
 * structural: it must accept nothing when unconfigured, refuse a bad secret, reject a
 * body it cannot parse, record a verified delivery exactly once, and treat a replay as
 * a no-op. Crucially, it never changes a balance.
 *
 * The route runs for real against the throwaway DB; only the env is stubbed.
 */

const SECRET = "finnhub_test_secret_0001";
const URL = "http://localhost:3210/api/webhooks/finnhub";
const BODY = JSON.stringify({
  type: "trade",
  data: [{ s: "AAPL", p: 336.64, t: 1791576000, v: 100 }],
});

function post(body: string, secret?: string): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== undefined) headers["x-finnhub-secret"] = secret;
  return POST(new Request(URL, { method: "POST", headers, body }));
}

async function finnhubEvents() {
  return prisma.webhookEvent.findMany({ where: { provider: "finnhub" }, orderBy: { receivedAt: "desc" } });
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await prisma.webhookEvent.deleteMany({ where: { provider: "finnhub" } });
});

describe("POST /api/webhooks/finnhub", () => {
  it("is disabled (503) and records nothing when no secret is configured", async () => {
    vi.stubEnv("FINNHUB_WEBHOOK_SECRET", "");
    const res = await post(BODY, "anything");
    expect(res.status).toBe(503);
    expect(await finnhubEvents()).toHaveLength(0);
  });

  it("refuses (401) a delivery with a wrong or missing secret", async () => {
    vi.stubEnv("FINNHUB_WEBHOOK_SECRET", SECRET);
    expect((await post(BODY, "wrong")).status).toBe(401);
    expect((await post(BODY)).status).toBe(401);
    expect(await finnhubEvents()).toHaveLength(0);
  });

  it("rejects (400) a verified delivery whose body is not a JSON object", async () => {
    vi.stubEnv("FINNHUB_WEBHOOK_SECRET", SECRET);
    expect((await post("not json", SECRET)).status).toBe(400);
    expect(await finnhubEvents()).toHaveLength(0);
  });

  it("records a verified delivery once and changes no balance", async () => {
    vi.stubEnv("FINNHUB_WEBHOOK_SECRET", SECRET);
    const res = await post(BODY, SECRET);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "recorded" });

    const rows = await finnhubEvents();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      provider: "finnhub",
      eventId: deriveFinnhubEventId(BODY),
      eventType: "trade",
      status: "IGNORED", // no handler consumes Finnhub events yet
      userId: null,
    });
  });

  it("treats a replay of the same delivery as a no-op", async () => {
    vi.stubEnv("FINNHUB_WEBHOOK_SECRET", SECRET);
    await post(BODY, SECRET);
    const replay = await post(BODY, SECRET);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ result: "duplicate" });
    expect(await finnhubEvents()).toHaveLength(1);
  });
});
