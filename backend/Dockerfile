FROM pytorch/pytorch:2.0.1-cuda11.7-cudnn8-runtime

WORKDIR /app

# Install system dependencies for cv2
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# CRITICAL: Ensure NumPy is properly installed before other packages
# The PyTorch base image has numpy but it may not be fully configured
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --force-reinstall 'numpy>=1.21.0,<1.27.0'

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy code
COPY . .

# Create weights directory and download model
RUN mkdir -p weights && \
    wget https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth \
    -O weights/RealESRGAN_x4plus.pth

# Expose port
ENV PORT 8080
EXPOSE 8080

# Healthcheck to verify service is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import numpy; import torch; print('OK')" || exit 1

# Run with Gunicorn (2 workers for concurrent requests, 4 threads for I/O)
CMD exec gunicorn --bind :$PORT --workers 2 --threads 4 --timeout 0 main:app
