import { z } from "zod";
import { infrai } from "./infrai.js";

export const sweepRequest = z.object({ tenantId: z.string().min(1), accounts: z.array(z.object({ id: z.string(), state: z.enum(["active", "suspended", "closed"]), lastSeen: z.string().datetime(), recordKey: z.string() })) });
type Account = z.infer<typeof sweepRequest>["accounts"][number];
const STALE_DAYS = 90;

export function staleAccounts(accounts: Account[], now = new Date()): Account[] {
  const cutoff = now.getTime() - STALE_DAYS * 86400000;
  return accounts.filter((account) => account.state === "closed" && Date.parse(account.lastSeen) < cutoff);
}

export async function scheduleSweep(webhook: string): Promise<string> {
  const result = await infrai.cron.create({ cron_expr: "0 2 * * *", task: webhook });
  return result.job_id;
}

export async function deleteFound(tenantId: string, keys: string[]): Promise<void> {
  await infrai.storage.bucket.create(tenantId);
  if (keys.length) {
    const result = await infrai.storage.object.delete_batch(tenantId, keys);
    if (result.errors?.length) throw new AggregateError(result.errors, "Some objects could not be deleted");
  }
}

if (process.argv[1]?.endsWith("cleanup_sweep.ts")) {
  const webhook = process.env.SWEEP_WEBHOOK_URL ?? "https://example.invalid/cleanup";
  const jobId = await scheduleSweep(webhook);
  console.log(JSON.stringify({ scheduled: jobId }));
}
