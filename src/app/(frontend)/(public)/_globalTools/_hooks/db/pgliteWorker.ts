import { PGlite } from "@electric-sql/pglite"
import { worker } from "@electric-sql/pglite/worker"

let fetchPatched = false

const isRelativePath = (url: string): boolean => url.startsWith("/") && !url.startsWith("//")

const getBaseUrl = (options: unknown): string | undefined => {
  if (!options || typeof options !== "object") return
  const candidate = (options as Record<string, unknown>).__ftbBaseUrl
  if (typeof candidate !== "string") return
  return candidate
}

void worker({
  init: async (options) => {
    const baseUrlCandidate = getBaseUrl(options)
    if (!baseUrlCandidate && !fetchPatched) {
      throw new Error("Missing required __ftbBaseUrl option for PGlite worker fetch patch.")
    }

    if (!fetchPatched && baseUrlCandidate) {
      try {
        const parsedBaseUrl = new URL(baseUrlCandidate)
        const baseUrl = parsedBaseUrl.origin === "null" ? parsedBaseUrl.toString() : parsedBaseUrl.origin
        const originalFetch = globalThis.fetch.bind(globalThis)
        const toAbsolute = (url: string) => new URL(url, baseUrl).toString()

        globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
          let urlStr = ""
          if (typeof input === "string") {
            urlStr = input
          } else if (input instanceof URL) {
            urlStr = input.href
          } else {
            urlStr = (input as Request).url
          }

          if (isRelativePath(urlStr)) {
            return originalFetch(toAbsolute(urlStr), init)
          }
          return originalFetch(input, init)
        }) as typeof fetch

        fetchPatched = true
      } catch (err) {
        throw new Error("Failed to patch fetch in PGlite worker", { cause: err })
      }
    }

    const createOptions: Record<string, unknown> = {
      ...(options as Record<string, unknown>),
      relaxedDurability: true,
    }
    delete createOptions.__ftbBaseUrl

    const pg = await PGlite.create(createOptions as unknown as Parameters<typeof PGlite.create>[0])
    return pg
  },
})
