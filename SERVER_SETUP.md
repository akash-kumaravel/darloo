# LOVEVERSE Server Setup Guide

## Overview
This server handles:
- Image uploads to GitHub
- Hugging Face API integration for content generation
- Image analysis using Hugging Face vision models

## Setup Steps

### 1. GitHub Setup
- Create a GitHub Personal Access Token:
  1. Go to GitHub Settings → Developer settings → Personal access tokens
  2. Create a new token with `repo` and `user` permissions
  3. Copy the token

### 2. Hugging Face Setup
- Create a Hugging Face account at https://huggingface.co
- Get your API token from https://huggingface.co/settings/tokens
- Create an API access token with read permissions

### 3. Environment Variables
Create a `.env` file in the root directory:
```
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_REPO=username/repo
GITHUB_BRANCH=main
GITHUB_IMAGE_PATH=images

HF_API_TOKEN=your_hugging_face_api_token
HF_API_URL=https://api-inference.huggingface.co/models

FLASK_ENV=production
FLASK_DEBUG=False
```

### 4. Deploy on Hugging Face Spaces
1. Go to https://huggingface.co/spaces
2. Create a new Space with "Docker" runtime
3. Upload app.py and requirements.txt
4. Add environment variables in Space settings
5. Space will auto-deploy

## API Endpoints

### Health Check
```
GET /health
```

### Upload Image to GitHub
```
POST /upload-image
Content-Type: application/json

{
  "image": "data:image/png;base64,iVBORw0KGgo...",
  "filename": "my-image.png"
}

Response:
{
  "success": true,
  "url": "https://raw.githubusercontent.com/...",
  "filename": "my-image.png"
}
```

### Generate Content with Hugging Face
```
POST /api/generate
Content-Type: application/json

{
  "prompt": "Once upon a time",
  "model": "gpt2"
}

Response:
{
  "success": true,
  "result": [...]
}
```

### Image to Text
```
POST /api/image-to-text
Content-Type: application/json

{
  "image": "data:image/png;base64,iVBORw0KGgo..."
}

Response:
{
  "success": true,
  "result": [...]
}
```

## Notes
- Image path in GitHub will be: `{GITHUB_IMAGE_PATH}/{filename}`
- Ensure GitHub token has write access to the repository
- Hugging Face models may take time to load on first request
