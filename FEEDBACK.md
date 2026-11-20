# Feedback rules

These are the house rules of this engine. F-001 to F-003 were set when it was started; F-004 to F-015 came from one
user's corrections on real videos while the engine was built. Every user adds their own below with the next number.

Read before writing any spec. Newest last.
Format: `F-NNN (date, where it came from) rule. Why: reason.`

F-001 (2026-11-14, starting rule) Analogy first, then the real mechanism, then where the analogy stops working.
Why: the point of these videos is understanding without effort; an analogy alone misleads.

F-002 (2026-11-14, starting rule) Never state anything more confidently than the source. Keep its numbers,
uncertainty and caveats. Why: a confident wrong video is worse than no video.

F-003 (2026-11-14, starting rule) On-screen text is a label, a number or a short phrase; the narration carries
the sentences. Why: subtitles already show every word, and two texts at once compete for the eye.

F-004 (2026-11-14, the first demo) No emoji as icons or illustrations. Use professional visuals: one consistent
icon set, precise diagrams drawn with true geometry in each field's own conventions, and photos only when the
real object matters and the picture fits the meaning. Every visual decision follows docs/avoid-list.md.
Why: emoji and first-hit stock photos read as machine-made, and the demo's "padlock" photo did not match the meaning.

F-005 (2026-11-14, the first directions) The look adapts to the topic: no single fixed design and no fixed analogy.
Each video picks its theme (plate, stage, ground or a saved one) and may set its own content colours, typeface and
motif; the through-line metaphor comes from the topic of that video. Assets are searched across every keyed
provider in .env, ordered by the video's topic. (Since F-015 no theme is a default: each video's look is designed
for it, and a stock theme is only its base.)
Why: the videos span fields as far apart as web security, astronomy and machine learning.

F-006 (2026-11-14, from a real video) Every video gets a design made for its topic: its own palette, type, chrome
(progress bar, titles, captions), layouts, transitions and direction, with deliberate variation so no two videos
look alike. A design becomes a saved theme only when the user says "save" (`make.py videos/<slug> --save-theme
<name>`); otherwise the next topic gets a new design.
Why: a video on the default design looked exactly like the demo, and every later video would have looked the same.

F-007 (2026-11-14, from a real video) Render previews while iterating; the 4K master only when the user asks for it.
Why: the 4K master of a five-minute video took 30 minutes, and a video is judged before it is final.

F-008 (2026-11-14, from a real video) Explain with real 3D where the subject has form (devices, chips, machines,
systems shown as places), with varied camera angles, and keep the space coherent: one world per chapter, an
establishing shot, then the details, then back. Flat diagrams that are only animated are not enough on their own.
Why: simple diagrams that only move do not show a thing that has form.

F-009 (2026-11-14, from a real video) Explain in depth, not as an overview: how each part works and why, in an
order a newcomer can follow. For a system, that means its architecture and how each part really works, not a list
of its parts.
Why: the viewer wants to understand the thing properly, and an overview leaves the working out.

F-010 (2026-11-14, from a real video) The engine makes explainer videos on any topic; any one video is only a case
to test it on. Build general capabilities into the engine (templates, toolkit, asset kinds, the direction method)
and keep anything that serves one topic (its geometry, data, layouts, scene code) in that video's folder. Given any
topic, the session works out the subject, the audience and the mechanism, then directs the best video for it.
Why: an engine shaped around its first topic would serve no other.

F-011 (2026-11-15, from a real video) Choose 2D or 3D scene by scene, whichever explains that idea better. 3D is for
things that have form or are places; flows, data, arguments and anything a flat drawing says faster stay 2D. This
refines F-008: real 3D where it helps, never everywhere.
Why: 3D everywhere costs time and hides ideas that a flat drawing says at once.

F-012 (2026-11-15, from a real video) A big subject becomes a course: numbered lessons that start from the basics,
each building on the ones before and repeating nothing, taught as a teacher would, in detail. Research the subject
first and plan every lesson before making the first.
Why: one long video cannot teach a big subject, and lessons that repeat each other waste the viewer's time.

F-013 (2026-11-16, a voice trial) Narration is written for the ear and spoken the way a person would say it, never
read off the page: no abbreviations such as "i.e." or "e.g." (say "that is", "for example"), and a symbol or a code
token is given the words a teacher would use ("the inst token") while the screen and the caption keep its written
form (`[INST]`). So what is said and what is shown may differ, and the spec must be able to carry both.
Why: the voices in the trial skipped `[INST]` or spelled it out, and narration read off the page sounds unnatural.

F-014 (2026-11-16, from a real video) What is built for one video and could serve another topic is made general and
usable from any session: the piece moves from the video folder into the kit, topic-free, with a demo from an
everyday subject and a page in docs/kit; SPEC.md and the skill say how to use it; and it is proven by making a
video of another topic from a session started elsewhere. This holds for the scene-code toolkit as a whole (the
"freedom version"), for the spoken forms, the second voice and the music.
Why: a capability that only one video folder can reach is lost to every other video.

F-015 (2026-11-18, from two real videos) The freedom version is the main way to make a video, from any session: a
video directed and designed for its topic, with its own scene code where a picture needs it. Nothing about a video
is fixed in advance, not the theme, not the flow, not the kinds of picture. The session that makes it decides from
what is at hand: the topic, how it is best explained, the level of the explanation, and whether that is done in
2D, in 3D or mixed. What the user states is followed exactly: "make it in 2D only" means 2D only, "don't use
Blender" means no Blender. The fixed templates stay as parts a director may pick, and as the cheap path when the
user asks for one.
Why: a video directed for its topic beat one made on a fixed theme and flow, which came out like every other.

## Template backlog

Kept in docs/backlog.md, so that a video session does not read it: add a wish that needs template, kit or engine
work there.
