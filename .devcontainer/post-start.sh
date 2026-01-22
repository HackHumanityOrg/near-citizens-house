#!/bin/bash

# Verify Redis is running (using Node.js since redis-cli may not be installed)
echo "🔍 Checking Redis connection..."
until node -e "const net = require('net'); const c = net.connect(6379, 'redis'); c.on('connect', () => { c.end(); process.exit(0); }); c.on('error', () => process.exit(1));" 2>/dev/null; do
    echo "Waiting for Redis..."
    sleep 1
done
echo "✅ Redis is ready at redis://redis:6379"

# Display environment info
echo ""
echo "📋 Environment Info:"
echo "  Node.js: $(node --version)"
echo "  pnpm: $(pnpm --version)"
echo "  Rust: $(rustc --version)"
echo "  cargo-near: $(cargo near --version 2>/dev/null || echo 'not installed')"
