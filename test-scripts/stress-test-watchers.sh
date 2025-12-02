#!/bin/bash
# Stress test for file watchers - create many files rapidly
# Usage: ./stress-test-watchers.sh /path/to/project

PROJECT_PATH="$1"
if [ -z "$PROJECT_PATH" ]; then
  echo "Usage: $0 <project-path>"
  echo "Example: $0 /Users/username/my-project"
  exit 1
fi

BLUEKIT_DIR="$PROJECT_PATH/.bluekit"
KITS_DIR="$BLUEKIT_DIR/kits"

# Ensure directories exist
mkdir -p "$KITS_DIR"

echo "===================================="
echo "File Watcher Stress Test"
echo "===================================="
echo "Project: $PROJECT_PATH"
echo "Target: $KITS_DIR"
echo ""
echo "This test will:"
echo "  1. Create 100 .md files rapidly"
echo "  2. Modify existing files repeatedly"
echo "  3. Verify app doesn't crash"
echo ""
echo "Expected behavior:"
echo "  ✅ No crash (bounded channel absorbs burst)"
echo "  ✅ Debouncing reduces updates to ~10-20"
echo "  ✅ All files eventually detected"
echo ""
echo "Before fix would have:"
echo "  ❌ OOM crash from unbounded channel"
echo "  ❌ Frontend frozen from event spam"
echo ""
read -p "Press Enter to start test (or Ctrl+C to cancel)..."
echo ""

echo "Starting stress test: creating 100 files rapidly..."
START_TIME=$(date +%s)

for i in {1..100}; do
  # Create new file
  cat > "$KITS_DIR/test-kit-$i.md" <<EOF
---
id: test-kit-$i
alias: Test Kit $i
---

# Test Kit $i

This is test kit number $i created at $(date).
EOF

  # Also modify the first file repeatedly to trigger more events
  if [ $i -gt 1 ]; then
    echo "Updated at $(date)" >> "$KITS_DIR/test-kit-1.md"
  fi

  # Brief pause to simulate realistic file creation
  sleep 0.01
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "Stress test complete in ${DURATION}s"
echo ""
echo "Check the app:"
echo "  - Did it crash? (it shouldn't)"
echo "  - Are all 100 files visible?"
echo "  - Did updates appear smoothly?"
echo ""
read -p "Press Enter to clean up test files..."

echo "Cleaning up..."
rm -f "$KITS_DIR/test-kit-"*.md
echo "Done! Test files removed."
