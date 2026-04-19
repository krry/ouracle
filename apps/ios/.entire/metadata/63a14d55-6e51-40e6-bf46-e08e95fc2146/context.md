# Session Context

**Session ID:** 63a14d55-6e51-40e6-bf46-e08e95fc2146

**Commit Message:** No, I don't want the user to have to select a photo. But the photos are

## Prompt

No, I don't want the user to have to select a photo. But the photos are coming out blurrier than the Messages app's photos. Maybe we need to implement a low-light detector. Ideally though the camera component would choose a nice frame with the subject's eyes open

## Summary

That's a smart approach. The issue is likely that `AVCapturePhotoSettings()` captures a single frame, which might not be the sharpest moment. You could:

**Auto-select best frame approach:**

1. **Enable burst capture** — capture 5-10 frames rapidly
2. **Analyze each frame** using Vision framework for:
   - **Face detection** — is there a face?
   - **Eye detection** — are eyes open/visible?
   - **Sharpness** — Laplacian variance to detect blur
3. **Score each frame** and auto-select the best

**Implementation outline:**

```swift
// In CameraController.capturePhoto()
let settings = AVCapturePhotoSettings()
settings.maxPhotosCount = 7  // Burst mode

// In the capture delegate:
// - Extract all captured frames
// - Analyze each with Vision (face landmarks, eyes)
// - Return the sharpest, best-lit frame with eyes open
```

**Vision framework methods:**
- `VNDetectFaceRectanglesRequest` — find faces
- `VNDetectFaceLandmarksRequest` — detect eyes, nose, etc.
- Custom sharpness scoring via image Laplacian

This mirrors what Messages/Camera likely does internally, but fully automatic — user just taps once, gets the best frame.

Want me to implement this? It's ~150-200 lines of Vision analysis + scoring logic, integrated into the capture flow.

## Key Actions

