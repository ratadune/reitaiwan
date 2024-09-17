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

  // 提取系統消息
  const systemMessage = messages.find(msg => msg.role === "system");
  const userMessages = messages.filter(msg => msg.role !== "system");

  const requestBody = {
    messages: userMessages,
    model: model,
    max_tokens: 200,
    stream: true,
    system: systemMessage ? systemMessage.content : undefined,
  };
  console.log("Request body:", JSON.stringify(requestBody, null, 2));
  console.log("apiK:", apiKey);
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

    // ... 其餘的流處理代碼保持不變 ...
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}
