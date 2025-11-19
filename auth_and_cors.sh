#!/bin/bash

# Script to authenticate gcloud and set CORS

echo "==================================================================="
echo "Step 1: Please open this URL in your browser:"
echo "==================================================================="
echo ""

# Start auth and capture the URL
/tmp/google-cloud-sdk/bin/gcloud auth login --no-launch-browser 2>&1 | grep "https://accounts.google.com" | head -1

echo ""
echo "==================================================================="
echo "Step 2: After signing in, you'll see a verification code."
echo "Step 3: Run this command with the code:"
echo ""
echo "  echo 'YOUR_CODE_HERE' | /tmp/google-cloud-sdk/bin/gcloud auth login --no-launch-browser"
echo ""
echo "Step 4: Then run this to apply CORS:"
echo ""
echo "  /tmp/google-cloud-sdk/bin/gcloud storage buckets update gs://formlab-42fae.firebasestorage.app --cors-file=cors.json"
echo "==================================================================="
