import { afterEach, describe, expect, it, vi } from "vitest";

// `vi.hoisted` so the mock factories (which are hoisted above the imports) can see them.
const { syncSignals, refreshRiskNews, reconcileDesk } = vi.hoisted(() => ({
  syncSignals: vi.fn(async () => ({ persisted: 3, fetched: 4 })),
  refreshRiskNews: vi.fn(async () => ({ count: 5 })),
  reconcileDesk: vi.fn(async () => ({ ok: true, findings: [] })),
}));

vi.mock("@/lib/signals/sync", () => ({ syncSignals }));
vi.mock("@/lib/risk/news", () => ({ refreshRiskNews }));
vi.mock("@/lib/reconcile", () => ({ reconcileDesk }));

import { GET } from "@/app/api/cron/sync-desk/route";
import { GET as reconcileGET } from "@/app/api/cron/reconcile/route";

/**
 * The scheduled desk sync touches no money but it *is* an inbound surface, so it must
 * fail closed: disabled until a secret is set, and authorised only by an exact bearer
 * match. A scheduler (Vercel cron, a GitHub Action, an uptime pinger) is the only
 * caller.
 */

const SECRET = "cron-secret-value";

function request(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/sync-desk", { method: "GET", headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("GET /api/cron/sync-desk", () => {
  it("is disabled (503) and runs nothing when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(request({ authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(503);
    expect(syncSignals).not.toHaveBeenCalled();
    expect(refreshRiskNews).not.toHaveBeenCalled();
  });

  it("rejects a wrong or missing bearer (401)", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);

    expect((await GET(request())).status).toBe(401);
    expect((await GET(request({ authorization: "Bearer wrong" }))).status).toBe(401);
    expect((await GET(request({ authorization: SECRET }))).status).toBe(401);
    expect(syncSignals).not.toHaveBeenCalled();
  });

  it("runs the sync (200) with the correct bearer", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const res = await GET(request({ authorization: `Bearer ${SECRET}` }));

    expect(res.status).toBe(200);
    expect(syncSignals).toHaveBeenCalledTimes(1);
    expect(refreshRiskNews).toHaveBeenCalledTimes(1);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("reports a failure (500) rather than a false success", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    syncSignals.mockRejectedValueOnce(new Error("provider unreachable"));

    const res = await GET(request({ authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false, error: "provider unreachable" });
  });
});

describe("GET /api/cron/reconcile", () => {
  function reconcileRequest(headers: Record<string, string> = {}): Request {
    return new Request("http://localhost/api/cron/reconcile", { method: "GET", headers });
  }

  it("is disabled (503) and runs nothing when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await reconcileGET(reconcileRequest({ authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(503);
    expect(reconcileDesk).not.toHaveBeenCalled();
  });

  it("rejects a wrong or missing bearer (401)", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    expect((await reconcileGET(reconcileRequest())).status).toBe(401);
    expect((await reconcileGET(reconcileRequest({ authorization: "Bearer wrong" }))).status).toBe(401);
    expect(reconcileDesk).not.toHaveBeenCalled();
  });

  it("runs the reconciliation (200) with the correct bearer", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const res = await reconcileGET(reconcileRequest({ authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(200);
    expect(reconcileDesk).toHaveBeenCalledTimes(1);
    expect(await res.json()).toMatchObject({ ok: true });
  });
});
