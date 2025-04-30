const WebSocket = require('ws');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

// Log SDK version
console.log("Using @google/generative-ai version: 0.24.0");

// Use the fastest available model
const MODEL_NAME = 'gemini-2.0-flash-lite-001';
// IMPORTANT: For testing only - replace with your actual API key
// In production, use environment variables properly
const GEMINI_API_KEY = 'AIzaSyDmS0bCCkuRK-PDnb6Steug3Cu5t0g4ZlQ'; 
const OPENAI_API_KEY = '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';

// Initialize Gemini API with a timeout
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Set reasonable timeouts for external API calls
const GEMINI_TIMEOUT_MS = 5000; // 5 seconds
const TTS_TIMEOUT_MS = 5000;    // 5 seconds

const wss = new WebSocket.Server({ port: 4001 });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received message:', data.type);

      if (data.type === 'audio') {
        console.log('Processing audio message...');
        
        try {
          console.log('Using modern audio format with streaming...');
          // Format exactly matching the documentation example
          const model = genAI.getGenerativeModel({ model: MODEL_NAME });
          
          // Create proper contents structure per documentation
          const contents = [
            { 
              role: 'user',
              parts: [
                { text: "The following is an audio message in a conversation. Please respond naturally as if you were having a conversation with me. Don't mention transcription or describe the audio itself." },
                { 
                  inlineData: {
                    mimeType: data.mimeType || 'audio/wav',
                    data: data.audio
                  } 
                }
              ]
            }
          ];
          
          console.log('Sending audio with proper format...');
          
          // Get text response from Gemini with streaming
          try {
            const result = await model.generateContentStream({
              contents: contents,
              generationConfig: {
                maxOutputTokens: 256,
                temperature: 0.4,
                topK: 40,
                topP: 0.95,
              }
            });

            // First, get the transcription
            const transcriptionResult = await model.generateContent({
              contents: [
                { 
                  role: 'user',
                  parts: [
                    { text: "Please transcribe the following audio message exactly as spoken, without adding any commentary or response:" },
                    { 
                      inlineData: {
                        mimeType: data.mimeType || 'audio/wav',
                        data: data.audio
                      } 
                    }
                  ]
                }
              ],
              generationConfig: {
                maxOutputTokens: 2000,
                temperature: 0.5, // Lower temperature for more accurate transcription
              }
            });
            
            const transcription = transcriptionResult.response.text();
            console.log('Audio transcription:', transcription);
            
            // Send the transcription to the client
            ws.send(JSON.stringify({
              type: 'transcription',
              content: transcription
            }));
            
            // Start streaming the response immediately
            let fullText = '';
            
            // Send streaming updates as they arrive
            for await (const chunk of result.stream) {
              const chunkText = chunk.text();
              if (chunkText) {
                fullText += chunkText;
                // Send each chunk as it arrives
                ws.send(JSON.stringify({
                  type: 'stream-chunk',
                  content: chunkText
                }));
              }
            }
            
            console.log('Gemini streaming response complete:', fullText);
            
            // Send completed message marker
            ws.send(JSON.stringify({
              type: 'stream-complete',
              content: fullText
            }));
            
            // Start TTS processing while the user is reading
            // Do this in a non-blocking way
            processTTS(fullText, ws);
            
          } catch (streamError) {
            console.error('Streaming error:', streamError);
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Streaming error',
              details: streamError.message || streamError.toString()
            }));
          }
        } catch (audioError) {
          console.error('Error processing audio specifically:', audioError);
          
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Failed to process audio',
            details: audioError.message || audioError.toString()
          }));
        }
      } else if (data.type === 'chat') {
        // Handle text chat using streaming for immediate response
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        
        const contents = [
          {
            role: 'user',
            parts: [{ text: data.message }]
          }
        ];
        
        try {
          // Use streaming API for immediate response
          const result = await model.generateContentStream({
            contents: contents,
            generationConfig: {
              maxOutputTokens: 256,
              temperature: 0.4,
              topK: 40,
              topP: 0.95,
            }
          });
          
          let fullText = '';
          
          // Send streaming updates as they arrive
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              fullText += chunkText;
              // Send each chunk as it arrives
              ws.send(JSON.stringify({
                type: 'stream-chunk',
                content: chunkText
              }));
            }
          }
          
          console.log('Gemini streaming response complete:', fullText);
          
          // Send completed message marker
          ws.send(JSON.stringify({
            type: 'stream-complete',
            content: fullText
          }));
          
        } catch (error) {
          console.error('Chat error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Failed to get response',
            details: error.message || error.toString()
          }));
        }
      } else {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Unknown message type'
        }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Failed to process message',
        details: error.message || error.toString()
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Process TTS in the background without blocking the initial response
async function processTTS(text, ws) {
  try {
    console.log('Processing TTS for:', text.substring(0, 50) + '...');
    
    const ttsResponse = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1',
        input: text,
        voice: 'alloy',
        response_format: 'mp3',
        speed: 1.2
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: TTS_TIMEOUT_MS
      }
    );
    
    const audioBase64 = Buffer.from(ttsResponse.data, 'binary').toString('base64');
    
    // Send the audio back to the client
    ws.send(JSON.stringify({
      type: 'tts-audio',
      audio: audioBase64,
      mimeType: 'audio/mp3',
      text: text
    }));
    
    console.log('TTS audio sent successfully');
  } catch (error) {
    console.error('TTS processing error:', error);
    ws.send(JSON.stringify({
      type: 'tts-error',
      error: 'Failed to generate audio',
      details: error.message || error.toString()
    }));
  }
}

console.log('Gemini WebSocket server running on ws://localhost:4001');