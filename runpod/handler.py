"""
RunPod Handler for MeloTTS Text-to-Speech
Handles serverless inference requests for text-to-speech conversion
"""

import runpod
import base64
import io
import os
import sys
import tempfile
import logging
from typing import Dict, Any

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from melo.api import TTS
    import soundfile as sf
    import numpy as np
except ImportError as e:
    logger.error(f"Failed to import required modules: {e}")
    sys.exit(1)

# Global model storage
models = {}

def load_model(language: str = 'EN', device: str = 'auto') -> TTS:
    """
    Load and cache TTS model for specified language
    
    Args:
        language: Language code (EN-US, EN-BR, EN-IN, etc.)
        device: Device to run on ('auto', 'cuda', 'cpu')
    
    Returns:
        TTS model instance
    """
    # For English accents, we use one EN model and select speakers by ID
    # Map all English variants to the base EN model
    base_language = 'EN' if language.startswith('EN') else language
    model_key = f"{base_language}_{device}"
    
    if model_key not in models:
        try:
            logger.info(f"Loading MeloTTS model for base language: {base_language}, device: {device}")
            models[model_key] = TTS(language=base_language, device=device)
            logger.info(f"Successfully loaded model: {model_key}")
            
            # Log available speakers for English
            if base_language == 'EN':
                try:
                    speaker_ids = models[model_key].hps.data.spk2id
                    logger.info(f"Available English speakers: {list(speaker_ids.keys())}")
                except:
                    pass
                    
        except Exception as e:
            logger.error(f"Failed to load model {model_key}: {e}")
            raise
    
    return models[model_key]

def get_speaker_id(model: TTS, language: str, speaker_id: int = 0):
    """
    Get the correct speaker ID for accent selection
    
    Args:
        model: TTS model instance
        language: Language code (EN-US, EN-BR, EN-IN, etc.)
        speaker_id: Default speaker ID if accent mapping fails
        
    Returns:
        Speaker ID for the requested accent
    """
    try:
        speaker_ids = model.hps.data.spk2id
        
        # Map language codes to speaker names based on documentation
        accent_mapping = {
            'EN-US': 'EN-US',
            'EN-BR': 'EN-BR', 
            'EN-IN': 'EN_INDIA',  # Note: underscore instead of dash
            'EN-AU': 'EN-AU',
            'EN': 'EN-US'  # Default to US
        }
        
        accent_key = accent_mapping.get(language, 'EN-US')
        
        if accent_key in speaker_ids:
            logger.info(f"Using accent {accent_key} with speaker ID {speaker_ids[accent_key]}")
            return speaker_ids[accent_key]
        else:
            logger.warning(f"Accent {accent_key} not found, using default speaker {speaker_id}")
            return speaker_id
            
    except Exception as e:
        logger.warning(f"Could not get speaker ID for {language}: {e}, using default {speaker_id}")
        return speaker_id

def validate_input(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate and parse input parameters
    
    Args:
        event: Input event containing text and parameters
    
    Returns:
        Validated parameters dictionary
    """
    input_data = event.get('input', {})
    
    # Required parameter
    text = input_data.get('text')
    if not text or not isinstance(text, str):
        raise ValueError("'text' parameter is required and must be a string")
    
    if len(text.strip()) == 0:
        raise ValueError("'text' parameter cannot be empty")
    
    # Optional parameters with defaults
    params = {
        'text': text.strip(),
        'speaker_id': input_data.get('speaker_id', 0),
        'language': input_data.get('language', 'EN-US'),
        'device': input_data.get('device', 'auto'),
        'speed': float(input_data.get('speed', 1.0)),
        'sdp_ratio': float(input_data.get('sdp_ratio', 0.2)),
        'noise_scale': float(input_data.get('noise_scale', 0.6)),
        'noise_scale_w': float(input_data.get('noise_scale_w', 0.8))
    }
    
    # Validate ranges
    if not 0.1 <= params['speed'] <= 3.0:
        raise ValueError("'speed' must be between 0.1 and 3.0")
    
    if not 0 <= params['sdp_ratio'] <= 1.0:
        raise ValueError("'sdp_ratio' must be between 0.0 and 1.0")
    
    if not 0 <= params['noise_scale'] <= 2.0:
        raise ValueError("'noise_scale' must be between 0.0 and 2.0")
    
    if not 0 <= params['noise_scale_w'] <= 2.0:
        raise ValueError("'noise_scale_w' must be between 0.0 and 2.0")
    
    return params

def generate_speech(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate speech from text using MeloTTS
    
    Args:
        params: Validated parameters dictionary
    
    Returns:
        Dictionary containing audio data and metadata
    """
    try:
        # Load model
        model = load_model(params['language'], params['device'])
        
        # Get correct speaker ID for accent
        accent_speaker_id = get_speaker_id(model, params['language'], params['speaker_id'])
        
        # Generate speech
        logger.info(f"Generating speech for text: {params['text'][:50]}...")
        logger.info(f"Using accent: {params['language']}, speaker_id: {accent_speaker_id}")
        
        # Create temporary file for audio output
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            # Generate audio using correct MeloTTS API based on documentation
            model.tts_to_file(
                text=params['text'],
                speaker_id=accent_speaker_id,
                output_path=temp_path,
                speed=params['speed']
            )
            
            logger.info("tts_to_file completed successfully")
            
            # Read the generated audio file
            audio_data, sample_rate = sf.read(temp_path)
            
            # Convert to base64
            buffer = io.BytesIO()
            sf.write(buffer, audio_data, sample_rate, format='WAV')
            audio_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            logger.info(f"Successfully generated {len(audio_data)} audio samples at {sample_rate}Hz")
            
            return {
                "audio": audio_base64,
                "sample_rate": int(sample_rate),
                "format": "wav",
                "duration": len(audio_data) / sample_rate,
                "text": params['text'],
                "speaker_id": params['speaker_id'],
                "language": params['language']
            }
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
                
    except Exception as e:
        logger.error(f"Error generating speech: {e}")
        raise

def handler(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main RunPod handler function
    
    Args:
        event: RunPod event containing input data
    
    Returns:
        Response dictionary with audio data or error
    """
    try:
        logger.info(f"Received event: {event}")
        
        # Validate input
        params = validate_input(event)
        logger.info(f"Validated parameters: {params}")
        
        # Generate speech
        result = generate_speech(params)
        
        logger.info("Successfully processed request")
        return result
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return {"error": f"Validation error: {str(e)}"}
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return {"error": f"Internal error: {str(e)}"}

# Health check endpoint
def health_check():
    """Health check to verify model loading"""
    try:
        # Try to load English model
        model = load_model('EN-US', 'auto')
        return {"status": "healthy", "models_loaded": list(models.keys())}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

if __name__ == "__main__":
    logger.info("Starting MeloTTS RunPod handler...")
    
    # Perform initial health check
    health = health_check()
    logger.info(f"Health check: {health}")
    
    if health["status"] == "unhealthy":
        logger.error("Failed health check, exiting...")
        sys.exit(1)
    
    # Start RunPod serverless handler
    logger.info("Starting RunPod serverless handler...")
    runpod.serverless.start({"handler": handler})