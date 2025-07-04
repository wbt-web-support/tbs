#!/usr/bin/env python3
"""
RunPod MeloTTS Test Script
Tests the deployed container with different accents
"""

import requests
import json
import base64
import time
import os
from typing import Dict, Any

# Configuration
RUNPOD_API_KEY = "rpa_CWD2ZDMUQOSA66OH14GUKXZRYVB18Q2IXKUDBKO9pnsfon"  # Your API key
RUNPOD_ENDPOINT_ID = "yycsx39sqwycic"  # Your endpoint ID

# Test configurations
TEST_CASES = [
    {
        "text": "Hello, this is a test of American English accent.",
        "language": "EN-US",
        "accent_name": "American"
    },
    {
        "text": "Hello, this is a test of British English accent.",
        "language": "EN-BR", 
        "accent_name": "British"
    },
    {
        "text": "Hello, this is a test of Indian English accent.",
        "language": "EN-IN",
        "accent_name": "Indian"
    }
]

def test_runpod_endpoint(text: str, language: str, accent_name: str) -> Dict[str, Any]:
    """Test a specific accent configuration"""
    
    print(f"\n🎤 Testing {accent_name} accent ({language})")
    print(f"Text: {text}")
    
    # Prepare request payload
    payload = {
        "input": {
            "text": text,
            "language": language,
            "speaker_id": 0,
            "speed": 1.0,
            "device": "auto"
        }
    }
    
    headers = {
        "Authorization": f"Bearer {RUNPOD_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Try both sync and async endpoints
    endpoints_to_try = [
        f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/runsync",
        f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/run"
    ]
    
    for endpoint_url in endpoints_to_try:
        try:
            print(f"📡 Trying endpoint: {endpoint_url}")
            
            # Make request
            start_time = time.time()
            response = requests.post(
                endpoint_url,
                headers=headers,
                json=payload,
                timeout=60
            )
            
            request_time = time.time() - start_time
            print(f"⏱️  Request took: {request_time:.2f} seconds")
            
            if response.status_code == 200:
                result = response.json()
                
                # Check for errors
                if "error" in result:
                    print(f"❌ RunPod Error: {result['error']}")
                    continue
                
                # Handle IN_QUEUE status
                if result.get("status") == "IN_QUEUE":
                    print(f"⏳ Request queued. ID: {result.get('id', 'Unknown')}")
                    # For async endpoint, you'd need to poll for results
                    continue
                
                # Check for successful audio generation
                if "output" in result and "audio" in result["output"]:
                    audio_b64 = result["output"]["audio"]
                    sample_rate = result["output"].get("sample_rate", 22050)
                    
                    print(f"✅ Success! Generated audio:")
                    print(f"   - Audio size: {len(audio_b64)} chars (base64)")
                    print(f"   - Sample rate: {sample_rate} Hz")
                    print(f"   - Language: {result['output'].get('language', language)}")
                    
                    # Save audio file for testing
                    audio_filename = f"test_{accent_name.lower()}_accent.wav"
                    try:
                        audio_data = base64.b64decode(audio_b64)
                        with open(audio_filename, "wb") as f:
                            f.write(audio_data)
                        print(f"💾 Saved audio to: {audio_filename}")
                    except Exception as e:
                        print(f"⚠️  Could not save audio file: {e}")
                    
                    return {
                        "success": True,
                        "endpoint": endpoint_url,
                        "audio_size": len(audio_b64),
                        "sample_rate": sample_rate,
                        "request_time": request_time,
                        "filename": audio_filename
                    }
                
                else:
                    print(f"❌ No audio in response: {result}")
                    
            else:
                print(f"❌ HTTP {response.status_code}: {response.text}")
                
        except requests.exceptions.Timeout:
            print(f"⏰ Timeout after 60 seconds")
        except requests.exceptions.RequestException as e:
            print(f"🔌 Connection error: {e}")
        except Exception as e:
            print(f"💥 Unexpected error: {e}")
    
    return {"success": False, "error": "All endpoints failed"}

def test_health_check():
    """Test if the RunPod service is healthy"""
    print("🏥 Testing service health...")
    
    # Simple health check with minimal text
    health_payload = {
        "input": {
            "text": "test",
            "language": "EN-US",
            "speaker_id": 0
        }
    }
    
    headers = {
        "Authorization": f"Bearer {RUNPOD_API_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/runsync",
            headers=headers,
            json=health_payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if "error" in result:
                print(f"❌ Service unhealthy: {result['error']}")
                return False
            elif result.get("status") == "IN_QUEUE":
                print(f"⚠️  Service busy (IN_QUEUE)")
                return True
            elif "output" in result:
                print(f"✅ Service healthy")
                return True
        
        print(f"❌ Health check failed: HTTP {response.status_code}")
        return False
        
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def main():
    """Main test function"""
    print("🚀 RunPod MeloTTS Accent Test Suite")
    print(f"🔗 Endpoint ID: {RUNPOD_ENDPOINT_ID}")
    print("=" * 50)
    
    # Health check first
    if not test_health_check():
        print("\n❌ Service appears to be unhealthy. Check RunPod logs.")
        return
    
    print("\n🧪 Running accent tests...")
    
    results = []
    
    # Test each accent
    for test_case in TEST_CASES:
        result = test_runpod_endpoint(
            test_case["text"],
            test_case["language"], 
            test_case["accent_name"]
        )
        results.append({
            "accent": test_case["accent_name"],
            "language": test_case["language"],
            **result
        })
        
        # Wait between tests
        time.sleep(2)
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    successful_tests = [r for r in results if r.get("success")]
    failed_tests = [r for r in results if not r.get("success")]
    
    print(f"✅ Successful: {len(successful_tests)}/{len(results)}")
    print(f"❌ Failed: {len(failed_tests)}/{len(results)}")
    
    if successful_tests:
        print("\n🎉 Working accents:")
        for result in successful_tests:
            print(f"   - {result['accent']} ({result['language']}): {result['request_time']:.2f}s")
    
    if failed_tests:
        print("\n💔 Failed accents:")
        for result in failed_tests:
            print(f"   - {result['accent']} ({result['language']}): {result.get('error', 'Unknown error')}")
    
    if successful_tests:
        print(f"\n🎵 Audio files saved in current directory")
        print("You can play them to test the different accents!")

if __name__ == "__main__":
    main()