#!/usr/bin/env python3
"""
Validate seed.json structure and relationships.
Run this before importing to catch potential issues.
"""

import json
import sys
from pathlib import Path

def validate_seed_json(filepath="seed.json"):
    """Validate the seed.json file structure."""
    
    print(f"🔍 Validating {filepath}...")
    errors = []
    warnings = []
    
    # Load JSON
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"❌ File not found: {filepath}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}")
        return False
    
    # Extract entities
    contacts = data.get('ContactEntity', [])
    photos = data.get('PhotoEntity', [])
    souvenirs = data.get('SouvenirEntity', [])
    shares = data.get('ShareEntity', [])
    
    print(f"\n📊 Entity Counts:")
    print(f"   Contacts:  {len(contacts)}")
    print(f"   Photos:    {len(photos)}")
    print(f"   Souvenirs: {len(souvenirs)}")
    print(f"   Shares:    {len(shares)}")
    
    # Build ID lookup tables
    contact_ids = {c.get('_objectID') for c in contacts}
    photo_ids = {p.get('_objectID') for p in photos}
    souvenir_ids = {s.get('_objectID') for s in souvenirs}
    
    # Validate unique IDs
    print(f"\n🔑 Validating Unique IDs...")
    
    # Check photo IDs
    photo_uuids = [p.get('id') for p in photos]
    if len(photo_uuids) != len(set(photo_uuids)):
        errors.append("Duplicate UUID found in PhotoEntity 'id' fields")
    
    # Check souvenir IDs
    souvenir_uuids = [s.get('id') for s in souvenirs]
    if len(souvenir_uuids) != len(set(souvenir_uuids)):
        errors.append("Duplicate UUID found in SouvenirEntity 'id' fields")
    
    # Check contact IDs
    contact_uuids = [c.get('id') for c in contacts]
    if len(contact_uuids) != len(set(contact_uuids)):
        errors.append("Duplicate UUID found in ContactEntity 'id' fields")
    
    # Validate seed:// image references
    print(f"\n🖼️  Validating Image References...")
    seed_images = []
    missing_images = []
    
    for photo in photos:
        asset_id = photo.get('assetLocalId', '')
        if asset_id.startswith('seed://'):
            image_name = asset_id[7:]  # Remove 'seed://'
            seed_images.append(image_name)
            
            # Check if file exists (if SeedData/Images folder exists)
            image_path = Path('Images') / image_name
            if not image_path.exists():
                missing_images.append(image_name)
        elif not asset_id:
            warnings.append(f"Photo {photo.get('_objectID')} has no assetLocalId")
        else:
            warnings.append(f"Photo {photo.get('_objectID')} uses non-seed asset: {asset_id}")
    
    print(f"   Seed images referenced: {len(seed_images)}")
    if missing_images:
        print(f"   ⚠️  Missing image files: {len(missing_images)}")
        for img in missing_images[:5]:  # Show first 5
            warnings.append(f"Image file not found: {img}")
        if len(missing_images) > 5:
            warnings.append(f"... and {len(missing_images) - 5} more missing images")
    
    # Validate relationships
    print(f"\n🔗 Validating Relationships...")
    
    for i, photo in enumerate(photos, 1):
        photo_id = photo.get('_objectID')
        
        # Check contact references
        for contact_ref in photo.get('contacts', []):
            if contact_ref not in contact_ids:
                errors.append(f"Photo p{i} references non-existent contact: {contact_ref}")
        
        # Check souvenir references
        for souvenir_ref in photo.get('souvenirs', []):
            if souvenir_ref not in souvenir_ids:
                errors.append(f"Photo p{i} references non-existent souvenir: {souvenir_ref}")
        
        # Check favoritedBySouvenir
        if 'favoritedBySouvenir' in photo:
            fav_ref = photo['favoritedBySouvenir']
            if fav_ref not in souvenir_ids:
                errors.append(f"Photo p{i} favoritedBySouvenir references non-existent souvenir: {fav_ref}")
    
    for i, souvenir in enumerate(souvenirs, 1):
        # Check primaryContact
        primary_contact = souvenir.get('primaryContact')
        if primary_contact and primary_contact not in contact_ids:
            errors.append(f"Souvenir p{i} references non-existent primaryContact: {primary_contact}")
        
        # Check favoritePhoto
        fav_photo = souvenir.get('favoritePhoto')
        if fav_photo:
            if fav_photo not in photo_ids:
                errors.append(f"Souvenir p{i} references non-existent favoritePhoto: {fav_photo}")
            elif fav_photo not in souvenir.get('photos', []):
                warnings.append(f"Souvenir p{i} favoritePhoto is not in its photos array")
        
        # Check photos array
        for photo_ref in souvenir.get('photos', []):
            if photo_ref not in photo_ids:
                errors.append(f"Souvenir p{i} references non-existent photo: {photo_ref}")
    
    for i, contact in enumerate(contacts, 1):
        # Check primarySouvenir
        primary_souv = contact.get('primarySouvenir')
        if primary_souv and primary_souv not in souvenir_ids:
            errors.append(f"Contact p{i} references non-existent primarySouvenir: {primary_souv}")
        
        # Check photos array
        for photo_ref in contact.get('photos', []):
            if photo_ref not in photo_ids:
                errors.append(f"Contact p{i} references non-existent photo: {photo_ref}")
    
    # Validate required fields
    print(f"\n✓  Validating Required Fields...")
    
    for i, photo in enumerate(photos, 1):
        if not photo.get('id'):
            errors.append(f"Photo p{i} missing required 'id' field")
        if not photo.get('assetLocalId'):
            errors.append(f"Photo p{i} missing required 'assetLocalId' field")
        if not photo.get('timestamp'):
            warnings.append(f"Photo p{i} missing 'timestamp' field")
    
    for i, souvenir in enumerate(souvenirs, 1):
        if not souvenir.get('id'):
            errors.append(f"Souvenir p{i} missing required 'id' field")
        if not souvenir.get('photos'):
            warnings.append(f"Souvenir p{i} has no photos")
    
    for i, contact in enumerate(contacts, 1):
        if not contact.get('id'):
            errors.append(f"Contact p{i} missing required 'id' field")
        if not contact.get('givenName') and not contact.get('familyName'):
            warnings.append(f"Contact p{i} missing both givenName and familyName")
    
    # Report results
    print(f"\n{'='*60}")
    
    if errors:
        print(f"\n❌ ERRORS FOUND ({len(errors)}):")
        for error in errors:
            print(f"   • {error}")
    
    if warnings:
        print(f"\n⚠️  WARNINGS ({len(warnings)}):")
        for warning in warnings[:10]:  # Show first 10
            print(f"   • {warning}")
        if len(warnings) > 10:
            print(f"   ... and {len(warnings) - 10} more warnings")
    
    if not errors and not warnings:
        print(f"\n✅ Validation passed! No issues found.")
        return True
    elif not errors:
        print(f"\n✅ Validation passed with warnings.")
        print(f"   The file should import successfully, but review the warnings above.")
        return True
    else:
        print(f"\n❌ Validation failed!")
        print(f"   Fix the errors above before importing.")
        return False

if __name__ == "__main__":
    filepath = sys.argv[1] if len(sys.argv) > 1 else "seed.json"
    success = validate_seed_json(filepath)
    sys.exit(0 if success else 1)
