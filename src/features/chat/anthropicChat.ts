import { Message } from "../messages/messages";

const WORKER_URL = 'https://anthropic-api-proxy.ratadune.workers.dev/'; 
console.log("WORKER_URL=", WORKER_URL);

export async function getAnthropicChatResponseStream(
  messages: Message[],
  apiKey: string,
  model: string
) {
  console.log("Function called with:", {
    messagesCount: messages.length,
    apiKeyLength: apiKey.length,
    model: model
  });

  const requestBody = {
    messages: messages,
    model: model,
    max_tokens: 200,
    stream: true,
  };
  console.log("Request body:", JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(`${WORKER_URL}?api_key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log("Response status:", response.status);
    console.log("Response headers:", JSON.stringify(Object.fromEntries(response.headers), null, 2));

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    if (!response.body) {
      console.error("Response body is null");
      throw new Error('Response body is null');
    }

    return new ReadableStream<string>({
      async start(controller) {
        const reader = (response.body as ReadableStream<Uint8Array>).getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log("Stream complete");
              break;
            }
            const chunk = new TextDecoder().decode(value);
            console.log("Received chunk:", chunk);
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
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}
