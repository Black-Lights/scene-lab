/**
 * @file kit/camera.ts
 * @description The camera as pure math (architecture section 6.3): no React, no three, no Remotion import, so
 *   the same numbers place the 3D camera, project the labels and can be checked from a plain script.
 *   A shot is data: which places to fit, from which angle, into which part of the frame. settle() turns a shot
 *   into the pose it comes to rest on; mixPose() moves between two poses around the target, the azimuth going
 *   the shorter way; shotEntries() and foldShots() run the shots of every scene of a world on one timeline, each
 *   move starting from wherever the camera is at that instant; project() says where a point lands on the frame.
 *   The 2D board has the same model with a simpler pose (settle2, mixPose2, project2).
 *   Conventions (architecture section 1): right-handed, Y up; degrees; `az` = 0 puts the camera on +Z looking at
 *   -Z and grows towards +X; `el` = 0 is the horizon and 90 looks straight down; `fov` is vertical. A 3D place is
 *   { pos: centre of its base, size: [x, y, z] }; a 2D place is { pos: top-left corner, size: [w, h] }.
 *   The subject is centred in a rectangle of the frame (by default the content area between the chapter bar and
 *   the captions) by moving the principal point of the projection, never by aiming the camera off the subject:
 *   a camera turned away would show the subject from a slightly different angle than the shot asked for.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
/** x, y, width, height in layout pixels. */
export type Rect = [number, number, number, number];
export type PlaceBox = { pos: number[]; size?: number[] };
export type Places = Record<string, PlaceBox>;

/** A camera move as the spec writes it. Every field is optional: an empty shot frames every place. */
export type Shot = {
  at?: number; // seconds in the scene at which the move starts (make.py turns a `cue` into this)
  over?: number; // seconds the move takes
  ease?: string;
  cue?: string; // still here only when make.py could not find the words: the shot then never happens
  frame?: string | string[]; // places to fit into the frame
  target?: string | number[]; // what to look at: a place or a point (default: the middle of `frame`)
  pos?: number[]; // an explicit camera position, in place of az, el and dist
  preset?: string;
  az?: number;
  el?: number;
  dist?: number; // multiplies the fitted distance (on a board: divides the fitted zoom)
  fov?: number;
  pad?: number; // room left free around the framed places, as a fraction of the rectangle on each side
  fit?: 'area' | 'full' | number[]; // where on the frame the subject sits
  orbit?: number; // degrees per second, from the moment the move starts until the next shot
};

/** Where a 3D camera is: it looks at `target` from `dist` away; `shift` moves the principal point, in half-frames. */
export type Pose = { target: Vec3; az: number; el: number; dist: number; fov: number; shift: Vec2 };
/** Where a board camera is: the board point (x, y) sits at the middle of the stage, drawn `zoom` times its size. */
export type Pose2 = { x: number; y: number; zoom: number };
/** The stage on the frame: its rectangle, and the part of it the subject is fitted into (local to the stage). */
export type View = { x: number; y: number; w: number; h: number; area: Rect };
/** A point on the frame: layout pixels, the distance in front of the camera, and whether it can be seen at all. */
export type Projected = { x: number; y: number; depth: number; visible: boolean };

export const FOV = 34;
export const PAD = 0.06;

/** Angle and distance of the named views. `dist` multiplies the distance at which the framed places just fit. */
export const PRESETS: Record<string, { az: number; el: number; dist: number }> = {
  establish: { az: 35, el: 28, dist: 1 },
  top: { az: 0, el: 90, dist: 1 },
  side: { az: 90, el: 8, dist: 1 },
  front: { az: 0, el: 12, dist: 1 },
  low: { az: 35, el: 5, dist: 1 },
  close: { az: 30, el: 20, dist: 0.6 },
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: number[], b: number[]): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: number[], b: number[]): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: number[], k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const num = (x: unknown, d = 0): number => (typeof x === 'number' && Number.isFinite(x) ? x : d);
const list = (x: string | string[] | undefined): string[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);

/** A place by name. A name the stage does not have is an error: the camera must never frame a guess. */
export const placeOf = (places: Places, name: string, what = 'a shot'): PlaceBox => {
  const p = places[name];
  if (!p || !Array.isArray(p.pos)) {
    const known = Object.keys(places);
    throw new Error(`${what} names the place "${name}", which is not declared (${known.length ? 'places: ' + known.join(', ') : 'no places are declared'})`);
  }
  return p;
};

/** The eight corners of a 3D place: it stands on y = pos[1] and is centred on pos in x and z. */
export const corners = (p: PlaceBox): Vec3[] => {
  const [x, y, z] = [num(p.pos[0]), num(p.pos[1]), num(p.pos[2])];
  const [sx, sy, sz] = [num(p.size?.[0]), num(p.size?.[1]), num(p.size?.[2])];
  const out: Vec3[] = [];
  for (const dx of [-0.5, 0.5]) for (const dy of [0, 1]) for (const dz of [-0.5, 0.5]) out.push([x + dx * sx, y + dy * sy, z + dz * sz]);
  return out;
};

/** The middle of a 3D place: half its height above its base. */
export const centreOf = (p: PlaceBox): Vec3 => [num(p.pos[0]), num(p.pos[1]) + num(p.size?.[1]) / 2, num(p.pos[2])];

export type Bounds = { min: Vec3; max: Vec3; centre: Vec3; radius: number };

/** The box and the sphere around a set of 3D places: what the clip planes, the lights and the ground are fitted to. */
export const boundsOf = (places: PlaceBox[]): Bounds => {
  const pts = places.flatMap(corners);
  if (!pts.length) return { min: [-1, 0, -1], max: [1, 1, 1], centre: [0, 0.5, 0], radius: 1.5 };
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let i = 0; i < 3; i++) {
    min[i] = Math.min(min[i], p[i]);
    max[i] = Math.max(max[i], p[i]);
  }
  const centre = mul(add(min, max), 0.5);
  const d = sub(max, centre);
  return { min, max, centre, radius: Math.max(1e-3, Math.hypot(d[0], d[1], d[2])) };
};

/**
 * The camera's own axes for an angle: `back` points from the target to the camera, `right` and `up` span the
 * picture. Written out instead of built with a look-at, so a view from straight above (el = 90) has a defined
 * "up": the far side of the ground, which keeps 2D data unmirrored in a top view.
 */
export const basis = (az: number, el: number): { back: Vec3; right: Vec3; up: Vec3 } => {
  const [ca, sa, ce, se] = [Math.cos(rad(az)), Math.sin(rad(az)), Math.cos(rad(el)), Math.sin(rad(el))];
  return { back: [sa * ce, se, ca * ce], right: [ca, 0, -sa], up: [-sa * se, ce, -ca * se] };
};

/** The rectangle of the stage a shot centres its subject in, in pixels local to the stage. */
const fitRect = (fit: Shot['fit'], view: View): Rect => {
  if (fit === 'full') return [0, 0, view.w, view.h];
  if (Array.isArray(fit) && fit.length === 4) return [num(fit[0]) - view.x, num(fit[1]) - view.y, Math.max(1, num(fit[2], 1)), Math.max(1, num(fit[3], 1))];
  if (fit !== undefined && fit !== 'area') throw new Error(`a shot's "fit" is "area", "full" or [x, y, w, h], not ${JSON.stringify(fit)}`);
  return view.area;
};

const presetOf = (name: string | undefined) => {
  if (name === undefined) return undefined;
  const p = PRESETS[name];
  if (!p) throw new Error(`a shot's preset "${name}" is not one of ${Object.keys(PRESETS).join(', ')}`);
  return p;
};

/**
 * The pose a shot comes to rest on: the framed places just fit the rectangle, seen from the shot's angle.
 * The fit is exact for the corners of the places, with no iteration: a corner at offset q from the target is
 * inside the rectangle when dist >= q.back + |q.right| * f / halfWidth (and the same for up), so the fitted
 * distance is the largest of those. When the shot names no target, the target is then slid in the picture
 * plane until the places sit in the middle of the rectangle, because perspective makes the near side larger.
 */
export const settle = (shot: Shot, places: Places, view: View): Pose => {
  const pre = presetOf(shot.preset);
  const names = shot.frame !== undefined ? list(shot.frame) : typeof shot.target === 'string' ? [shot.target] : Object.keys(places);
  const pts = names.map((n) => placeOf(places, n)).flatMap(corners);
  const fov = num(shot.fov, FOV);
  const fit = fitRect(shot.fit, view);
  const shift: Vec2 = [((fit[0] + fit[2] / 2) / view.w) * 2 - 1, 1 - ((fit[1] + fit[3] / 2) / view.h) * 2];
  const fixed = shot.target !== undefined;
  let target: Vec3 = Array.isArray(shot.target)
    ? [num(shot.target[0]), num(shot.target[1]), num(shot.target[2])]
    : typeof shot.target === 'string'
      ? centreOf(placeOf(places, shot.target))
      : pts.length
        ? boundsOfPoints(pts)
        : [0, 0, 0];
  if (Array.isArray(shot.pos)) {
    const d = sub([num(shot.pos[0]), num(shot.pos[1]), num(shot.pos[2])], target);
    const dist = Math.max(1e-6, Math.hypot(d[0], d[1], d[2]));
    return { target, az: deg(Math.atan2(d[0], d[2])), el: deg(Math.asin(Math.max(-1, Math.min(1, d[1] / dist)))), dist, fov, shift };
  }
  const az = num(shot.az, pre?.az ?? PRESETS.establish.az);
  const el = Math.max(-90, Math.min(90, num(shot.el, pre?.el ?? PRESETS.establish.el)));
  const { back, right, up } = basis(az, el);
  const f = 1 / Math.tan(rad(fov) / 2);
  const usable = Math.max(0.05, 1 - 2 * num(shot.pad, PAD));
  const halfW = (fit[2] / view.w) * usable * (view.w / view.h); // in units of the frame's half height, like f
  const halfH = (fit[3] / view.h) * usable;
  const need = (tg: Vec3) => {
    let d = 0;
    for (const p of pts) {
      const q = sub(p, tg);
      const depth = dot(q, back);
      d = Math.max(d, depth + (f * Math.abs(dot(q, right))) / halfW, depth + (f * Math.abs(dot(q, up))) / halfH);
    }
    return d;
  };
  let dist = need(target);
  for (let i = 0; i < 8 && !fixed && dist > 1e-9; i++) {
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const p of pts) {
      const q = sub(p, target);
      const z = dist - dot(q, back);
      if (z <= 1e-9) continue;
      x0 = Math.min(x0, dot(q, right) / z); x1 = Math.max(x1, dot(q, right) / z);
      y0 = Math.min(y0, dot(q, up) / z); y1 = Math.max(y1, dot(q, up) / z);
    }
    const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
    if (!Number.isFinite(cx + cy) || Math.abs(cx) + Math.abs(cy) < 1e-6) break;
    target = add(target, add(mul(right, cx * dist), mul(up, cy * dist)));
    dist = need(target);
  }
  if (!(dist > 1e-6)) dist = 1; // a single point has no size to fit: stand one unit away
  return { target, az, el, dist: dist * num(shot.dist, pre?.dist ?? 1), fov, shift };
};

const boundsOfPoints = (pts: Vec3[]): Vec3 => {
  const c: Vec3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) c[i] = (Math.min(...pts.map((p) => p[i])) + Math.max(...pts.map((p) => p[i]))) / 2;
  return c;
};

/** The pose `p` of the way from `a` to `b`: everything moves around the target, and the azimuth takes the shorter way round. */
export const mixPose = (a: Pose, b: Pose, p: number): Pose => {
  const turn = ((((b.az - a.az) % 360) + 540) % 360) - 180;
  return {
    target: [lerp(a.target[0], b.target[0], p), lerp(a.target[1], b.target[1], p), lerp(a.target[2], b.target[2], p)],
    az: a.az + turn * p,
    el: lerp(a.el, b.el, p),
    dist: lerp(a.dist, b.dist, p),
    fov: lerp(a.fov, b.fov, p),
    shift: [lerp(a.shift[0], b.shift[0], p), lerp(a.shift[1], b.shift[1], p)],
  };
};

/** A pose with its azimuth turned: how `orbit` is applied while a shot holds. */
export const turned = (pose: Pose, degrees: number): Pose => (degrees ? { ...pose, az: pose.az + degrees } : pose);

export type Camera = {
  eye: Vec3; back: Vec3; right: Vec3; up: Vec3;
  f: number; aspect: number; near: number; far: number;
  /** The projection matrix, column-major, as three.js and WebGL store it. */
  proj: number[];
};

/**
 * Everything a renderer needs to stand where a pose says: the eye, the axes and the projection matrix with the
 * principal point moved by `shift`. project() below uses the same numbers, so a label lands on its place.
 */
export const cameraOf = (pose: Pose, view: View, near?: number, far?: number): Camera => {
  const { back, right, up } = basis(pose.az, pose.el);
  const eye = add(pose.target, mul(back, pose.dist));
  const f = 1 / Math.tan(rad(pose.fov) / 2);
  const aspect = view.w / view.h;
  const n = near ?? pose.dist * 0.05;
  const fr = far ?? pose.dist * 20;
  const proj = [f / aspect, 0, 0, 0, 0, f, 0, 0, -pose.shift[0], -pose.shift[1], (fr + n) / (n - fr), -1, 0, 0, (2 * fr * n) / (n - fr), 0];
  return { eye, back, right, up, f, aspect, near: n, far: fr, proj };
};

/** Where a world point lands on the frame, in layout pixels, with the matrix the stage renders with. */
export const project = (pose: Pose, point: number[], view: View): Projected => {
  const c = cameraOf(pose, view);
  const q = sub([num(point[0]), num(point[1]), num(point[2])], c.eye);
  const depth = -dot(q, c.back);
  const z = Math.max(depth, 1e-9);
  const nx = ((c.f / c.aspect) * dot(q, c.right)) / z + pose.shift[0];
  const ny = (c.f * dot(q, c.up)) / z + pose.shift[1];
  return { x: view.x + ((nx + 1) / 2) * view.w, y: view.y + ((1 - ny) / 2) * view.h, depth, visible: depth > 0 };
};

/** Clip planes that hold the whole world: nothing of the declared places is cut, and depth stays precise. */
export const clipFor = (pose: Pose, bounds: Bounds): { near: number; far: number } => {
  const { back } = basis(pose.az, pose.el);
  const eye = add(pose.target, mul(back, pose.dist));
  const d = Math.hypot(...sub(eye, bounds.centre));
  const near = Math.max(Math.min(d - 3 * bounds.radius, pose.dist * 0.5), pose.dist * 0.02, bounds.radius * 1e-3);
  return { near, far: Math.max(d + 4 * bounds.radius, pose.dist * 4) + near };
};

// ---------------------------------------------------------------- the 2D board

/** The pose a board shot comes to rest on: the framed places just fit the rectangle. `dist` 2 shows them half as large. */
export const settle2 = (shot: Shot, places: Places, view: View): Pose2 => {
  const names = shot.frame !== undefined ? list(shot.frame) : typeof shot.target === 'string' ? [shot.target] : Object.keys(places);
  const boxes = names.map((n) => placeOf(places, n));
  const fit = fitRect(shot.fit, view);
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const b of boxes) {
    x0 = Math.min(x0, num(b.pos[0])); y0 = Math.min(y0, num(b.pos[1]));
    x1 = Math.max(x1, num(b.pos[0]) + num(b.size?.[0])); y1 = Math.max(y1, num(b.pos[1]) + num(b.size?.[1]));
  }
  if (!boxes.length) [x0, y0, x1, y1] = [0, 0, view.w, view.h];
  const usable = Math.max(0.05, 1 - 2 * num(shot.pad, PAD));
  const fitted = Math.min(x1 > x0 ? (fit[2] * usable) / (x1 - x0) : Infinity, y1 > y0 ? (fit[3] * usable) / (y1 - y0) : Infinity);
  const zoom = (Number.isFinite(fitted) ? fitted : 1) / Math.max(1e-6, num(shot.dist, 1));
  const look: number[] = Array.isArray(shot.target)
    ? shot.target
    : typeof shot.target === 'string'
      ? ((b) => [num(b.pos[0]) + num(b.size?.[0]) / 2, num(b.pos[1]) + num(b.size?.[1]) / 2])(placeOf(places, shot.target))
      : [(x0 + x1) / 2, (y0 + y1) / 2];
  // the looked-at point goes to the middle of the fit rectangle, which is not always the middle of the stage
  return { x: num(look[0]) - (fit[0] + fit[2] / 2 - view.w / 2) / zoom, y: num(look[1]) - (fit[1] + fit[3] / 2 - view.h / 2) / zoom, zoom };
};

/**
 * Between two board poses. The zoom is mixed as a height above the board (1 / zoom), which is the straight flight
 * of a camera: mixing the zoom itself makes a move that zooms in rush at its start and crawl at its end.
 */
export const mixPose2 = (a: Pose2, b: Pose2, p: number): Pose2 => ({
  x: lerp(a.x, b.x, p),
  y: lerp(a.y, b.y, p),
  zoom: 1 / lerp(1 / a.zoom, 1 / b.zoom, p),
});

/** Where a board point lands on the frame, in layout pixels. */
export const project2 = (pose: Pose2, point: number[], view: View): Projected => ({
  x: view.x + view.w / 2 + (num(point[0]) - pose.x) * pose.zoom,
  y: view.y + view.h / 2 + (num(point[1]) - pose.y) * pose.zoom,
  depth: 1,
  visible: true,
});

// ---------------------------------------------------------------- shots on the world's timeline

/** One scene of a world as the camera sees it: where its t = 0 is on the video, whether it carries on from the scene before, its shots. */
export type SceneShots<S> = { origin: number; follows: boolean; shots: S[] };
/** One camera event on world time. A cut takes the pose at once; a move takes `over` seconds from wherever the camera is. */
export type Entry<S> = { T: number; over: number; ease?: string; cut: boolean; shot: S };

/** How long before a scene's own start its opening pose is in force: longer than any cut into the scene. */
export const OPENING = 1;

/**
 * The shots of every scene of a world, in time order (section 6.3). A shot with `at` is a move at that time.
 * A shot without one opens its scene: when the scene carries on from a scene of the same world it is a move
 * that starts at t = 0, otherwise it is the pose the scene cuts to. A shot whose cue make.py did not find is
 * left out. A scene without shots adds nothing, so it holds whatever pose it inherits.
 */
export const shotEntries = <S extends { at?: number; over?: number; ease?: string; cue?: unknown }>(scenes: SceneShots<S>[], over: number): Entry<S>[] => {
  const out: Entry<S>[] = [];
  for (const sc of scenes)
    for (const shot of sc.shots) {
      if (typeof shot.at === 'number') out.push({ T: sc.origin + shot.at, over: num(shot.over, over), ease: shot.ease, cut: false, shot });
      else if (shot.cue !== undefined) continue;
      else if (sc.follows) out.push({ T: sc.origin, over: num(shot.over, over), ease: shot.ease, cut: false, shot });
      else out.push({ T: sc.origin - OPENING, over: 0, cut: true, shot });
    }
  return out.map((e, i) => ({ e, i })).sort((a, b) => a.e.T - b.e.T || a.i - b.i).map((x) => x.e);
};

export type Folded<V> = { value: V; from: V; to: V; p: number; index: number };

/**
 * The state of anything that follows the shots, at world time T: the pose itself, or a label layout that has to
 * move in step with it. `first` is the state before any shot; `goal(i, held)` is where entry i comes to rest,
 * `held` seconds after it began (for an orbit). Each move starts from the state at that instant, so a move that
 * interrupts another one, or runs across the seam between two scenes, never jumps.
 */
export const foldShots = <S, V>(entries: Entry<S>[], T: number, first: V, goal: (i: number, held: number) => V,
  mix: (a: V, b: V, p: number) => V, ease: (name?: string) => (x: number) => number): Folded<V> => {
  let [value, from, to, p, index] = [first, first, first, 1, -1];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.T > T) break;
    // an entry is followed only until the next one begins: that is the pose the next one starts from
    const until = Math.min(T, entries[i + 1]?.T ?? Infinity);
    const g = goal(i, until - e.T);
    if (e.cut || e.over <= 0) [value, from, to, p] = [g, g, g, 1];
    else {
      p = ease(e.ease)(clamp01((until - e.T) / e.over));
      [from, to, value] = [value, g, mix(value, g, p)];
    }
    index = i;
  }
  return { value, from, to, p, index };
};
