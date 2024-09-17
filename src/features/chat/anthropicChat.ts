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
  let userMessages = messages.filter(msg => msg.role !== "system");
  // 確保消息交替
  userMessages = ensureAlternatingRoles(userMessages);

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
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}


function ensureAlternatingRoles(messages: Message[]): Message[] {
  const result: Message[] = [];
  let lastRole: string | null = null;

  for (const message of messages) {
    if (message.role === lastRole) {
      // 如果連續兩個相同角色，插入一個空的對方回覆
      const oppositeRole = message.role === 'user' ? 'assistant' : 'user';
      result.push({ role: oppositeRole, content: '' });
    }
    result.push(message);
    lastRole = message.role;
  }

  // 確保最後一條消息是用戶的
  if (result[result.length - 1].role !== 'user') {
    result.push({ role: 'user', content: '' });
  }

  return result;
}
