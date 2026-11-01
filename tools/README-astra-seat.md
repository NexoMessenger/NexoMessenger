# Astra seating rig experiment (not production)

Run `npm ci` and `npm run dev`, then open `/tools/astra-seat-preview.html`.
The bar in this page is a visual reference, not functional UI. The script loads
`public/assets/astra-3d.glb`, can optionally apply temporary skin-weight edits to the in-memory
model only (`?weights`), and exposes `window.pose(0..1)` for frame inspection. It does not
modify the GLB or the running application.

This is not ready to ship: the experimental reweighting still produces visible holes/creases in the
shoulders and elbows; the hands do not resemble the reference. In a diagnostic
comparison of the seated pose, the trial did not reduce highly stretched mesh
edges, so it is opt-in and must not be used in production. The feet,
seating contact and transitions need further work. Do not enable this in the app
until the rig, greeting animation, reduced-motion handling and mobile interaction
have been verified.

The slider scrubs the sitting transition. Add `?smooth&passes=32` to test a
separate mesh-neighbour smoothing experiment; no edits are saved to the model.
A local edge-length diagnostic found 1,694 edges stretched over five times in
that test compared with 4,281 using original weights (on roughly 629k sampled
edges). This is encouraging but still visibly leaves serious arm/hand defects,
so it is not a production fix. Edge length counts depend on the chosen pose and
are not a quality score. The smoother changes weights used by the greeting too,
which has not been checked yet. The extra commands `?hair` and `?weights` are
other unapproved experiments; they can be combined with `smooth`.

`?ik&smooth&passes=32` tests a two-bone hand-target solver that puts the hands
near the lap. This exposes worse tearing and long pulled polygons; it is not
usable. The IK is a position experiment, not a fixed rig or approved animation.
Diagnostic helper unit tests: `node --test tests/astra-rig-diagnostics.test.mjs`.

`?raised` adds a first rough attempt at raising one foot onto the bar; the
current knee/ankle geometry is visibly distorted and the control bar is a
non-functional visual stand-in. The separate preview video keeps the arms still
because the previous attempts to move them damaged the mesh. Neither experiment
is enabled in the app.

`?legik` tests a separate two-bone leg target and corrects ankle orientation;
`tx`, `ty`, `tz`, `px`, `py`, `pz` adjust target and knee direction. `?smoothlegs`
adds experimental weight smoothing below the waist. The skeleton can reach the
chosen point in a synthetic unit test, but on Astra the skirt, hair and leg mesh
still deform visibly. This remains a laboratory experiment, not an app feature.
