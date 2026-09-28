# GRAPHICS OVERHAUL brief (owner request)

The arcade games now PLAY well. They must LOOK like real mobile games (Subway Surfers, Crossy Road, Alto's Adventure, Angry Birds, Cut the Rope), not a web app with a penguin on it. Do NOT change gameplay, difficulty, scoring or question logic. Art, animation and presentation only. Update each game IN PLACE at the same URL (read each game's current source with the Artifact tool first). Build ONE SHARED ART KIT first, then apply it game by game. Do Turbo Slide and Penguin Slide first as the quality bar and SHOW SCREENSHOTS BEFORE DOING THE REST (owner explicitly asked to review them first).

Games: Penguin Slide https://claude.ai/artifact/2NuCQAbUwta4BhgPrfZLiy; Turbo Slide https://claude.ai/artifact/9FaF5ULQTMNyLhswFzWUGo; Polar Dash https://claude.ai/artifact/UAtpCWkeMTCiAXRuogSfur; Grammar Runner https://claude.ai/artifact/E3qHddMA2w7vDqAkTL51eV; Sled Run https://claude.ai/artifact/1cTgMXbso1noB1uSoMiDnZ; Convoy Rush https://claude.ai/artifact/LsAzJFwoaB4U47Fby9djb8; Sinking Berg https://claude.ai/artifact/7A7ZEcpWSYwh9USkoKPvqQ; Line-Up https://claude.ai/artifact/8qrMNDobNHtCE3QY4zsDdh; Port Defence https://claude.ai/artifact/UBAF5UH4wEeLxuNQTdEoUK; Storm Night https://claude.ai/artifact/5QpzTCRRVx8rPEfdcLGNnA; Interrogation https://claude.ai/artifact/S46trde48ywWwpUg5nBLiJ.

## Problems seen at phone width (~375px)
1. Every game opens on the same navy card with pill buttons; the mascot is hidden behind the buttons; in two games the game art bleeds through the menu.
2. Play areas are flat single-colour fills with dashed lane lines: no depth, lighting, parallax or scenery.
3. Answers are rounded UI buttons, not in-world objects.
4. Pip is small and stiff: one pose, no animation states.
5. Canvas too small on phones; controls and HUD eat the screen; some text unreadably small.
6. No feeling of speed: nothing rushes past, no motion lines, no camera movement.

## Art direction (all games, one franchise look)
- Chunky, bright cartoon premium-mobile style. Thick dark outlines (3-4px, dark navy #14163a, not black), soft cel shading (one shadow tone + one highlight per shape), rim light, rounded forms.
- Palette per world, each with sky gradient, 3 depth tones, 1 accent: Ice (cyan/white/deep blue + gold), Aurora night (indigo/teal/magenta), Sunset harbour (peach/coral/navy), Storm (slate/teal/lightning yellow), Volcano/boss (charcoal/orange/red). (No green as a theme colour; semantic ticks only.)
- Canvas 2D, everything procedural (paths/gradients), or pre-render sprites to offscreen canvases at startup. Use devicePixelRatio for crisp retina rendering.
- Depth: 4+ parallax layers in every game (far sky/stars/aurora, mountains, mid scenery, near props, foreground particles); distant layers paler and bluer.
- Lighting: soft vignette, glows on important objects (the correct answer NEVER glows early; only glow player, pickups, boss), drop shadow under every grounded object.
- Nothing is ever still: snow/embers/bubbles drifting, flags waving, water shimmer, idle bobbing.

## Pip, the mascot (one reusable rigged character)
- Bigger (>= 18% of screen height in runner games), separate parts: body, belly, head, eyes, beak, flippers, feet, grad cap with tassel.
- Code-driven states: idle (breathing, blink every 3-5 s), run (feet cycle, body bob, flipper swing), lean left/right on lane change (tilt 15 deg, squash on landing), jump (stretch up, tuck, squash on landing), hurt (flash red-white, X eyes 300 ms, knock-back), celebrate (flippers up, bounce, cap flies up and falls back), sad (game over).
- Expressions change with combo (focused at x3; determined with fiery glow at x5). Tassel and scarf trail with spring secondary motion. Shop skins visibly change Pip (colours, hats, scarves, sleds, trails).

## In-world answers (no UI buttons during play)
Every answer is an object that belongs in that world with the answer painted/carved on it in a bold game font: ice blocks with frost edges, gates/arches, fish, crates, balloons, floating buoys, car roofs, lanterns, planks. Text >= 28px on a 375px screen, high contrast, outline or plate behind it.

## Speed and game feel
Speed lines and motion streaks scaling with speed. Camera: slight follow lag, zoom-out as speed rises, shake on hits, kick forward on a correct answer. Correct: object shatters into shards + gold sparkle burst + "+30 x3" pop text flying to the score + hit-stop 60 ms. Wrong: red vignette flash, crack/splat, Pip hurt, heart icon breaks and falls. Combo meter: a flame bar that grows; at x3 screen edges glow; at x5 a fire trail behind Pip and music pitches up. Boss entrances: screen darkens, boss slides in with a title card ("THE STORM TROLL!"), HP bar slams in.

## Menus and screens
- Title screen is a living scene from that game (e.g. Turbo Slide: the highway at dusk with cars zooming by, Pip revving). Big logo with 3D bevel, drop shadow, subtle bounce. Pip visible and animated, never behind buttons.
- Chunky 3D game buttons (face + darker bottom edge that depresses on press, bounce on hover) with icons; PLAY biggest; dark text on yellow buttons (never white on yellow).
- Results: stars fly in one at a time with a sound, score counts up, "NEW BEST!" ribbon, confetti, Pip celebrating or sad.
- Transitions: quick wipe (snowflake iris or slide) between screens; no hard cuts.
- Fonts: chunky display font for titles and numbers ("Lilita One" or "Fredoka" via Google Fonts, system fallback) + readable font for small text.

## Layout (phones first)
Play area fills >= 75% of screen height on 375x812. HUD is a slim overlay on the game, not a separate block. Touch controls are invisible zones (tap left/right half, swipe) with small translucent hints, not giant buttons. No horizontal scroll. Test at 360x740, 375x812, 768x1024, 1280x800.

## Performance and accessibility
Steady 60 fps on a mid-range phone; cap particles (~150), pool objects, pre-render static layers. prefers-reduced-motion: tone down shake, flashes, parallax speed. Colour never the only signal (add tick/cross icon and a sound).

## Also fix while in there
- Calm mode must be OFF by default (it is ON in Turbo Slide, Storm Night and Interrogation).
- Interrogation: PLAY did not start the game on two clicks. Fix it.
- Sinking Berg: after pressing PLAY the pans stayed empty 4+ seconds with no equation. Fix it or show a "Ready... GO!" countdown.
- Polar Dash: the menu overlaps the DUCK/JUMP pads at phone width and the pads take half the screen. Shrink them to invisible tap zones.

## Definition of done (each game)
Screenshots of title, gameplay (early and high-speed), a boss and the results at 375x812 and 1280x800. Confirm: a stranger would think it's a real app-store game; no flat single-colour area > 20% of the screen; >= 4 parallax layers visible and moving; answers are in-world objects readable at arm's length; Pip animated in every listed state; correct and wrong answers each have a distinct satisfying effect; 60 fps, no console errors, calm mode off by default. Show the owner screenshots after Turbo Slide and Penguin Slide BEFORE continuing.

Guardrails still apply: never mention Oak; no green theme colour; no random/paid rewards; no chat; no public ranking; no external requests except Google Fonts.
