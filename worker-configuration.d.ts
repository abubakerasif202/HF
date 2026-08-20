declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    QUOTE_ENDPOINT_URL?: string;
    QUOTE_BEARER_TOKEN?: string;
    QUOTE_RATE_LIMITER?: RateLimit;
  }
}
