"""
Skin Cancer Detection Web App - Flask Backend
Serves the trained MobileNetV2 model for skin lesion classification.
"""

import os
import io
import base64
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import tensorflow as tf
import traceback

# Initialize Flask app
app = Flask(__name__, static_folder='static')
CORS(app)  # Enable CORS for cross-origin requests from mobile

# Configuration
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'skin_cancer_model.h5')
IMG_SIZE = (224, 224)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size

# Load model at startup
print("Loading skin cancer detection model...")
try:
    model = tf.keras.models.load_model(MODEL_PATH)
    print("Model loaded successfully!")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None


def preprocess_image(image_data):
    """
    Preprocess image for model prediction.
    Robustly handles base64 decoding errors.
    """
    try:
        # Decode base64 if needed
        if isinstance(image_data, str):
            # Check if it's a data URL
            if 'base64,' in image_data:
                # Split and take the second part (the actual data)
                image_data = image_data.split('base64,')[1]
            
            # Clean up string
            image_data = image_data.strip()
            
            # Add padding if needed (len % 4 should be 0)
            missing_padding = len(image_data) % 4
            if missing_padding:
                image_data += '=' * (4 - missing_padding)
                
            try:
                image_bytes = base64.b64decode(image_data)
            except Exception as e:
                print(f"Base64 decoding failed: {e}")
                raise ValueError("Invalid base64 string provided")
        else:
            image_bytes = image_data
        
        # Open image with PIL
        try:
            img = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGB (standardize channels)
            if img.mode != 'RGB':
                img = img.convert('RGB')
                
            # Resize
            img = img.resize(IMG_SIZE, Image.Resampling.LANCZOS)
            
            # Convert to array and normalize
            img_array = np.array(img, dtype=np.float32) / 255.0
            img_array = np.expand_dims(img_array, axis=0)
            
            return img_array
            
        except Exception as e:
            print(f"PIL Image open failed. Bytes length: {len(image_bytes)}")
            # Try to print first few bytes to debug magic numbers
            if len(image_bytes) > 10:
                print(f"First 10 bytes: {image_bytes[:10]}")
            raise ValueError(f"Could not identify image file: {e}")

    except Exception as e:
        print(f"Preprocessing error: {e}")
        raise e


@app.route('/')
def index():
    """Serve the main application page."""
    return send_from_directory('static', 'index.html')


@app.route('/<path:path>')
def static_files(path):
    """Serve static files."""
    return send_from_directory('static', path)


@app.errorhandler(Exception)
def handle_exception(e):
    # Log ALL errors to file
    err_msg = f"SERVER ERROR: {str(e)}\n{traceback.format_exc()}"
    print(err_msg, flush=True)
    with open("server_error.log", "a") as f:
        f.write("-" * 20 + "\n")
        f.write(err_msg + "\n")
    return jsonify({'error': str(e), 'success': False}), 500

@app.before_request
def log_request_info():
    msg = f"Incoming request: {request.method} {request.url} Content-Length: {request.content_length}"
    print(msg, flush=True)
    with open("server_access.log", "a") as f:
        f.write(msg + "\n")


@app.route('/api/predict', methods=['POST'])
def predict():
    """
    Predict whether a skin lesion is benign or malignant.
    """
    print("Request received in predict endpoint!", flush=True)
    
    if model is None:
        return jsonify({
            'success': False,
            'error': 'Model not loaded. Please check server logs.'
        }), 500
    
    try:
        # Get image data from request
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({
                'success': False,
                'error': 'No image provided.'
            }), 400
        
        image_data = data['image']
        
        # Preprocess image
        processed_image = preprocess_image(image_data)
        
        # DEBUG: Print stats about the image going into the model
        stats_msg = (
            f"Input shape: {processed_image.shape}\n"
            f"Input range: min={processed_image.min():.4f}, max={processed_image.max():.4f}, mean={processed_image.mean():.4f}"
        )
        print(stats_msg, flush=True)
        
        # Make prediction
        prediction = model.predict(processed_image, verbose=0)[0][0]
        pred_msg = f"Raw prediction value: {prediction:.6f}"
        print(pred_msg, flush=True)
        
        # Write to file backup
        with open("server_debug.txt", "a") as f:
            f.write("-" * 20 + "\n")
            f.write(stats_msg + "\n")
            f.write(pred_msg + "\n")
        
        # Interpret result
        # Model output: 0 = Benign, 1 = Malignant
        # prediction > 0.5 means malignant
        is_suspicious = prediction > 0.5
        
        if is_suspicious:
            result = "SUSPICIOUS"
            result_detail = "Potentially Malignant"
            confidence = float(prediction)
        else:
            result = "BENIGN"
            result_detail = "Likely Benign"
            confidence = float(1 - prediction)
        
        return jsonify({
            'success': True,
            'result': result,
            'result_detail': result_detail,
            'confidence': round(confidence * 100, 1),
            'raw_score': float(prediction),
            'disclaimer': (
                "⚠️ IMPORTANT: This is an AI-powered screening tool for educational purposes only. "
                "It is NOT a medical diagnosis. Always consult a qualified dermatologist or healthcare "
                "professional for proper skin cancer screening and diagnosis. Early detection saves lives - "
                "if you have concerns about any skin lesion, please see a doctor immediately."
            )
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error processing image: {str(e)}'
        }), 500


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None
    })


if __name__ == '__main__':
    # Get local IP for mobile access instructions
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except:
        local_ip = "your-pc-ip"
    
    print("\n" + "="*60)
    print("SKIN CANCER DETECTION WEB APP")
    print("="*60)
    print(f"\nTo access from your PHONE (same WiFi network):")
    print(f"   Open browser and go to: http://{local_ip}:5000")
    print(f"\nTo access from this PC:")
    print(f"   Open browser and go to: http://localhost:5000")
    print("\n" + "="*60 + "\n")
    
    # Run with Waitress (Production-ready WSGI server)
    from waitress import serve
    print("Starting Waitress server on 0.0.0.0:5000...", flush=True)
    serve(app, host='0.0.0.0', port=5000, threads=6)
