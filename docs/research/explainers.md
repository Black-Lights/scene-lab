# Research: explainers (2026-11-14, v0.2 sweep)

3BLUE1BROWN / MANIM
- Stated rules: "Every movement on the screen should be deliberate, with an identifiable purpose." Visuals make the same point as the narration and do not compete with it. Examples come before abstraction, and definitions are "an ending point". https://www.3blue1brown.com/faq
- The core primitive is Transform. It "transforms a Mobject into a target Mobject", and path_arc lets the points travel along an arc. So the next idea grows out of the object already on screen, with no cut. https://docs.manim.community/en/stable/reference/manim.animation.transform.Transform.html
- From his own demo (summary built from auto-captions): the number of colours comes from the number of states, set as a gradient. He uses either clearly different hues or shades of one hue, and dislikes red as the second colour. Equations are coloured by substring, so a variable matches its picture. Context fades to opacity 0 and is not deleted. Equations are shrunk, given a backstroke and parked in a corner. He works in 2D by default ("Only go up to 3D if you really need to"). The camera pans to a saved frame. Motion is eased by default and linear when the real dynamics must show. https://rosetta.to/u/3blue1brown/how-i-animate-3blue1brown-a-manim-demo-with-ben-sparks
- Do NOT copy: the blue/brown identity (https://www.3blue1brown.com/faq). From watching the videos: the near-black background, the pi creatures, and the manim default palette with LaTeX everywhere.

KURZGESAGT
- About a dozen script drafts come first. A sketch phase then picks a visual metaphor for each scene. Narration is recorded first and sets the timing. https://kurzgesagt.org/youtube/
- They "try to think of visual metaphors [and] transitions between ideas". About 200 Illustrator panels per video, every moving thing moved by hand, music composed "to highlight the important parts". https://rosetta.to/u/kurzgesagt/how-to-make-a-kurzgesagt-video-in-1200-hours
- Do NOT copy: the "minimalistic, flat" vector look (https://en.wikipedia.org/wiki/Kurzgesagt), the "quirky and relatable characters" trademark (https://kurzgesagt.org/youtube/), and (observed) glowing saturated space gradients and birds.

PRIMER (Justin Helps)
- Built with primerpython, a Blender library whose "structure comes from manim". The repo is archived (Jan 2026). https://github.com/Helpsypoo/primer
- Observed, no primary write-up found: the narration states the rules, a simulation runs on screen, and the result emerges while the viewer watches. Charts beside the simulation reuse the simulation's colours.
- Do NOT copy (observed): soft blob creatures with eyes, pastel 3D.

BARTOSZ CIECHANOWSKI
- Each demo isolates one idea, and complexity builds in order: disc, coupled discs, torque, gears, tooth profiles, gear trains. Real-world complications such as backlash come last. https://ciechanow.ski/gears/
- Colour encodes role throughout (yellow drives, green is driven). Colour names in the prose are bolded to match the figure. Symbols sit next to their objects, and arrow length tracks the quantity. Time can be scrubbed: "controlling the time back and forth with a slider". Same URL.
- Commenters (not the author) say he hand-codes WebGL. https://news.ycombinator.com/item?id=31261533
- Do NOT copy (observed): his light-grey, softly lit 3D renders.

DISTILL
- Explanation is not polish: "good explanations often involve transforming the idea". Notation and visualisations are "the user interface of research". The explainer does the interpretive labour once so every viewer does not have to. https://distill.pub/2017/research-debt/
- Its aim is "Clear, Dynamic and Vivid", and "Reactive diagrams allow for a type of communication not possible in static mediums." https://distill.pub/about/
- The author guide covers mechanics only: "draw a static diagram, tag elements of your diagram with classes or ids, and then manipulate them". In other words, author the figure once and animate its parts. https://distill.pub/guide/
- Animation is effective for "state transitions", uncertainty, causality and narrative. Words plus pictures beat either alone, and narration and graphics should complement each other, not duplicate. Segmenting helps learners. Asking for a prediction before the reveal works. https://distill.pub/2020/communicating-with-interactive-articles/
- Do NOT copy: the article template's gutter and marginalia layout (https://distill.pub/guide/).

OTHERS
- Branch Education: "Engineering is three-dimensional." They rebuild chips and PCBs "in photorealistic 3D", "reconstructing complex physical systems from first principles", and check details against manuals, patents and real hardware. https://www.branch.education/ Observed: the camera zooms from the device into a cutaway of the part. Do NOT copy the photoreal cutaway with glowing paths.
- Reducible: built wholly on manim (https://github.com/nipunramk/Reducible). It shows the transform grammar carries computer science topics, but it also shows how easily the result reads as a 3b1b lookalike.
- Steve Mould: "The 'ah-ha' moment is more important than the 'ha-ha' moment." https://labnews.co.uk/the_art_of_taking_things_apart/
- Our World in Data: shows "multiple discrete graphics rather than overlaying multiple lines", "the source of the data is always displayed prominently", and detail sits behind "Learn more". https://ourworldindata.org/redesigning-our-interactive-data-visualizations

PRINCIPLES FOR THIS ENGINE
1. One persistent stage per chapter. The main object stays on screen and the next scene changes it (morph, recolour, add parts). A hard cut only marks a new chapter.
2. Every motion is tied to a narration cue in the spec. Motion is allowed only for a state change, a cause and effect, or pointing attention. Nothing moves idly, and the background is static, which also protects the 2.85 MB part budget.
3. Colour means role, fixed for the whole video. The spec declares a role map (for example input, output, the changing quantity) with at most 3 role hues plus neutrals. Extra states are shades of one hue. Caption keywords, labels and shapes share the role colour.
4. Labels sit on or beside their object, in its role colour. No legends. Readouts and equations go in a corner on a backing plate.
5. Concrete before abstract. A worked example scene comes before any definition or formula, and a definition or title card closes a chapter.
6. One through-line metaphor per video, declared in the spec. Every analogy has a mapping beat: analogy part next to real part, same role colour, then the analogy fades and the real mechanism stays.
7. Build by addition. Start with the simplest model and add one element per scene. Earlier elements dim to about 30% and are never deleted.
8. Timing: ease in and out for conceptual moves, linear for real dynamics (simulations, time scrubs). Hold still for at least 1.5 s after each reveal.
9. The camera moves only to change scale (zoom into a part, pull back to context), slowly and eased. 2D by default, 3D only when depth is the idea.
10. The thing being explained fills about 70% of the frame. Chrome (title, progress bar, caption band) stays small, neutral and still.
11. The visual shows what words cannot (shape, motion, quantity). On-screen text never repeats the caption. Ask a question, hold, then run the mechanism.
12. Data uses direct labels, small multiples instead of overlaid lines, and a visible source line. The palette comes from the topic, never a borrowed signature (no near-black blue/brown, flat glowing space, blobs or Distill margins).
