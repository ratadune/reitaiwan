import { Message } from "../messages/messages";

const PROXY_URL = '/reitaiwan/api-proxy.html';

export async function getAnthropicChatResponseStream(
  messages: Message[],
  apiKey: string,
  model: string
) {
  const response = await fetch(`${PROXY_URL}?api_key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: messages,
      model: model,
      max_tokens: 200,
      stream: true,
    }),
  });

  if (!response.body) {
    throw new Error('Response body is null');
  }

  return new ReadableStream<string>({
    async start(controller) {
      // 使用類型斷言來告訴 TypeScript response.body 不為 null
      const reader = (response.body as ReadableStream<Uint8Array>).getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'content_block_delta') {
                  controller.enqueue(data.delta.text);
                }
              } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
              }
            }
          }
        }
      } catch (error) {
        console.error('Stream reading error:', error);
        controller.error(error);
      } finally {
        reader.releaseLock();
        controller.close();
      }
    }
  });
}
