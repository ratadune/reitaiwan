import { Message } from "../messages/messages";
import { Anthropic } from "@anthropic-ai/sdk";

export async function getAnthropicChatResponse(messages: Message[], apiKey: string, model: string) {
  const client = new Anthropic({ apiKey });
  const systemMessage = messages.find((message) => message.role === "system");
  const userMessages = messages.filter((message) => message.role !== "system" && message.content !== "");

  const response = await client.messages.create({
    system: systemMessage?.content,
    messages: userMessages,
    model: model,
    max_tokens: 200,
  });

  return response.content;
}

export async function getAnthropicChatResponseStream(
  messages: Message[],
  apiKey: string,
  model: string
) {
  const client = new Anthropic({ apiKey });
  const systemMessage = messages.find((message) => message.role === "system");
  const userMessages = messages.filter((message) => message.role !== "system" && message.content !== "");

  const stream = await client.messages.stream({
    system: systemMessage?.content,
    messages: userMessages,
    model: model,
    max_tokens: 200,
  });

  return new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          controller.enqueue(chunk.text);
        }
      }
      controller.close();
    },
  });
}
