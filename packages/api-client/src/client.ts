import createClient from "openapi-fetch";
import type { paths } from "./gen/schema.js";

export type GnndexPaths = paths;

export function createGnndexClient(
  baseUrl = "http://localhost:4000/v1",
  options?: { fetch?: typeof fetch }
) {
  return createClient<paths>({
    baseUrl,
    fetch: options?.fetch
  });
}
