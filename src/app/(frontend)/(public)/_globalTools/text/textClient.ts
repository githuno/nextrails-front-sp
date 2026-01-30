/**
 * Text client - Markdown parsing & serialization utilities
 * Handles Front-matter + body markdown format
 */

/**
 * Front-matter metadata
 */
export interface TextMetadata {
  title: string
  tags: string[]
  createdAt: Date
  updatedAt?: Date
  wordCount: number
}

/**
 * Parsed markdown document
 */
export interface ParsedMarkdown {
  metadata: TextMetadata
  body: string
}

/**
 * Text client - Markdown parsing & serialization
 */
export const createTextClient = () => {
  const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/

  return {
    /**
     * Count words in text
     */
    countWords: (text: string): number => {
      return text
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0).length
    },

    /**
     * Parse markdown with front-matter
     */
    parseMarkdown: (markdown: string): ParsedMarkdown => {
      const match = markdown.match(FRONTMATTER_REGEX)

      if (!match) {
        // No front-matter found
        return {
          metadata: {
            title: "Untitled",
            tags: [],
            createdAt: new Date(),
            wordCount: 0,
          },
          body: markdown,
        }
      }

      const [, frontMatterStr, body] = match

      try {
        // Simple YAML-like parsing (avoid heavy dependencies)
        const lines = frontMatterStr.split("\n")
        const frontMatter: Record<string, unknown> = {}

        for (const line of lines) {
          if (!line.trim()) continue

          const colonIdx = line.indexOf(":")
          if (colonIdx === -1) continue

          const key = line.substring(0, colonIdx).trim()
          const valueStr = line.substring(colonIdx + 1).trim()

          if (key === "title") {
            frontMatter.title = valueStr.replace(/^["']|["']$/g, "")
          } else if (key === "tags") {
            // Parse array: [tag1, tag2]
            const match = valueStr.match(/^\[(.*?)\]$/)
            if (match) {
              frontMatter.tags = match[1]
                .split(",")
                .map((t) => t.trim().replace(/^["']|["']$/g, ""))
                .filter((t) => t.length > 0)
            }
          } else if (key === "createdAt") {
            frontMatter.createdAt = new Date(valueStr.replace(/^["']|["']$/g, ""))
          } else if (key === "wordCount") {
            frontMatter.wordCount = parseInt(valueStr, 10)
          }
        }

        return {
          metadata: {
            title: (frontMatter.title as string) || "Untitled",
            tags: (frontMatter.tags as string[]) || [],
            createdAt: (frontMatter.createdAt as Date) || new Date(),
            wordCount: (frontMatter.wordCount as number) || 0,
          },
          body,
        }
      } catch (err) {
        console.error("Failed to parse front-matter:", err)
        // Parsing failed, treat entire content as body
        return {
          metadata: {
            title: "Untitled",
            tags: [],
            createdAt: new Date(),
            wordCount: 0,
          },
          body: markdown,
        }
      }
    },

    /**
     * Serialize markdown with front-matter
     */
    serializeMarkdown: (data: {
      title: string
      tags: string[]
      body: string
      wordCount: number
      createdAt?: Date
    }): string => {
      const frontMatter = [
        "---",
        `title: "${data.title}"`,
        `tags: [${data.tags.map((t) => `"${t}"`).join(", ")}]`,
        `createdAt: "${(data.createdAt || new Date()).toISOString()}"`,
        `wordCount: ${data.wordCount}`,
        "---",
        "",
      ].join("\n")

      return frontMatter + data.body
    },

    /**
     * Extract preview from markdown (first N characters)
     */
    extractPreview: (markdown: string, maxChars: number = 100): string => {
      try {
        const parsed = createTextClient().parseMarkdown(markdown)
        const preview = parsed.body
          .replace(/[#*_`[\]()]/g, "")
          .split("\n")
          .filter((line) => line.trim().length > 0)
          .join(" ")
          .substring(0, maxChars)

        return preview
      } catch {
        return markdown.substring(0, maxChars)
      }
    },

    /**
     * Extract title from markdown content
     */
    extractTitle: (markdown: string): string => {
      try {
        const parsed = createTextClient().parseMarkdown(markdown)
        return parsed.metadata.title
      } catch {
        return "Untitled"
      }
    },

    /**
     * Extract tags from markdown content
     */
    extractTags: (markdown: string): string[] => {
      try {
        const parsed = createTextClient().parseMarkdown(markdown)
        return parsed.metadata.tags
      } catch {
        return []
      }
    },
  }
}

export type TextClient = ReturnType<typeof createTextClient>
