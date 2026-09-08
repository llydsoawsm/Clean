# Clean Assets

Placeholder for app icon and splash screen.

## Required files (Expo SDK 54, Expo Go compatible):

- `icon.png` — 1024x1024, PNG, transparent background, simple “Clean” laundry icon (e.g., white shirt on blue #172554 circle)
- `adaptive-icon.png` — 1024x1024, same icon with safe padding (Android)
- `splash.png` — 1284x2778, centered “Clean” + “Laundry Management” on #f4f6fb background
- `favicon.png` — 48x48 (web, optional)

Current `app.json` points to these files. Replace placeholders before production build with `eas build` (requires `npm install -g eas-cli` + Expo account).

For development in Expo Go, the default Expo icon will show until these files are added — app still runs.

## Generating placeholders (temporary):

If you have ImageMagick:
```
magick -size 1024x1024 xc:"#172554" -fill white -draw "circle 512,512 512,100" -fill white -gravity center -pointsize 200 -annotate 0 "C" assets/icon.png
```
Or simply export a 1024x1024 PNG from Figma with text “C”.
