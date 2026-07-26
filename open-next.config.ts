import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * No incremental cache override on purpose.
 *
 * Every dynamic surface here is `force-dynamic` — rooms change by the second
 * and the admin reads live data. The only static page is the landing, which
 * Workers already serves from the assets binding. An R2 cache would be a
 * bucket to provision and pay for with nothing to put in it.
 */
export default defineCloudflareConfig();
