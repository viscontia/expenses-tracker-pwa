#!/bin/bash
set -e

echo "Building Vinxi app..."
pnpm build

echo "Cleaning public directory..."
rm -rf public/*

echo "Copying build files..."
cp -r .vinxi/build/client/* public/

echo "Copying PWA files..."
cp .output/public/offlineExpenseTracker.html public/
cp .output/public/sw.js public/
cp .output/public/robots.txt public/
cp .output/public/manifest.json public/
cp .output/public/icon-*.png public/

echo "Build completed successfully!"
ls -la public/ 