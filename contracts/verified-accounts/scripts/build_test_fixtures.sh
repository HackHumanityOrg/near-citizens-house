#!/bin/bash
# Build test fixture WASMs for versioning tests
#
# This script builds both V1 (production) and V2 (upgrade-simulation) versions
# of the contract and stores them in tests/fixtures/ for integration testing.
#
# Usage: ./scripts/build_test_fixtures.sh
#
# The fixtures are committed to git so tests can run without rebuilding.
# Run this script whenever you make changes that affect versioning.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTRACT_DIR="$SCRIPT_DIR/.."
FIXTURES_DIR="$CONTRACT_DIR/tests/fixtures"

echo "========================================"
echo "Building Verified Accounts Test Fixtures"
echo "========================================"
echo ""

cd "$CONTRACT_DIR"

# Build V1 (production) - default features
echo "[1/2] Building V1 (production) fixture..."
cargo near build non-reproducible-wasm 2>&1 | tail -5

V1_WASM="$CONTRACT_DIR/target/near/verified_accounts.wasm"
if [ ! -f "$V1_WASM" ]; then
    echo "ERROR: V1 WASM not found at $V1_WASM"
    exit 1
fi

mkdir -p "$FIXTURES_DIR/v1"
cp "$V1_WASM" "$FIXTURES_DIR/v1/"
V1_SIZE=$(wc -c < "$FIXTURES_DIR/v1/verified_accounts.wasm")
V1_HASH=$(shasum -a 256 "$FIXTURES_DIR/v1/verified_accounts.wasm" | cut -d' ' -f1)
echo "  -> $FIXTURES_DIR/v1/verified_accounts.wasm"
echo "  -> Size: $V1_SIZE bytes"
echo "  -> SHA256: $V1_HASH"
echo ""

# Build V2 (upgrade-simulation) - with upgrade-simulation feature
echo "[2/2] Building V2 (upgrade-simulation) fixture..."
cargo near build non-reproducible-wasm --features upgrade-simulation 2>&1 | tail -5

V2_WASM="$CONTRACT_DIR/target/near/verified_accounts.wasm"
if [ ! -f "$V2_WASM" ]; then
    echo "ERROR: V2 WASM not found at $V2_WASM"
    exit 1
fi

mkdir -p "$FIXTURES_DIR/v2"
cp "$V2_WASM" "$FIXTURES_DIR/v2/"
V2_SIZE=$(wc -c < "$FIXTURES_DIR/v2/verified_accounts.wasm")
V2_HASH=$(shasum -a 256 "$FIXTURES_DIR/v2/verified_accounts.wasm" | cut -d' ' -f1)
echo "  -> $FIXTURES_DIR/v2/verified_accounts.wasm"
echo "  -> Size: $V2_SIZE bytes"
echo "  -> SHA256: $V2_HASH"
echo ""

# Verify different checksums (V1 and V2 should be different)
if [ "$V1_HASH" = "$V2_HASH" ]; then
    echo "WARNING: V1 and V2 have the same checksum!"
    echo "This might indicate the feature flag isn't working correctly."
    exit 1
fi

echo "========================================"
echo "Fixtures built successfully!"
echo "========================================"
echo ""
echo "V1 (production):        $FIXTURES_DIR/v1/verified_accounts.wasm"
echo "V2 (upgrade-simulation): $FIXTURES_DIR/v2/verified_accounts.wasm"
echo ""
echo "These fixtures are used by tests/integration/versioning_tests.rs"
echo "Commit them to git so CI can run tests without rebuilding."
