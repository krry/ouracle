#!/usr/bin/env python3
"""Generate a representative seed.json from the 2026 photo data."""

import json
import uuid
from datetime import datetime
from pathlib import Path

BASE_UUID = "A914B88A-BDDC-42FF-83D7-1A0C3FF607E4"


def compute_contact_photo_counts(photo_map: dict[str, dict], contact_ids: set[str]) -> dict[str, set[str]]:
    counts: dict[str, set[str]] = {cid: set() for cid in contact_ids}
    for photo in photo_map.values():
        for cid in photo.get("contacts", []):
            if cid in counts:
                counts[cid].add(photo["_objectID"])
    return counts


def compute_contact_photo_counts(photo_map: dict[str, dict], contact_ids: set[str]) -> dict[str, set[str]]:
    counts: dict[str, set[str]] = {cid: set() for cid in contact_ids}
    for photo in photo_map.values():
        for cid in photo.get("contacts", []):
            if cid in counts:
                counts[cid].add(photo["_objectID"])
    return counts


def object_id(entity: str, key: str) -> str:
    return f"x-coredata://{BASE_UUID}/{entity}/{key}"


def iso_now() -> str:
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    seed_dir = script_dir.parent
    source_path = seed_dir / "seed-2026-01-29.json"
    output_path = seed_dir / "seed.json"

    if not source_path.exists():
        raise FileNotFoundError(f"Missing source seed data at {source_path}")

    with source_path.open() as f:
        source = json.load(f)

    contacts = source.get("ContactEntity", [])[:]
    photos = source.get("PhotoEntity", [])[:]
    souvenirs = source.get("SouvenirEntity", [])[:]
    shares = source.get("ShareEntity", [])[:]

    contact_map = {c["_objectID"]: c for c in contacts}
    photo_map = {p["_objectID"]: p for p in photos}
    souvenir_map = {s["_objectID"]: s for s in souvenirs}

    alan_contact_id = object_id("ContactEntity", "alan")
    photo_mark_id = object_id("PhotoEntity", "photo_mark-alan-mat")
    photo_tim_id = object_id("PhotoEntity", "photo_tim-andy-josh")

    if alan_contact_id not in contact_map or photo_mark_id not in photo_map:
        raise RuntimeError("Expected alan contact and photo_mark-alan-mat in source seed data")

    photo_tim = photo_map.get(photo_tim_id)
    if photo_tim and alan_contact_id not in photo_tim.get("contacts", []):
        photo_tim.setdefault("contacts", []).append(alan_contact_id)
    alan_contact = contact_map.get(alan_contact_id)
    if alan_contact:
        alan_contact.setdefault("photos", [])
        if photo_tim_id not in alan_contact["photos"]:
            alan_contact["photos"].append(photo_tim_id)

    for photo_key in ["photo_jane-02", "photo_carole-zack", "photo_tim-andy-josh"]:
        photo_id = object_id("PhotoEntity", photo_key)
        photo = photo_map.get(photo_id)
        if not photo:
            continue
        photo["latitude"] = None
        photo["longitude"] = None
        photo["plusCode"] = ""
        photo["postalGeocodeJSON"] = ""
        photo["timezoneID"] = ""

    extended_souvenir_id = object_id("SouvenirEntity", "alan-extended")
    if extended_souvenir_id not in souvenir_map:
        favorite_photo_id = photo_mark_id
        extended_souvenir = {
            "_objectID": extended_souvenir_id,
            "caption": "Alan & friends expanded",
            "createdAt": iso_now(),
            "favoritePhoto": favorite_photo_id,
            "id": str(uuid.uuid4()).upper(),
            "lastLatitude": photo_map[favorite_photo_id].get("latitude"),
            "lastLongitude": photo_map[favorite_photo_id].get("longitude"),
            "photos": [photo_mark_id, photo_tim_id],
            "primaryContact": alan_contact_id,
            "shares": [],
            "updatedAt": iso_now(),
        }
        souvenirs.append(extended_souvenir)
        souvenir_map[extended_souvenir_id] = extended_souvenir

        for photo_id in extended_souvenir["photos"]:
            photo = photo_map.get(photo_id)
            if not photo:
                continue
            photo.setdefault("souvenirs", [])
            if extended_souvenir_id not in photo["souvenirs"]:
                photo["souvenirs"].append(extended_souvenir_id)

    photos = list(photo_map.values())
    photo_count = len(photos)
    contact_photo_counts = compute_contact_photo_counts(photo_map, set(contact_map.keys()))

    multi_contacts = []
    single_contacts = []
    for contact_id in sorted(contact_map):
        photo_count_for_contact = len(contact_photo_counts.get(contact_id, set()))
        entry = (photo_count_for_contact, contact_id)
        if photo_count_for_contact > 1:
            multi_contacts.append(entry)
        else:
            single_contacts.append(entry)

    multi_contacts.sort(key=lambda x: (-x[0], x[1]))
    single_contacts.sort(key=lambda x: (x[0], x[1]))

    selected_contact_ids = []
    for _, contact_id in multi_contacts:
        if len(selected_contact_ids) >= photo_count:
            break
        selected_contact_ids.append(contact_id)

    single_added = 0
    for _, contact_id in single_contacts:
        if len(selected_contact_ids) >= photo_count or single_added >= 3:
            break
        selected_contact_ids.append(contact_id)
        single_added += 1

    selected_contact_ids = selected_contact_ids[:photo_count]
    selected_contacts_set = set(selected_contact_ids)

    contacts = [contact_map[cid] for cid in selected_contact_ids]

    filtered_souvenirs = []
    for souvenir in souvenirs:
        if len(filtered_souvenirs) >= photo_count:
            break
        if souvenir["primaryContact"] not in selected_contacts_set:
            continue
        filtered_souvenirs.append(souvenir)

    souvenirs = filtered_souvenirs

    selected_souvenir_ids = {s["_objectID"] for s in souvenirs}

    for photo in photos:
        photo["contacts"] = [cid for cid in photo.get("contacts", []) if cid in selected_contacts_set]
        photo["souvenirs"] = [sid for sid in photo.get("souvenirs", []) if sid in selected_souvenir_ids]

    primary_for_contact = {}
    for souvenir in souvenirs:
        contact_id = souvenir["primaryContact"]
        primary_for_contact.setdefault(contact_id, []).append(souvenir["_objectID"])

    for contact in contacts:
        contact_id = contact["_objectID"]
        contact["photos"] = [photo["_objectID"] for photo in photos if contact_id in photo.get("contacts", [])]
        primaries = primary_for_contact.get(contact_id)
        if primaries:
            contact["primarySouvenir"] = primaries[0]
        else:
            contact.pop("primarySouvenir", None)

    output = {
        "ContactEntity": contacts,
        "PhotoEntity": photos,
        "ShareEntity": shares,
        "SouvenirEntity": souvenirs,
    }

    with output_path.open("w") as f:
        json.dump(output, f, indent=2)

    print(f"✅ Regenerated {output_path} from {source_path}")
    print(f"   contacts: {len(contacts)}")
    print(f"   photos:   {len(photos)}")
    print(f"   souvenirs: {len(souvenirs)}")


if __name__ == "__main__":
    main()
