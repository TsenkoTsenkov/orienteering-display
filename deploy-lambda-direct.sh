#!/bin/bash

# AWS Configuration
export AWS_PROFILE=tsenkoTest
export AWS_REGION=eu-west-1
ACCOUNT_ID=339713156432

echo "🚀 Direct Lambda Deployment to AWS"
echo "Account: $ACCOUNT_ID | Region: $AWS_REGION | Profile: $AWS_PROFILE"

# Create/verify IAM role
ROLE_NAME="orienteering-lambda-role"
ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"

echo "Setting up IAM role..."
aws iam create-role \
    --role-name $ROLE_NAME \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "lambda.amazonaws.com"},
            "Action": "sts:AssumeRole"
        }]
    }' 2>/dev/null || echo "Role exists"

aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null

echo "Waiting for IAM..."
sleep 5

# Deploy Proxy Function
echo "📦 Deploying Proxy Function..."
cd amplify/functions/proxy
zip -q function.zip handler.ts
aws lambda create-function \
    --function-name orienteering-proxy \
    --runtime nodejs20.x \
    --role $ROLE_ARN \
    --handler handler.handler \
    --timeout 30 \
    --memory-size 512 \
    --zip-file fileb://function.zip 2>/dev/null || \
aws lambda update-function-code \
    --function-name orienteering-proxy \
    --zip-file fileb://function.zip

# Create Function URL
aws lambda create-function-url-config \
    --function-name orienteering-proxy \
    --cors '{"AllowOrigins":["*"],"AllowMethods":["*"],"AllowHeaders":["*"]}' \
    --auth-type NONE 2>/dev/null

aws lambda add-permission \
    --function-name orienteering-proxy \
    --statement-id AllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE 2>/dev/null

PROXY_URL=$(aws lambda get-function-url-config \
    --function-name orienteering-proxy \
    --query 'FunctionUrl' \
    --output text)

cd ../../..

# Deploy Scrape Function with Puppeteer Layer
echo "📦 Deploying Scrape Function..."
cd amplify/functions/scrape
npm install --production
zip -q -r function.zip .
aws lambda create-function \
    --function-name orienteering-scrape \
    --runtime nodejs20.x \
    --role $ROLE_ARN \
    --handler handler.handler \
    --timeout 60 \
    --memory-size 2048 \
    --layers "arn:aws:lambda:eu-west-1:764866452798:layer:chrome-aws-lambda:39" \
    --zip-file fileb://function.zip 2>/dev/null || \
aws lambda update-function-code \
    --function-name orienteering-scrape \
    --zip-file fileb://function.zip

# Create Function URL
aws lambda create-function-url-config \
    --function-name orienteering-scrape \
    --cors '{"AllowOrigins":["*"],"AllowMethods":["*"],"AllowHeaders":["*"]}' \
    --auth-type NONE 2>/dev/null

aws lambda add-permission \
    --function-name orienteering-scrape \
    --statement-id AllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE 2>/dev/null

SCRAPE_URL=$(aws lambda get-function-url-config \
    --function-name orienteering-scrape \
    --query 'FunctionUrl' \
    --output text)

cd ../../..

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo "================================"
echo "🔗 Proxy Function URL: $PROXY_URL"
echo "🔗 Scrape Function URL: $SCRAPE_URL"
echo ""
echo "Update your .env.production:"
echo "REACT_APP_PROXY_URL=${PROXY_URL%/}"
echo "REACT_APP_SCRAPE_URL=${SCRAPE_URL%/}"

# Clean up
rm -f amplify/functions/*/function.zip