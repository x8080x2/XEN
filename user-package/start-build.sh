#!/bin/bash

echo "===================================================="
echo "  Email Sender Desktop - Build and Launch"
echo "===================================================="
echo ""

# Validate license before building
node validateLicense.js
if [ $? -ne 0 ]; then
    echo ""
    echo "Build cancelled due to license validation failure."
    exit 1
fi

echo ""
echo "Building application..."
npm run build
if [ $? -ne 0 ]; then
    echo "Build failed!"
    exit 1
fi

echo ""
echo "Starting Email Sender Desktop App..."
npm run electron
