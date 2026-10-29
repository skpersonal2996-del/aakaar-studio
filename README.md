# aakaar — studio website

An explorable 3D studio built with React Three Fiber. Drag to look around; click objects (or the orange markers) to fly to them and open a section.

| Object | Opens |
| --- | --- |
| Shruti's laptop | 01 Projects |
| Bookshelf | 02 Our story |
| Vinay's laptop | 03 Services |
| Couch | 04 Process |
| ID wall | 05 About |
| Phone on the desk | 06 Contact |
| Vinay or Shruti | Hover for an intro, click to zoom in |

The top bar has a Warm / Night theme switch and a music toggle; "Reset view" returns the camera home.

```bash
npm install
npm run dev
```

- **Copy** (sections, projects, story, services, team, socials): `src/content.js`.
- **Camera framing and marker positions**: `src/scene/views.js`.
- **Lighting** (warm and night): `src/scene/Lights.jsx`; post-processing in `src/scene/Studio.jsx`.
- **Images**: founder photos in `public/team/`, project thumbnails in `public/projects/`. Everything else is procedural.
