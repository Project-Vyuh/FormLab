import os
import tempfile
import requests
from flask import Flask, request, jsonify
from google.cloud import storage, firestore
import torch
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer
import cv2
import numpy as np

app = Flask(__name__)

# Initialize Firebase/Google Cloud clients
# Note: In Cloud Run, credentials are auto-detected from the service account
storage_client = storage.Client()
db = firestore.Client()

# Initialize Real-ESRGAN model
# We use the x4plus model for general images
model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
netscale = 4

# Determine if GPU is available
use_gpu = torch.cuda.is_available()

# Pre-download weights or include them in the Docker image
# For this example, we assume weights are at 'weights/RealESRGAN_x4plus.pth'
upsampler = RealESRGANer(
    scale=netscale,
    model_path='weights/RealESRGAN_x4plus.pth',
    model=model,
    tile=512 if not use_gpu else 0,  # Use tiling on CPU for 6-10x speedup
    tile_pad=10,
    pre_pad=0,
    half=use_gpu,  # Only use FP16 when GPU is available
    gpu_id=0 if use_gpu else None
)

@app.route('/upscale', methods=['POST'])
def upscale():
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    request_id = data.get('requestId')
    image_url = data.get('imageUrl')
    user_id = data.get('userId')
    
    if not request_id or not image_url:
        return jsonify({'error': 'Missing requestId or imageUrl'}), 400

    try:
        # 1. Download image
        print(f"Downloading image for request {request_id}...")
        response = requests.get(image_url, stream=True)
        response.raise_for_status()
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as tmp_input:
            for chunk in response.iter_content(chunk_size=8192):
                tmp_input.write(chunk)
            input_path = tmp_input.name

        # 2. Read image with cv2
        img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)

        # 2.5. Validate and resize image if too large (prevents memory exhaustion)
        h, w = img.shape[:2]
        max_size = 4000
        if max(h, w) > max_size:
            scale_factor = max_size / max(h, w)
            new_w = int(w * scale_factor)
            new_h = int(h * scale_factor)
            img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
            print(f"Resized input from {w}x{h} to {new_w}x{new_h} for request {request_id}")

        # 3. Upscale
        print(f"Upscaling image for request {request_id}...")
        output, _ = upsampler.enhance(img, outscale=4)
        
        # 4. Save output as JPEG (faster encoding/uploading than PNG)
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_output:
            cv2.imwrite(tmp_output.name, output, [cv2.IMWRITE_JPEG_QUALITY, 95])
            output_path = tmp_output.name

        # 5. Upload to Firebase Storage
        print(f"Uploading result for request {request_id}...")
        project_id = os.environ.get('GOOGLE_CLOUD_PROJECT')
        bucket_name = os.environ.get('STORAGE_BUCKET', f"{project_id}.firebasestorage.app")
        bucket = storage_client.bucket(bucket_name)
        blob_name = f"users/{user_id}/upscaled/{request_id}.jpg"
        blob = bucket.blob(blob_name)
        blob.content_type = 'image/jpeg'
        blob.upload_from_filename(output_path)
        blob.make_public() # Optional: depending on your security rules
        output_url = blob.public_url

        # 6. Update Firestore
        print(f"Updating Firestore for request {request_id}...")
        doc_ref = db.collection('upscale_requests').document(request_id)
        doc_ref.update({
            'status': 'completed',
            'outputUrl': output_url,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })

        # Cleanup
        os.remove(input_path)
        os.remove(output_path)

        return jsonify({'success': True, 'outputUrl': output_url})

    except Exception as e:
        print(f"Error processing request {request_id}: {e}")
        # Update Firestore with error
        try:
            db.collection('upscale_requests').document(request_id).update({
                'status': 'failed',
                'error': str(e),
                'updatedAt': firestore.SERVER_TIMESTAMP
            })
        except:
            pass
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
