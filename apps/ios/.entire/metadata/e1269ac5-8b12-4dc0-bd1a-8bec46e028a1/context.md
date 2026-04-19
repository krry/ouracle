# Session Context

**Session ID:** e1269ac5-8b12-4dc0-bd1a-8bec46e028a1

**Commit Message:** Sounds like this isn't well thought through yet. I'll restate the object

## Prompt

sounds like this isn't well thought through yet. I'll restate the objective and our capabilities and see what you can come up with:

For beta testing, I want to be able to invite my friends and family to the app in pairs. For example I would send my Dad and sister an invite, which would resolve them both to the same shared souvenir with a photo of them that I chose. They'll be downloading the app through TestFlight, so it would be nice if I could send them these invites after they do to save them a step.

## Summary

Got it. This is much clearer. Here's what I'd propose:

**Simplified Flow:**

1. **DevTools: "Create Paired Invite"**
   - Pick contact A (Dad)
   - Pick contact B (Sister)
   - Pick a photo
   - Tap "Generate"

2. **System creates:**
   - A new Souvenir with `primaryContact` = You (the user running DevTools)
   - Adds the chosen photo to it
   - Generates a CKShare for the souvenir
   - Gets the share URL from CloudKit

3. **UI shows two share buttons:**
   - "Share with Dad" → opens Messages (or share sheet) with Dad's phone/email pre-filled, link in body
   - "Share with Sister" → same, but for Sister
   - (Both buttons send the exact same CloudKit share URL)

4. **When they tap the link:**
   - Deep link handler recognizes the CKShare URL
   - App opens share acceptance flow (you probably already have this)
   - They accept → become a participant on the share
   - They see the souvenir with your chosen photo + can add their own

**Why this works:**
- No "wrapper links" needed; CloudKit share URL is the real thing
- Same link, two recipients — CloudKit handles multiple acceptances fine
- Contact selection is simple (use system CNContactPickerViewController)
- Ties to existing Share + deep link infrastructure
- They get the invite *after* downloading (one step), and accepting it creates their local share state

**Missing pieces to build:**
- DevTools UI for contact/photo selection
- Deep link handler to intercept CloudKit share URLs
- Souvenir creation with photo attachment in DevTools context

Does this match what you had in mind?

## Key Actions

