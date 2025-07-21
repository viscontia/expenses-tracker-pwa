#!/bin/bash
set -e

echo "Creating directories..."
mkdir -p src/generated/tanstack-router

echo "Generating route tree..."
pnpm tsr generate

echo "Building with Vinxi..."
pnpm vinxi build --preset node-server

echo "Build completed successfully!" 