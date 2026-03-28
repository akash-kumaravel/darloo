/**
 * Utility for uploading images to ImgBB.
 */
export async function uploadToImgBB(file: File): Promise<string> {
  const apiKey = (process.env as any).IMGBB_API_KEY || '0b064a9926765c9f265e329856b5c1f8';
  
  const formData = new FormData();
  formData.append('image', file);
  
  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'ImgBB upload failed');
    }
    
    const result = await response.json();
    return result.data.url;
  } catch (error) {
    console.error('ImgBB upload error:', error);
    throw error;
  }
}
