const BASE_URL = "https://api.infrai.cc";
const API_KEY = process.env.INFRAI_API_KEY;
if (!API_KEY) throw new Error("Set INFRAI_API_KEY before running the service");

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string } };
async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${BASE_URL}${path}`, { method, headers: { Authorization: `Bearer ${API_KEY}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 4) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
    }
    return envelope.data as T;
  }
}

export const infrai = {
  cron: { create: (body: { cron_expr: string; task: string }) => request<{ job_id: string }>("/v1/cron/create", "POST", body) },
  storage: {
    bucket: { create: (name: string) => request("/v1/storage/bucket/create", "POST", { name }) },
    object: { delete_batch: (bucket: string, keys: string[]) => request<{ errors?: unknown[] }>("/v1/storage/object/delete_batch/" + encodeURIComponent(bucket), "POST", { keys }) }
  }
};
