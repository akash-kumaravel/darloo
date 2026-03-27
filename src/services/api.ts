// API Service for Hugging Face Server Integration

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://akashkumaravel-darloo.hf.space';

interface UploadImageResponse {
  success: boolean;
  url: string;
  filename: string;
  error?: string;
}

interface GenerateResponse {
  success: boolean;
  result: any;
  error?: string;
}

interface ImageToTextResponse {
  success: boolean;
  result: any;
  error?: string;
}

/**
 * Convert file or canvas to base64
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

/**
 * Convert canvas to base64
 */
export function canvasToBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

/**
 * Upload image to GitHub via server
 */
export async function uploadImage(
  imageData: string,
  filename?: string
): Promise<UploadImageResponse> {
  try {
    const response = await fetch(`${SERVER_URL}/upload-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageData,
        filename: filename || `image_${Date.now()}.png`,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      url: '',
      filename: '',
      error: String(error),
    };
  }
}

/**
 * Generate text content using Hugging Face models
 */
export async function generateContent(
  prompt: string,
  model: string = 'gpt2'
): Promise<GenerateResponse> {
  try {
    const response = await fetch(`${SERVER_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        model,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Generation error:', error);
    return {
      success: false,
      result: null,
      error: String(error),
    };
  }
}

/**
 * Convert image to text using Hugging Face vision models
 */
export async function imageToText(
  imageData: string
): Promise<ImageToTextResponse> {
  try {
    const response = await fetch(`${SERVER_URL}/api/image-to-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageData,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Image-to-text error:', error);
    return {
      success: false,
      result: null,
      error: String(error),
    };
  }
}

/**
 * Health check
 */
export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// =============== STAR MANAGEMENT FUNCTIONS ===============

interface StarsResponse {
  success: boolean;
  total: number;
  history?: any[];
  message?: string;
  error?: string;
}

/**
 * Get current star count from server
 */
export async function getStars(): Promise<number> {
  try {
    const response = await fetch(`${SERVER_URL}/api/stars`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json() as StarsResponse;
    return data.total || 0;
  } catch (error) {
    console.error('Get stars error:', error);
    return 0;
  }
}

/**
 * Add stars to current count
 */
export async function addStars(amount: number, reason: string = 'Reward'): Promise<StarsResponse> {
  try {
    const response = await fetch(`${SERVER_URL}/api/stars/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        reason,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Add stars error:', error);
    return {
      success: false,
      total: 0,
      error: String(error),
    };
  }
}

/**
 * Set stars to a specific value
 */
export async function setStars(total: number, reason: string = 'Admin set'): Promise<StarsResponse> {
  try {
    const response = await fetch(`${SERVER_URL}/api/stars/set`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        total,
        reason,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Set stars error:', error);
    return {
      success: false,
      total: 0,
      error: String(error),
    };
  }
}

/**
 * Reset stars to 0
 */
export async function resetStars(): Promise<StarsResponse> {
  try {
    const response = await fetch(`${SERVER_URL}/api/stars/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Reset stars error:', error);
    return {
      success: false,
      total: 0,
      error: String(error),
    };
  }
}
