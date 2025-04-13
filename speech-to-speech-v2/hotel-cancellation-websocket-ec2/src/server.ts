import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { fromInstanceMetadata } from "@aws-sdk/credential-providers";
import { NovaSonicBidirectionalStreamClient } from "./client";
import { Buffer } from "node:buffer";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Create the AWS Bedrock client
const bedrockClient = new NovaSonicBidirectionalStreamClient({
  requestHandlerConfig: {
    maxConcurrentStreams: 10,
  },
  clientConfig: {
    region: process.env.AWS_REGION || "us-east-1",
    credentials: fromInstanceMetadata(),
  },
});

// Periodically check for and close inactive sessions (every minute)
// Sessions with no activity for over 5 minutes will be force closed
setInterval(() => {
  console.log("Session cleanup check");
  const now = Date.now();

  // Check all active sessions
  bedrockClient.getActiveSessions().forEach((sessionId) => {
    const lastActivity = bedrockClient.getLastActivityTime(sessionId);

    // If no activity for 5 minutes, force close
    if (now - lastActivity > 5 * 60 * 1000) {
      console.log(
        `Closing inactive session ${sessionId} after 5 minutes of inactivity`
      );
      try {
        bedrockClient.forceCloseSession(sessionId);
      } catch (error) {
        console.error(
          `Error force closing inactive session ${sessionId}:`,
          error
        );
      }
    }
  });
}, 60000);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "../public")));

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Create a unique session ID for this client
  const sessionId = socket.id;

  try {
    // Create session with the new API
    const session = bedrockClient.createStreamSession(sessionId);
    bedrockClient.initiateSession(sessionId);

    setInterval(() => {
      const connectionCount = Object.keys(io.sockets.sockets).length;
      console.log(`Active socket connections: ${connectionCount}`);
    }, 60000);

    // Set up event handlers
    session.onEvent("contentStart", (data) => {
      console.log("contentStart:", data);
      socket.emit("contentStart", data);
    });

    session.onEvent("textOutput", (data) => {
      console.log("Text output:", data);
      socket.emit("textOutput", data);
    });

    session.onEvent("audioOutput", (data) => {
      console.log("Audio output received, sending to client");
      socket.emit("audioOutput", data);
    });

    session.onEvent("error", (data) => {
      console.error("Error in session:", data);
      socket.emit("error", data);
    });

    session.onEvent("toolUse", (data) => {
      console.log("Tool use detected:", data.toolName);
      socket.emit("toolUse", data);
    });

    session.onEvent("toolResult", (data) => {
      console.log("Tool result received");
      socket.emit("toolResult", data);
    });

    session.onEvent("contentEnd", (data) => {
      console.log("Content end received", data);
      socket.emit("contentEnd", data);
    });

    session.onEvent("streamComplete", () => {
      console.log("Stream completed for client:", socket.id);
      socket.emit("streamComplete");
    });

    // Simplified audioInput handler without rate limiting
    socket.on("audioInput", async (audioData) => {
      try {
        // Convert base64 string to Buffer
        const audioBuffer =
          typeof audioData === "string"
            ? Buffer.from(audioData, "base64")
            : Buffer.from(audioData);

        // Stream the audio
        await session.streamAudio(audioBuffer);
      } catch (error) {
        console.error("Error processing audio:", error);
        socket.emit("error", {
          message: "Error processing audio",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    socket.on("promptStart", async () => {
      try {
        console.log("Prompt start received");
        await session.setupPromptStart();
      } catch (error) {
        console.error("Error processing prompt start:", error);
        socket.emit("error", {
          message: "Error processing prompt start",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    socket.on("systemPrompt", async (data) => {
      try {
        console.log("System prompt received", data);
        await session.setupSystemPrompt(undefined, data);
      } catch (error) {
        console.error("Error processing system prompt:", error);
        socket.emit("error", {
          message: "Error processing system prompt",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    socket.on("audioStart", async (data) => {
      try {
        console.log("Audio start received", data);
        await session.setupStartAudio();
      } catch (error) {
        console.error("Error processing audio start:", error);
        socket.emit("error", {
          message: "Error processing audio start",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    socket.on("stopAudio", async (chat) => {
      try {
        console.log("Stop audio requested, beginning proper shutdown sequence");

        const chatSummary = await generateChatSummaryWithBedrock(chat.history);
        // Emit the summary to the client
        socket.emit("chatSummary", { chatSummary });

        // Chain the closing sequence
        await Promise.all([
          session
            .endAudioContent()
            .then(() => session.endPrompt())
            .then(() => session.close())
            .then(() => console.log("Session cleanup complete")),
        ]);
      } catch (error) {
        console.error("Error processing streaming end events:", error);
        socket.emit("error", {
          message: "Error processing streaming end events",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log("Client disconnected abruptly:", socket.id);

      if (bedrockClient.isSessionActive(sessionId)) {
        try {
          console.log(
            `Beginning cleanup for abruptly disconnected session: ${socket.id}`
          );

          // Add explicit timeouts to avoid hanging promises
          const cleanupPromise = Promise.race([
            (async () => {
              await session.endAudioContent();
              await session.endPrompt();
              await session.close();
            })(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Session cleanup timeout")),
                3000
              )
            ),
          ]);

          await cleanupPromise;
          console.log(
            `Successfully cleaned up session after abrupt disconnect: ${socket.id}`
          );
        } catch (error) {
          console.error(
            `Error cleaning up session after disconnect: ${socket.id}`,
            error
          );
          try {
            bedrockClient.forceCloseSession(sessionId);
            console.log(`Force closed session: ${sessionId}`);
          } catch (e) {
            console.error(
              `Failed even force close for session: ${sessionId}`,
              e
            );
          }
        } finally {
          // Make sure socket is fully closed in all cases
          if (socket.connected) {
            socket.disconnect(true);
          }
        }
      }
    });
  } catch (error) {
    console.error("Error creating session:", error);
    socket.emit("error", {
      message: "Failed to initialize session",
      details: error instanceof Error ? error.message : String(error),
    });
    socket.disconnect();
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start the server
const PORT = process.env.PORT || 8082;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(
    `Open http://localhost:${PORT} in your browser to access the application`
  );
});

process.on("SIGINT", async () => {
  console.log("Shutting down server...");

  const forceExitTimer = setTimeout(() => {
    console.error("Forcing server shutdown after timeout");
    process.exit(1);
  }, 5000);

  try {
    // First close Socket.IO server which manages WebSocket connections
    await new Promise((resolve) => io.close(resolve));
    console.log("Socket.IO server closed");

    // Then close all active sessions
    const activeSessions = bedrockClient.getActiveSessions();
    console.log(`Closing ${activeSessions.length} active sessions...`);

    await Promise.all(
      activeSessions.map(async (sessionId) => {
        try {
          await bedrockClient.closeSession(sessionId);
          console.log(`Closed session ${sessionId} during shutdown`);
        } catch (error) {
          console.error(
            `Error closing session ${sessionId} during shutdown:`,
            error
          );
          bedrockClient.forceCloseSession(sessionId);
        }
      })
    );

    // Now close the HTTP server with a promise
    await new Promise((resolve) => server.close(resolve));
    clearTimeout(forceExitTimer);
    console.log("Server shut down");
    process.exit(0);
  } catch (error) {
    console.error("Error during server shutdown:", error);
    process.exit(1);
  }
});

async function generateChatSummaryWithBedrock(chatHistory: any) {
  if (!chatHistory || chatHistory.length === 0) {
    return "No conversation history available.";
  }

  const chatSummaryBedrockClient = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: fromInstanceMetadata(),
  });

  // Prepare the input for the Bedrock model
  const inputText = chatHistory
    .map((item: any, index: any) => {
      return `${index + 1}. ${item.role}: ${item.message}`;
    })
    .join("\n");

  const prompt = {
    messages: [
      {
        role: "user",
        content: `Summarize the following chat between a customer and an agent:\n${inputText}`,
      },
    ],
  };
  try {
    // Invoke the Bedrock model
    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0", // Model ID
      contentType: "application/json", // Input content type
      accept: "application/json", // Expected response content type
      body: JSON.stringify({
        messages: prompt.messages, // Include the messages array
        max_tokens: 300, // Set the maximum number of tokens for the response
        anthropic_version: "bedrock-2023-05-31",
      }),
    });

    const response = await chatSummaryBedrockClient.send(command);
    console.log("Bedrock response:", response);
    console.log("Bedrock response body:", response.body.transformToString());
    console.log("Bedrock response body type:", typeof response.body);
    console.log("Bedrock response body length:", response.body.length);
    const responseBody = JSON.parse(await response.body.transformToString());
    const body = responseBody.content[0].text;

    // Extract and return the summary
    return body || "No summary generated.";
  } catch (error) {
    console.error("Error generating summary with Bedrock:", error);
    return "Failed to generate summary.";
  }
}
