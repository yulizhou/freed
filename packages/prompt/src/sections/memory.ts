/**
 * Memory surfacing section.
 * Calls MemoryManager to build a context summary.
 */
// Note: Dynamic import to avoid circular dependency at module load time.
// Actual MemoryManager instance is passed in from the assembler.
export type MemorySummaryProvider = () => Promise<string>

export async function getMemorySection(
  getMemorySummary: MemorySummaryProvider,
): Promise<string | null> {
  const summary = await getMemorySummary()
  if (!summary) {
    return null
  }
  return `## Memory Context\n\n${summary}`
}
