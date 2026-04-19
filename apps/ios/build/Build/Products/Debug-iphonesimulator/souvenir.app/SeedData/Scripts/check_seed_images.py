#!/usr/bin/env python3
"""
Check if all required seed images exist and match seed.json references.
"""

import json
import sys
from pathlib import Path

def check_seed_images():
    """Check seed images against seed.json."""
    
    print("🖼️  Checking Seed Images\n")
    
    # Check if SeedData/Images folder exists
    images_dir = Path("SeedData/Images")
    if not images_dir.exists():
        print(f"❌ Directory not found: {images_dir}")
        print(f"   Create it with: mkdir -p SeedData/Images")
        return False
    
    # Load seed.json
    seed_file = Path("seed.json")
    if not seed_file.exists():
        print(f"❌ seed.json not found")
        return False
    
    with open(seed_file) as f:
        data = json.load(f)
    
    photos = data.get('PhotoEntity', [])
    print(f"📊 Found {len(photos)} photos in seed.json\n")
    
    # Extract seed image references
    seed_refs = []
    for photo in photos:
        asset_id = photo.get('assetLocalId', '')
        if asset_id.startswith('seed://'):
            seed_refs.append(asset_id[7:])  # Remove 'seed://'
    
    print(f"🔍 Seed image references: {len(seed_refs)}")
    
    # Check which images exist
    existing = []
    missing = []
    
    for image_name in seed_refs:
        image_path = images_dir / image_name
        if image_path.exists():
            existing.append(image_name)
            size_kb = image_path.stat().st_size / 1024
            print(f"   ✅ {image_name} ({size_kb:.1f} KB)")
        else:
            missing.append(image_name)
            print(f"   ❌ {image_name} - NOT FOUND")
    
    # Check for extra images not referenced
    all_images = list(images_dir.glob("*"))
    image_files = [f for f in all_images if f.is_file() and not f.name.startswith('.')]
    extra_images = [f.name for f in image_files if f.name not in seed_refs]
    
    if extra_images:
        print(f"\n⚠️  Extra images in folder (not referenced in seed.json):")
        for img in extra_images:
            print(f"   • {img}")
    
    # Summary
    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"   Total references: {len(seed_refs)}")
    print(f"   Found:            {len(existing)} ✅")
    print(f"   Missing:          {len(missing)} ❌")
    print(f"   Extra files:      {len(extra_images)} ⚠️")
    
    if missing:
        print(f"\n❌ Missing images - add these files to {images_dir}:")
        for img in missing:
            print(f"   • {img}")
        return False
    else:
        print(f"\n✅ All seed images found!")
        
        # Calculate total size
        total_size = sum((images_dir / img).stat().st_size for img in existing)
        total_mb = total_size / (1024 * 1024)
        print(f"   Total size: {total_mb:.2f} MB")
        
        if total_mb > 50:
            print(f"   ⚠️  Warning: Total size is quite large for DEBUG bundle")
        
        return True

if __name__ == "__main__":
    success = check_seed_images()
    sys.exit(0 if success else 1)
