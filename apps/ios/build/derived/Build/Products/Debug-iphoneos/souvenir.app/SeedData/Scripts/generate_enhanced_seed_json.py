#!/usr/bin/env python3
"""
Generate seed.json from image filenames and location data.
Image naming convention: seed-{name1}-{name2}-...-{nn}.jpeg
Locations read from photo_locations.txt
"""

import json
import uuid
import random
import re
import os
from datetime import datetime, timedelta
from pathlib import Path

# Base UUID for Core Data object references
BASE_UUID = "A914B88A-BDDC-42FF-83D7-1A0C3FF607E4"

# Timezone mapping by region/country
TIMEZONE_MAP = {
    "California": "America/Los_Angeles",
    "Nevada": "America/Los_Angeles",
    "Oregon": "America/Los_Angeles",
    "Arizona": "America/Phoenix",
    "Illinois": "America/Chicago",
    "Alabama": "America/Chicago",
    "Maui": "Pacific/Honolulu",
    "Thailand": "Asia/Bangkok",
    "England": "Europe/London",
    "France": "Europe/Paris",
    "British Columbia": "America/Vancouver",
}

def get_timezone(state_or_country: str) -> str:
    """Get timezone from state/country name."""
    for key, tz in TIMEZONE_MAP.items():
        if key.lower() in state_or_country.lower():
            return tz
    return "America/Los_Angeles"  # default

def get_country_code(state_or_country: str) -> str:
    """Get ISO country code."""
    state_or_country = state_or_country.lower()
    if "thailand" in state_or_country:
        return "TH"
    if "england" in state_or_country:
        return "GB"
    if "france" in state_or_country:
        return "FR"
    if "british columbia" in state_or_country:
        return "CA"
    return "US"

def get_country_name(state_or_country: str) -> str:
    """Get full country name."""
    state_or_country = state_or_country.lower()
    if "thailand" in state_or_country:
        return "Thailand"
    if "england" in state_or_country:
        return "United Kingdom"
    if "france" in state_or_country:
        return "France"
    if "british columbia" in state_or_country:
        return "Canada"
    return "United States"

def object_id(entity: str, key: str) -> str:
    """Generate Core Data object ID reference."""
    return f"x-coredata://{BASE_UUID}/{entity}/{key}"

def gen_uuid() -> str:
    return str(uuid.uuid4()).upper()

def parse_image_filename(filename: str) -> list[str]:
    """
    Parse image filename to extract person names.
    seed-cameron-kyle.jpeg -> ['cameron', 'kyle']
    seed-jane-01.jpeg -> ['jane']
    """
    base = filename.replace('.jpeg', '').replace('.jpg', '')
    if base.startswith('seed-'):
        base = base[5:]

    parts = base.split('-')
    names = [p.lower() for p in parts if not p.isdigit()]
    return names

def capitalize_name(name: str) -> str:
    """Capitalize name properly."""
    return name.capitalize()

def parse_locations_file(filepath: Path) -> dict[str, dict]:
    """
    Parse photo_locations.txt file.
    Returns dict: filename -> {lat, lon, city, state}
    """
    locations = {}
    with open(filepath) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue

            if ':' not in line:
                continue

            filename, data = line.split(':', 1)
            filename = filename.strip()
            data = data.strip()

            if not data:
                continue

            # Parse: lat, lon, city, state
            parts = [p.strip() for p in data.split(',')]
            if len(parts) >= 4:
                locations[filename] = {
                    "lat": float(parts[0]),
                    "lon": float(parts[1]),
                    "city": parts[2],
                    "state": parts[3]
                }
            elif len(parts) == 3:
                # city might be combined
                locations[filename] = {
                    "lat": float(parts[0]),
                    "lon": float(parts[1]),
                    "city": parts[2],
                    "state": ""
                }

    return locations

def main():
    script_dir = Path(__file__).parent
    images_dir = script_dir.parent / "Images"
    locations_file = script_dir / "photo_locations.txt"

    # Load locations
    locations = parse_locations_file(locations_file)
    print(f"Loaded {len(locations)} locations from photo_locations.txt")

    # Find all images
    image_files = sorted([f.name for f in images_dir.glob("seed-*.jpeg")])
    print(f"Found {len(image_files)} images")

    # Parse all images to extract names
    name_to_images: dict[str, list[str]] = {}
    image_to_names: dict[str, list[str]] = {}

    for img in image_files:
        names = parse_image_filename(img)
        image_to_names[img] = names
        for name in names:
            if name not in name_to_images:
                name_to_images[name] = []
            name_to_images[name].append(img)

    print(f"Found {len(name_to_images)} unique contacts")

    # Generate data structures
    contacts = []
    photos = []
    souvenirs = []

    contact_keys = {}
    photo_keys = {}
    souvenir_keys = {}

    for name in sorted(name_to_images.keys()):
        contact_keys[name] = name
        souvenir_keys[name] = name

    # Create photos
    base_time = datetime.now() - timedelta(days=len(image_files))

    for i, img in enumerate(image_files):
        key = img.replace('.jpeg', '').replace('seed-', 'photo_')
        photo_keys[img] = key

        names = image_to_names[img]

        # Get location data
        loc = locations.get(img, {"lat": 37.7749, "lon": -122.4194, "city": "San Francisco", "state": "California"})

        # Photo timestamp spreads over past N days
        timestamp = base_time + timedelta(days=i, hours=random.randint(8, 20))

        # Geocode JSON
        geocode = {
            "locality": loc["city"],
            "administrativeArea": loc["state"],
            "country": get_country_name(loc["state"]),
            "countryCode": get_country_code(loc["state"])
        }

        photo = {
            "_objectID": object_id("PhotoEntity", key),
            "assetLocalId": f"seed://{img}",
            "contacts": [object_id("ContactEntity", contact_keys[n]) for n in names],
            "favoriteForSouvenir": 0,
            "id": gen_uuid(),
            "latitude": loc["lat"],
            "longitude": loc["lon"],
            "plusCode": "",
            "postalGeocodeJSON": json.dumps(geocode),
            "souvenirs": [object_id("SouvenirEntity", souvenir_keys[n]) for n in names],
            "timestamp": timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "timezoneID": get_timezone(loc["state"])
        }
        photos.append(photo)

    # Create souvenirs for each contact
    for name in sorted(name_to_images.keys()):
        key = souvenir_keys[name]
        imgs = name_to_images[name]

        photo_refs = [object_id("PhotoEntity", photo_keys[img]) for img in imgs]

        # Pick favorite photo (first solo photo, or first one)
        solo_imgs = [img for img in imgs if len(image_to_names[img]) == 1]
        favorite_img = solo_imgs[0] if solo_imgs else imgs[0]

        favorite_photo_data = next(p for p in photos if p["assetLocalId"] == f"seed://{favorite_img}")

        souvenir = {
            "_objectID": object_id("SouvenirEntity", key),
            "caption": f"Memories with {capitalize_name(name)}",
            "createdAt": favorite_photo_data["timestamp"],
            "favoritePhoto": object_id("PhotoEntity", photo_keys[favorite_img]),
            "id": gen_uuid(),
            "lastLatitude": favorite_photo_data["latitude"],
            "lastLongitude": favorite_photo_data["longitude"],
            "photos": photo_refs,
            "primaryContact": object_id("ContactEntity", contact_keys[name]),
            "shares": [],
            "updatedAt": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
        }
        souvenirs.append(souvenir)

        # Mark favorite photo
        for p in photos:
            if p["assetLocalId"] == f"seed://{favorite_img}":
                p["favoriteForSouvenir"] = 1

    # Create contacts
    for name in sorted(name_to_images.keys()):
        key = contact_keys[name]
        imgs = name_to_images[name]

        photo_refs = [object_id("PhotoEntity", photo_keys[img]) for img in imgs]

        birth_year = random.randint(1975, 2000)
        birth_month = random.randint(1, 12)
        birth_day = random.randint(1, 28)

        contact = {
            "_objectID": object_id("ContactEntity", key),
            "birthday": f"{birth_year}-{birth_month:02d}-{birth_day:02d}T00:00:00Z",
            "compositeName": f"{capitalize_name(name)} Souvy",
            "createdAt": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "familyName": "Souvy",
            "givenName": capitalize_name(name),
            "id": gen_uuid(),
            "isPrimaryForSouvenir": 1,
            "phoneE164": f"+1{random.randint(200,999)}{random.randint(100,999)}{random.randint(1000,9999)}",
            "photos": photo_refs,
            "primarySouvenir": object_id("SouvenirEntity", souvenir_keys[name])
        }
        contacts.append(contact)

    # Build output
    output = {
        "ContactEntity": contacts,
        "PhotoEntity": photos,
        "ShareEntity": [],
        "SouvenirEntity": souvenirs
    }

    # Write to seed.json
    output_path = script_dir.parent / "seed.json"
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nGenerated {output_path}:")
    print(f"  {len(contacts)} contacts")
    print(f"  {len(photos)} photos")
    print(f"  {len(souvenirs)} souvenirs")

    # Show location summary
    print(f"\nLocations used:")
    cities = {}
    for img, loc in locations.items():
        city = f"{loc['city']}, {loc['state']}"
        cities[city] = cities.get(city, 0) + 1
    for city, count in sorted(cities.items(), key=lambda x: -x[1])[:10]:
        print(f"  {city}: {count} photos")

if __name__ == "__main__":
    main()
