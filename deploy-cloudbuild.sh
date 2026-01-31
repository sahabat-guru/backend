#!/bin/bash

# Deploy SahabatGuru Backend using Cloud Build (No local Docker needed)
# Usage: ./deploy-cloudbuild.sh

set -e

# Configuration
PROJECT_ID="sahabat-guru-485613"
REGION="asia-southeast2"
SERVICE_NAME="sahabatguru-backend"

echo "🚀 Deploying ${SERVICE_NAME} to Google Cloud Run using Cloud Build"
echo "📦 Project: ${PROJECT_ID}"
echo "🌏 Region: ${REGION}"
echo ""

# Read environment variables from .env file
if [ -f .env ]; then
    echo "📝 Reading environment variables from .env file..."

    # Extract variables (excluding comments, empty lines, and reserved vars)
    ENV_VARS=""
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ $key =~ ^#.*$ ]] && continue
        [[ -z $key ]] && continue

        # Remove leading/trailing whitespace
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs)

        # Skip if key or value is empty
        [[ -z $key ]] || [[ -z $value ]] && continue

        # Skip reserved Cloud Run environment variables
        [[ $key == "PORT" ]] && continue

        # Add to ENV_VARS
        if [ -z "$ENV_VARS" ]; then
            ENV_VARS="${key}=${value}"
        else
            ENV_VARS="${ENV_VARS},${key}=${value}"
        fi
    done < .env

    echo "✅ Environment variables loaded"
else
    echo "⚠️  .env file not found. Proceeding without environment variables."
fi

# Submit build to Cloud Build
echo ""
echo "🔨 Building with Cloud Build (this builds in the cloud, no local Docker needed)..."
gcloud builds submit --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest --project ${PROJECT_ID}

# Deploy to Cloud Run
echo ""
echo "🚀 Deploying to Cloud Run..."

if [ -n "$ENV_VARS" ]; then
    gcloud run deploy ${SERVICE_NAME} \
        --image gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest \
        --platform managed \
        --region ${REGION} \
        --allow-unauthenticated \
        --memory 512Mi \
        --cpu 1 \
        --max-instances 10 \
        --min-instances 0 \
        --port 8080 \
        --set-env-vars="${ENV_VARS}" \
        --project ${PROJECT_ID}
else
    gcloud run deploy ${SERVICE_NAME} \
        --image gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest \
        --platform managed \
        --region ${REGION} \
        --allow-unauthenticated \
        --memory 512Mi \
        --cpu 1 \
        --max-instances 10 \
        --min-instances 0 \
        --port 8080 \
        --project ${PROJECT_ID}
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Getting service URL..."
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --region ${REGION} \
    --project ${PROJECT_ID} \
    --format='value(status.url)')

echo "🔗 Service URL: ${SERVICE_URL}"
echo ""
echo "Test your API:"
echo "  curl ${SERVICE_URL}/health"
