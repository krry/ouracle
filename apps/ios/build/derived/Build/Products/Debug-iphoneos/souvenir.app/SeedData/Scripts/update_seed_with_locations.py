#!/usr/bin/env python3

import json
import sys

def update_seed_with_locations():
    # Load the seed data
    with open('seed.json', 'r') as f:
        seed_data = json.load(f)

    # Create a mapping from photo ID to location
    photo_locations = {}

    for photo in seed_data.get('PhotoEntity', []):
        photo_id = photo['_objectID'].split('/')[-1]  # Extract the last part of the ID
        latitude = photo.get('latitude')
        longitude = photo.get('longitude')

        if latitude is not None and longitude is not None:
            photo_locations[photo_id] = {
                'latitude': latitude,
                'longitude': longitude
            }

    # Update each SouvenirEntity with lastLatitude and lastLongitude
    # Use the location from the latest photo (first in photos array)
    updated_souvenirs = []

    for souvenir in seed_data.get('SouvenirEntity', []):
        # Get the photos array
        photos = souvenir.get('photos', [])

        # Find the first photo that has location data
        last_latitude = 0.0
        last_longitude = 0.0

        for photo_ref in photos:
            photo_id = photo_ref.split('/')[-1]  # Extract the last part of the ID
            if photo_id in photo_locations:
                location = photo_locations[photo_id]
                last_latitude = location['latitude']
                last_longitude = location['longitude']
                break  # Use the first photo with location data

        # Create updated souvenir with location fields
        updated_souvenir = souvenir.copy()
        updated_souvenir['lastLatitude'] = last_latitude
        updated_souvenir['lastLongitude'] = last_longitude

        updated_souvenirs.append(updated_souvenir)

    # Update the seed data
    seed_data['SouvenirEntity'] = updated_souvenirs

    # Save the updated seed data
    with open('seed.json', 'w') as f:
        json.dump(seed_data, f, indent=2)

    print(f"✅ Updated {len(updated_souvenirs)} souvenirs with location data")

    # Print summary
    souvenirs_with_locations = sum(1 for s in updated_souvenirs if s['lastLatitude'] != 0 or s['lastLongitude'] != 0)
    print(f"🗺️ Souvenirs with valid locations: {souvenirs_with_locations}")
    print(f"❌ Souvenirs without locations: {len(updated_souvenirs) - souvenirs_with_locations}")

if __name__ == '__main__':
    update_seed_with_locations()
