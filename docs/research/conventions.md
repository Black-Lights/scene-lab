# Research: conventions (2026-11-14, v0.2 sweep)

SEQUENCE (protocols, multi-agent)
1. Time runs top to bottom, with one column per party. RFC 8446 Fig. 1 puts Client on the left and Server on the right, earlier messages higher, and arrow direction gives the sender. https://www.rfc-editor.org/rfc/rfc8446#section-2
2. Lamport's space-time diagram runs the other way: time goes up, processes are vertical lines, events are dots and messages are wavy lines. Use it only for a "happened-before" or clock story, and say so on screen. https://www.cs.princeton.edu/courses/archive/fall15/cos518/papers/time-clocks.pdf
3. Each participant gets a head (a rectangle with its name) and a lifeline under it that may be dashed. An X at the bottom ends a lifeline. https://www.uml-diagrams.org/sequence-diagrams.html
4. Activation bars are thin rectangles on the lifeline. Nested or overlapping bars show callbacks or self-calls. https://www.uml-diagrams.org/sequence-diagrams.html
5. Arrow semantics: a synchronous call has a filled head, an async message has an open head, and a reply (also a create) is a dashed line with an open head. A lost message ends in a black dot, a found message starts from one. https://www.uml-diagrams.org/sequence-diagrams-reference.html
6. Mermaid uses the same vocabulary, so it can serve as the spec grammar. Solid `->>` vs dotted `-->>`, async `-)`, a cross for failure `-x`, bidirectional `<<->>`, activation with `+`/`-`, `Note over A,B`, the fragments `loop/alt/opt/par/critical/break`, shaded `rect` regions, `autonumber`, and `box` to group participants. https://mermaid.js.org/syntax/sequenceDiagram.html
7. Mark encryption by how the label is wrapped and keep the arrow style for call semantics. RFC 8446: `{}` means encrypted under handshake keys, `[]` means under application keys, `*` means optional and `+` means a notable extension. A bidirectional arrow shows Application Data flowing both ways. For video, use a fill or lock tint per key phase plus the bracket glyph in the label. https://www.rfc-editor.org/rfc/rfc8446#section-2
8. Show protocol phases as labelled brackets on the left edge. RFC 8446 brackets Key Exchange, Server Parameters and Authentication. Count round trips by grouping each there-and-back pair. https://www.rfc-editor.org/rfc/rfc8446#section-2
9. Multi-agent: lifelines are agent roles, not instances, and message labels are performatives (cfp, propose, accept). AUML adds role threads, nesting, guards and cardinalities. Plain UML sequence diagrams cannot express FIPA Contract Net's multicast well, so draw one-to-many as a fan of arrows with an "×n" label. https://typeset.io/pdf/representing-agent-interaction-protocols-in-uml-vl7k5eq3s1.pdf ; https://arxiv.org/html/1109.5732
10. Cloudflare's TLS 1.3 post: its figures are images, and their colours and icons could not be checked from the text. Treat them as a visual reference only. https://blog.cloudflare.com/rfc-8446-aka-tls-1-3/

DIAGRAM (systems)
1. Give every diagram a title stating its type and scope, plus a key for the notation. https://c4model.com/diagrams/notation
2. Show each element's type and a short description of its responsibility. Containers and components also carry their technology. https://c4model.com/diagrams/notation
3. One line means one unidirectional relationship. Its label must match the arrow's direction and intent ("sends order to", never just "uses"). Container-to-container lines name the protocol. https://c4model.com/diagrams/notation
4. C4 prescribes no shapes or colours. Keep colour coding consistent and safe for colour-blind viewers. https://c4model.com/diagrams/notation
5. Data-flow diagrams: an external entity is a rectangle and a process is a rounded rectangle with an ID and a verb-noun name. A data store is the third shape, and a flow is an arrow named for the data it carries. Every flow starts or ends at a process, so no flow runs store to store, entity to entity, or between an entity and a store directly. https://www.visual-paradigm.com/guide/data-flow-diagram/what-is-data-flow-diagram/
6. Signal-flow and block diagrams: blocks are transfer functions and arrows give signal direction. A summing junction is a circle with a sign at each input. A takeoff point copies a signal undiminished, and feedback returns from a takeoff to a summing junction (a minus sign means negative feedback). https://en.wikibooks.org/wiki/Control_Systems/Block_Diagrams ; https://www.electrical4u.com/block-diagrams-of-control-system/
7. Use one main flow direction per diagram (rankdir LR for pipelines, TB for hierarchies). Feedback edges run against it, which makes the loop readable. https://github.com/dagrejs/dagre/wiki
8. Draw grouping boundaries (system, trust zone) as labelled enclosing rectangles behind the nodes. C4's notation page gives no boundary rule, so this is a house rule. https://c4model.com/diagrams/notation

PLOT
1. Data-ink: show the data, maximize the share of ink that carries data, erase non-data ink and redundant data ink "within reason", then revise. https://faculty.cc.gatech.edu/~stasko/7450/13/Notes/tufte.pdf ; https://www.holistics.io/blog/data-ink-ratio/
2. Avoid legends because "Legends always put an extra mental burden on the reader." Put each series name at the end of its line. https://clauswilke.com/dataviz/redundant-coding.html
3. Do not rely on colour alone. Use a light tint for fills and a darker shade of the same hue for the line and its label text. https://clauswilke.com/dataviz/redundant-coding.html
4. If you must order labels, follow the visual order of the data, never alphabetical order. https://clauswilke.com/dataviz/redundant-coding.html
5. Log axes: the title names the variable (not "log of" it), ticks show original values at equal multiplicative steps, and the base is stated. Zero cannot appear, so use a square-root scale if zeros matter. Use log for data spanning magnitudes or for ratios. https://clauswilke.com/dataviz/coordinate-systems-axes.html
6. When both axes share units, use equal grid spacing. https://clauswilke.com/dataviz/coordinate-systems-axes.html
7. Animate in a fixed order: axes first, then the curve stroke drawn progressively (Manim's Create "incrementally show[s]" a path), then the end label and any on-curve annotation. Log axes in Manim need x_min > 0. https://docs.manim.community/en/stable/reference/manim.animation.creation.Create.html ; https://docs.manim.community/en/stable/reference/manim.mobject.graphing.coordinate_systems.Axes.html
8. Put annotations at the data point (a dot, a short leader line and text) instead of in a caption or legend. Direct labelling is also PolicyViz's argument. https://policyviz.com/2024/01/11/graph-labeling-strategies/
9. Our World in Data: its own documentation on end-of-line labels or animation could not be found, and the Grapher docs page says it is out of date. https://ourworldindata.org/owid-grapher

LAYOUT LIBRARIES
- @dagrejs/dagre 3.1.3 (2026-10-24), MIT, about 1.4 MB unpacked, depends on @dagrejs/graphlib 4.0.6. https://registry.npmjs.org/@dagrejs/dagre/latest ; https://registry.npmjs.org/@dagrejs/dagre
  - `dagre.layout(g)` is synchronous. Nodes take width and height; edges take width and height for their label, plus labelpos l/c/r and labeloffset. It returns node centres, edge `points` and the edge label centre x/y. Graph options are rankdir, nodesep, edgesep and ranksep. https://github.com/dagrejs/dagre/wiki
  - It is actively released: 3.0.0 in March 2026, 3.1.x from August to October 2026.
- elkjs 0.12.1 is licensed EPL-2.0 OR GPL-3.0-or-later (flag) and is about 8.2 MB unpacked. https://registry.npmjs.org/elkjs/latest
  - There is no synchronous API. `layout()` returns a Promise, and even the in-thread fallback resolves through setTimeout. https://github.com/kieler/elkjs ; https://raw.githubusercontent.com/kieler/elkjs/master/src/js/elk-api.js
  - It would only work if run ahead of time in make.py and passed in as props.
- d3-dag: latest dist-tag is 1.3.0 and the licence is MIT (shown on GitHub). Its release date and maintenance status could not be confirmed. https://registry.npmjs.org/d3-dag ; https://github.com/erikbrinkman/d3-dag
  - Its dagre-compatible API ignores edge labels.
- d3-force is deterministic: the default random source is a fixed-seed LCG, unset positions start in a phyllotaxis arrangement, and `stop()` plus `tick(n)` computes a static layout inline. https://d3js.org/d3-force/simulation
  - It has no layers or direction, so it is wrong for flow diagrams. Its version and licence were not checked.
- graphology: ForceAtlas2 runs synchronously for a fixed number of iterations. Its documentation does not say whether the result is deterministic, and its layout module lists only random and circular layouts, so no layered layout was confirmed. Licence not checked. https://graphology.github.io/standard-library/layout-forceatlas2.html

RECOMMENDATION: @dagrejs/dagre 3.1.3 (MIT). It is the only candidate that is synchronous, layered and directional, and it returns edge label positions from label sizes you give it. Measure text with fixed font metrics rather than the DOM. https://github.com/dagrejs/dagre/wiki
