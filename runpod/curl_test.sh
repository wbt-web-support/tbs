#!/bin/bash
# Test script for RunPod endpoint using curl

echo "=== MeloTTS RunPod Endpoint Test ==="

# Check if environment variables are set
if [ -z "$RUNPOD_ENDPOINT" ] || [ -z "$RUNPOD_API_KEY" ]; then
    echo "❌ Please set environment variables:"
    echo "export RUNPOD_ENDPOINT='https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/runsync'"
    echo "export RUNPOD_API_KEY='your-api-key'"
    exit 1
fi

echo "Testing endpoint: $RUNPOD_ENDPOINT"

# Test cases for different accents
declare -a tests=(
    '{"input": {"text": "Hello, this is American English.", "language": "EN-US", "speaker_id": 0, "speed": 1.0}}'
    '{"input": {"text": "Good morning, this is British English.", "language": "EN-BR", "speaker_id": 0, "speed": 1.0}}'
    '{"input": {"text": "Namaste, this is Indian English.", "language": "EN-IN", "speaker_id": 0, "speed": 1.0}}'
    '{"input": {"text": "This is a speed test.", "language": "EN-US", "speaker_id": 0, "speed": 1.5}}'
)

declare -a names=(
    "American English"
    "British English" 
    "Indian English"
    "Speed Test"
)

# Run tests
for i in "${!tests[@]}"; do
    echo ""
    echo "--- Testing ${names[$i]} ---"
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Authorization: Bearer $RUNPOD_API_KEY" \
        -H "Content-Type: application/json" \
        -d "${tests[$i]}" \
        "$RUNPOD_ENDPOINT")
    
    # Extract response body and status code
    body=$(echo "$response" | head -n -1)
    status_code=$(echo "$response" | tail -n 1)
    
    if [ "$status_code" = "200" ]; then
        echo "✅ HTTP $status_code - Success"
        
        # Parse key fields from response
        duration=$(echo "$body" | grep -o '"duration":[0-9.]*' | cut -d: -f2)
        language=$(echo "$body" | grep -o '"language":"[^"]*"' | cut -d: -f2 | tr -d '"')
        sample_rate=$(echo "$body" | grep -o '"sample_rate":[0-9]*' | cut -d: -f2)
        
        echo "   Language: $language"
        echo "   Duration: ${duration}s"
        echo "   Sample Rate: ${sample_rate}Hz"
        
        # Save audio if present
        audio_b64=$(echo "$body" | grep -o '"audio":"[^"]*"' | cut -d: -f2 | tr -d '"')
        if [ ! -z "$audio_b64" ]; then
            filename="output_${names[$i]// /_}.wav"
            echo "$audio_b64" | base64 -d > "$filename"
            echo "   Audio saved: $filename"
        fi
    else
        echo "❌ HTTP $status_code - Failed"
        echo "   Response: $body"
    fi
done

echo ""
echo "=== Test Complete ==="
echo "Check generated .wav files to verify accent differences"