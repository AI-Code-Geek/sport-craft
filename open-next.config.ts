import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// This app is fully dynamic (auth-gated pages, live poll/auction/scoring state) — no SSG/ISR pages,
// so no incremental-cache override is needed (unlike the read-only reports viewer this is patterned
// after). All persistence is the KV namespace bound below.
export default defineCloudflareConfig();
