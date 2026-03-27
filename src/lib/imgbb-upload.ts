/**
 * Upload image to Imgbb
 * Returns the image URL on success
 */
export const uploadToImgbb = async (file: File): Promise<string> => {
  const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
  
  if (!apiKey) {
    throw new Error('Imgbb API key is not configured');
  }

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error?.message || 'Upload failed');
    }

    console.log('Image uploaded to Imgbb:', data.data.url);
    return data.data.url;
  } catch (error) {
    console.error('Imgbb upload error:', error);
    throw error;
  }
};
