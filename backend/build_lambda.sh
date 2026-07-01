#!/bin/bash

# ============================================================================
# Avoir Lambda Deployment Package Builder
# ============================================================================
# This script automates the creation of a production-ready AWS Lambda
# deployment package with all dependencies and the handler code.
#
# Author: Team NEONX
# Project: Avoir - AI-Native Agency + AI Hedge Fund
# ============================================================================

echo "🚀 Building Avoir Production Lambda Package..."
echo ""

# Clean up any previous build artifacts
echo "🧹 Cleaning up old build artifacts..."
rm -rf package/
rm -f avoir-production-backend.zip

# Create fresh package directory
echo "📦 Creating package directory..."
mkdir package

# Install dependencies into package directory
echo "📥 Installing dependencies from requirements-lambda.txt..."
pip install -r backend/requirements-lambda.txt -t package/

# Copy the Lambda handler into package
echo "📄 Copying Lambda handler (aws_lambda_handler.py)..."
cp backend/aws_lambda_handler.py package/

# Create the deployment zip file
echo "🗜️  Creating deployment zip file..."
cd package && zip -r ../avoir-production-backend.zip . && cd ..

# Clean up temporary package directory
echo "🧹 Cleaning up temporary files..."
rm -rf package/

# Display success message and file info
echo ""
echo "✅ Build Complete! avoir-production-backend.zip is ready for AWS."
echo ""
echo "📊 Package Information:"
ls -lh avoir-production-backend.zip
echo ""
echo "🚀 Next Steps:"
echo "   1. Upload to AWS Lambda Console, or"
echo "   2. Deploy via AWS CLI:"
echo "      aws lambda update-function-code --function-name avoir-backend --zip-file fileb://avoir-production-backend.zip"
echo ""
