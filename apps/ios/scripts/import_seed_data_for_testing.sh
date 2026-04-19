#!/bin/bash

# Import seed data for testing - Phase 15 Bug Reproduction
# Usage: ./scripts/import_seed_data_for_testing.sh

echo "🚀 Starting seed data import for bug reproduction..."
echo "📅 Date: $(date)"
echo "📋 Purpose: Import seed data to reproduce FocusView disappearing bug"
echo ""

# Navigate to project directory
cd /Users/kerry/Code/SVNR/souvenir

# Check if seed data exists
echo "🔍 Checking seed data..."
if [ -f "apps/ios/souvenir/SeedData/seed.json" ]; then
    echo "✅ Seed data found: apps/ios/souvenir/SeedData/seed.json"
    echo "📊 File size: $(du -h apps/ios/souvenir/SeedData/seed.json | cut -f1)"
else
    echo "❌ Seed data not found!"
    exit 1
fi

# Check if seed images exist
echo "🔍 Checking seed images..."
if [ -d "apps/ios/souvenir/SeedData/Images" ]; then
    image_count=$(ls -1 apps/ios/souvenir/SeedData/Images | wc -l)
    echo "✅ Seed images found: $image_count images"
else
    echo "⚠️ Seed images directory not found"
fi

echo ""
echo "📋 Import Process:"
echo "1. Build app with seed data import capability"
echo "2. Launch app in simulator"
echo "3. Trigger seed data import"
echo "4. Verify map pins appear"
echo "5. Test FocusView functionality"
echo ""

# Build the app
echo "🔨 Building app for testing..."
xcodebuild -scheme souvenir \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath ./build \
  clean build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed!"
    exit 1
fi

echo ""
echo "📱 Launching app in simulator..."

# Launch the app
app_pid=$(xcrun simctl launch 5157E7F7-2BD5-472E-BCDE-27CD8A587DEF ink.kerry.souvenir)

if [ -n "$app_pid" ]; then
    echo "✅ App launched successfully (PID: $app_pid)"
else
    echo "❌ App launch failed!"
    exit 1
fi

echo ""
echo "🎯 Testing FocusView with seed data:"
echo "1. Navigate to FriendMapView"
echo "2. Observe map pins (should show seed souvenirs)"
echo "3. Tap on map pins to test FocusView"
echo "4. Check for disappearing bug"
echo ""

# Wait for app to settle
sleep 3

# Capture initial state screenshot
echo "📸 Capturing initial state..."
xcrun simctl io 5157E7F7-2BD5-472E-BCDE-27CD8A587DEF screenshot initial_state.png
echo "✅ Screenshot saved: initial_state.png"

echo ""
echo "🎉 Seed data import process initiated!"
echo "📋 Next Steps:"
echo "1. Manually verify map pins appear in simulator"
echo "2. Tap on pins to test FocusView"
echo "3. Document bug reproduction results"
echo "4. Update testing session logs"
echo ""
echo "💡 Note: If bug reproduces, capture:"
echo "   - Screenshots of the issue"
echo "   - Console logs"
echo "   - Video recording if possible"
echo ""
echo "⏳ Testing session continues..."
