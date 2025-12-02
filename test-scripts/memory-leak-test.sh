#!/bin/bash
# Memory leak test for file watchers - long-running continuous file operations
# Usage: ./memory-leak-test.sh /path/to/project [duration_seconds]

PROJECT_PATH="$1"
DURATION=${2:-3600} # Default 1 hour

if [ -z "$PROJECT_PATH" ]; then
  echo "Usage: $0 <project-path> [duration_seconds]"
  echo "Example: $0 /Users/username/my-project 3600"
  echo ""
  echo "Default duration: 3600 seconds (1 hour)"
  exit 1
fi

BLUEKIT_DIR="$PROJECT_PATH/.bluekit"
KITS_DIR="$BLUEKIT_DIR/kits"

# Ensure directories exist
mkdir -p "$KITS_DIR"

echo "===================================="
echo "File Watcher Memory Leak Test"
echo "===================================="
echo "Project: $PROJECT_PATH"
echo "Duration: $DURATION seconds ($((DURATION / 60)) minutes)"
echo ""
echo "This test will:"
echo "  1. Continuously create and delete files"
echo "  2. Run for $((DURATION / 60)) minutes"
echo "  3. Monitor memory usage"
echo ""
echo "Expected behavior:"
echo "  ✅ Memory stays bounded (<50MB growth)"
echo "  ✅ No accumulating tasks/handles"
echo "  ✅ Watcher count remains stable"
echo ""
echo "IMPORTANT:"
echo "  - Keep Activity Monitor open"
echo "  - Watch memory usage of 'bluekit-app' process"
echo "  - Memory should stay relatively flat"
echo ""
read -p "Press Enter to start test (or Ctrl+C to cancel)..."
echo ""

START_TIME=$(date +%s)
END_TIME=$((START_TIME + DURATION))
ITERATION=0

echo "Starting memory leak test..."
echo "Monitor memory usage with Activity Monitor / Task Manager"
echo ""

while [ $(date +%s) -lt $END_TIME ]; do
  ITERATION=$((ITERATION + 1))

  # Create and delete files continuously
  for i in {1..10}; do
    echo "---" > "$KITS_DIR/temp-$i.md"
    echo "id: temp-$i" >> "$KITS_DIR/temp-$i.md"
    echo "---" >> "$KITS_DIR/temp-$i.md"
    echo "# Temp File $i" >> "$KITS_DIR/temp-$i.md"
    sleep 0.5
    rm -f "$KITS_DIR/temp-$i.md"
  done

  ELAPSED=$(($(date +%s) - START_TIME))
  REMAINING=$((DURATION - ELAPSED))
  echo "Iteration $ITERATION - Elapsed: ${ELAPSED}s / ${DURATION}s - Remaining: ${REMAINING}s"
done

echo ""
echo "===================================="
echo "Memory leak test complete!"
echo "===================================="
echo "Total runtime: $((DURATION / 60)) minutes"
echo "Total iterations: $ITERATION"
echo ""
echo "Check results:"
echo "  - Did memory grow unbounded? (it shouldn't)"
echo "  - Is the app still responsive?"
echo "  - Any error messages?"
echo ""
echo "Expected: Memory usage should be stable (< 50MB growth total)"
