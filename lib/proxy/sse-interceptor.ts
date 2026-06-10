import { inspectSamplingRequest, type McpSamplingRequest, type SamplingInspectionResult } from './sampling-inspector';

/**
 * Wraps a ReadableStream (SSE response body) with a TransformStream
 * that inspects each SSE data event for MCP sampling requests.
 *
 * In 'block' mode, sampling requests with CRITICAL findings are replaced
 * with error responses. In 'monitor' mode, findings are reported via callback
 * but the stream passes through unmodified.
 */
export function createSseInterceptor(
  originalStream: ReadableStream<Uint8Array>,
  mode: 'monitor' | 'block' | 'off',
  onSamplingFound: (result: SamplingInspectionResult) => void,
): ReadableStream<Uint8Array> {
  if (mode === 'off') return originalStream;

  const transformer = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);

      // Parse SSE data lines: "data: {...json...}"
      const dataLines: string[] = [];
      const lineRe = /^data: (.+)$/gm;
      let lineMatch: RegExpExecArray | null;
      while ((lineMatch = lineRe.exec(text)) !== null) {
        dataLines.push(lineMatch[1]);
      }

      if (dataLines.length === 0) {
        // No data lines — pass through
        controller.enqueue(chunk);
        return;
      }

      for (const dataLine of dataLines) {
        try {
          const json = JSON.parse(dataLine) as McpSamplingRequest;

          // Check if this is a sampling request
          if (json?.method === 'sampling/createMessage') {
            const result = inspectSamplingRequest(json);
            onSamplingFound(result);

            // In block mode: if CRITICAL finding, replace with blocked message
            if (mode === 'block' && !result.safe) {
              const errorPayload = JSON.stringify({
                jsonrpc: '2.0',
                error: {
                  code: -32600,
                  message:
                    'MCPGUARDIAN: Sampling request blocked — ' +
                    result.findings.map(f => f.type).join(', '),
                },
                id: (json as { id?: unknown }).id ?? null,
              });
              controller.enqueue(
                new TextEncoder().encode(`data: ${errorPayload}\n\n`),
              );
              return; // Don't forward the original chunk
            }
          }
        } catch {
          // Not JSON — pass through
        }
      }

      // No sampling request found or safe — pass through
      controller.enqueue(chunk);
    },
  });

  return originalStream.pipeThrough(transformer);
}
