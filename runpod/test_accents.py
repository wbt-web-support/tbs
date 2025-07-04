#!/usr/bin/env python3
"""
Quick test for UK and Indian accents
"""

import sys
import os
import json
import base64
import time

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_accent(language, text, description):
    """Test a specific accent"""
    print(f"\n=== Testing {description} ===")
    
    event = {
        "input": {
            "text": text,
            "language": language,
            "speed": 1.0
        }
    }
    
    try:
        from handler import handler
        
        start_time = time.time()
        result = handler(event)
        end_time = time.time()
        
        if 'error' in result:
            print(f"❌ Error: {result['error']}")
            return False
        elif 'audio' in result:
            print(f"✅ Success in {end_time - start_time:.2f}s")
            print(f"   Duration: {result.get('duration', 0):.2f}s")
            print(f"   Sample Rate: {result.get('sample_rate')}Hz")
            
            # Save audio file
            audio_data = base64.b64decode(result['audio'])
            filename = f"{language.lower().replace('-', '_')}_test.wav"
            with open(filename, 'wb') as f:
                f.write(audio_data)
            print(f"   Audio saved: {filename}")
            return True
        else:
            print(f"❌ Unexpected result: {result}")
            return False
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        return False

if __name__ == "__main__":
    print("MeloTTS Accent Test")
    print("==================")
    
    # Test cases
    tests = [
        ("EN-US", "Hello from America, how are you today?", "American English"),
        ("EN-BR", "Hello from Britain, how are you today?", "British English"),
        ("EN-IN", "Hello from India, how are you today?", "Indian English")
    ]
    
    results = {}
    for language, text, description in tests:
        results[language] = test_accent(language, text, description)
    
    print(f"\n=== Test Summary ===")
    for language, success in results.items():
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{language}: {status}")
        
    if all(results.values()):
        print("\n🎉 All accent tests passed! Check the .wav files to hear the differences.")
    else:
        print("\n⚠️  Some tests failed. Check the error messages above.")