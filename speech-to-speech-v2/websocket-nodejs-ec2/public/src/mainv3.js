import { AudioPlayer } from "./lib/play/AudioPlayer.js";
import { ChatHistoryManager } from "./lib/util/ChatHistoryManager.js";

// Connect to the server
const socket = io();

// DOM elements
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const statusElement = document.getElementById("status");
const chatContainer = document.getElementById("chat-container");

// Chat history management
let chat = { history: [] };
const chatRef = { current: chat };
const chatHistoryManager = ChatHistoryManager.getInstance(
  chatRef,
  (newChat) => {
    chat = { ...newChat };
    chatRef.current = chat;
    updateChatUI();
  }
);

// Audio processing variables
let audioContext;
let audioStream;
let isStreaming = false;
let processor;
let sourceNode;
let waitingForAssistantResponse = false;
let waitingForUserTranscription = false;
let userThinkingIndicator = null;
let assistantThinkingIndicator = null;
let transcriptionReceived = false;
let displayAssistantText = false;
let role;
const audioPlayer = new AudioPlayer();
let sessionInitialized = false;

// Custom system prompt - you can modify this
let SYSTEM_PROMPT = `
# Identity
- You are a Hotel Cancellation Voice Agent.
- You converse in fluid and conversational English to resolved the customer issue.
- Be precise, concise, and enthusiastic in all your responses! Prompt

## Task
Act as a professional, empathetic **voice agent** that assists customers with **hotel reservation cancellations only** over a phone call.

## Context Information
- The USER is requesting to cancel a hotel reservation
- Reservation numbers may not be provided
- ASR (automatic speech recognition) may introduce misheard names, dates, or numbers
- Cancellation policies often include **deadlines** which may impact refund eligibility

## Model Instructions
- You MUST ONLY assist with hotel cancellations
- DO NOT respond to questions or requests outside this scope (e.g., booking, billing, upgrades)
- DO confirm the USER's **name and check-in date** before using any tools
- DO handle ASR errors gracefully by:
  * Repeating information back in different words
  * Using phonetic clarification when needed ("Is that P as in Paul?")
  * Confirming important information like names and dates twice if necessary
- DO clearly explain the cancellation policy, including whether there are **fees or refunds**
- DO NOT cancel the reservation unless the USER consents after understanding the policy
- DO speak naturally, with appropriate pacing and empathy
- DO pause briefly between complex information points to aid comprehension
- DO NOT proceed if required info (name or date) remains unclear after three attempts

## Tool Use
You have access to the following tools:

### getreservation
Use this tool **only after confirming** both the USER's name and check-in date. The tool requires:
- 'name': Full name of the guest who made the reservation
- 'checkInDate': The check-in date in YYYY-MM-DD format

Example confirmation before using tool:
"Let me make sure I have this right. Your name is **{{name}}**, is that correct?"
"And your check-in date was **{{date}}**, is that right?"

### getcancellationpolicy
Use this tool to retrieve the specific cancellation policy for a reservation:
- 'reservationId': The unique identifier for the reservation

After retrieving the policy, clearly explain any fees or refund eligibility to the USER.

### cancelreservation
Use this tool to process the cancellation, but ONLY after:
1. Explaining the cancellation policy
2. Receiving explicit consent from the USER
3. Confirming they understand any potential fees

The tool requires:
- 'reservationId': The unique identifier for the reservation
- 'confirmCancellation': Must be set to true only after receiving USER consent

## Response Style and Format Requirements
- Use natural, conversational voice tone with varied confirmation phrases
- Keep sentences short to medium length for better TTS delivery
- Repeat key info using different words to handle possible ASR misrecognition
- Speak at a moderate pace, especially when sharing policy details or numbers
- Ask for clarification if input is unclear or partially heard
- Clearly communicate cancellation policy, including any penalties
- Always ask for **confirmation before processing** cancellation
- End the call warmly, but DO NOT offer services outside cancellation

## Example Dialogues

### Standard Cancellation Flow

**USER:**
"Hi, I need to cancel my hotel booking. It's under Angela Park, for April 12th."

**ASSISTANT:**
"Hi there. I'd be happy to help you cancel that reservation. Let me make sure I have your details correct. Is your name Angela Park?"

**USER:**
"Yes, that's right."

**ASSISTANT:**
"Thank you. And was your check-in date April 12th, 2025?"

**USER:**
"Yes."

**ASSISTANT:**
[Using getReservation tool with name="Angela Park", checkInDate="2025-04-12"]
"Thanks for confirming. I'll look that up for you now."
"I've found your reservation at the Seaview Hotel. Let me check the cancellation policy for you."
[Using getCancellationPolicy tool with retrieved reservationId]
"According to our records, you're still within the free cancellation period, so there won't be any charges if we cancel now. Would you like me to go ahead and cancel this reservation for you?"

**USER:**
"Yes, please cancel it."

**ASSISTANT:**
[Using cancelReservation tool with reservationId and confirmCancellation=true]
"I've processed your cancellation. Your reservation at the Seaview Hotel for April 12th has been cancelled. You won't be charged any fees. You'll receive a confirmation email shortly. Is there anything else about this cancellation I can help with?"

### Another Example Dialog

**USER:**
"I want to cancel my booking for John Smith."

**ASSISTANT:**
"I'll help you cancel that. Did you say your name is John Smith? J-O-H-N S-M-I-T-H?"

**USER:**
"No, it's Don Smith. D-O-N."

**ASSISTANT:**
"Thank you for clarifying. So that's Don Smith. And what was the check-in date for your reservation?"

**USER:**
"January 15th" [with background noise]

**ASSISTANT:**
"I'm sorry, I didn't catch that clearly. Could you please repeat the check-in date?"

**USER:**
"It's January 15th."

**ASSISTANT:**
"January 15th, 2025. Is that correct?"

....

### Handling Off-Topic Requests

**USER:**
"After you cancel this, I'd like to make a new reservation for next month."

**ASSISTANT:**
"I've successfully cancelled your current reservation. Regarding a new booking, I'm specialized in handling cancellations only. Our reservations team would be happy to help you make a new booking. Would you like me to transfer you to them?"
`;


// Initialize WebSocket audio
async function initAudio() {
  try {
    statusElement.textContent = "Requesting microphone access...";
    statusElement.className = "connecting";

    // Request microphone access
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    audioContext = new AudioContext({
      sampleRate: 16000,
    });

    await audioPlayer.start();

    statusElement.textContent = "Microphone ready. Click Start to begin.";
    statusElement.className = "ready";
    startButton.disabled = false;
  } catch (error) {
    console.error("Error accessing microphone:", error);
    statusElement.textContent = "Error: " + error.message;
    statusElement.className = "error";
  }
}

// Initialize the session with Bedrock
async function initializeSession() {
  if (sessionInitialized) return;

  statusElement.textContent = "Initializing session...";
  let SYSTEM_PROMPT = document.getElementById("prompt").value;
  console.log("system prompt", SYSTEM_PROMPT);
  try {
    // Send events in sequence
    socket.emit("promptStart");
    socket.emit("systemPrompt", SYSTEM_PROMPT);
    socket.emit("audioStart");

    // Mark session as initialized
    sessionInitialized = true;
    statusElement.textContent = "Session initialized successfully";
  } catch (error) {
    console.error("Failed to initialize session:", error);
    statusElement.textContent = "Error initializing session";
    statusElement.className = "error";
  }
}

async function startStreaming() {
  if (isStreaming) return;

  try {
    // First, make sure the session is initialized
    if (!sessionInitialized) {
      await initializeSession();
    }

    // Create audio processor
    sourceNode = audioContext.createMediaStreamSource(audioStream);

    // Use ScriptProcessorNode for audio processing
    if (audioContext.createScriptProcessor) {
      processor = audioContext.createScriptProcessor(512, 1, 1);

      processor.onaudioprocess = (e) => {
        if (!isStreaming) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Convert to 16-bit PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff;
        }

        // Convert to base64 (browser-safe way)
        const base64Data = arrayBufferToBase64(pcmData.buffer);

        // Send to server
        socket.emit("audioInput", base64Data);
      };

      sourceNode.connect(processor);
      processor.connect(audioContext.destination);
    }

    isStreaming = true;
    startButton.disabled = true;
    stopButton.disabled = false;
    statusElement.textContent = "Streaming... Speak now";
    statusElement.className = "recording";

    // Show user thinking indicator when starting to record
    transcriptionReceived = false;
    showUserThinkingIndicator();
  } catch (error) {
    console.error("Error starting recording:", error);
    statusElement.textContent = "Error: " + error.message;
    statusElement.className = "error";
  }
}

// Convert ArrayBuffer to base64 string
function arrayBufferToBase64(buffer) {
  const binary = [];
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary.push(String.fromCharCode(bytes[i]));
  }
  return btoa(binary.join(""));
}

function stopStreaming() {
  if (!isStreaming) return;

  isStreaming = false;

  // Clean up audio processing
  if (processor) {
    processor.disconnect();
    sourceNode.disconnect();
  }

  startButton.disabled = false;
  stopButton.disabled = true;
  statusElement.textContent = "Processing...";
  statusElement.className = "processing";

  audioPlayer.stop();
  // Tell server to finalize processing
  socket.emit("stopAudio");

  // End the current turn in chat history
  chatHistoryManager.endTurn();
}

// Base64 to Float32Array conversion
function base64ToFloat32Array(base64String) {
  try {
    const binaryString = window.atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    return float32Array;
  } catch (error) {
    console.error("Error in base64ToFloat32Array:", error);
    throw error;
  }
}

// Process message data and add to chat history
function handleTextOutput(data) {
  console.log("Processing text output:", data);
  if (data.content) {
    const messageData = {
      role: data.role,
      message: data.content,
    };
    chatHistoryManager.addTextMessage(messageData);
  }
}

// Update the UI based on the current chat history
function updateChatUI() {
  if (!chatContainer) {
    console.error("Chat container not found");
    return;
  }

  // Clear existing chat messages
  chatContainer.innerHTML = "";

  // Add all messages from history
  chat.history.forEach((item) => {
    if (item.endOfConversation) {
      const endDiv = document.createElement("div");
      endDiv.className = "message system";
      endDiv.textContent = "Conversation ended";
      chatContainer.appendChild(endDiv);
      return;
    }

    if (item.role) {
      const messageDiv = document.createElement("div");
      const roleLowerCase = item.role.toLowerCase();
      messageDiv.className = `message ${roleLowerCase}`;

      const roleLabel = document.createElement("div");
      roleLabel.className = "role-label";
      roleLabel.textContent = item.role;
      messageDiv.appendChild(roleLabel);

      const content = document.createElement("div");
      content.textContent = item.message || "No content";
      messageDiv.appendChild(content);

      chatContainer.appendChild(messageDiv);
    }
  });

  // Re-add thinking indicators if we're still waiting
  if (waitingForUserTranscription) {
    showUserThinkingIndicator();
  }

  if (waitingForAssistantResponse) {
    showAssistantThinkingIndicator();
  }

  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Show the "Listening" indicator for user
function showUserThinkingIndicator() {
  hideUserThinkingIndicator();

  waitingForUserTranscription = true;
  userThinkingIndicator = document.createElement("div");
  userThinkingIndicator.className = "message user thinking";

  const roleLabel = document.createElement("div");
  roleLabel.className = "role-label";
  roleLabel.textContent = "USER";
  userThinkingIndicator.appendChild(roleLabel);

  const listeningText = document.createElement("div");
  listeningText.className = "thinking-text";
  listeningText.textContent = "Listening";
  userThinkingIndicator.appendChild(listeningText);

  const dotContainer = document.createElement("div");
  dotContainer.className = "thinking-dots";

  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("span");
    dot.className = "dot";
    dotContainer.appendChild(dot);
  }

  userThinkingIndicator.appendChild(dotContainer);
  chatContainer.appendChild(userThinkingIndicator);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Show the "Thinking" indicator for assistant
function showAssistantThinkingIndicator() {
  hideAssistantThinkingIndicator();

  waitingForAssistantResponse = true;
  assistantThinkingIndicator = document.createElement("div");
  assistantThinkingIndicator.className = "message assistant thinking";

  const roleLabel = document.createElement("div");
  roleLabel.className = "role-label";
  roleLabel.textContent = "ASSISTANT";
  assistantThinkingIndicator.appendChild(roleLabel);

  const thinkingText = document.createElement("div");
  thinkingText.className = "thinking-text";
  thinkingText.textContent = "Thinking";
  assistantThinkingIndicator.appendChild(thinkingText);

  const dotContainer = document.createElement("div");
  dotContainer.className = "thinking-dots";

  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("span");
    dot.className = "dot";
    dotContainer.appendChild(dot);
  }

  assistantThinkingIndicator.appendChild(dotContainer);
  chatContainer.appendChild(assistantThinkingIndicator);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Hide the user thinking indicator
function hideUserThinkingIndicator() {
  waitingForUserTranscription = false;
  if (userThinkingIndicator && userThinkingIndicator.parentNode) {
    userThinkingIndicator.parentNode.removeChild(userThinkingIndicator);
  }
  userThinkingIndicator = null;
}

// Hide the assistant thinking indicator
function hideAssistantThinkingIndicator() {
  waitingForAssistantResponse = false;
  if (assistantThinkingIndicator && assistantThinkingIndicator.parentNode) {
    assistantThinkingIndicator.parentNode.removeChild(
      assistantThinkingIndicator
    );
  }
  assistantThinkingIndicator = null;
}

// EVENT HANDLERS
// --------------

// Handle content start from the server
socket.on("contentStart", (data) => {
  console.log("Content start received:", data);

  if (data.type === "TEXT") {
    // Below update will be enabled when role is moved to the contentStart
    role = data.role;
    if (data.role === "USER") {
      // When user's text content starts, hide user thinking indicator
      hideUserThinkingIndicator();
    } else if (data.role === "ASSISTANT") {
      // When assistant's text content starts, hide assistant thinking indicator
      hideAssistantThinkingIndicator();
      let isSpeculative = false;
      try {
        if (data.additionalModelFields) {
          const additionalFields = JSON.parse(data.additionalModelFields);
          isSpeculative = additionalFields.generationStage === "SPECULATIVE";
          if (isSpeculative) {
            console.log("Received speculative content");
            displayAssistantText = true;
          } else {
            displayAssistantText = false;
          }
        }
      } catch (e) {
        console.error("Error parsing additionalModelFields:", e);
      }
    }
  } else if (data.type === "AUDIO") {
    // When audio content starts, we may need to show user thinking indicator
    if (isStreaming) {
      showUserThinkingIndicator();
    }
  }
});

// Handle text output from the server
socket.on("textOutput", (data) => {
  console.log("Received text output:", data);

  if (role === "USER") {
    // When user text is received, show thinking indicator for assistant response
    transcriptionReceived = true;
    //hideUserThinkingIndicator();

    // Add user message to chat
    handleTextOutput({
      role: data.role,
      content: data.content,
    });

    // Show assistant thinking indicator after user text appears
    showAssistantThinkingIndicator();
  } else if (role === "ASSISTANT") {
    //hideAssistantThinkingIndicator();
    if (displayAssistantText) {
      handleTextOutput({
        role: data.role,
        content: data.content,
      });
    }
  }
});

// Handle audio output
socket.on("audioOutput", (data) => {
  if (data.content) {
    try {
      const audioData = base64ToFloat32Array(data.content);
      audioPlayer.playAudio(audioData);
    } catch (error) {
      console.error("Error processing audio data:", error);
    }
  }
});

// Handle content end events
socket.on("contentEnd", (data) => {
  console.log("Content end received:", data);

  if (data.type === "TEXT") {
    if (role === "USER") {
      // When user's text content ends, make sure assistant thinking is shown
      hideUserThinkingIndicator();
      showAssistantThinkingIndicator();
    } else if (role === "ASSISTANT") {
      // When assistant's text content ends, prepare for user input in next turn
      hideAssistantThinkingIndicator();
    }

    // Handle stop reasons
    if (data.stopReason && data.stopReason.toUpperCase() === "END_TURN") {
      chatHistoryManager.endTurn();
    } else if (
      data.stopReason &&
      data.stopReason.toUpperCase() === "INTERRUPTED"
    ) {
      console.log("Interrupted by user");
      audioPlayer.bargeIn();
    }
  } else if (data.type === "AUDIO") {
    // When audio content ends, we may need to show user thinking indicator
    if (isStreaming) {
      showUserThinkingIndicator();
    }
  }
});

// Stream completion event
socket.on("streamComplete", () => {
  if (isStreaming) {
    stopStreaming();
  }
  statusElement.textContent = "Ready";
  statusElement.className = "ready";
});

// Handle connection status updates
socket.on("connect", () => {
  statusElement.textContent = "Connected to server";
  statusElement.className = "connected";
  sessionInitialized = false;
});

socket.on("disconnect", () => {
  statusElement.textContent = "Disconnected from server";
  statusElement.className = "disconnected";
  startButton.disabled = true;
  stopButton.disabled = true;
  sessionInitialized = false;
  hideUserThinkingIndicator();
  hideAssistantThinkingIndicator();
});

// Handle errors
socket.on("error", (error) => {
  console.error("Server error:", error);
  statusElement.textContent =
    "Error: " + (error.message || JSON.stringify(error).substring(0, 100));
  statusElement.className = "error";
  hideUserThinkingIndicator();
  hideAssistantThinkingIndicator();
});

// Button event listeners
startButton.addEventListener("click", startStreaming);
stopButton.addEventListener("click", stopStreaming);

// Initialize the app when the page loads
document.addEventListener("DOMContentLoaded", initAudio);


document.getElementById("SYSTEM_PROMPT").innerHTML = SYSTEM_PROMPT;