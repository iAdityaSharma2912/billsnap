# Regenerating BillSnap's app icons

The editable master is `src-tauri/icons/source.svg` — the same mark as
`frontend/src/components/shared/Logo.tsx`. If you ever redesign the
logo, update both files, then regenerate the icon set with the commands
below (run from `src-tauri/icons/`).

These tools only need to be installed once, on whichever machine you use
to regenerate icons — they are NOT part of the app's runtime
dependencies and don't need to be installed on shop PCs.

## 1. Install the tools (one-time)

On Windows, the easiest path is WSL (Windows Subsystem for Linux) or
doing this step on a Linux/Mac machine — `rsvg-convert` and `icnsutil`
are awkward to install natively on Windows. If you don't have WSL set
up and just want the icons regenerated once, the existing files in this
folder are already correct and you don't need to do this at all unless
you're changing the logo.

```bash
# Ubuntu/Debian (or WSL):
sudo apt-get install -y librsvg2-bin
pip install pillow icnsutil
```

## 2. Generate the PNGs

```bash
rsvg-convert -w 32  -h 32  source.svg -o 32x32.png
rsvg-convert -w 128 -h 128 source.svg -o 128x128.png
rsvg-convert -w 256 -h 256 source.svg -o 128x128@2x.png
rsvg-convert -w 512 -h 512 source.svg -o icon-512-temp.png
```

## 3. Generate the Windows .ico (multi-resolution)

```bash
python3 -c "
from PIL import Image
base = Image.open('icon-512-temp.png').convert('RGBA')
base.save('icon.ico', format='ICO', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
"
```

## 4. Generate the macOS .icns

```bash
python3 -c "
import icnsutil
writer = icnsutil.IcnsFile()
writer.add_media(file='icon-512-temp.png')
writer.write('icon.icns')
"
```

## 5. Clean up

```bash
rm icon-512-temp.png
```

You should end up with exactly these 5 files in `src-tauri/icons/`,
matching what `tauri.conf.json`'s `bundle.icon` list expects:
`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.ico`, `icon.icns`.
