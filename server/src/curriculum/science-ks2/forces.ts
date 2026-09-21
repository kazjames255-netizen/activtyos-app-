// KS2 Science — Forces & Magnets (Years 3 and 5). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Graph/number keys are recomputed by _check_s2.ts from _s2data.ts (the data that draws the images).
import type { CTopic } from "../types";

const MAG_ALT = "Three pairs of bar magnets, labelled A, B and C, with a gap between them. Each magnet is half red marked N and half blue marked S. In pair A the facing ends are S on the left and N on the right. In pair B the facing ends are N and N. In pair C the facing ends are S and S.";
const FRIC_ALT = "Bar chart of how far a toy car rolled after leaving a ramp. Sandpaper: 20 centimetres. Carpet: 45. Wood: 110. Smooth plastic: 150.";
const PARA_ALT = "A table of parachute drop times in seconds. Canopy width 10 centimetres: trials 1.1, 1.3 and 1.2. Canopy width 20 centimetres: trials 1.9, 2.1 and 2.0. Canopy width 30 centimetres: trials 2.7, 2.9 and 2.8. The means are 1.2 seconds for 10 centimetres and 2.0 seconds for 20 centimetres; the mean for 30 centimetres is shown as a question mark.";
const GEAR_ALT = "Three toothed gears in a row that mesh together: a small gear A on the left with 12 teeth, a large gear B in the middle with 24 teeth and a small gear C on the right with 12 teeth. A curved red arrow above A shows that it turns clockwise.";

export const TOPIC: CTopic = {
  key: "forces",
  topic: "Forces & Magnets",
  subject: "Science",
  years: {
    // ───────────────────────── YEAR 3 ─────────────────────────
    3: {
      year: 3,
      objectives: [
        "Compare how things move on different surfaces.",
        "Notice that some forces need contact between two objects, but magnetic forces can act at a distance.",
        "Observe how magnets attract or repel each other and attract some materials and not others.",
        "Compare and group together a variety of everyday materials on the basis of whether they are attracted to a magnet, and identify some magnetic materials.",
        "Describe magnets as having two poles, and predict whether two magnets will attract or repel each other, depending on which poles are facing.",
        "Working scientifically: make a fair test and read results from a bar chart.",
      ],
      note: {
        title: "Year 3: forces, friction and magnets",
        body: `## Pushes and pulls
A **force** is a push or a pull. Most forces need **contact**: you push a door, you pull a rope. **Magnetic forces** can act **at a distance**, without touching.

## Friction
**Friction** is a force that happens when two surfaces rub together. It **slows things down**. Rough surfaces have **more friction** than smooth ones. Friction is useful: it lets shoes grip the floor and brakes stop a bicycle.

**Worked example 1:** A ball rolled across long grass stops sooner than one rolled across a polished floor, because the grass has more friction.

## Magnets
- Magnets attract some materials. **Magnetic** materials are mostly **iron** and **steel** (also nickel and cobalt). Metals like copper, aluminium and gold are **not** magnetic. Wood, plastic and glass are not magnetic either.
- Every magnet has **two poles**: north (N) and south (S).
- **Different** poles (N and S) **attract**. **Same** poles (N and N, or S and S) **repel** (push apart).

| Poles facing | Result |
| --- | --- |
| N and S | Attract |
| S and N | Attract |
| N and N | Repel |
| S and S | Repel |

**Worked example 2:** You hold a magnet's S pole close to another magnet's S pole and feel a push. They repel.

**Worked example 3: sorting.** A steel screw sticks to a magnet, a brass key does not, and a pencil does not. Only the steel screw is magnetic.

**A fair test** changes only one thing. If you test surfaces, use the same ramp, the same toy and the same starting point each time.`,
      },
      quiz: {
        title: "Forces & Magnets: Year 3 quiz",
        questions: [
          { key: "forces-y3-01", kind: "single", prompt: "Which of these would a magnet pick up?", options: ["A steel paperclip", "A wooden spoon", "A plastic ruler", "A piece of aluminium foil"], answer: "A steel paperclip", explanation: "Steel contains iron, which is magnetic. Wood, plastic and aluminium are not.", difficulty: 1 },
          { key: "forces-y3-02", kind: "single", prompt: "Look at pair A of magnets. What will happen when they are moved close together?", options: ["They repel", "They attract", "Nothing", "They spin"], answer: "They attract", explanation: "The facing ends are S and N. Different poles attract.", difficulty: 2, image: { file: "forces-magnets.png", alt: MAG_ALT } },
          { key: "forces-y3-03", kind: "multi", prompt: "Look at the three pairs of magnets. Which TWO pairs will repel each other?", options: ["A", "B", "C", "None of them"], answer: ["B", "C"], explanation: "Pair B faces N with N and pair C faces S with S. Same poles repel. Pair A faces S with N, so it attracts.", difficulty: 3, image: { file: "forces-magnets.png", alt: MAG_ALT } },
          { key: "forces-y3-04", kind: "single", prompt: "Two north poles are brought close together. What will happen?", options: ["They attract", "They join and stick", "They repel", "Nothing happens"], answer: "They repel", explanation: "Same poles repel, so you feel a push apart.", difficulty: 1 },
          { key: "forces-y3-05", kind: "single", prompt: "What are the two ends of a magnet called?", options: ["Sides", "Edges", "Poles", "Points"], answer: "Poles", explanation: "A magnet has a north pole and a south pole.", difficulty: 2 },
          { key: "forces-y3-06", kind: "single", prompt: "Which force can act on an object without touching it?", options: ["Friction", "A push from a hand", "Magnetic force", "A pull with a rope"], answer: "Magnetic force", explanation: "Magnetic forces can act at a distance. Friction, pushes and pulls with a rope all need contact.", difficulty: 2, diagnostic: true },
          { key: "forces-y3-07", kind: "single", prompt: "A toy car rolled down a ramp onto four surfaces. Look at the chart. Which surface had the most friction?", options: ["Wood", "Smooth plastic", "Carpet", "Sandpaper"], answer: "Sandpaper", explanation: "More friction slows the car sooner. The car went the shortest distance on sandpaper (20 cm), so sandpaper had the most friction.", difficulty: 2, diagnostic: true, image: { file: "forces-friction.png", alt: FRIC_ALT } },
          { key: "forces-y3-08", kind: "number", prompt: "Look at the chart. How much further did the car roll on wood than on carpet? (Give your answer in cm.)", answer: 65, explanation: "Wood: 110 cm. Carpet: 45 cm. Subtract: 110 − 45 = 65.", difficulty: 2, image: { file: "forces-friction.png", alt: FRIC_ALT } },
          { key: "forces-y3-09", kind: "single", prompt: "Ava tests four surfaces with the same toy car. Which of these does she need to keep the same to make it a fair test?", options: ["The surface", "The height of the ramp", "The distance rolled", "Nothing"], answer: "The height of the ramp", explanation: "Only the surface should change. The ramp height must stay the same, and the distance rolled is what is measured.", difficulty: 3 },
          { key: "forces-y3-10", kind: "short", prompt: "What is the name of the force that slows things down when two surfaces rub together?", answer: "friction", accepted: ["Friction", "the friction", "friction.", "fricton", "frictoin", "friction force"], explanation: "Friction acts between surfaces that rub. It slows moving things.", difficulty: 1 },
        ],
      },
      flashcards: [
        { front: "What is a force?", back: "A push or a pull." },
        { front: "Friction", back: "A force between surfaces that rub together; it slows things down." },
        { front: "Which surfaces have more friction?", back: "Rough ones." },
        { front: "Magnetic materials", back: "Mostly iron and steel (also nickel and cobalt)." },
        { front: "Is aluminium magnetic?", back: "No." },
        { front: "Two ends of a magnet", back: "North and south poles." },
        { front: "Different poles…", back: "Attract." },
        { front: "Same poles…", back: "Repel." },
        { front: "Can magnetic forces act at a distance?", back: "Yes, without touching." },
        { front: "What is a fair test?", back: "Change one thing only; keep everything else the same." },
      ],
    },
    // ───────────────────────── YEAR 5 ─────────────────────────
    5: {
      year: 5,
      objectives: [
        "Explain that unsupported objects fall towards the Earth because of the force of gravity acting between the Earth and the falling object.",
        "Identify the effects of air resistance, water resistance and friction that act between moving surfaces.",
        "Recognise that some mechanisms, including levers, pulleys and gears, allow a smaller force to have a greater effect.",
        "Working scientifically: plan a fair test with variables, take repeat readings, calculate a mean and draw a conclusion.",
      ],
      note: {
        title: "Year 5: gravity, resistance and simple machines",
        body: `## Gravity
**Gravity** is a force that pulls objects towards the centre of the Earth. It is why things fall when you drop them. Weight is measured in **newtons (N)** with a force meter (a newtonmeter).

## Resistance forces
- **Air resistance** is friction from the air pushing against a moving object. A wide, flat shape has more air resistance. A **parachute** slows a fall.
- **Water resistance** is the same with water. **Streamlined** shapes push through with less resistance.
- **Friction** between surfaces slows things and can make heat. Rubber-soled boots grip better than smooth-soled ones.

## Simple machines
- **Levers** (a see-saw, a crowbar) turn around a **pivot**.
- **Pulleys** change the direction of a force and can make lifting easier.
- **Gears** are toothed wheels that mesh. Meshing gears turn in **opposite** directions. A small gear turns faster than a larger gear it drives.

**Worked example 1: gears.** A gear with 10 teeth drives a gear with 30 teeth. The big gear turns once for every 3 turns of the small one (30 ÷ 10 = 3).

**Worked example 2: a mean.** A ball is dropped three times through water and takes 2.4 s, 2.6 s and 2.2 s. The mean is (2.4 + 2.6 + 2.2) ÷ 3 = 7.2 ÷ 3 = 2.4 s.

**Worked example 3: heavier or lighter?** Two paper cones the same size are dropped, but one has coins inside. Gravity pulls harder on the heavy cone but the air resistance is about the same, so it falls faster.

**Working scientifically:** to compare fairly, change only one variable (the **independent** variable), measure one thing (the **dependent** variable) and keep all other **control** variables the same. Repeat and use the mean.`,
      },
      quiz: {
        title: "Forces & Magnets: Year 5 quiz",
        questions: [
          { key: "forces-y5-01", kind: "single", prompt: "Which force pulls objects towards the Earth?", options: ["Gravity", "Magnetism", "Friction", "Air resistance"], answer: "Gravity", explanation: "Gravity pulls things towards the centre of the Earth, so unsupported objects fall.", difficulty: 1 },
          { key: "forces-y5-02", kind: "single", prompt: "Which force acts upwards on a falling parachute and slows it down?", options: ["Gravity", "Magnetism", "Air resistance", "Sound"], answer: "Air resistance", explanation: "The canopy pushes against the air. The air pushes back, slowing the fall.", difficulty: 1 },
          { key: "forces-y5-03", kind: "number", prompt: "Look at the table. What is the mean drop time of the 30 cm parachute? (Give your answer in seconds.)", answer: 2.8, tolerance: 0.05, explanation: "Add the three trials: 2.7 + 2.9 + 2.8 = 8.4. Then divide by 3: 8.4 ÷ 3 = 2.8 s.", difficulty: 2, diagnostic: true, image: { file: "forces-parachute.png", alt: PARA_ALT } },
          { key: "forces-y5-04", kind: "single", prompt: "Look at the table. Which conclusion is best supported by the results?", options: ["Smaller canopies fall more slowly", "Canopy width makes no difference to how long the parachute takes to land","Bigger canopies fall more slowly, so they take longer to land", "The 20 cm canopy fell fastest"], answer: "Bigger canopies fall more slowly, so they take longer to land", explanation: "The mean time increases as the canopy width increases (1.2 s, 2.0 s, 2.8 s). A bigger canopy has more air resistance.", difficulty: 2, image: { file: "forces-parachute.png", alt: PARA_ALT } },
          { key: "forces-y5-05", kind: "single", prompt: "In the parachute test, which one thing did the pupils change on purpose (the independent variable)?", options: ["The drop height", "The stopwatch", "The width of the canopy", "The person dropping"], answer: "The width of the canopy", explanation: "The independent variable is the one thing you change. The drop height must stay the same to keep the test fair.", difficulty: 1, image: { file: "forces-parachute.png", alt: PARA_ALT } },
          { key: "forces-y5-06", kind: "single", prompt: "Look at the gears. Gear A turns clockwise. Which way does gear B turn?", options: ["Clockwise", "It does not turn", "It turns both ways", "Anticlockwise"], answer: "Anticlockwise", explanation: "Meshing gears always turn in opposite directions.", difficulty: 2, diagnostic: true, image: { file: "forces-gears.png", alt: GEAR_ALT } },
          { key: "forces-y5-07", kind: "single", prompt: "Two paper parachutes have the same size canopy. One carries a heavy load and one a light load. Which prediction is best?", options: ["Both fall at exactly the same speed, because the canopies are the same size so the air resistance is the same","The lighter one falls faster", "The heavier one falls faster, because gravity pulls harder while the air resistance is about the same", "The heavier one floats"], answer: "The heavier one falls faster, because gravity pulls harder while the air resistance is about the same", explanation: "Gravity pulls harder on a heavier load, but the same canopy gives about the same air resistance.", difficulty: 3 },
          { key: "forces-y5-08", kind: "number", prompt: "Look at the gears. How many times does gear A (12 teeth) turn while gear B (24 teeth) turns once?", answer: 2, explanation: "B has twice as many teeth as A, so A must turn 24 ÷ 12 = 2 times for B to turn once.", difficulty: 3, image: { file: "forces-gears.png", alt: GEAR_ALT } },
          { key: "forces-y5-09", kind: "single", prompt: "What do levers, pulleys and gears help us to do?", options: ["Make energy from nothing", "Let a smaller force have a greater effect", "Remove gravity", "Stop friction completely so nothing slows down"], answer: "Let a smaller force have a greater effect", explanation: "These machines make jobs easier. They do not create energy.", difficulty: 2 },
          { key: "forces-y5-10", kind: "multi", prompt: "Which TWO are examples where friction is useful?", options: ["Tyres gripping a wet road", "Brake pads slowing a bicycle wheel", "An ice skater gliding", "Oil making a hinge move smoothly"], answer: ["Tyres gripping a wet road", "Brake pads slowing a bicycle wheel"], explanation: "Friction helps tyres grip and brakes slow a wheel. Skating and oil are about reducing friction.", difficulty: 2 },
        ],
      },
      flashcards: [
        { front: "Gravity", back: "The force that pulls objects towards the centre of the Earth." },
        { front: "Unit of force", back: "The newton (N)." },
        { front: "Air resistance", back: "Friction from air pushing against a moving object; a parachute uses it to slow down." },
        { front: "Water resistance", back: "Friction from water; streamlined shapes have less." },
        { front: "Streamlined", back: "A smooth shape that moves through air or water with little resistance." },
        { front: "Meshing gears turn…", back: "In opposite directions." },
        { front: "Lever, pulley, gear", back: "Machines that let a smaller force have a greater effect." },
        { front: "Independent variable", back: "The one thing you change in an investigation." },
        { front: "Dependent variable", back: "The thing you measure." },
        { front: "How do you find a mean?", back: "Add the readings, then divide by how many there are." },
      ],
    },
  },
};
