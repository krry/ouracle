# Seed Data Generation Guide

You need to update your `seed.json` to have:
- **4 ContactEntity** items (already done ✅)
- **17 PhotoEntity** items (currently has 6)
- **8 SouvenirEntity** items (currently has 4)

## Quick Start: Automated Generation

### Step 1: Run the Python script

```bash
cd /path/to/your/project
python3 generate_seed_json.py
```

This will:
- Preserve your existing 4 contacts
- Generate 17 photo entities referencing `seed://seed-hana-01.jpeg` through `seed://seed-hana-17.jpeg`
- Generate 8 souvenir entities with proper relationships
- Distribute photos across souvenirs (some have 3 photos, others have 2 or 1)

### Step 2: Verify your seed images

Make sure you have these files in `SeedData/Images/`:
```
seed-hana-01.jpeg
seed-hana-02.jpeg
seed-hana-03.jpeg
...
seed-hana-17.jpeg
```

**Don't have 17 images yet?** You can:
1. Duplicate existing images with different names
2. Use placeholder images
3. Adjust the script's `NUM_PHOTOS` variable

---

## Distribution Plan

The script distributes photos like this:

| Souvenir | Contact | Photos | Description |
|----------|---------|--------|-------------|
| 1 | Contact 1 | 3 photos (1, 2, 3) | Favorite: photo 1 |
| 2 | Contact 2 | 2 photos (4, 5) | Favorite: photo 4 |
| 3 | Contact 3 | 3 photos (6, 7, 8) | Favorite: photo 6 |
| 4 | Contact 4 | 2 photos (9, 10) | Favorite: photo 9 |
| 5 | Contact 1 | 2 photos (11, 12) | Favorite: photo 11 |
| 6 | Contact 2 | 2 photos (13, 14) | Favorite: photo 13 |
| 7 | Contact 3 | 2 photos (15, 16) | Favorite: photo 15 |
| 8 | Contact 4 | 1 photo (17) | Favorite: photo 17 |

This gives you:
- ✅ Variety in souvenir sizes (1-3 photos each)
- ✅ Each contact has 2 souvenirs
- ✅ Realistic test data for different UI states
- ✅ Each contact appears in photos only for their "primary" photo in each souvenir

---

## Manual Approach (If You Prefer)

If you want to manually edit the JSON, here's a template for one photo:

```json
{
  "_objectID" : "x-coredata://A914B88A-BDDC-42FF-83D7-1A0C3FF607E4/PhotoEntity/p1",
  "assetLocalId" : "seed://seed-hana-01.jpeg",
  "contacts" : [
    "x-coredata://A914B88A-BDDC-42FF-83D7-1A0C3FF607E4/ContactEntity/p1"
  ],
  "favoritedBySouvenir" : "x-coredata://A914B88A-BDDC-42FF-83D7-1A0C3FF607E4/SouvenirEntity/p1",
  "favoriteForSouvenir" : 0,
  "id" : "NEW-UUID-HERE",
  "latitude" : 21.3099,
  "longitude" : -157.8581,
  "plusCode" : "73H38492+GH",
  "postalGeocodeJSON" : "{\"locality\":\"Honolulu\",\"administrativeArea\":\"HI\",\"countryCode\":\"US\",\"country\":\"United States\"}",
  "souvenirs" : [
    "x-coredata://A914B88A-BDDC-42FF-83D7-1A0C3FF607E4/SouvenirEntity/p1"
  ],
  "timestamp" : "2026-01-10T14:30:00Z",
  "timezoneID" : "Pacific/Honolulu"
}
```

**Important fields to update:**
- `_objectID`: Must be unique (p1, p2, p3, ... p17)
- `id`: Generate a new UUID for each
- `assetLocalId`: Use `seed://seed-hana-XX.jpeg` format
- `contacts`: Reference a contact _objectID (only for the "primary" photo)
- `souvenirs`: Reference souvenir _objectID(s)
- `favoritedBySouvenir`: Only set for the favorite photo of each souvenir

---

## Customization Options

### Change the number of items

Edit `generate_seed_json.py`:

```python
NUM_PHOTOS = 17      # Change this
NUM_SOUVENIRS = 8    # Change this
NUM_CONTACTS = 4     # Should match your ContactEntity count
```

### Change locations

Edit the `LOCATIONS` array in the script to use different cities/coordinates.

### Change captions

Edit the `CAPTIONS` array in the script.

### Change image filenames

If your images aren't named `seed-hana-XX.jpeg`, update this line:

```python
"assetLocalId": f"seed://your-custom-name-{index:02d}.jpg",
```

---

## UUID Generation

If you need to generate UUIDs manually, you can use:

**Python:**
```python
import uuid
print(str(uuid.uuid4()).upper())
```

**Terminal:**
```bash
uuidgen
```

**Swift (in Xcode playground):**
```swift
print(UUID().uuidString)
```

---

## Validation Checklist

Before importing, verify:

- [ ] All photo `_objectID` values are unique (p1 through p17)
- [ ] All photo `id` UUIDs are unique
- [ ] All `assetLocalId` values start with `seed://`
- [ ] All `assetLocalId` image files exist in `SeedData/Images/`
- [ ] All souvenir `_objectID` values are unique (p1 through p8)
- [ ] All souvenir `id` UUIDs are unique
- [ ] Each souvenir's `favoritePhoto` references a photo in its `photos` array
- [ ] Each souvenir's `primaryContact` exists in ContactEntity
- [ ] Contact photo arrays reference valid PhotoEntity objects
- [ ] Contact primarySouvenir references valid SouvenirEntity objects
- [ ] JSON is valid (use a JSON validator or `python3 -m json.tool seed.json`)

---

## Testing the Import

1. Build and run in DEBUG mode
2. Tap the hammer icon (DevTools)
3. Scroll to "Data Import"
4. Tap "Import Seed Data"
5. Confirm the action
6. Wait for "✅ Successfully imported seed data"
7. Check your app to see the souvenirs and photos

If you see errors, check the Xcode console for details.

