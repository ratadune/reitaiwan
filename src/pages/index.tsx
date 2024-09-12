import { useCallback, useContext, useEffect, useState, useRef } from "react";
import VrmViewer from "@/components/vrmViewer";
import { ViewerContext } from "@/features/vrmViewer/viewerContext";
import {
  Message,
  textsToScreenplay,
  Screenplay,
} from "@/features/messages/messages";
import { speakCharacter } from "@/features/messages/speakCharacter";
import { MessageInputContainer } from "@/components/messageInputContainer";
import { SYSTEM_PROMPT } from "@/features/constants/systemPromptConstants";
import { KoeiroParam, DEFAULT_PARAM } from "@/features/constants/koeiroParam";
import { getOpenAIChatResponseStream } from "@/features/chat/openAiChat";
import { getAnthropicChatResponseStream } from "@/features/chat/anthropicChat";
import { getOllamaChatResponseStream } from "@/features/chat/ollamaChat";
import { Introduction } from "@/components/introduction";
import { Menu } from "@/components/menu";
import { GitHubLink } from "@/components/githubLink";
import { Meta } from "@/components/meta";
import "@/lib/i18n";
import { useTranslation } from 'react-i18next';
import { fetchAndProcessComments } from "@/features/youtube/youtubeComments";

export default function Home() {
  const { viewer } = useContext(ViewerContext);

  const [systemPrompt, setSystemPrompt] = useState(SYSTEM_PROMPT);
  const [selectAIService, setSelectAIService] = useState("openai");
  const [selectAIModel, setSelectAIModel] = useState("gpt-3.5-turbo");
  const [openAiKey, setOpenAiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("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");
  //
  const [selectVoice, setSelectVoice] = useState("simple_vits");//vits on
  const [simpleVitsUrl, setSimpleVitsUrl] = useState("https://artrajz-vits-simple-api.hf.space/voice/vits"); // vits location
  const [selectLanguage, setSelectLanguage] = useState("Japanese");
  const [selectVoiceLanguage, setSelectVoiceLanguage] = useState("ja-JP");
  const [koeiromapKey, setKoeiromapKey] = useState("");
  const [voicevoxSpeaker, setVoicevoxSpeaker] = useState("2");
  const [googleTtsType, setGoogleTtsType] = useState("en-US-Neural2-F");
  const [youtubeMode, setYoutubeMode] = useState(false);
  const [youtubeApiKey, setYoutubeApiKey] = useState("");
  const [youtubeLiveId, setYoutubeLiveId] = useState("");
  const [koeiroParam, setKoeiroParam] = useState<KoeiroParam>(DEFAULT_PARAM);
  const [chatProcessing, setChatProcessing] = useState(false);
  const [chatLog, setChatLog] = useState<Message[]>([]);
  const [codeLog, setCodeLog] = useState<Message[]>([]);
  const [assistantMessage, setAssistantMessage] = useState("");
  const [webSocketMode, changeWebSocketMode] = useState(false);
  const [isVoicePlaying, setIsVoicePlaying] = useState(false);
  const [lastCommentTime, setLastCommentTime] = useState(Date.now()); //autoYT remained time 
  const [autoReplyMode, setAutoReplyMode] = useState(false); //autoYT
  const { t } = useTranslation();
  const INTERVAL_MILL_SECONDS_RETRIEVING_COMMENTS = 20000; // 20秒
  const YT_AUTO_REPLY_INTERVAL = 120000; // 80秒 autoYT
  const YT_AUTO_REPLY_MESSAGES = [ //autoYT
    "(接著話題自我介紹)",
    "(接著話題和觀眾打招呼)",
    "(接著話題講芙蘭姐姐你自己最喜歡的東西)"
  ];
  
  useEffect(() => {
    const storedData = window.localStorage.getItem("chatVRMParams");
    if (storedData) {
      const params = JSON.parse(storedData);
      // codeLogがundefinedまたは配列でない場合は、空の配列をセットする
      setCodeLog(Array.isArray(params.codeLog) ? params.codeLog : []);
    }
  }, []);

  useEffect(() => {
    if (window.localStorage.getItem("chatVRMParams")) {
      const params = JSON.parse(
        window.localStorage.getItem("chatVRMParams") as string
      );
      setSystemPrompt(params.systemPrompt);
      setKoeiroParam(params.koeiroParam);
      setChatLog(params.chatLog);
      setCodeLog(params.codeLog);
    }
  }, []);

  useEffect(() => {
    process.nextTick(() =>
      window.localStorage.setItem(
        "chatVRMParams",
        JSON.stringify({ systemPrompt, koeiroParam, chatLog, codeLog })
      )
    );
  }, [systemPrompt, koeiroParam, chatLog, codeLog]);

  const handleChangeChatLog = useCallback(
    (targetIndex: number, text: string) => {
      const newChatLog = chatLog.map((v: Message, i) => {
        return i === targetIndex ? { role: v.role, content: text } : v;
      });

      setChatLog(newChatLog);
    },
    [chatLog]
  );

  const handleChangeCodeLog = useCallback(
    async (targetIndex: number, text: string) => {
      const newCodeLog = codeLog.map((v: Message, i) => {
        return i === targetIndex ? { role: v.role, content: text} : v;
      });

      setCodeLog(newCodeLog);
    },
    [codeLog]
  );

  /**
   * 文ごとに音声を直列でリクエストしながら再生する
   */
  const handleSpeakAi = useCallback( //Vits
    async (
      screenplay: Screenplay,
      onStart?: () => void,
      onEnd?: () => void
    ) => {
       speakCharacter(screenplay, viewer, selectVoice, koeiromapKey, voicevoxSpeaker, googleTtsType,simpleVitsUrl, onStart, onEnd);
  },
  [viewer, selectVoice, koeiromapKey, voicevoxSpeaker, googleTtsType, simpleVitsUrl]
);

  const wsRef = useRef<WebSocket | null>(null);


  /**
   * アシスタントとの会話を行う
   */
  const handleSendChat = useCallback(
    async (text: string, role?: string) => {
      const newMessage = text;

      if (newMessage == null) {
        return;
      }

      if (autoReplyMode  && role !== undefined && role !== "user") {//autoYT
        setLastCommentTime(Date.now()); 
      }


      if (webSocketMode) {
        console.log("websocket mode: true")
        setChatProcessing(true);

        if (role !== undefined && role !== "user") {
          // WebSocketからの返答を処理         

          if (role == "assistant") {
            let aiText = `${"[neutral]"} ${newMessage}`;
            try {
              const aiTalks = textsToScreenplay([aiText], koeiroParam);

              // 文ごとに音声を生成 & 再生、返答を表示
              handleSpeakAi(aiTalks[0], async () => {
                // アシスタントの返答をログに追加
                const updateLog: Message[] = [
                  ...codeLog,
                  { role: "assistant", content: newMessage },
                ];
                setChatLog(updateLog);
                setCodeLog(updateLog);

                setAssistantMessage(newMessage);
                setIsVoicePlaying(false);
                setChatProcessing(false);
              });
            } catch (e) {
              setIsVoicePlaying(false);
              setChatProcessing(false);
            }
          } else if (role == "code" || role == "output" || role == "executing"){ // コードコメントの処理
            // ループ完了後にAI応答をコードログに追加
            const updateLog: Message[] = [
              ...codeLog,
              { role: role, content: newMessage },
            ];
            setCodeLog(updateLog);
            setChatProcessing(false);
          } else { // その他のコメントの処理（現想定では使用されないはず）
            console.log("error role:", role)
          }
        } else {
          // WebSocketで送信する処理

          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            // ユーザーの発言を追加して表示
            const updateLog: Message[] = [
              ...codeLog,
              { role: "user", content: newMessage },
            ];
            setChatLog(updateLog);
            setCodeLog(updateLog);

            // WebSocket送信
            wsRef.current.send(JSON.stringify({content: newMessage, type: "chat"}));
          } else {
            setAssistantMessage(t('NotConnectedToExternalAssistant'));
            setChatProcessing(false);
          }
        } //webSocketMode end
      } else {
        // ChatVERM original mode
        if (selectAIService === "openai" && !openAiKey && process.env.OPEN_AI_KEY ) {
          setAssistantMessage(t('GPT_APIKey_set!'));
          return;
        } else if (selectAIService === "openai" && !openAiKey) {
        console.log(process.env.OPEN_AI_KEY)
        console.log(process.env.GOOGLE_APPLICATION_CREDENTIALS)
          setAssistantMessage(t('GPT_APIKeyNotEntered '+process.env.GOOGLE_APPLICATION_CREDENTIALS));
          return;
        } else if (selectAIService === "anthropic" && !anthropicKey) {
          setAssistantMessage(t('claude_APIKeyNotEntered'));
          return;
        }

        setChatProcessing(true);
        // ユーザーの発言を追加して表示
        const messageLog: Message[] = [
          ...chatLog,
          { role: "user", content: newMessage },
        ];
        setChatLog(messageLog);

        // Chat GPTへ
        const messages: Message[] = [
          {
            role: "system",
            content: systemPrompt,
          },
          ...messageLog,
        ];

        let stream;
        if (selectAIService === "openai") {
          stream = await getOpenAIChatResponseStream(messages, openAiKey, selectAIModel).catch(
            (e) => {
              console.error(e);
              return null;
            }
          );
        } else if (selectAIService === "anthropic") {
          stream = await getAnthropicChatResponseStream(messages, anthropicKey, selectAIModel).catch(
            (e) => {
              console.error(e);
              return null;
            }
          );
        } else if (selectAIService === "ollama") {
          stream = await getOllamaChatResponseStream(messages, selectAIModel).catch(
            (e) => {
              console.error(e);
              return null;
            }
          );
        }
        if (stream == null) {
          setChatProcessing(false);
          return;
        }

        const reader = stream.getReader();
        let receivedMessage = "";
        let aiTextLog = "";
        let tag = "";
        const sentences = new Array<string>();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            receivedMessage += value;

            // 返答内容のタグ部分の検出
            const tagMatch = receivedMessage.match(/^\[(.*?)\]/);
            if (tagMatch && tagMatch[0]) {
              tag = tagMatch[0];
              receivedMessage = receivedMessage.slice(tag.length);
            }

            // 返答を一文単位で切り出して処理する
            const sentenceMatch = receivedMessage.match(
              /^(.+[。．！？\n]|.{10,}[、,])/
            );
            if (sentenceMatch && sentenceMatch[0]) {
              const sentence = sentenceMatch[0];
              sentences.push(sentence);
              receivedMessage = receivedMessage
                .slice(sentence.length)
                .trimStart();

              // 発話不要/不可能な文字列だった場合はスキップ
              if (
                !sentence.replace(
                  /^[\s\[\(\{「［（【『〈《〔｛«‹〘〚〛〙›»〕》〉』】）］」\}\)\]]+$/g,
                  ""
                )
              ) {
                continue;
              }

              const aiText = `${tag} ${sentence}`;
              const aiTalks = textsToScreenplay([aiText], koeiroParam);
              aiTextLog += aiText;

              // 文ごとに音声を生成 & 再生、返答を表示
              const currentAssistantMessage = sentences.join(" ");
              handleSpeakAi(aiTalks[0], () => {
                setAssistantMessage(currentAssistantMessage);
              });
            }
          }
        } catch (e) {
          setChatProcessing(false);
          console.error(e);
        } finally {
          reader.releaseLock();
        }

        // アシスタントの返答をログに追加
        const messageLogAssistant: Message[] = [
          ...messageLog,
          { role: "assistant", content: aiTextLog },
        ];

        setChatLog(messageLogAssistant);
        setChatProcessing(false);
      }
    },
    [webSocketMode, koeiroParam, handleSpeakAi, codeLog, t, selectAIService, openAiKey, anthropicKey, chatLog, systemPrompt, selectAIModel]
  );
  
    /**
   *autoYT youtube mode中メッセージ来なかったら、毎60秒に自動gptにメッセージ  
   */
  const checkComments = useCallback(() => {
    if (autoReplyMode) {
      const elapsedTime = Date.now() - lastCommentTime;
      const remainingTime = YT_AUTO_REPLY_INTERVAL - elapsedTime;

      if (elapsedTime >= YT_AUTO_REPLY_INTERVAL) {
        const randomIndex = Math.floor(Math.random() * YT_AUTO_REPLY_MESSAGES.length);
        const autoReplyMessage = YT_AUTO_REPLY_MESSAGES[randomIndex];
        handleSendChat(autoReplyMessage, "user");
        setLastCommentTime(Date.now());
      } else {
        console.log(`距離下一次自動回復還有 ${Math.ceil(remainingTime / 1000)} 秒`);
      }
    }
  }, [autoReplyMode, lastCommentTime, handleSendChat]);



  ///取得したコメントをストックするリストの作成（tmpMessages）
  interface tmpMessage {
    text: string;
    role: string;
    emotion: string;
  }
  const [tmpMessages, setTmpMessages] = useState<tmpMessage[]>([]);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      console.log("WebSocket connection opened:", event);
    };
    const handleMessage = (event: MessageEvent) => {
      console.log("Received message:", event.data);
      const jsonData = JSON.parse(event.data);
      setTmpMessages((prevMessages) => [...prevMessages, jsonData]);
    };
    const handleError = (event: Event) => {
      console.error("WebSocket error:", event);
    };
    const handleClose = (event: Event) => {
      console.log("WebSocket connection closed:", event);
    };

    function setupWebsocket() {
    //if (webSocketMode){
        const ws = new WebSocket("ws://localhost:8000/ws");
        ws.addEventListener("open", handleOpen);
        ws.addEventListener("message", handleMessage);
        ws.addEventListener("error", handleError);
        ws.addEventListener("close", handleClose);
        return ws;
      }
    //}
    let ws = setupWebsocket();
    wsRef.current = ws;

    const reconnectInterval = setInterval(() => {
      if (webSocketMode && ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CONNECTING) {
        setChatProcessing(false);
        console.log("try reconnecting...");
        ws.close();
        ws = setupWebsocket();
        wsRef.current = ws;
      }
    }, 1000);

    return () => {
      clearInterval(reconnectInterval);
      ws.close();
    };
  }, [webSocketMode]);

  useEffect(() => {
    if (tmpMessages.length > 0 && !isVoicePlaying) {
      const message = tmpMessages[0];
      if (message.role == "assistant") { setIsVoicePlaying(true) };
      setTmpMessages((tmpMessages) => tmpMessages.slice(1));
      handleSendChat(message.text, message.role);
    }
  }, [tmpMessages, isVoicePlaying, handleSendChat]);


  //autoYT (視聽者から反応来ない)自動送信機能のINTERVAL　クリーンアップ
  useEffect(() => {
      const timer = setInterval(checkComments, INTERVAL_MILL_SECONDS_RETRIEVING_COMMENTS);
      return () => {
        clearInterval(timer);
      };
    }, [checkComments]);
    
    
  // YouTubeコメントを取得する処理
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchAndProcessComments(youtubeLiveId, youtubeApiKey, handleSendChat);
    }, INTERVAL_MILL_SECONDS_RETRIEVING_COMMENTS);
    // クリーンアップ関数
    return () => clearInterval(intervalId);
  }, [youtubeLiveId, youtubeApiKey, handleSendChat]);


  return (
    <div className={"font-M_PLUS_2"}>
      <Meta />
      <Introduction
        openAiKey={openAiKey}
        koeiroMapKey={koeiromapKey}
        onChangeAiKey={setOpenAiKey}
        onChangeKoeiromapKey={setKoeiromapKey}
      />
      <VrmViewer />
      <MessageInputContainer
        isChatProcessing={chatProcessing}
        onChatProcessStart={handleSendChat}
        selectVoiceLanguage={selectVoiceLanguage}
      />
      <Menu
        selectAIService={selectAIService}
        setSelectAIService={setSelectAIService}
        selectAIModel={selectAIModel}
        setSelectAIModel={setSelectAIModel}
        openAiKey={openAiKey}
        onChangeOpenAiKey={setOpenAiKey}
        anthropicKey={anthropicKey}
        onChangeAnthropicKey={setAnthropicKey}
        systemPrompt={systemPrompt}
        chatLog={chatLog}
        codeLog={codeLog}
        koeiroParam={koeiroParam}
        assistantMessage={assistantMessage}
        koeiromapKey={koeiromapKey}
        voicevoxSpeaker={voicevoxSpeaker}
        googleTtsType={googleTtsType}
        simpleVitsUrl={simpleVitsUrl} //vits
        onChangeSimpleVitsUrl={setSimpleVitsUrl} //vits
        autoReplyMode={autoReplyMode}//autoYT
        onChangeAutoReplyMode={setAutoReplyMode}//autoYT
        youtubeMode={youtubeMode}
        youtubeApiKey={youtubeApiKey}
        youtubeLiveId={youtubeLiveId}
        onChangeSystemPrompt={setSystemPrompt}
        onChangeChatLog={handleChangeChatLog}
        onChangeCodeLog={handleChangeCodeLog}
        onChangeKoeiromapParam={setKoeiroParam}
        onChangeYoutubeMode={setYoutubeMode}
        onChangeYoutubeApiKey={setYoutubeApiKey}
        onChangeYoutubeLiveId={setYoutubeLiveId}
        handleClickResetChatLog={() => setChatLog([])}
        handleClickResetCodeLog={() => setCodeLog([])}
        handleClickResetSystemPrompt={() => setSystemPrompt(SYSTEM_PROMPT)}
        onChangeKoeiromapKey={setKoeiromapKey}
        onChangeVoicevoxSpeaker={setVoicevoxSpeaker}
        onChangeGoogleTtsType={setGoogleTtsType}
        webSocketMode={webSocketMode}
        changeWebSocketMode={changeWebSocketMode}
        selectVoice={selectVoice}
        setSelectVoice={setSelectVoice}
        selectLanguage={selectLanguage}
        setSelectLanguage={setSelectLanguage}
        setSelectVoiceLanguage={setSelectVoiceLanguage}
      />
      <GitHubLink />
    </div>
  );
}
