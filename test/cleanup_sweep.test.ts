import assert from "node:assert/strict";
import { deleteFound, staleAccounts, sweepRequest } from "../src/cleanup_sweep.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const parsed = sweepRequest.parse({ tenantId: "clinic-a", accounts: [
  { id: "a1", state: "closed", lastSeen: "2025-08-01T00:00:00.000Z", recordKey: "records/a1" },
  { id: "a2", state: "active", lastSeen: "2025-01-01T00:00:00.000Z", recordKey: "records/a2" },
  { id: "a3", state: "closed", lastSeen: "2025-12-15T00:00:00.000Z", recordKey: "records/a3" }
] });
assert.deepEqual(staleAccounts(parsed.accounts, now).map((a) => a.id), ["a1"]);
console.log("cleanup decision test passed");

const originalFetch = globalThis.fetch;
const errors = [{ key: "records/a1", code: "ACCESS_DENIED", message: "Deletion denied" }];
let batchErrors = errors;
globalThis.fetch = async (input) => new Response(JSON.stringify({
  ok: true,
  data: String(input).includes("/delete_batch/") ? { errors: batchErrors } : {}
}));
try {
  await assert.rejects(deleteFound("clinic-a", ["records/a1"]), (error: unknown) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, errors);
    return true;
  });
  batchErrors = [];
  await deleteFound("clinic-a", ["records/a1"]);
  await deleteFound("clinic-a", []);
} finally {
  globalThis.fetch = originalFetch;
}
console.log("batch cleanup error test passed");
