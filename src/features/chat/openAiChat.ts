import { OpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat";
import { Message } from "../messages/messages";

export async function getOpenAIChatResponse(messages: Message[], apiKey: string, model: string) {
  console.log("A");
  if (!apiKey) {
    throw new Error("Invalid API Key");
  }

  const openai = new OpenAI({
    apiKey: apiKey,
    //api_base: 'https://api.chatanywhere.cn/v1', // 
    dangerouslyAllowBrowser: true,
  });

  const data = await openai.chat.completions.create({
    model: model,
    messages: messages as unknown as ChatCompletionMessageParam[], // 使用類型斷言
  });

  const [aiRes] = data.choices;
  const message = aiRes.message?.content || "エラーが発生しました";

  return { message: message };
}

export async function getOpenAIChatResponseStream(
  messages: Message[],
  apiKey: string,
  model: string
) {

  if (!apiKey) {
    throw new Error("Invalid API Key");
  }
  console.log("[messages]");
  console.log(messages);

  const openai = new OpenAI({
    apiKey: apiKey,
    //baseURL: 'https://free.gpt.ge/v1', // 
    //baseURL: 'https://api.chatanywhere.cn/', // 
    dangerouslyAllowBrowser: true,
  });
  console.log("openai:"+ openai);
  const stream_reply = await openai.chat.completions.create({
    model: model,
    messages: messages as unknown as ChatCompletionMessageParam[], // 使用類型斷言
    stream: true,
    max_tokens: 200,
  });
  
  //console.log("[C]");
  console.log("stream_reply:"+stream_reply);

  const res = new ReadableStream({
    async start(controller: ReadableStreamDefaultController) {
      try {
        for await (const chunk of stream_reply) {
          console.log(chunk);
          const messagePiece = chunk.choices[0].delta.content;
          if (!!messagePiece) {
            controller.enqueue(messagePiece);
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    }
  });

  return res;