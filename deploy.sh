#!/bin/bash

# Product Hunt Scraper Backend Deployment Script
# This script will set up your backend server with the correct configuration

# Create the .env file with your provided credentials
cat > .env << EOL
# Server Configuration
PORT=5000
NODE_ENV=production
LOG_LEVEL=info
API_KEY=36b5a4eac688fdc38359303bd6d470a131eaa8fc90546b4e135adb19a671f1f1

# MongoDB Configuration
MONGODB_URI=mongodb+srv://proudchannel2024:0dFAif2drrYzIjNV@cluster0.armbx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0

# Product Hunt API Keys (using your existing keys)
PH_TOKEN=${PH_TOKEN}
PH_TOKEN_2=${PH_TOKEN_2}
PH_TOKEN_3=${PH_TOKEN_3}

# Discord Webhook (if you use it)
DISCORD_WEBHOOK_URL=${DISCORD_WEBHOOK_URL}

# Frontend URL for CORS (update this with your Vercel URL)
FRONTEND_URL=https://product-hunt-scraper.vercel.app

# Cron Schedule for Scraper (every hour by default)
SCRAPER_CRON=0 * * * *

# CRON Secret (using your API key)
CRON_SECRET=36b5a4eac688fdc38359303bd6d470a131eaa8fc90546b4e135adb19a671f1f1
EOL

# Install dependencies
npm install

# Set up PM2 for process management
npm install -g pm2

# Start the server with PM2
pm2 start server.js --name "ph-scraper-backend"

# Make PM2 auto-start on server reboot
pm2 save
pm2 startup

# Display success message
echo "=========================================================="
echo "Product Hunt Scraper Backend has been deployed successfully!"
echo "=========================================================="
echo "Your backend is running at: http://localhost:5000"
echo "API Key: 36b5a4eac688fdc38359303bd6d470a131eaa8fc90546b4e135adb19a671f1f1"
echo ""
echo "IMPORTANT: Add this environment variable to your Vercel project:"
echo "NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP:5000/api"
echo ""
echo "Replace YOUR_SERVER_IP with your actual server IP or domain."
echo "=========================================================="

