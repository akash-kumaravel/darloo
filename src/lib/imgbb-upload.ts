/**
 * Upload image to Imgbb
 * Returns the image URL on success
 */
export const uploadToImgbb = async (file: File): Promise<string> => {
  console.log('🔄 Starting Imgbb upload...');
  console.log('File:', file.name, 'Size:', file.size);
  
  // Try multiple ways to get the API key
  const apiKey = 
    import.meta.env.VITE_IMGBB_API_KEY ||
    (process.env as any).VITE_IMGBB_API_KEY ||
    '0b064a9926765c9f265e329856b5c1f8'; // Fallback for development
  
  console.log('API Key configured:', !!apiKey);
  console.log('API Key length:', apiKey?.length);
  
  if (!apiKey) {
    const error = 'Imgbb API key is not configured';
    console.error('❌', error);
    throw new Error(error);
  }

  const formData = new FormData();
  formData.append('image', file);

  const uploadUrl = `https://api.imgbb.com/1/upload?key=${apiKey}`;
  console.log('📤 Uploading to Imgbb...');

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });

    console.log('📨 Response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('📦 Imgbb response:', data);

    if (!data.success) {
      throw new Error(data.error?.message || 'Upload failed');
    }

    const imageUrl = data.data.url;
    console.log('✅ Upload successful! URL:', imageUrl);
    return imageUrl;
  } catch (error) {
    console.error('❌ Imgbb upload error:', error);
    throw new Error(`Imgbb upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
