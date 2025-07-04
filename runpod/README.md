# RunPod MeloTTS Deployment Guide

This guide walks you through deploying MeloTTS as a serverless endpoint on RunPod for use with RealtimeChatGemini.

## Prerequisites

1. **RunPod Account**: Create an account at [runpod.io](https://www.runpod.io)
2. **Docker Hub Account**: For storing the Docker image
3. **RunPod Credits**: Add credits to your RunPod account

## Step 1: Build and Push Docker Image

### 1.1 Build the Docker Image

```bash
cd runpod/
docker build -t akhilpalla619/melotts-runpod:latest .
```

### 1.2 Push to Docker Hub

```bash
docker push your-dockerhub-username/melotts-runpod:latest
```

## Step 2: Create RunPod Serverless Endpoint

### 2.1 Login to RunPod Console

1. Go to [RunPod Console](https://www.runpod.io/console)
2. Navigate to "Serverless" section
3. Click "New Endpoint"

### 2.2 Configure the Endpoint

**Basic Settings:**
- **Endpoint Name**: `melotts-tts`
- **Docker Image**: `your-dockerhub-username/melotts-runpod:latest`
- **Container Start Command**: `python handler.py`

**Advanced Settings:**
- **Container Registry Credentials**: If using private Docker Hub repo
- **Environment Variables**: Leave empty (all configs are in the handler)
- **GPU Type**: Select based on your needs:
  - **CPU**: Cost-effective, slower inference
  - **RTX A4000**: Good balance of cost/performance
  - **RTX 4090**: Fastest inference

**Resource Configuration:**
- **vCPU**: 2-4 cores
- **Memory**: 8-16 GB
- **GPU Memory**: 8-24 GB (if using GPU)
- **Container Disk**: 20 GB
- **Volume Disk**: Not needed

**Scaling:**
- **Workers**: 0-10 (auto-scale based on demand)
- **Max Job Time**: 300 seconds (5 minutes)
- **Idle Timeout**: 5 seconds

### 2.3 Deploy

1. Review your configuration
2. Click "Deploy"
3. Wait for deployment to complete (5-10 minutes)
4. Copy the **Endpoint ID** from the deployment page

## Step 3: Get RunPod API Key

1. Go to [RunPod Settings](https://www.runpod.io/console/user/settings)
2. Navigate to "API Keys" section
3. Click "Create API Key"
4. Give it a name (e.g., "MeloTTS TTS")
5. Copy the generated API key

## Step 4: Configure Your Application

Add the following to your `.env.local`:

```env
RUNPOD_API_KEY=your_runpod_api_key_here
RUNPOD_ENDPOINT_ID=your_endpoint_id_here
```

## Step 5: Test the Integration

### 5.1 Test via RunPod Console

1. Go to your endpoint page
2. Click "Test" tab
3. Use this test payload:

```json
{
  "input": {
    "text": "Hello, this is a test of MeloTTS running on RunPod!",
    "speaker_id": 0,
    "speed": 1.0,
    "language": "EN"
  }
}
```

### 5.2 Test via Your Application

1. Start your Next.js development server
2. Navigate to RealtimeChatGemini
3. Send a voice message or enable TTS
4. Check browser console and server logs for any errors

## Troubleshooting

### Common Issues

**1. Build Failures**
```bash
# If MeloTTS installation fails, try:
docker build --no-cache -t your-dockerhub-username/melotts-runpod:latest .
```

**2. Cold Start Timeouts**
- Increase "Max Job Time" to 600 seconds
- Use GPU instances for faster model loading
- Consider using RunPod Pods for 24/7 availability

**3. Audio Quality Issues**
- Adjust `speed`, `noise_scale`, or `sdp_ratio` parameters
- Try different `speaker_id` values (0-9 typically available)

**4. Rate Limiting**
- Monitor your RunPod usage dashboard
- Scale up worker count if needed

### Monitoring

**RunPod Console:**
- Monitor endpoint performance and logs
- Track costs and usage metrics
- View request/response times

**Application Logs:**
- Check Next.js server console for TTS errors
- Monitor browser network tab for failed requests

## Cost Optimization

### Pricing Overview
- **CPU**: ~$0.0003/second
- **RTX A4000**: ~$0.0009/second  
- **RTX 4090**: ~$0.0016/second

### Optimization Tips

1. **Use CPU for Development**: Cheaper for testing
2. **GPU for Production**: Faster inference, better user experience
3. **Monitor Usage**: Set up billing alerts
4. **Batch Requests**: If possible, combine multiple TTS requests

## API Reference

### Request Format

```json
{
  "input": {
    "text": "Text to synthesize",
    "speaker_id": 0,           // Optional: 0-9
    "language": "EN",          // Optional: EN, ES, FR, etc.
    "speed": 1.0,             // Optional: 0.1-3.0
    "device": "auto",         // Optional: auto, cpu, cuda
    "sdp_ratio": 0.2,         // Optional: 0.0-1.0
    "noise_scale": 0.6,       // Optional: 0.0-2.0
    "noise_scale_w": 0.8      // Optional: 0.0-2.0
  }
}
```

### Response Format

```json
{
  "output": {
    "audio": "base64_encoded_wav_data",
    "sample_rate": 22050,
    "format": "wav",
    "duration": 2.5,
    "text": "Original text",
    "speaker_id": 0,
    "language": "EN"
  }
}
```

### Error Response

```json
{
  "error": "Error description"
}
```

## Support

For issues:
1. Check RunPod logs in the console
2. Review this documentation
3. Check RealtimeChatGemini server logs
4. Create an issue in the project repository