#!/usr/bin/env python3
"""
Check RunPod API structure and authentication
"""

import requests

RUNPOD_API_KEY = "rpa_CWD2ZDMUQOSA66OH14GUKXZRYVB18Q2IXKUDBKO9pnsfon"
RUNPOD_ENDPOINT_ID = "yycsx39sqwycic"

def test_api_endpoints():
    """Test different API endpoint structures"""
    
    headers = {
        "Authorization": f"Bearer {RUNPOD_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Different API structures to try
    base_urls = [
        "https://api.runpod.ai/v2",
        "https://api.runpod.ai/v1", 
        "https://api.runpod.io/v2",
        "https://api.runpod.io/v1"
    ]
    
    print("🔍 Testing different API base URLs...")
    
    for base_url in base_urls:
        try:
            print(f"\n📡 Testing: {base_url}")
            response = requests.get(base_url, headers=headers, timeout=10)
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                print("   ✅ Base URL works!")
                try:
                    data = response.json()
                    print(f"   📦 Response keys: {list(data.keys()) if isinstance(data, dict) else 'List response'}")
                except:
                    print(f"   📄 Response text: {response.text[:100]}...")
            elif response.status_code == 404:
                print("   ❌ URL not found")
            elif response.status_code == 401:
                print("   ❌ Authentication failed")
            else:
                print(f"   ❓ Status: {response.status_code}")
                
        except Exception as e:
            print(f"   🔌 Error: {e}")

def test_without_auth():
    """Test endpoints without authentication to see if they exist"""
    
    print("\n🔓 Testing endpoints without authentication...")
    
    endpoints = [
        f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}",
        f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/run",
        f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/runsync"
    ]
    
    for endpoint in endpoints:
        try:
            print(f"\n📡 Testing: {endpoint}")
            response = requests.get(endpoint, timeout=10)
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 401:
                print("   ✅ Endpoint exists (needs auth)")
            elif response.status_code == 404:
                print("   ❌ Endpoint not found")
            elif response.status_code == 405:
                print("   ✅ Endpoint exists (wrong method)")
            else:
                print(f"   ❓ Status: {response.status_code}")
                
        except Exception as e:
            print(f"   🔌 Error: {e}")

def check_graphql_api():
    """Check if RunPod uses GraphQL API"""
    
    print("\n🎯 Testing GraphQL API...")
    
    headers = {
        "Authorization": f"Bearer {RUNPOD_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # GraphQL query to list endpoints
    query = {
        "query": """
        query {
            myself {
                serverlessDiscount {
                    discountFactor
                }
            }
        }
        """
    }
    
    graphql_urls = [
        "https://api.runpod.ai/graphql",
        "https://api.runpod.io/graphql"
    ]
    
    for url in graphql_urls:
        try:
            print(f"\n📡 Testing GraphQL: {url}")
            response = requests.post(url, headers=headers, json=query, timeout=10)
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                print("   ✅ GraphQL API works!")
                try:
                    data = response.json()
                    print(f"   📦 Response: {data}")
                except:
                    print(f"   📄 Response text: {response.text[:200]}...")
            else:
                print(f"   ❌ Status: {response.status_code}")
                print(f"   📄 Response: {response.text[:100]}...")
                
        except Exception as e:
            print(f"   🔌 Error: {e}")

def main():
    print("🔍 RunPod API Structure Checker")
    print("=" * 40)
    
    test_api_endpoints()
    test_without_auth()
    check_graphql_api()
    
    print("\n" + "=" * 40)
    print("💡 Manual Steps to Check:")
    print("1. Log into RunPod dashboard")
    print("2. Go to Serverless > Endpoints")
    print("3. Find your endpoint and check:")
    print("   - Endpoint ID")
    print("   - Status (should be 'Running')")
    print("   - API key in Settings")
    print("4. Look for 'Test' or 'API' tab for correct URL format")

if __name__ == "__main__":
    main()