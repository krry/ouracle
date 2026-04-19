# Quick Reference: Updating seed.json to 17 Photos & 8 Souvenirs

## Your Requirements
- ✅ 4 contacts (already correct)
- 📸 17 photos (need 11 more)
- 🎁 8 souvenirs (need 4 more)

## Option 1: Automated (Recommended)

### Step 1: Run the generator
```bash
cd /path/to/your/souvenir/project
python3 generate_seed_json.py
```

### Step 2: Verify your images exist
```
SeedData/Images/seed-hana-01.jpeg
SeedData/Images/seed-hana-02.jpeg
...
SeedData/Images/seed-hana-17.jpeg
```

### Step 3: Validate before importing
```bash
python3 validate_seed_json.py
```

### Step 4: Import in app
1. Run app (DEBUG mode)
2. Tap hammer icon
3. Tap "Import Seed Data"
4. Confirm

## Option 2: Manual Updates

### Copy existing photos, change these fields:
```json
{
  "_objectID": "x-coredata://.../PhotoEntity/p7",  ← Increment number
  "id": "NEW-UUID-HERE",                            ← Generate new UUID
  "assetLocalId": "seed://seed-hana-07.jpeg",      ← Match image file
  ...
}
```

### For souvenirs 5-8, use this template:
```json
{
  "_objectID": "x-coredata://.../SouvenirEntity/p5",
  "id": "NEW-UUID-HERE",
  "caption": "Optional caption",
  "createdAt": "2026-01-15T10:00:00Z",
  "updatedAt": "2026-01-15T10:00:00Z",
  "favoritePhoto": "x-coredata://.../PhotoEntity/p11",
  "primaryContact": "x-coredata://.../ContactEntity/p1",
  "photos": [
    "x-coredata://.../PhotoEntity/p11",
    "x-coredata://.../PhotoEntity/p12"
  ],
  "shares": []
}
```

## Image File Naming

Your images should be named:
```
seed-hana-01.jpeg
seed-hana-02.jpeg
seed-hana-03.jpeg
...
seed-hana-17.jpeg
```

Or customize the pattern in `generate_seed_json.py` if you want different names.

## UUID Generation Quick Commands

**macOS Terminal:**
```bash
uuidgen
```

**Python:**
```python
python3 -c "import uuid; print(uuid.uuid4())"
```

**Multiple UUIDs at once:**
```bash
for i in {1..17}; do uuidgen; done
```

## Validation

Before importing, always validate:
```bash
python3 validate_seed_json.py
```

Look for:
- ❌ ERRORS: Must fix before importing
- ⚠️  WARNINGS: Should review but may be OK
- ✅ Success: Ready to import

## Common Issues

### "Seed image not found in bundle"
- Check file exists: `ls SeedData/Images/`
- Check filename matches JSON exactly (case-sensitive)
- Ensure folder added as "folder reference" in Xcode

### "Duplicate UUID"
- Each photo needs unique `id` field
- Run validator to find duplicates

### "References non-existent souvenir"
- Photo's `souvenirs` array must reference valid souvenir `_objectID`
- Check the reference format matches exactly

### Import fails silently
- Check Xcode console for error messages
- Verify Photos permission granted
- Try clearing existing data first

## Files You'll Work With

1. **seed.json** - Main data file
2. **SeedData/Images/** - Image files folder
3. **generate_seed_json.py** - Generator script
4. **validate_seed_json.py** - Validation script
5. **SEED_GENERATION_GUIDE.md** - Detailed instructions

## Distribution (from script)

| Souvenir | Photos | Contact |
|----------|--------|---------|
| 1 | 3 (p1, p2, p3) | Contact 1 |
| 2 | 2 (p4, p5) | Contact 2 |
| 3 | 3 (p6, p7, p8) | Contact 3 |
| 4 | 2 (p9, p10) | Contact 4 |
| 5 | 2 (p11, p12) | Contact 1 |
| 6 | 2 (p13, p14) | Contact 2 |
| 7 | 2 (p15, p16) | Contact 3 |
| 8 | 1 (p17) | Contact 4 |

**Total: 17 photos, 8 souvenirs, 4 contacts**

## Need Different Numbers?

Edit `generate_seed_json.py`:
```python
NUM_PHOTOS = 17      # Change this
NUM_SOUVENIRS = 8    # Change this
NUM_CONTACTS = 4     # Change this
```

Then re-run the script.
