import type { ToolOutput } from './types.js';

export function textOutput(text: string): ToolOutput {
  return {
    content: [{ type: 'text', text }],
  };
}

export function structuredOutput(
  structuredContent: Record<string, unknown>,
  text: string,
): ToolOutput {
  return {
    structuredContent,
    content: [{ type: 'text', text }],
  };
}

export function errorOutput(
  message: string,
  structuredContent: Record<string, unknown> = { success: false, message },
  isError = false,
): ToolOutput {
  return {
    structuredContent,
    content: [{ type: 'text', text: message }],
    ...(isError ? { isError: true } : {}),
  };
}
