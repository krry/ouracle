# Session Context

**Session ID:** 82142d9e-bddd-4609-965b-f89047e0b921

**Commit Message:** BUG: flipping to back camera and then back to the front camera leads to

## Prompt

BUG: flipping to back camera and then back to the front camera leads to the captures being stuck in landscape orientation

BUG: selecting a photo from the library I still see the back button, but when I capture a photo, I do not. Why is this? If we can show the back button over the photo, we should just make this the Retake Button, not the back button.

## Summary

You've hit your limit · resets 1pm (America/Chicago)

## Key Actions

- - **Task**: Investigate camera orientation and retake button inconsistency bugs
- - **Grep**: onChange\(of: selectedPhoto\)
- - **Grep**: AddSouvenirView\(
- - **Grep**: initialSelectedPhoto
