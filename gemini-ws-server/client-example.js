// Example client-side code for connecting to the Gemini WebSocket server

// Initialize WebSocket connection
const ws = new WebSocket('ws://localhost:4001');

// Get the current user's ID from your authentication system
// For example, if using Supabase Auth:
// const userId = supabase.auth.user()?.id;
const userId = 'your-user-id-here'; // Replace with actual user ID

// To store chat history
let chatHistory = [];

// Connection opened
ws.addEventListener('open', (event) => {
  console.log('Connected to Gemini WebSocket server');
  
  // Fetch chat history when connection is established
  fetchChatHistory();
});

// Listen for messages from the server
ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'stream-chunk':
      // Handle streaming chunk (partial response)
      console.log('Received chunk:', data.content);
      break;
      
    case 'stream-complete':
      // Handle complete message
      console.log('Complete response:', data.content);
      break;
      
    case 'transcription':
      // Handle audio transcription
      console.log('Transcription:', data.content);
      break;
      
    case 'tts-audio':
      // Handle text-to-speech audio
      console.log('Received TTS audio');
      // Play the audio or save it
      break;
      
    case 'chat_history':
      // Handle received chat history
      chatHistory = data.history || [];
      console.log('Received chat history:', chatHistory);
      displayChatHistory(); // Function to display chat history in UI
      break;
      
    case 'history_cleared':
      // Handle chat history cleared confirmation
      if (data.success) {
        chatHistory = [];
        console.log('Chat history cleared successfully');
        displayChatHistory(); // Update UI
      } else {
        console.error('Failed to clear chat history');
      }
      break;
      
    case 'error':
      // Handle error
      console.error('Error:', data.error, data.details);
      break;
  }
});

// Function to send a chat message
function sendChatMessage(message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'chat',
      message: message,
      userId: userId  // Include the user ID with every message
    }));
  } else {
    console.error('WebSocket is not connected');
  }
}

// Function to send an audio message
function sendAudioMessage(audioBase64, mimeType = 'audio/wav') {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'audio',
      audio: audioBase64,
      mimeType: mimeType,
      userId: userId  // Include the user ID with every message
    }));
  } else {
    console.error('WebSocket is not connected');
  }
}

// Function to fetch chat history
function fetchChatHistory() {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'fetch_history',
      userId: userId
    }));
    console.log('Requesting chat history...');
  } else {
    console.error('WebSocket is not connected');
  }
}

// Function to clear chat history
function clearChatHistory() {
  if (ws.readyState === WebSocket.OPEN) {
    if (confirm('Are you sure you want to clear your chat history?')) {
      ws.send(JSON.stringify({
        type: 'clear_history',
        userId: userId
      }));
      console.log('Requesting to clear chat history...');
    }
  } else {
    console.error('WebSocket is not connected');
  }
}

// Example function to display chat history in UI
function displayChatHistory() {
  const chatContainer = document.getElementById('chat-container');
  if (!chatContainer) return;
  
  chatContainer.innerHTML = '';
  
  if (chatHistory.length === 0) {
    chatContainer.innerHTML = '<p class="no-messages">No messages yet. Start a conversation!</p>';
    return;
  }
  
  chatHistory.forEach(msg => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msg.role}`;
    
    const timestamp = new Date(msg.timestamp).toLocaleTimeString();
    
    messageDiv.innerHTML = `
      <div class="message-content">${msg.content}</div>
      <div class="message-time">${timestamp}</div>
    `;
    
    chatContainer.appendChild(messageDiv);
  });
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Handle connection errors
ws.addEventListener('error', (event) => {
  console.error('WebSocket error:', event);
});

// Handle disconnection
ws.addEventListener('close', (event) => {
  console.log('Disconnected from server:', event.code, event.reason);
});

// Example: UI Elements
/*
// Add these to your HTML
<div id="chat-container"></div>
<div id="chat-controls">
  <input type="text" id="message-input" placeholder="Type a message...">
  <button id="send-button">Send</button>
  <button id="clear-button">Clear History</button>
</div>

// Add these event listeners
document.getElementById('send-button').addEventListener('click', () => {
  const input = document.getElementById('message-input');
  const message = input.value.trim();
  if (message) {
    sendChatMessage(message);
    input.value = '';
  }
});

document.getElementById('clear-button').addEventListener('click', clearChatHistory);
*/ 