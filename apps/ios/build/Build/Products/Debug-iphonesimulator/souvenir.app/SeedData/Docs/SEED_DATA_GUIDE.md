# Seed Data Setup Guide

This guide explains how to set up and use seed data with bundled images for DEBUG mode testing.

## Overview

The seed data system allows you to:
- Bundle a `seed.json` file with your app (DEBUG builds only)
- Include test images in your app bundle
- Import both the JSON data and images into Core Data and Photos library
- Reset to a known state for testing

## Setup Steps

### 1. Create the SeedData Folder Structure

In Xcode, create the following folder structure:

```
souvenir/
├── SeedData/              # Create this folder
│   ├── seed.json         # Your seed data JSON
│   └── Images/           # Subfolder for images
│       ├── contact_1_photo.jpg
│       ├── contact_2_photo.jpg
│       ├── souvenir_1_main.jpg
│       ├── souvenir_1_extra.jpg
│       └── ... (more images)
```

**Important:** When adding to Xcode:
- Right-click the project → "Add Files to 'souvenir'"
- Select the `SeedData` folder
- ✅ Check "Create folder references" (NOT "Create groups")
- ✅ Check "Copy items if needed"
- ✅ Add to target: souvenir

This ensures the folder structure is preserved in the bundle.

### 2. Update seed.json Format

For any `PhotoEntity` that should use a bundled seed image, set the `assetLocalId` to:

```json
"assetLocalId" : "seed://image_filename.jpg"
```

Example:

```json
{
  "PhotoEntity" : [
    {
      "_objectID" : "x-coredata://...",
      "assetLocalId" : "seed://contact_1_photo.jpg",
      "id" : "B8CB6682-0D2A-44F9-976F-4ECE50A1FBD4",
      "latitude" : 37.7749,
      "longitude" : -122.4194,
      "timestamp" : "2026-01-17T19:55:03Z",
      ...
    }
  ]
}
```

The `seed://` prefix tells the import system to look for the image in the bundle instead of the Photos library.

### 3. Prepare Your Seed Images

#### Option A: Use Your Own Photos
1. Export photos from Photos app or other source
2. Rename them to match your `seed.json` references
3. Add to `SeedData/Images/` folder

#### Option B: Use Stock Photos
1. Download royalty-free images (Unsplash, Pexels, etc.)
2. Resize to reasonable dimensions (e.g., 1920x1080 or smaller)
3. Name them descriptively (e.g., `portrait_john.jpg`, `landscape_beach.jpg`)
4. Add to `SeedData/Images/` folder

### 4. Update Your seed.json Content

Replace the test data with more realistic information:

```json
{
  "ContactEntity" : [
    {
      "_objectID" : "x-coredata://A914B88A-BDDC-42FF-83D7-1A0C3FF607E4/ContactEntity/p1",
      "compositeName" : "John Smith",
      "familyName" : "Smith",
      "givenName" : "John",
      "phoneE164" : "+15555551234",
      "id" : "6FCDC189-23DD-41BB-B3B9-E0373BCB23A7",
      ...
    }
  ],
  "PhotoEntity" : [
    {
      "_objectID" : "x-coredata://A914B88A-BDDC-42FF-83D7-1A0C3FF607E4/PhotoEntity/p1",
      "assetLocalId" : "seed://john_portrait.jpg",
      "latitude" : 37.7749,
      "longitude" : -122.4194,
      "timestamp" : "2025-12-15T14:30:00Z",
      ...
    }
  ]
}
```

## Usage

### Importing Seed Data

1. Run your app in DEBUG mode
2. Tap the orange floating hammer button (bottom-left)
3. Scroll to "Data Import" section
4. Tap "Import Seed Data"
5. Confirm the destructive action

The import process will:
1. ✅ Clear all existing Core Data
2. ✅ Load `seed.json` from the bundle
3. ✅ Create all entities and relationships
4. ✅ Import bundled images to Photos library
5. ✅ Update PhotoEntity records with new Photos identifiers

### Exporting Current Data

To create new seed data from your current app state:

1. Open DevTools
2. Tap "Export Core Data to JSON"
3. Share/save the exported JSON file
4. Manually update the `assetLocalId` fields to use `seed://` format
5. Copy the actual photo files to `SeedData/Images/`
6. Replace `seed.json` in your project

## Image Format Notes

### Supported Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- HEIC (.heic, .heif) - if supported by UIImage

### Recommended Specifications
- Resolution: 1920x1080 to 4096x2160
- File size: < 5MB per image
- Color space: sRGB

### Photos Library Import

When importing, seed images are:
1. Loaded from the app bundle
2. Added to the user's Photos library
3. Given a new `PHAsset` local identifier
4. This identifier replaces `seed://...` in PhotoEntity

## Troubleshooting

### "Seed image not found in bundle"
- Verify the image file exists in `SeedData/Images/`
- Check the filename matches exactly (case-sensitive)
- Ensure folder was added as "folder reference" not "group"

### "Photos access not authorized"
- The import will skip images if Photos permission is denied
- Data will still import, but PhotoEntity records will have invalid `assetLocalId`
- Grant Photos permission and re-import

### Import fails with relationship errors
- Ensure all `_objectID` references are consistent
- Check that relationship targets exist in the JSON
- Verify foreign key references point to valid objects

## Best Practices

1. **Keep images small**: Bundle size increases with every image
2. **Use realistic data**: Test with data that resembles production
3. **Version your seed.json**: Commit to git so team members have same test data
4. **Document your test scenarios**: Add comments to explain the test cases
5. **Update regularly**: As schema changes, update seed data to match

## Schema Compatibility

The import system handles:
- ✅ UUIDs (converted from strings)
- ✅ Dates (ISO8601 format)
- ✅ Numbers (Int, Double, Bool)
- ✅ Strings
- ✅ To-one relationships
- ✅ To-many relationships
- ⚠️ Binary data (skipped by default, use base64 if needed)
- ✅ Bundled seed images (seed:// prefix)

## Example Use Cases

### Use Case 1: Testing with Sample Users
Create 5-10 realistic contacts with photos showing different scenarios:
- Portrait photos
- Group photos
- Photos with locations
- Photos without locations

### Use Case 2: Testing Map Features
Include photos from different geographic locations:
- Different cities
- Different countries
- Clustered locations
- Spread out locations

### Use Case 3: Testing UI Edge Cases
Include data that tests edge cases:
- Very long names
- Missing optional fields
- Empty captions
- Maximum number of photos per souvenir

## DEBUG-Only Safety

All seed data functionality is wrapped in `#if DEBUG` blocks:
- Seed import code won't compile in Release builds
- DevTools panel is DEBUG-only
- Bundle size impact is DEBUG-only
- No risk of shipping test data to production

---

## Quick Start Checklist

- [ ] Create `SeedData` folder with `Images` subfolder
- [ ] Add folder to Xcode as "folder reference"
- [ ] Prepare test images (5-10 photos)
- [ ] Update `seed.json` with realistic data
- [ ] Use `seed://filename.jpg` for bundled images
- [ ] Test import in DevTools
- [ ] Verify photos appear in Photos app
- [ ] Verify data appears correctly in app

