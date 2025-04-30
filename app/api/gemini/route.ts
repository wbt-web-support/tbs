import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { WebSocketServer } from "ws";
import { createServer } from "http";

const MODEL_NAME = "gemini-2.0-flash";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

const genAI = new GoogleGenerativeAI(API_KEY);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return new NextResponse("Session ID is required", { status: 400 });
  }

  try {
    const server = createServer();
    const wss = new WebSocketServer({ server });

    wss.on("connection", (ws) => {
      console.log("Client connected");

      ws.on("message", async (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          if (data.type === "chat") {
            const model = genAI.getGenerativeModel({ model: MODEL_NAME });
            const chat = model.startChat({
              history: data.history || [],
              generationConfig: {
                maxOutputTokens: 1024,
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
              },
            });

            const result = await chat.sendMessage(data.message);
            const response = result.response;
            const text = response.text();

            ws.send(JSON.stringify({
              type: "response",
              content: text
            }));
          }
        } catch (error) {
          console.error("Error processing message:", error);
          ws.send(JSON.stringify({
            type: "error",
            error: "Failed to process message"
          }));
        }
      });

      ws.on("close", () => {
        console.log("Client disconnected");
      });
    });

    return new Promise((resolve) => {
      server.listen(0, () => {
        const port = (server.address() as any).port;
        resolve(new NextResponse(JSON.stringify({ port }), {
          headers: { "Content-Type": "application/json" },
        }));
      });
    });
  } catch (error) {
    console.error("Error creating WebSocket server:", error);
    return new NextResponse("Failed to create WebSocket server", { status: 500 });
  }
} 