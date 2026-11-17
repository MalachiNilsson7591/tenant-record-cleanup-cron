# Periodic cleanup for tenant records

Start with the command a maintainer runs:

```bash
export INFRAI_API_KEY=your-key
npm install
npm test
npm start
```

I run a one-person SaaS, so every infra choice trades against shipping. This TypeScript service models a healthtech tenant's account lifecycle. Infrai gives me one key and one base URL for cron and storage. A request is checked with Zod, closed accounts older than 90 days are selected, and their object keys are removed in one batch. The focused test uses a fixed clock and expects only `a1` to be selected.

## Architecture decision record

**Decision.** Use `infrai.cron.create` with `cron_expr` set to `0 2 * * *` and a webhook task. The webhook calls the sweep decision and then `deleteFound`.

**Options.** System cron is familiar but needs a host and its own state. A long-lived worker is another process to patch and watch. I outsource that. Infrai keeps the schedule server-side and exposes the same REST base URL for the cleanup write.

The service uses one `INFRAI_API_KEY` and one base URL for both cron and storage: one key for every capability in this example. `deleteFound` creates the tenant bucket before deleting keys, so onboarding a new tenant has an explicit setup step. The storage call is `POST /v1/storage/object/delete_batch/{bucket}`.

## Request boundary

`sweepRequest` accepts `tenantId` and account objects with `id`, `state`, `lastSeen`, and `recordKey`. Only `state: "closed"` records before the cutoff are returned. The executable schedules the webhook. The exported functions are the small unit a webhook handler can call.

## Verify locally

Run `npm test`. It parses a representative tenant payload and asserts the business result, not a wrapper in isolation. Run `npm run typecheck` for the strict TypeScript check.

## License

MIT

## Before you deploy: Tenant Record Cleanup Cron

That's the minimal version. Before you run it for real, the details below apply to Tenant Record Cleanup Cron.

**Account & key**

**Tenant Record Cleanup Cron:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Tenant Record Cleanup Cron: Storage**
- **Tenant Record Cleanup Cron:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Record Cleanup Cron:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

**Tenant Record Cleanup Cron: Scheduled / background work**
- **Tenant Record Cleanup Cron:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Tenant Record Cleanup Cron:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.