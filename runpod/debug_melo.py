#!/usr/bin/env python3
"""
Debug script to test MeloTTS directly
"""

from melo.api import TTS
import tempfile

# Test what happens when we call TTS directly
try:
    print("=== Testing MeloTTS Direct API ===")
    
    # Test with EN-US
    print("Loading EN-US model...")
    model = TTS(language='EN-US', device='auto')
    print("Model loaded successfully")
    
    # Test simple generation
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        temp_path = f.name
    
    print(f"Generating to: {temp_path}")
    
    # Try minimal call first
    try:
        model.tts_to_file('Hello', 0, temp_path)
        print("✅ Minimal call worked!")
    except Exception as e:
        print(f"❌ Minimal call failed: {e}")
        print(f"Error type: {type(e)}")
        
        # Try different parameter combinations
        try:
            print("Trying with keyword arguments...")
            model.tts_to_file(text='Hello', speaker_id=0, output_path=temp_path)
            print("✅ Keyword call worked!")
        except Exception as e2:
            print(f"❌ Keyword call also failed: {e2}")
            
            # Try checking what methods are available
            print("Available methods:")
            for attr in dir(model):
                if 'tts' in attr.lower():
                    print(f"  - {attr}")
    
    # Test other accents
    for lang in ['EN-BR', 'EN-IN']:
        try:
            print(f"\nTesting {lang}...")
            model_test = TTS(language=lang, device='auto')
            print(f"✅ {lang} model loaded")
        except Exception as e:
            print(f"❌ {lang} failed: {e}")
            
except Exception as e:
    print(f"Failed to load model: {e}")
    print(f"Error type: {type(e)}")