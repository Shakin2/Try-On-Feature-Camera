import os
import typing
import urllib.request
from flask import Flask, render_template, request, send_file, jsonify
from werkzeug.utils import secure_filename

# --- 1. IMPORTS ---
from google import genai
from google.genai.types import (
    Image,
    ProductImage,
    RecontextImageConfig,
    RecontextImageSource,
)

# --- 2. CLIENT DEFINITIONS ---
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "ga4-bigquerytest-platypus-nz") # 👈 REPLACE THIS
LOCATION = os.environ.get("GOOGLE_CLOUD_REGION", "us-central1")
client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)

virtual_try_on = "virtual-try-on-preview-08-04"

# --- 3. APP SETUP ---
app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# --- 4. HELPER: DOWNLOAD URL ---
def download_image_from_url(url, save_path):
    try:
        opener = urllib.request.build_opener() 
        opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
        urllib.request.install_opener(opener)
        urllib.request.urlretrieve(url, save_path)
        print(f"Successfully downloaded {url}")
        return save_path
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return None

# --- 5. AI FUNCTION (Unchanged) ---
def run_ai_virtual_try_on(person_image_path, clothing_image_path):
    print(f"Running AI on {person_image_path} and {clothing_image_path}")
    response = client.models.recontext_image(
        model=virtual_try_on,
        source=RecontextImageSource(
            person_image=Image.from_file(location=person_image_path),
            product_images=[
                ProductImage(product_image=Image.from_file(location=clothing_image_path))
            ],
        ),
        config=RecontextImageConfig(
            output_mime_type="image/jpeg",
            number_of_images=1,
            safety_filter_level="BLOCK_LOW_AND_ABOVE",
        ),
    )
    result_filename = "result_" + os.path.basename(person_image_path) + ".jpeg"
    result_path = os.path.join(app.config['UPLOAD_FOLDER'], result_filename)
    response.generated_images[0].image.save(result_path)
    print(f"Result image saved to: {result_path}")
    return result_path

# --- 6. ROUTES ---
@app.route('/')
def index():
    # Just serves the main HTML file. All logic is in JavaScript.
    return render_template('index.html')

@app.route('/combine', methods=['POST'])
def combine():
    # This API takes ONE person image and ONE product image
    
    if 'person_upload' not in request.files:
        return jsonify({'error': 'No person image uploaded'}), 400

    person_file = request.files['person_upload']
    
    # Check for product_url OR product_upload
    product_url = request.form.get('product_url')
    product_file = request.files.get('product_upload')

    if not product_url and not product_file:
        return jsonify({'error': 'No product image or URL provided'}), 400
        
    if person_file.filename == '':
        return jsonify({'error': 'No selected person file'}), 400

    # --- Define temp paths ---
    person_path = None
    clothing_path = None # This will be the path to the final product image
    result_image_path = None
    
    # --- Create a list of all files to delete ---
    files_to_delete = []

    try:
        # --- 1. Save Person Image ---
        person_filename = "person_" + secure_filename(person_file.filename)
        person_path = os.path.join(app.config['UPLOAD_FOLDER'], person_filename)
        person_file.save(person_path)
        files_to_delete.append(person_path)
        
        # --- 2. Process Product Image ---
        if product_file:
            # It's an uploaded file
            product_filename = "prod_" + secure_filename(product_file.filename)
            clothing_path = os.path.join(app.config['UPLOAD_FOLDER'], product_filename)
            product_file.save(clothing_path)
            files_to_delete.append(clothing_path)
        
        elif product_url:
            # It's a URL, download it
            product_filename = "prod_downloaded_" + os.path.basename(product_url)
            clothing_path = os.path.join(app.config['UPLOAD_FOLDER'], product_filename)
            if not download_image_from_url(product_url, clothing_path):
                return jsonify({'error': 'Failed to download product URL'}), 500
            files_to_delete.append(clothing_path)

        # --- 3. Run AI ---
        result_image_path = run_ai_virtual_try_on(person_path, clothing_path)
        files_to_delete.append(result_image_path)
            
        return send_file(result_image_path, mimetype='image/jpeg')
            
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        # --- 4. Clean up all temp files ---
        for path in files_to_delete:
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception as e:
                print(f"Error cleaning up file {path}: {e}")

# --- 7. RUN COMMAND ---
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(debug=True, host='0.0.0.0', port=port)