#!/usr/bin/env python3
"""
Local test for MeloTTS handler (without Docker)
"""

import sys
import os
import json
import base64

# Add current directory to path to import handler
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_handler_validation():
    """Test input validation"""
    print("=== Testing Input Validation ===")
    
    try:
        from handler import validate_input
        
        # Test valid input
        valid_event = {
            "input": {
                "text": "Hello world",
                "language": "EN-US",
                "speed": 1.0
            }
        }
        
        params = validate_input(valid_event)
        print("✅ Valid input test passed")
        print(f"   Parsed params: {params}")
        
        # Test invalid inputs
        test_cases = [
            ({"input": {}}, "Missing text"),
            ({"input": {"text": ""}}, "Empty text"),
            ({"input": {"text": "test", "speed": 5.0}}, "Invalid speed"),
        ]
        
        for invalid_event, description in test_cases:
            try:
                validate_input(invalid_event)
                print(f"❌ {description} should have failed")
            except ValueError:
                print(f"✅ {description} validation works")
            except Exception as e:
                print(f"❌ {description} unexpected error: {e}")
                
    except ImportError as e:
        print(f"❌ Cannot import handler: {e}")

def test_accent_configs():
    """Test different accent configurations"""
    print("\n=== Testing Accent Configurations ===")
    
    accents = [
        ("EN-US", "American English"),
        ("EN-BR", "British English"), 
        ("EN-IN", "Indian English")
    ]
    
    for language_code, description in accents:
        event = {
            "input": {
                "text": f"This is a test of {description} accent.",
                "language": language_code,
                "speaker_id": 0,
                "speed": 1.0
            }
        }
        
        print(f"\n--- {description} ({language_code}) ---")
        print(f"Event: {json.dumps(event, indent=2)}")
        print("Ready for testing with actual TTS models")

if __name__ == "__main__":
    print("MeloTTS Local Test Suite")
    print("========================")
    
    test_handler_validation()
    test_accent_configs()
    
    print("\n=== Instructions for Full Testing ===")
    print("1. Run your Docker container:")
    print("   docker start melotts")
    print("\n2. Test with the full test script:")
    print("   python test_endpoint.py")
    print("\n3. For RunPod testing, set environment variables:")
    print("   export RUNPOD_ENDPOINT='https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/runsync'")
    print("   export RUNPOD_API_KEY='your-api-key'")
    print("\n4. Manual test commands:")
    print("   # Test handler directly in container")
    print('   docker exec melotts python -c "from handler import handler; print(handler({\'input\': {\'text\': \'Hello\', \'language\': \'EN-US\'}}))"')