FROM pytorch/pytorch:2.0.1-cuda11.7-cudnn8-runtime

WORKDIR /app

# Install system dependencies for cv2
RUN apt-get update && apt-get install -y libgl1-mesa-glx libglib2.0-0 wget && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy code
COPY . .

# Create weights directory and download model
# In production, you might want to bake this into the image or mount a volume
RUN mkdir -p weights && \
    wget https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth -O weights/RealESRGAN_x4plus.pth

# Expose port
ENV PORT 8080
EXPOSE 8080

# Run with Gunicorn
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:app
