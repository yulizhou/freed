/**
 * System-reminder wrapper for meta messages.
 * Per-turn dynamic information is injected as system-reminder user messages,
 * not as part of the stable system prompt.
 */

export function wrapInSystemReminder(content: string): string {
  return `<system-reminder>\n${content}\n</system-reminder>`
}

export function wrapMessagesInSystemReminder(
  messages: { message: { content: string | unknown } }[],
): typeof messages {
  return messages.map((msg) => {
    const content = msg.message.content
    if (typeof content === 'string') {
      return {
        ...msg,
        message: {
          ...msg.message,
          content: wrapInSystemReminder(content),
        },
      }
    }
    return msg
  })
}
