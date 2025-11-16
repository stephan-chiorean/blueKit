#!/bin/bash
# Minimal 1x1 transparent PNG (base64 encoded)
BASE64_PNG="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

echo "$BASE64_PNG" | base64 -d > 32x32.png
echo "$BASE64_PNG" | base64 -d > 128x128.png
echo "$BASE64_PNG" | base64 -d > 128x128@2x.png
echo "$BASE64_PNG" | base64 -d > icon.icns
echo "$BASE64_PNG" | base64 -d > icon.ico

echo "Placeholder icons created"
