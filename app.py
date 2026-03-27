from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import base64
import requests
from dotenv import load_dotenv
from datetime import datetime
import uuid

load_dotenv()

app = Flask(__name__)
CORS(app)

# GitHub Configuration
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
GITHUB_REPO = os.getenv('GITHUB_REPO')  # format: username/repo
GITHUB_BRANCH = os.getenv('GITHUB_BRANCH', 'main')
GITHUB_IMAGE_PATH = os.getenv('GITHUB_IMAGE_PATH', 'images')

# Hugging Face configuration
HF_API_TOKEN = os.getenv('HF_API_TOKEN')
HF_API_URL = os.getenv('HF_API_URL', 'https://api-inference.huggingface.co/models')

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'}), 200

@app.route('/upload-image', methods=['POST'])
def upload_image():
    """
    Upload image to GitHub
    Expected: { "image": "base64_string", "filename": "optional_name" }
    """
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({'error': 'No image provided'}), 400
        
        image_data = data['image']
        filename = data.get('filename', f"image_{uuid.uuid4().hex[:8]}.png")
        
        # Ensure filename has an extension
        if '.' not in filename:
            filename = f"{filename}.png"
        
        # Decode base64 image
        try:
            image_bytes = base64.b64decode(image_data.split(',')[-1])
        except Exception as e:
            return jsonify({'error': f'Invalid base64 image: {str(e)}'}), 400
        
        # Upload to GitHub
        github_url = upload_to_github(image_bytes, filename)
        
        if github_url:
            return jsonify({
                'success': True,
                'url': github_url,
                'filename': filename
            }), 200
        else:
            return jsonify({'error': 'Failed to upload to GitHub'}), 500
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate', methods=['POST'])
def generate_content():
    """
    Generate content using Hugging Face models
    Expected: { "prompt": "text", "model": "model_id" }
    """
    try:
        data = request.get_json()
        
        if not data or 'prompt' not in data:
            return jsonify({'error': 'No prompt provided'}), 400
        
        prompt = data['prompt']
        model = data.get('model', 'gpt2')
        
        # Call Hugging Face API
        response = call_huggingface_api(prompt, model)
        
        if response:
            return jsonify({
                'success': True,
                'result': response
            }), 200
        else:
            return jsonify({'error': 'Failed to generate content'}), 500
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/image-to-text', methods=['POST'])
def image_to_text():
    """
    Convert image to text using Hugging Face vision models
    Expected: { "image": "base64_string" }
    """
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({'error': 'No image provided'}), 400
        
        image_data = data['image']
        
        # Decode base64 image
        try:
            image_bytes = base64.b64decode(image_data.split(',')[-1])
        except Exception as e:
            return jsonify({'error': f'Invalid base64 image: {str(e)}'}), 400
        
        # Call Hugging Face vision API
        response = call_huggingface_vision_api(image_bytes)
        
        if response:
            return jsonify({
                'success': True,
                'result': response
            }), 200
        else:
            return jsonify({'error': 'Failed to process image'}), 500
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def upload_to_github(image_bytes, filename):
    """
    Upload image file to GitHub repository
    """
    if not GITHUB_TOKEN or not GITHUB_REPO:
        print("GitHub credentials not configured")
        return None
    
    try:
        # GitHub API endpoint
        url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{GITHUB_IMAGE_PATH}/{filename}"
        
        # Prepare headers
        headers = {
            'Authorization': f'token {GITHUB_TOKEN}',
            'Accept': 'application/vnd.github.v3+json'
        }
        
        # Encode image to base64
        encoded_image = base64.b64encode(image_bytes).decode('utf-8')
        
        # Check if file exists to get its SHA (needed for updates)
        get_response = requests.get(url, headers=headers)
        sha = None
        if get_response.status_code == 200:
            sha = get_response.json()['sha']
        
        # Prepare payload
        payload = {
            'message': f'Upload image: {filename}',
            'content': encoded_image,
            'branch': GITHUB_BRANCH
        }
        
        if sha:
            payload['sha'] = sha
        
        # Upload to GitHub
        response = requests.put(url, json=payload, headers=headers)
        
        if response.status_code in [201, 200]:
            # Return the raw GitHub URL
            return f"https://raw.githubusercontent.com/{GITHUB_REPO}/{GITHUB_BRANCH}/{GITHUB_IMAGE_PATH}/{filename}"
        else:
            print(f"GitHub upload failed: {response.status_code} - {response.text}")
            return None
    
    except Exception as e:
        print(f"Error uploading to GitHub: {str(e)}")
        return None

def call_huggingface_api(prompt, model='gpt2'):
    """
    Call Hugging Face Inference API
    """
    if not HF_API_TOKEN:
        print("Hugging Face API token not configured")
        return None
    
    try:
        url = f"{HF_API_URL}/{model}"
        headers = {
            'Authorization': f'Bearer {HF_API_TOKEN}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'inputs': prompt,
            'parameters': {
                'max_length': 100
            }
        }
        
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            return result
        else:
            print(f"Hugging Face API error: {response.status_code} - {response.text}")
            return None
    
    except Exception as e:
        print(f"Error calling Hugging Face API: {str(e)}")
        return None

def call_huggingface_vision_api(image_bytes):
    """
    Call Hugging Face vision model (image captioning, etc.)
    """
    if not HF_API_TOKEN:
        print("Hugging Face API token not configured")
        return None
    
    try:
        # Using Salesforce BLIP for image captioning
        url = f"{HF_API_URL}/Salesforce/blip-image-captioning-base"
        headers = {
            'Authorization': f'Bearer {HF_API_TOKEN}'
        }
        
        response = requests.post(url, data=image_bytes, headers=headers, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            return result
        else:
            print(f"Hugging Face Vision API error: {response.status_code} - {response.text}")
            return None
    
    except Exception as e:
        print(f"Error calling Hugging Face Vision API: {str(e)}")
        return None

@app.route('/', methods=['GET'])
def index():
    """Welcome endpoint"""
    return jsonify({
        'name': 'LOVEVERSE Server',
        'version': '1.0.0',
        'endpoints': [
            '/health',
            '/upload-image',
            '/api/generate',
            '/api/image-to-text'
        ]
    }), 200

if __name__ == '__main__':
    # For local development
    app.run(debug=True, host='0.0.0.0', port=7860)
