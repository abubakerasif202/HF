import "server-only";
import { z } from "zod";

// Exact origin allowlist prevents configuration/user input from targeting internal services.
export const MAUTIC_ORIGIN = "https://marketing.hfremovalsadelaide.com";
export class MauticError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(code: string, status?: number) {
    super(code); this.name = "MauticError"; this.code = code; this.status = status;
  }
}
export function mauticConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.MAUTIC_ENABLED !== "true") return null;
  let url: URL;
  try { url = new URL(env.MAUTIC_BASE_URL ?? ""); } catch { throw new MauticError("invalid_configuration"); }
  if (url.origin !== MAUTIC_ORIGIN || url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) throw new MauticError("invalid_configuration");
  if (!env.MAUTIC_USERNAME || !env.MAUTIC_PASSWORD || env.MAUTIC_USERNAME.includes(":")) throw new MauticError("invalid_configuration");
  return { origin: url.origin, authorization: `Basic ${Buffer.from(`${env.MAUTIC_USERNAME}:${env.MAUTIC_PASSWORD}`).toString("base64")}` };
}
export const contactSchema = z.object({ id: z.number().int().positive(), fields: z.object({ all: z.record(z.string(), z.unknown()) }) });
export function createMauticClient(config: NonNullable<ReturnType<typeof mauticConfig>>, fetcher: typeof fetch = fetch, timeoutMs = 2500) {
  // One deadline covers lookup AND write, including response body consumption.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  async function request(path: string, method = "GET", body?: unknown): Promise<unknown> {
    try {
      const response = await fetcher(`${config.origin}/api/${path}`, {
        method, signal: controller.signal, redirect: "error", cache: "no-store",
        headers: { Authorization: config.authorization, Accept: "application/json", "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) throw new MauticError(response.status === 401 || response.status === 403 ? "authentication_failed" : "http_error", response.status);
      return await response.json().catch(() => { throw new MauticError("invalid_response"); });
    } catch (error) {
      if (error instanceof MauticError) throw error;
      throw new MauticError(controller.signal.aborted ? "timeout" : "network_error");
    }
  }
  return { request, close: () => clearTimeout(timer) };
}
