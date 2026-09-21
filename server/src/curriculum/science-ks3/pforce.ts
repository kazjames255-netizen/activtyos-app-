// KS3 Science — Physics: Forces & Motion (Y8 speed, distance–time graphs, pressure, moments; Y9 Newton's laws, weight, springs).
// Original content aligned to the DfE KS3 programme of study (OGL v3.0). Calculation keys are recomputed by _check_s3.ts.
import type { CTopic } from "../types";
import { IMG } from "./_img";
import { sg, nm, build } from "./_h";

export const TOPIC: CTopic = {
  key: "pforce",
  topic: "Physics — Forces & Motion",
  subject: "Science",
  years: {
    8: {
      year: 8,
      subtopic: "Year 8: speed, pressure and moments",
      objectives: [
        "Speed and the quantitative relationship between average speed, distance and time (speed = distance ÷ time).",
        "The representation of a journey on a distance–time graph.",
        "Pressure in fluids and on solids (pressure = force ÷ area); atmospheric pressure decreases with height.",
        "Moments as the turning effects of forces; the equilibrium of a balanced beam.",
      ],
      note: {
        title: "Year 8: speed, pressure and moments",
        body: `## Speed and distance–time graphs

speed = distance ÷ time. Units: m/s, km/h. On a **distance–time graph**:
- a **horizontal** line means the object is **stationary**;
- a **straight sloping** line means **constant speed**, and the **steeper** the line the faster it is;
- speed = the gradient (rise ÷ run).

## Pressure

pressure = force ÷ area. Units: newtons per square metre (N/m²), called pascals. The same force on a **smaller area** gives a **larger pressure**, which is why spikes and knives work. **Atmospheric pressure** is caused by the weight of the air above, so it is lower at high altitude.

## Moments

A **moment** is the turning effect of a force: moment = force × perpendicular distance from the pivot (N m). If a beam is balanced, **clockwise moments = anticlockwise moments**.

## Worked examples

A train travels 240 km in 3 h: speed = 240 ÷ 3 = **80 km/h**.
A force of 140 N on 4.0 m²: pressure = 140 ÷ 4.0 = **35 N/m²**.
A 30 N force acts 0.5 m from a pivot: moment = 30 × 0.5 = **15 N m**.`,
      },
      quiz: {
        title: "Speed, Pressure & Moments: Year 8 quiz",
        questions: build("pforce", 8, [
          nm("Look at the distance–time graph. What is the cyclist's speed during the first 20 seconds, in m/s?", 5, "Speed = distance ÷ time = 100 m ÷ 20 s = 5 m/s.", 1, { img: IMG.dt }),
          sg("Look at the distance–time graph. What is the cyclist doing between 20 s and 40 s?", "Stationary (not moving)", ["Moving at a steady speed", "Speeding up", "Moving backwards"], "The line is horizontal, so the distance from the start is not changing. The cyclist is at rest.", 1, { img: IMG.dt }),
          sg("Look at the distance–time graph. During which time is the cyclist moving fastest?", "40 s to 60 s", ["0 s to 20 s", "60 s to 100 s", "20 s to 40 s"], "The steepest section has the greatest speed: 200 m in 20 s is 10 m/s, faster than the other sections.", 2, { img: IMG.dt }),
          nm("Look at the distance–time graph. The cyclist rides out and then returns to the start. What total distance does the cyclist travel in the 100 seconds, in metres?", 600, "Out: 300 m. Back: 300 m. Total distance travelled = 300 + 300 = 600 m (distance is not the same as distance from the start).", 3, { img: IMG.dt }),
          sg("Why is atmospheric pressure lower at the top of a mountain?", "There is less air above pushing down", ["The air is hotter", "Gravity is much stronger", "The air is denser at the top"], "Atmospheric pressure comes from the weight of the air above, and there is less air above at height.", 2),
          nm("A car travels 150 km in 2.5 hours. What is its average speed in km/h?", 60, "Speed = distance ÷ time = 150 ÷ 2.5 = 60 km/h.", 1, { d: true }),
          nm("A force of 600 N acts on an area of 0.03 m². What is the pressure in N/m²?", 20000, "Pressure = force ÷ area = 600 ÷ 0.03 = 20 000 N/m².", 2, { d: true }),
          sg("Why does a sharp knife cut better than a blunt one, for the same force?", "The force acts on a smaller area, so the pressure is greater", ["The force is greater with a sharp knife", "The knife is heavier when it is sharp", "The pressure is smaller, so less effort is needed"], "Pressure = force ÷ area, so a smaller area gives a larger pressure.", 2),
          nm("Look at the balanced beam. What is the moment, in N m, of the 40 N force about the pivot?", 12, "Moment = force × distance from the pivot = 40 × 0.30 = 12 N m.", 2, { img: IMG.moments }),
          nm("Look at the balanced beam. What force, in N, must act 0.60 m to the right of the pivot to balance it?", 20, "For balance, clockwise moment = anticlockwise moment: F × 0.60 = 12, so F = 12 ÷ 0.60 = 20 N.", 3, { img: IMG.moments }),
        ]),
      },
      flashcards: [
        { front: "Speed formula", back: "speed = distance ÷ time." },
        { front: "Horizontal line on a distance–time graph", back: "Stationary." },
        { front: "Steeper line on a distance–time graph", back: "Faster speed." },
        { front: "Gradient of a distance–time graph", back: "Speed." },
        { front: "Pressure formula and unit", back: "pressure = force ÷ area; N/m² (pascal)." },
        { front: "Why do spikes exert a large pressure?", back: "Small area for the same force." },
        { front: "Why is atmospheric pressure less on a mountain?", back: "Less air above." },
        { front: "Moment formula", back: "moment = force × perpendicular distance from the pivot (N m)." },
        { front: "Balanced beam condition", back: "Clockwise moments = anticlockwise moments." },
        { front: "Distance versus distance from start", back: "Distance travelled adds all the movement; distance from start can go back to zero." },
      ],
    },
    9: {
      year: 9,
      subtopic: "Year 9: forces and Newton's laws",
      objectives: [
        "Forces as pushes or pulls arising from the interaction between two objects; using force arrows in diagrams; resultant forces.",
        "Balanced and unbalanced forces and their effect on motion (Newton's first law); an introduction to Newton's second law.",
        "Forces between interacting objects come in pairs (Newton's third law).",
        "Weight = mass × gravitational field strength; forces associated with deforming objects; stretching and squashing springs (extension is proportional to force).",
      ],
      note: {
        title: "Year 9: forces and Newton's laws",
        body: `## Resultant force

Forces are drawn as arrows. The **resultant force** is the single force that has the same effect as all the forces acting. In a straight line, add forces in the same direction and subtract opposite ones.

## Newton's laws

1. If the resultant force on an object is **zero**, it stays at rest or keeps moving at a constant velocity.
2. A **non-zero resultant force** makes an object accelerate in the direction of the force: **F = m × a** (force in N, mass in kg, acceleration in m/s²).
3. When object A pushes on object B, B pushes back on A with an **equal and opposite force**. The two forces act on **different objects**.

## Weight

Weight is a force: **weight = mass × gravitational field strength (g)**. On Earth g ≈ 10 N/kg. On the Moon g ≈ 1.6 N/kg. Mass does not change with place; weight does.

## Springs

For a spring, the extension is **directly proportional** to the force applied (Hooke's law), up to the **limit of proportionality**. Beyond it the graph curves.

## Worked examples

A 45 kg student on Earth: weight = 45 × 10 = **450 N**.
A 900 N drive force and 250 N friction: resultant = 900 − 250 = **650 N**.
A 15 N force on a 5 kg trolley: a = 15 ÷ 5 = **3 m/s²**.`,
      },
      quiz: {
        title: "Forces & Newton's Laws: Year 9 quiz",
        questions: build("pforce", 9, [
          nm("Look at the force diagram. What is the resultant force on the box in the horizontal direction, in newtons?", 300, "Subtract the opposite forces: 500 N − 200 N = 300 N in the direction of the driving force.", 1, { d: true, img: IMG.forces }),
          sg("Look at the force diagram. What is the box doing?", "Accelerating in the direction of the driving force", ["Moving at a constant speed in the direction of the driving force", "Slowing down, because the drag is acting against the motion", "Stationary, because the vertical forces are balanced"], "The horizontal forces are unbalanced, and the resultant is forwards, so it accelerates forwards. Vertical forces balance.", 2, { d: true, img: IMG.forces }),
          nm("Look at the force diagram. The driver changes the driving force so that the box moves at constant speed. The drag stays the same. What driving force is needed, in newtons?", 200, "Constant speed means the resultant is zero, so the driving force must equal the drag: 200 N.", 2, { img: IMG.forces }),
          nm("What is the weight, in newtons, of a person with a mass of 70 kg on Earth? (g = 10 N/kg)", 700, "Weight = mass × g = 70 × 10 = 700 N.", 1),
          nm("An astronaut has a mass of 80 kg. What is her weight on the Moon, where g = 1.6 N/kg, in newtons?", 128, "Weight = mass × g = 80 × 1.6 = 128 N. Her mass is still 80 kg.", 2),
          sg("The Earth pulls a book downwards (its weight). What is the other force in this Newton's third law pair?", "The book pulls the Earth upwards with an equal force", ["The table pushes the book upwards with an equal force", "Air resistance pushes the book upwards with an equal force", "The book pushes down on the table with an equal force"], "A third law pair acts on different objects and is the same type of force. The table's push is a different pair.", 3),
          sg("Look at the graph of a spring. What is the extension when a force of 6 N is applied?", "3 cm", ["2 cm", "4 cm", "6 cm"], "Find 6 N on the force axis, go across to the point and down to read 3 cm.", 1, { img: IMG.spring }),
          sg("Look at the graph of the spring. For which forces is the extension directly proportional to the force?", "0 to 10 N", ["0 to 4 N", "0 to 8 N", "0 to 12 N"], "The first six points lie on a straight line through the origin, up to 10 N. The point at 12 N is below that line.", 2, { img: IMG.spring }),
          nm("A car with a mass of 1200 kg accelerates at 2.5 m/s². What is the resultant force on the car, in newtons?", 3000, "F = m × a = 1200 × 2.5 = 3000 N.", 3),
          sg("Students pull a wooden block along different surfaces using a newtonmeter to measure friction. What is the independent variable?", "The type of surface", ["The reading on the newtonmeter", "The mass of the block", "The speed of pulling"], "The independent variable is the one you change on purpose. The newtonmeter reading is what you measure, and the mass and speed are controlled.", 2, { d: false }),
        ]),
      },
      flashcards: [
        { front: "Resultant force", back: "The single force with the same effect as all the forces together." },
        { front: "Newton's first law", back: "If the resultant force is zero, an object stays at rest or keeps moving at constant velocity." },
        { front: "Newton's second law (equation)", back: "F = m × a (newtons, kilograms, m/s²)." },
        { front: "Newton's third law", back: "Forces come in equal and opposite pairs that act on different objects." },
        { front: "Weight formula", back: "weight = mass × gravitational field strength." },
        { front: "g on Earth and on the Moon", back: "About 10 N/kg on Earth; about 1.6 N/kg on the Moon." },
        { front: "Mass or weight: which changes with location?", back: "Weight (mass stays the same)." },
        { front: "Hooke's law", back: "Extension is directly proportional to the force, up to the limit of proportionality." },
        { front: "What does constant speed tell you about forces?", back: "The resultant force is zero: forces are balanced." },
        { front: "Friction and air resistance act…", back: "In the direction opposite to motion." },
      ],
    },
  },
};
