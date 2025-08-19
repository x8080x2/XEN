#!/bin/bash

# Automatic process cleanup script for email sender application
echo "🔧 Starting automatic cleanup..."

# Kill any existing tsx processes for this project
echo "Killing existing tsx processes..."
pkill -f "tsx server/index.ts" 2>/dev/null || true

# Kill any npm dev processes
echo "Killing npm dev processes..."
pkill -f "npm run dev" 2>/dev/null || true

# Wait for processes to terminate
sleep 2

# Count remaining processes
process_count=$(ps aux | grep -E "(tsx|node)" | grep -v grep | wc -l)
echo "Remaining Node.js processes: $process_count"

# If still too many processes, do a more aggressive cleanup
if [ "$process_count" -gt 15 ]; then
    echo "⚠️  High process count detected, performing aggressive cleanup..."
    
    # Kill specific Node.js processes that might be stuck
    ps aux | grep -E "tsx server/index.ts" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true
    ps aux | grep -E "npm run dev" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true
    
    sleep 2
    
    final_count=$(ps aux | grep -E "(tsx|node)" | grep -v grep | wc -l)
    echo "Final process count: $final_count"
fi

echo "✅ Cleanup completed"