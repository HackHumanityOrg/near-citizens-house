#!/bin/bash
set -e

echo "🔧 Setting up NEAR Citizens House development environment..."

# Install pnpm dependencies
echo "📦 Installing Node.js dependencies..."
pnpm install --frozen-lockfile

# Verify Rust toolchain (components and target already installed by feature)
echo "🦀 Verifying Rust toolchain..."
rustc --version
rustup target list --installed | grep wasm32

# Build contracts once to cache dependencies
echo "🔨 Building smart contracts (caching dependencies)..."
pnpm build:contract || echo "Contract build skipped (may need network)"

# Install Playwright browsers for E2E tests
echo "🎭 Installing Playwright browsers..."
pnpm exec playwright install --with-deps chromium

# Create .env file from example if not exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please configure your .env file with required values"
fi

echo "✅ Development environment setup complete!"
echo ""
echo "Quick start commands:"
echo "  pnpm dev              - Start Next.js development server"
echo "  pnpm build:contract   - Build NEAR smart contracts"
echo "  pnpm test             - Run unit tests"
echo "  pnpm test:e2e         - Run Playwright E2E tests"
