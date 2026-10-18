# MILKY DESIGN WEBSITE 2 — Living Index

A fresh interpretation of the MILKY studio site. The dense Three.js habitat and
solid tropical leaf geometry are retained as proven material, with a lightweight
vGPU/WebGPU atmosphere layer adding deep haze, wet shimmer and near-camera rain.
The interface is an editorial index with cinematic live-site reels, a playable
experiments drawer, a clear studio story, an authentic Nest case study and a
direct enquiry path.

## Open it

Double-click `start-milky-2.cmd`. It serves the site at:

```text
http://localhost:5192/
```

The launcher prefers Brave when it is installed and otherwise uses the default
Windows browser. Closing its terminal window stops the local server.

## Automatic Windows login launch

`auto-start-milky-2.vbs` is the quiet login launcher used by the Windows Startup
shortcut. It scans ports 5192–5201 for this specific MILKY page, reuses it when
it is already running, or starts the checked-in server on the first available
port. It then opens the page in Brave when available, falling back to the
default browser. Startup diagnostics are appended to `tools/auto-start.log`.

## Structure

```text
index.html          semantic content and page structure
styles.css          complete art direction and responsive system
js/site.js          scroll, video, lab dialog and renderer bridge
js/forest.js        Three.js habitat, shaders, fog and wet-glass compositor
js/vgpu-atmosphere.js built vGPU/WebGPU atmosphere (runs directly in browser)
js/leaf*.js         real solid leaf geometry and baked monstera contours
src/                 editable vGPU layer and WGSL shader source
data/layout.json    deterministic five-bed plant composition
media/              real project captures and artwork
live/               three playable generative experiments
tools/              no-cache local server and one-click launcher
```

The Project Hub and Music Hub images in `media/nest/` are captured from the
local tools with `node tools/capture-nest.js`. The capture script expects the
existing Hub server at `http://127.0.0.1:5299/`; it does not start or rescan the
Hub.

The static enquiry form does not upload or store visitor details. It prepares a
message in the visitor's email app. The current destination lives in two clear
places in `index.html`: the visible contact link and `data-email` on
`#inquiryForm`. A WhatsApp link is already styled but remains hidden until a
real phone number is supplied.

No package install, CDN or build command is required to open the site: the vGPU
browser bundle is checked in. To edit its WGSL source, run `npm install`, then
`npm run check:vgpu` and `npm run build:vgpu`.

The atmosphere is deliberately progressive. Browsers without WebGPU retain the
complete Three.js forest. Modern desktop browsers run the overlay at a capped
30 FPS and no more than 1× device resolution; coarse-pointer devices start on a
lower 20 FPS tier, and sustained missed frames trigger the same lower tier.
