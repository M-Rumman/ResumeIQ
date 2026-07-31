/** Metadata-only telemetry for resume analysis. Never pass resume, prompt, or model content here. */
export type AiObservabilityContext = {
  requestId: string;
  startedAt: number;
};

export function createAiObservabilityContext(requestId: string): AiObservabilityContext {
  return { requestId, startedAt: Date.now() };
}

export function logAiEvent(
  context: AiObservabilityContext | undefined,
  event: string,
  metadata: Record<string, unknown> = {},
): void {
  if (!context) return;
  console.info('[ai-observability]', {
    requestId: context.requestId,
    event,
    elapsedMs: Date.now() - context.startedAt,
    ...metadata,
  });
}

export function textMetadata(value: string): { chars: number; bytes: number } {
  return { chars: value.length, bytes: Buffer.byteLength(value, 'utf8') };
}
