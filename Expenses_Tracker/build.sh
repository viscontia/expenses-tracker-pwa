#!/bin/bash
set -e

echo "Current directory: $(pwd)"
echo "Listing current directory:"
ls -la

echo "Creating directories with absolute path..."
mkdir -p "$(pwd)/src/generated/tanstack-router"

echo "Verifying directory creation:"
ls -la "$(pwd)/src/generated/tanstack-router/"

echo "Generating route tree..."
cd "$(pwd)" && pnpm tsr generate

echo "Building with Vinxi..."
cd "$(pwd)" && pnpm vinxi build --preset node-server

echo "Build completed successfully!" 