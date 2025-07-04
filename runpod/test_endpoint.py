#!/usr/bin/env python3
"""
Test script for MeloTTS RunPod endpoint
Tests accent selection and TTS functionality
"""

import requests
import json
import base64
import time
import os
from typing import Dict, Any

# RunPod endpoint configuration
RUNPOD_ENDPOINT = os.getenv('RUNPOD_ENDPOINT')  # Set this environment variable
RUNPOD_API_KEY = os.getenv('RUNPOD_API_KEY')    # Set this environment variable

# Test cases for different accents
TEST_CASES = [
    {
        "name": "US English",
        "input": {
            "text": "Hello, this is a test of American English accent.",
            "language": "EN-US",
            "speaker_id": 0,
            "speed": 1.0
        }
    },
    {
        "name": "British English", 
        "input": {
            "text": "Good morning, this is a test of British English accent.",
            "language": "EN-BR",
            "speaker_id": 0,
            "speed": 1.0
        }
    },
    {
        "name": "Indian English",
        "input": {
            "text": "Namaste, this is a test of Indian English accent.",
            "language": "EN-IN", 
            "speaker_id": 0,
            "speed": 1.0
        }
    },
    {
        "name": "Speed Test",
        "input": {
            "text": "This is a speed test with faster speech.",
            "language": "EN-US",
            "speaker_id": 0,
            "speed": 1.5
        }
    }
]

def test_local_container():
    """Test the local Docker container"""
    print("=== Testing Local Container ===")
    
    # Test if container is running
    import subprocess
    try:
        result = subprocess.run(['docker', 'ps', '--filter', 'name=melotts'], 
                              capture_output=True, text=True)
        if 'melotts' not in result.stdout:
            print("❌ Container 'melotts' is not running")
            return False
        print("✅ Container is running")
    except Exception as e:
        print(f"❌ Error checking container: {e}")
        return False
    
    # Test handler directly
    for test_case in TEST_CASES:
        print(f"\n--- Testing {test_case['name']} ---")
        
        # Create test event
        event = {"input": test_case["input"]}
        
        try:
            # Execute handler in container
            cmd = [
                'docker', 'exec', 'melotts', 'python', '-c',
                f"""
import sys
sys.path.append('/app')
from handler import handler
import json

event = {json.dumps(event)}
result = handler(event)
print(json.dumps(result))
"""
            ]
            
            start_time = time.time()
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            end_time = time.time()
            
            if result.returncode == 0:
                response = json.loads(result.stdout.strip())
                
                if 'error' in response:
                    print(f"❌ Error: {response['error']}")
                else:
                    print(f"✅ Success in {end_time - start_time:.2f}s")
                    print(f"   Language: {response.get('language')}")
                    print(f"   Duration: {response.get('duration', 0):.2f}s")
                    print(f"   Sample Rate: {response.get('sample_rate')}Hz")
                    
                    # Save audio file for verification
                    if 'audio' in response:
                        audio_data = base64.b64decode(response['audio'])
                        filename = f"test_output_{test_case['name'].replace(' ', '_').lower()}.wav"
                        with open(filename, 'wb') as f:
                            f.write(audio_data)
                        print(f"   Audio saved: {filename}")
            else:
                print(f"❌ Container execution failed: {result.stderr}")
                
        except subprocess.TimeoutExpired:
            print("❌ Test timed out")
        except Exception as e:
            print(f"❌ Test failed: {e}")

def test_runpod_endpoint():
    """Test the deployed RunPod endpoint"""
    print("\n=== Testing RunPod Endpoint ===")
    
    if not RUNPOD_ENDPOINT or not RUNPOD_API_KEY:
        print("❌ RUNPOD_ENDPOINT and RUNPOD_API_KEY environment variables required")
        print("   Set them with:")
        print("   export RUNPOD_ENDPOINT='https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/runsync'")
        print("   export RUNPOD_API_KEY='your-api-key'")
        return
    
    headers = {
        'Authorization': f'Bearer {RUNPOD_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    for test_case in TEST_CASES:
        print(f"\n--- Testing {test_case['name']} ---")
        
        payload = {
            "input": test_case["input"]
        }
        
        try:
            start_time = time.time()
            response = requests.post(
                RUNPOD_ENDPOINT,
                headers=headers,
                json=payload,
                timeout=120
            )
            end_time = time.time()
            
            if response.status_code == 200:
                result = response.json()
                
                if 'error' in result:
                    print(f"❌ API Error: {result['error']}")
                elif 'output' in result:
                    output = result['output']
                    print(f"✅ Success in {end_time - start_time:.2f}s")
                    print(f"   Language: {output.get('language')}")
                    print(f"   Duration: {output.get('duration', 0):.2f}s")
                    print(f"   Sample Rate: {output.get('sample_rate')}Hz")
                    
                    # Save audio file
                    if 'audio' in output:
                        audio_data = base64.b64decode(output['audio'])
                        filename = f"runpod_output_{test_case['name'].replace(' ', '_').lower()}.wav"
                        with open(filename, 'wb') as f:
                            f.write(audio_data)
                        print(f"   Audio saved: {filename}")
                else:
                    print(f"❌ Unexpected response format: {result}")
            else:
                print(f"❌ HTTP {response.status_code}: {response.text}")
                
        except requests.Timeout:
            print("❌ Request timed out")
        except Exception as e:
            print(f"❌ Request failed: {e}")

def test_health_check():
    """Test health check endpoint"""
    print("\n=== Testing Health Check ===")
    
    try:
        # Test local container health
        import subprocess
        result = subprocess.run([
            'docker', 'exec', 'melotts', 'python', '-c',
            'from handler import health_check; import json; print(json.dumps(health_check()))'
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            health = json.loads(result.stdout.strip())
            if health.get('status') == 'healthy':
                print("✅ Local container health check passed")
                print(f"   Models loaded: {health.get('models_loaded', [])}")
            else:
                print(f"❌ Health check failed: {health}")
        else:
            print(f"❌ Health check execution failed: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Health check failed: {e}")

if __name__ == "__main__":
    print("MeloTTS RunPod Endpoint Test Suite")
    print("==================================")
    
    # Test local container first
    test_health_check()
    test_local_container()
    
    # Test RunPod endpoint if configured
    test_runpod_endpoint()
    
    print("\n=== Test Summary ===")
    print("Check the generated audio files to verify accent differences:")
    for test_case in TEST_CASES:
        filename = f"test_output_{test_case['name'].replace(' ', '_').lower()}.wav"
        if os.path.exists(filename):
            print(f"  • {filename}")