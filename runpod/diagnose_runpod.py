#!/usr/bin/env python3
"""
RunPod Diagnostic Script
Checks API key, endpoint, and authentication
"""

import requests
import json

# Your current credentials
RUNPOD_API_KEY = "rpa_CWD2ZDMUQOSA66OH14GUKXZRYVB18Q2IXKUDBKO9pnsfon"
RUNPOD_ENDPOINT_ID = "yycsx39sqwycic"

def test_api_key():
    """Test if API key is valid by listing endpoints"""
    print("🔑 Testing API Key...")
    
    headers = {
        "Authorization": f"Bearer {RUNPOD_API_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        # List serverless endpoints
        response = requests.get(
            "https://api.runpod.ai/v2",
            headers=headers,
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ API Key is valid")
            
            try:
                data = response.json()
                if isinstance(data, dict):
                    endpoints = data.get('endpoints', [])
                    if endpoints:
                        print(f"📡 Found {len(endpoints)} endpoints:")
                        for ep in endpoints:
                            ep_id = ep.get('id', 'Unknown')
                            ep_name = ep.get('name', 'Unnamed')
                            ep_status = ep.get('status', 'Unknown')
                            print(f"   - {ep_name} ({ep_id}): {ep_status}")
                    else:
                        print("⚠️  No endpoints found in response")
                else:
                    print("⚠️  Unexpected response format")
                    
            except json.JSONDecodeError:
                print("⚠️  Could not parse response as JSON")
                print(f"Response: {response.text[:200]}...")
                
        elif response.status_code == 401:
            print("❌ API Key is invalid or expired")
            print("   Check your RunPod dashboard for the correct key")
            
        elif response.status_code == 403:
            print("❌ API Key valid but insufficient permissions")
            
        else:
            print(f"❌ Unexpected status: {response.status_code}")
            print(f"Response: {response.text[:200]}...")
            
    except requests.exceptions.RequestException as e:
        print(f"🔌 Connection error: {e}")

def test_endpoint_direct():
    """Test the specific endpoint directly"""
    print(f"\n🎯 Testing Endpoint: {RUNPOD_ENDPOINT_ID}")
    
    headers = {
        "Authorization": f"Bearer {RUNPOD_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Simple payload
    payload = {"input": {"text": "test"}}
    
    endpoints_to_test = [
        f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}",
        f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/run",
        f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/runsync",
        f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/status"
    ]
    
    for endpoint_url in endpoints_to_test:
        try:
            print(f"\n📡 Testing: {endpoint_url}")
            
            # Try GET first for status endpoints
            if "status" in endpoint_url:
                response = requests.get(endpoint_url, headers=headers, timeout=10)
            else:
                response = requests.post(endpoint_url, headers=headers, json=payload, timeout=10)
            
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                print("   ✅ Endpoint accessible")
                try:
                    data = response.json()
                    if "error" in data:
                        print(f"   ⚠️  Error in response: {data['error']}")
                    elif "status" in data:
                        print(f"   📊 Status: {data['status']}")
                    else:
                        print(f"   📦 Response keys: {list(data.keys())}")
                except:
                    print(f"   📄 Response: {response.text[:100]}...")
                    
            elif response.status_code == 401:
                print("   ❌ Authentication failed")
                
            elif response.status_code == 404:
                print("   ❌ Endpoint not found")
                
            elif response.status_code == 422:
                print("   ⚠️  Invalid payload format")
                
            else:
                print(f"   ❓ Status {response.status_code}: {response.text[:100]}...")
                
        except requests.exceptions.RequestException as e:
            print(f"   🔌 Connection error: {e}")

def show_credentials():
    """Show current credentials for verification"""
    print(f"\n📋 Current Configuration:")
    print(f"   API Key: {RUNPOD_API_KEY[:10]}...{RUNPOD_API_KEY[-5:]}")
    print(f"   Endpoint ID: {RUNPOD_ENDPOINT_ID}")
    print(f"   Expected endpoints:")
    print(f"   - https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/runsync")
    print(f"   - https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/run")

def main():
    print("🔍 RunPod Diagnostic Tool")
    print("=" * 40)
    
    show_credentials()
    test_api_key()
    test_endpoint_direct()
    
    print("\n" + "=" * 40)
    print("💡 Next Steps:")
    print("1. If API key is invalid: Get new key from RunPod dashboard")
    print("2. If endpoint not found: Check endpoint ID in RunPod dashboard")
    print("3. If 422 errors: Check if container expects different payload format")
    print("4. Check RunPod dashboard for endpoint status and logs")

if __name__ == "__main__":
    main()