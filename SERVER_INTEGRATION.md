# Server Integration Guide

## Setup

### 1. Environment Variables
Your `.env` file is already configured with:
```
VITE_SERVER_URL=https://akashkumaravel-darloo.hf.space
```

### 2. API Service
Use the API service from `src/services/api.ts`:

```typescript
import { uploadImage, generateContent, imageToText, fileToBase64 } from '@/src/services/api';
```

## Usage Examples

### Upload Image to GitHub

```typescript
import { uploadImage, fileToBase64 } from '@/src/services/api';

// From file input
const handleFileUpload = async (file: File) => {
  const base64 = await fileToBase64(file);
  const result = await uploadImage(base64, file.name);
  
  if (result.success) {
    console.log('Image URL:', result.url);
    // Use result.url to store in Firestore
  }
};

// From canvas (e.g., scrapbook drawing)
import { canvasToBase64, uploadImage } from '@/src/services/api';

const handleCanvasUpload = async (canvas: HTMLCanvasElement) => {
  const base64 = canvasToBase64(canvas);
  const result = await uploadImage(base64, 'memory.png');
  
  if (result.success) {
    console.log('Canvas saved:', result.url);
  }
};
```

### Generate Text Content

```typescript
import { generateContent } from '@/src/services/api';

const handleGenerateStory = async () => {
  const result = await generateContent(
    'Once upon a time in our love story',
    'gpt2'
  );
  
  if (result.success) {
    console.log('Generated:', result.result);
  }
};
```

### Image to Text (Vision)

```typescript
import { imageToText } from '@/src/services/api';

const handleDescribeImage = async (imageBase64: string) => {
  const result = await imageToText(imageBase64);
  
  if (result.success) {
    console.log('Description:', result.result);
  }
};
```

## Component Integration

### In Scrapbook Component
```typescript
import { uploadImage, canvasToBase64 } from '@/src/services/api';
import { toast } from 'sonner';

const handleSaveMemory = async (canvas: HTMLCanvasElement) => {
  try {
    const base64 = canvasToBase64(canvas);
    const response = await uploadImage(base64, `memory_${Date.now()}.png`);
    
    if (response.success) {
      // Save metadata to Firestore
      await firebaseSetDoc(doc(db, 'scrapbook', id), {
        imageUrl: response.url,
        timestamp: new Date(),
      });
      toast.success('Memory saved! ❤️');
    } else {
      toast.error('Failed to save memory');
    }
  } catch (error) {
    toast.error('Error saving memory');
  }
};
```

### In Memory Vault Component
```typescript
import { uploadImage, fileToBase64 } from '@/src/services/api';

const handleUploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;
  
  try {
    const base64 = await fileToBase64(file);
    const response = await uploadImage(base64, file.name);
    
    if (response.success) {
      // Store URL in Firestore
      console.log('Photo stored at:', response.url);
    }
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

## Server Endpoints

All endpoints are available at `https://akashkumaravel-darloo.hf.space`:

- **POST /upload-image** - Upload image to GitHub
- **POST /api/generate** - Generate text with Hugging Face
- **POST /api/image-to-text** - Describe images with vision models
- **GET /health** - Server health check

## Features

✅ Images stored permanently on GitHub  
✅ Hugging Face integration for AI features  
✅ CORS enabled for frontend access  
✅ Error handling and toast notifications  
✅ Base64 encoding for image transfer  

## Troubleshooting

### CORS Error
If you see CORS errors, the server has CORS enabled. Check:
- Server URL is correct in `.env`
- Server is running and healthy

### Image Upload Fails
Ensure GitHub token is valid in server `.env`:
- `GITHUB_TOKEN` has `repo` permission
- `GITHUB_REPO` is correct format (username/repo)

### Hugging Face API Errors
Model loading may take time on first request. Subsequent calls are faster.
