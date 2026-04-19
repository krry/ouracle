#!/usr/bin/env python3
"""
Generate seed.json with 17 PhotoEntity items and 8 SouvenirEntity items.
Run this script and it will create an updated seed.json file.
"""

import json
import uuid
from datetime import datetime, timedelta

# Configuration
NUM_PHOTOS = 17
NUM_SOUVENIRS = 4
NUM_CONTACTS = 4  # You mentioned you already have the contacts updated

# Sample locations (you can customize these)
LOCATIONS = [
    {"lat": 21.3099, "lon": -157.8581, "city": "Honolulu", "state": "HI", "timezone": "Pacific/Honolulu", "plusCode": "73H38492+GH"},
    {"lat": 20.8861, "lon": -156.5053, "city": "Kihei", "state": "HI", "timezone": "Pacific/Honolulu", "plusCode": "73G4VFP3+2C"},
    {"lat": 20.0266, "lon": -155.6656, "city": "Kailua-Kona", "state": "HI", "timezone": "Pacific/Honolulu", "plusCode": "73F428GM+5Q"},
    {"lat": 22.0964, "lon": -159.5261, "city": "Lihue", "state": "HI", "timezone": "Pacific/Honolulu", "plusCode": "73F63FWF+HJ"},
    {"lat": 21.4389, "lon": -158.0001, "city": "Kailua", "state": "HI", "timezone": "Pacific/Honolulu", "plusCode": "73H4C2QX+CP"},
    {"lat": 20.7984, "lon": -156.3319, "city": "Wailea", "state": "HI", "timezone": "Pacific/Honolulu", "plusCode": "73G4QMX9+F8"},
]

# Sample captions
CAPTIONS = [
    "Beautiful sunset at the beach",
    "Amazing hiking adventure",
    "Delicious local food",
    "Exploring the island",
    "Relaxing by the ocean",
    "Incredible waterfall view",
    "Snorkeling with sea turtles",
    "Traditional luau celebration",
]

def generate_uuid():
    """Generate a new UUID string."""
    return str(uuid.uuid4()).upper()

def generate_object_id(entity_name, index):
    """Generate Core Data object ID reference."""
    return f"x-coredata://A914B88A-BDDC-42FF-83D7-1A0C3FF607E4/{entity_name}/p{index}"

def generate_timestamp(days_ago):
    """Generate ISO8601 timestamp."""
    dt = datetime.now() - timedelta(days=days_ago)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

def generate_photo_entity(index, contact_index=None, souvenir_refs=None, is_favorite_for=None):
    """Generate a PhotoEntity object."""
    location = LOCATIONS[index % len(LOCATIONS)]
    
    photo = {
        "_objectID": generate_object_id("PhotoEntity", index),
        "assetLocalId": f"seed://seed-hana-{index:02d}.jpeg",
        "contacts": [],
        "favoriteForSouvenir": 0,
        "id": generate_uuid(),
        "latitude": location["lat"],
        "longitude": location["lon"],
        "plusCode": location["plusCode"],
        "postalGeocodeJSON": json.dumps({
            "locality": location["city"],
            "administrativeArea": location["state"],
            "countryCode": "US",
            "country": "United States",
        }),
        "souvenirs": souvenir_refs or [],
        "timestamp": generate_timestamp(NUM_PHOTOS - index),
        "timezoneID": location["timezone"]
    }
    
    # Add contact reference if specified
    if contact_index is not None:
        photo["contacts"].append(generate_object_id("ContactEntity", contact_index))
    
    # Mark as favorite for souvenir if specified
    if is_favorite_for is not None:
        photo["favoritedBySouvenir"] = generate_object_id("SouvenirEntity", is_favorite_for)
    
    return photo

def generate_souvenir_entity(index, photo_indices, primary_contact_index, favorite_photo_index=None):
    """Generate a SouvenirEntity object."""
    if favorite_photo_index is None:
        favorite_photo_index = photo_indices[0]
    
    photo_refs = [generate_object_id("PhotoEntity", i) for i in photo_indices]
    
    souvenir = {
        "_objectID": generate_object_id("SouvenirEntity", index),
        "createdAt": generate_timestamp(NUM_SOUVENIRS - index + 5),
        "favoritePhoto": generate_object_id("PhotoEntity", favorite_photo_index),
        "id": generate_uuid(),
        "photos": photo_refs,
        "primaryContact": generate_object_id("ContactEntity", primary_contact_index),
        "shares": [],
        "updatedAt": generate_timestamp(NUM_SOUVENIRS - index + 2)
    }
    
    # Add caption for some souvenirs
    if index <= len(CAPTIONS):
        souvenir["caption"] = CAPTIONS[index - 1]
    
    return souvenir

def main():
    # Distribution: 17 photos across 8 souvenirs
    # Souvenir 1: photos 1, 2, 3 (3 photos)
    # Souvenir 2: photos 4, 5 (2 photos)
    # Souvenir 3: photos 6, 7, 8 (3 photos)
    # Souvenir 4: photos 9, 10 (2 photos)
    # Souvenir 5: photos 11, 12 (2 photos)
    # Souvenir 6: photos 13, 14 (2 photos)
    # Souvenir 7: photos 15, 16 (2 photos)
    # Souvenir 8: photo 17 (1 photo)
    
    souvenir_photo_mapping = {
        1: [1, 2, 3],      # Contact 1
        2: [4, 5],         # Contact 2
        3: [6, 7, 8],      # Contact 3
        4: [9, 10],        # Contact 4
        5: [11, 12],       # Contact 1
        6: [13, 14],       # Contact 2
        7: [15, 16],       # Contact 3
        8: [17],           # Contact 4
    }
    
    # Generate all photos first
    photos = []
    for i in range(1, NUM_PHOTOS + 1):
        # Determine which souvenir and contact this photo belongs to
        souvenir_index = None
        contact_index = None
        for s_idx, photo_list in souvenir_photo_mapping.items():
            if i in photo_list:
                souvenir_index = s_idx
                # Distribute contacts: 1->1, 2->2, 3->3, 4->4, 5->1, 6->2, 7->3, 8->4
                contact_index = ((s_idx - 1) % NUM_CONTACTS) + 1
                break
        
        # First photo of each souvenir is the favorite (with contacts)
        # Second+ photos don't have contacts
        is_first_in_souvenir = (i == souvenir_photo_mapping[souvenir_index][0])
        is_favorite = is_first_in_souvenir
        
        photo = generate_photo_entity(
            index=i,
            contact_index=contact_index if is_first_in_souvenir else None,
            souvenir_refs=[generate_object_id("SouvenirEntity", souvenir_index)],
            is_favorite_for=souvenir_index if is_favorite else None
        )
        photos.append(photo)
    
    # Generate all souvenirs
    souvenirs = []
    for s_idx, photo_indices in souvenir_photo_mapping.items():
        contact_idx = ((s_idx - 1) % NUM_CONTACTS) + 1
        favorite_photo = photo_indices[0]  # First photo is favorite
        
        souvenir = generate_souvenir_entity(
            index=s_idx,
            photo_indices=photo_indices,
            primary_contact_index=contact_idx,
            favorite_photo_index=favorite_photo
        )
        souvenirs.append(souvenir)
    
    # Load existing contacts from current seed.json
    try:
        with open('seed.json', 'r') as f:
            existing_data = json.load(f)
            contacts = existing_data.get('ContactEntity', [])
    except FileNotFoundError:
        print("Warning: seed.json not found, using placeholder contacts")
        contacts = []
        for i in range(1, NUM_CONTACTS + 1):
            contacts.append({
                "_objectID": generate_object_id("ContactEntity", i),
                "compositeName": f"Contact {i}",
                "createdAt": generate_timestamp(20),
                "familyName": f"LastName{i}",
                "givenName": f"FirstName{i}",
                "id": generate_uuid(),
                "isPrimaryForSouvenir": 0,
                "phoneE164": f"+155555{i:04d}",
                "photos": [],
                "primarySouvenir": generate_object_id("SouvenirEntity", i)
            })
    
    # Update contact relationships
    for i, contact in enumerate(contacts, 1):
        # Find all photos with this contact
        contact_photos = [generate_object_id("PhotoEntity", photo_idx) 
                         for s_idx, photo_list in souvenir_photo_mapping.items() 
                         if ((s_idx - 1) % NUM_CONTACTS) + 1 == i
                         for photo_idx in [photo_list[0]]]  # Only first photo has contact
        contact["photos"] = contact_photos
        
        # Find primary souvenir (first souvenir with this contact)
        for s_idx, _ in souvenir_photo_mapping.items():
            if ((s_idx - 1) % NUM_CONTACTS) + 1 == i:
                contact["primarySouvenir"] = generate_object_id("SouvenirEntity", s_idx)
                break
    
    # Build final structure
    output = {
        "ContactEntity": contacts,
        "PhotoEntity": photos,
        "ShareEntity": [],
        "SouvenirEntity": souvenirs
    }
    
    # Write to file
    with open('seed.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"✅ Generated seed.json with:")
    print(f"   - {len(contacts)} contacts")
    print(f"   - {len(photos)} photos")
    print(f"   - {len(souvenirs)} souvenirs")
    print(f"\nPhoto distribution:")
    for s_idx, photo_list in souvenir_photo_mapping.items():
        contact_idx = ((s_idx - 1) % NUM_CONTACTS) + 1
        print(f"   Souvenir {s_idx} (Contact {contact_idx}): {len(photo_list)} photos ({photo_list})")
    print(f"\nMake sure you have these image files in SeedData/Images/:")
    for i in range(1, NUM_PHOTOS + 1):
        print(f"   - seed-hana-{i:02d}.jpeg")

if __name__ == "__main__":
    main()
