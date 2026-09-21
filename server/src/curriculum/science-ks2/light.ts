// KS2 Science — Light (Years 3 and 6). Original content aligned to the DfE National Curriculum (OGL v3.0).
// Graph/number keys are recomputed by _check_s2.ts from _s2data.ts (the data that draws the images).
import type { CTopic } from "../types";

const SHADOW3_ALT = "Bar chart of shadow height against the toy's distance from the torch. At 15 centimetres the shadow is 40 centimetres tall, at 20 it is 30, at 30 it is 20, at 40 it is 15 and at 50 it is 12. The shadow gets shorter as the toy moves away from the torch.";
const SEE_ALT = "Four panels, A to D, each showing a lamp, a ball and an eye. A: an arrow goes straight from the lamp to the eye and the ball has no arrows. B: an arrow goes from the eye to the ball. C: an arrow goes from the lamp to the ball, and another arrow goes from the ball to the eye. D: an arrow goes from the lamp to the ball and stops there.";
const SHADOW6_ALT = "A side-on diagram. A small lamp on the left sends two straight orange rays past the top and bottom of a short blue object, and on to a screen on the right. The distance from the lamp to the object is 8 centimetres, the distance from the lamp to the screen is 24 centimetres, and the object is 4 centimetres tall.";

export const TOPIC: CTopic = {
  key: "light",
  topic: "Light",
  subject: "Science",
  years: {
    // ───────────────────────── YEAR 3 ─────────────────────────
    3: {
      year: 3,
      objectives: [
        "Recognise that they need light in order to see things and that dark is the absence of light.",
        "Notice that light is reflected from surfaces.",
        "Recognise that light from the sun can be dangerous and that there are ways to protect their eyes.",
        "Recognise that shadows are formed when the light from a light source is blocked by an opaque object.",
        "Find patterns in the way that the size of shadows change.",
      ],
      note: {
        title: "Year 3: light, reflection and shadows",
        body: `## Light and seeing
We see things because **light** enters our eyes. Where there is no light at all, it is **dark** and we cannot see. A **light source** makes its own light, such as the Sun, a lamp or a candle flame. The Moon is **not** a light source: it only reflects light from the Sun.

## Reflection
Light bounces off surfaces. Shiny surfaces such as mirrors and metal foil reflect a lot of light. This is why cyclists wear reflective strips: car headlights bounce back to the driver.

## Keeping safe in the Sun
Never look directly at the Sun, even with sunglasses. Wear a sun hat, sunglasses and sun cream, and stay in the shade at midday.

## Shadows
A shadow forms when an **opaque** object (one that light cannot pass through) blocks the light.

| Material type | Light passes through? | Example |
| --- | --- | --- |
| Transparent | Yes, all of it | Clear glass |
| Translucent | Some | Tissue paper |
| Opaque | No | Wood, metal |

**Worked example 1:** A puppet is held between a lamp and a wall. It blocks the light, so a dark shape appears on the wall.

**Worked example 2: a pattern.** A puppet 12 cm from the lamp makes a big shadow. At 24 cm the shadow is smaller. The pattern: the **closer** the object is to the light source, the **bigger** the shadow.

**Worked example 3:** A shadow of an umbrella is darker than a shadow of a sheet of greaseproof paper, because the umbrella is opaque and the paper is only translucent.`,
      },
      quiz: {
        title: "Light: Year 3 quiz",
        questions: [
          { key: "light-y3-01", kind: "single", prompt: "Which of these is a light source?", options: ["A mirror", "The Moon", "A candle flame", "A white wall"], answer: "A candle flame", explanation: "A light source makes its own light. The Moon and mirrors only reflect light.", difficulty: 1 },
          { key: "light-y3-02", kind: "single", prompt: "Why can we not see anything in a completely dark room?", options: ["There is no light to enter our eyes", "Our eyes only work when it is daytime outside","The objects disappear", "Light is a solid"], answer: "There is no light to enter our eyes", explanation: "We see when light gets into our eyes. Dark means there is no light.", difficulty: 1 },
          { key: "light-y3-03", kind: "single", prompt: "How is a shadow formed?", options: ["Light bends around the object", "An opaque object blocks the light", "A transparent object reflects it", "The colour of the object makes it"], answer: "An opaque object blocks the light", explanation: "Light cannot pass through an opaque object, so the space behind it is dark. That dark shape is the shadow.", difficulty: 2, diagnostic: true },
          { key: "light-y3-04", kind: "single", prompt: "Which material would make the darkest shadow?", options: ["Clear plastic", "Tracing paper", "Thick cardboard", "Cling film"], answer: "Thick cardboard", explanation: "Cardboard is opaque and blocks nearly all the light. The others let light through.", difficulty: 1 },
          { key: "light-y3-05", kind: "number", prompt: "Look at the chart. How tall is the shadow when the toy is 30 cm from the torch? (Give your answer in cm.)", answer: 20, explanation: "Find 30 on the bottom axis, then read the height of the bar: 20 cm.", difficulty: 2, diagnostic: true, image: { file: "light-shadow3.png", alt: SHADOW3_ALT } },
          { key: "light-y3-06", kind: "number", prompt: "The toy is moved from 20 cm to 40 cm from the torch. By how many centimetres does its shadow become shorter?", answer: 15, explanation: "At 20 cm the shadow is 30 cm tall and at 40 cm it is 15 cm. So 30 − 15 = 15.", difficulty: 3, image: { file: "light-shadow3.png", alt: SHADOW3_ALT } },
          { key: "light-y3-07", kind: "single", prompt: "Which is the safest way to look after your eyes and skin on a sunny day?", options: ["Look at the Sun through binoculars", "Stay out in the sun at midday", "Look straight at the Sun, as long as you wear sunglasses","Wear a hat and sunglasses and use sun cream"], answer: "Wear a hat and sunglasses and use sun cream", explanation: "A hat, sunglasses and sun cream protect you. You must never look directly at the Sun, even with sunglasses.", difficulty: 2 },
          { key: "light-y3-08", kind: "multi", prompt: "Which TWO surfaces reflect light best?", options: ["A mirror", "Shiny metal foil", "Black velvet", "Rough brown paper"], answer: ["A mirror", "Shiny metal foil"], explanation: "Smooth, shiny surfaces reflect most of the light that hits them. Dark, rough surfaces reflect very little.", difficulty: 2 },
          { key: "light-y3-09", kind: "single", prompt: "Why are cycling jackets and road signs made with reflective material?", options: ["They reflect car headlights back so people can be seen", "They make their own light so the cyclist can see the road", "They soak up the light", "They are transparent"], answer: "They reflect car headlights back so people can be seen", explanation: "Reflective material bounces light back towards the driver, so the cyclist or sign shows up in the dark.", difficulty: 3 },
          { key: "light-y3-10", kind: "short", prompt: "What word describes a material that does not let any light pass through it?", answer: "opaque", accepted: ["Opaque", "an opaque material", "opaque.", "opaque material", "opake", "opaqe", "opague"], explanation: "Opaque materials block light. That is why they make shadows.", difficulty: 2 },
        ],
      },
      flashcards: [
        { front: "What do we need to see?", back: "Light entering our eyes." },
        { front: "Dark", back: "The absence of light." },
        { front: "Light source", back: "Something that makes its own light (Sun, lamp, candle flame). The Moon is not one." },
        { front: "Reflection", back: "Light bouncing off a surface." },
        { front: "Opaque", back: "Lets no light through; makes a dark shadow." },
        { front: "Transparent", back: "Lets all light through (clear glass)." },
        { front: "Translucent", back: "Lets some light through (tissue paper)." },
        { front: "How is a shadow formed?", back: "An opaque object blocks the light." },
        { front: "Pattern for shadow size", back: "The closer the object is to the light source, the bigger the shadow." },
        { front: "Sun safety", back: "Never look at the Sun. Wear a hat, sunglasses and sun cream." },
      ],
    },
    // ───────────────────────── YEAR 6 ─────────────────────────
    6: {
      year: 6,
      objectives: [
        "Recognise that light appears to travel in straight lines.",
        "Use the idea that light travels in straight lines to explain that objects are seen because they give out or reflect light into the eye.",
        "Explain that we see things because light travels from light sources to our eyes or from light sources to objects and then to our eyes.",
        "Use the idea that light travels in straight lines to explain why shadows have the same shape as the objects that cast them.",
      ],
      note: {
        title: "Year 6: how we see and how shadows form",
        body: `## Light travels in straight lines
Light travels in **straight lines** from a source. You can show this with a torch shining through three cards with holes: the light only gets through when the holes are in a straight line.

## How we see
- A **luminous** object (Sun, lamp, screen) makes its own light. Light travels from it **straight into your eye**.
- A **non-luminous** object (a tree, a book, the Moon) makes no light. You see it because light from a source **reflects** (bounces) off it and travels into your eye.

Light **never** comes out of your eyes. Arrows in a ray diagram go **from the source, to the object, to the eye**.

## Shadows
Because light travels in straight lines, an opaque object blocks some rays and a shadow forms behind it. The shadow has the **same shape** as the object. Move the object closer to the lamp and the shadow gets bigger.

**Worked example 1:** A lamp is 10 cm from a card that is 5 cm tall. The screen is 40 cm from the lamp. The screen is 4 times as far as the card (40 ÷ 10 = 4), so the shadow is 4 times as tall: 5 × 4 = 20 cm.

**Worked example 2:** You can see a page of this book in a dark room only if a lamp is switched on. The lamp's light reflects off the page into your eye.

**Worked example 3:** A shadow of a triangle held in front of a lamp is also a triangle, because the rays go straight past its edges.`,
      },
      quiz: {
        title: "Light: Year 6 quiz",
        questions: [
          { key: "light-y6-01", kind: "single", prompt: "Which diagram correctly shows how you see the ball?", options: ["A", "B", "C", "D"], answer: "C", explanation: "The ball makes no light. Light goes from the lamp to the ball, bounces off, and enters the eye. Only C shows both steps.", difficulty: 2, diagnostic: true, image: { file: "light-see.png", alt: SEE_ALT } },
          { key: "light-y6-02", kind: "single", prompt: "What is wrong with diagram B?", options: ["The ball is the wrong colour, so it cannot reflect any light", "The arrow goes from the eye to the ball, but light does not come out of our eyes", "The lamp is missing, so there is nothing to light up the ball", "Nothing is wrong: we see things by sending light out to them"], answer: "The arrow goes from the eye to the ball, but light does not come out of our eyes", explanation: "We see when light enters our eyes. Light does not travel out of them.", difficulty: 2, image: { file: "light-see.png", alt: SEE_ALT } },
          { key: "light-y6-03", kind: "single", prompt: "In diagram D, why would the eye not see the ball?", options: ["The ball is too far away from the eye to be seen","No light travels from the ball into the eye", "The lamp is too bright", "Light is stopped by the eye"], answer: "No light travels from the ball into the eye", explanation: "Light reaches the ball but no arrow goes from the ball to the eye, so nothing reaches the eye.", difficulty: 2, image: { file: "light-see.png", alt: SEE_ALT } },
          { key: "light-y6-04", kind: "single", prompt: "Light travels…", options: ["In circles", "In zig-zags", "In curves around corners", "In straight lines"], answer: "In straight lines", explanation: "Light appears to travel in straight lines. This is why we get shadows.", difficulty: 1 },
          { key: "light-y6-05", kind: "single", prompt: "Which of these is a luminous object (one that gives out its own light)?", options: ["The Moon", "A mirror", "The Sun", "A white book"], answer: "The Sun", explanation: "The Sun makes its own light. The others only reflect light.", difficulty: 1 },
          { key: "light-y6-06", kind: "single", prompt: "Why can we see the Moon at night?", options: ["It reflects light from the Sun", "It makes its own light", "It is transparent", "Light comes from our eyes"], answer: "It reflects light from the Sun", explanation: "The Moon is non-luminous. Sunlight bounces off it and travels to our eyes.", difficulty: 1 },
          { key: "light-y6-07", kind: "number", prompt: "Look at the diagram. The lamp is 8 cm from the object and 24 cm from the screen. The object is 4 cm tall. How tall is the shadow on the screen? (Give your answer in cm.)", answer: 12, explanation: "The screen is 24 ÷ 8 = 3 times as far from the lamp as the object. So the shadow is 3 times as tall: 4 × 3 = 12 cm.", difficulty: 3, image: { file: "light-shadow6.png", alt: SHADOW6_ALT } },
          { key: "light-y6-08", kind: "single", prompt: "The lamp is moved closer to the object, and the screen stays where it is. What happens to the size of the shadow?", options: ["It gets smaller", "It stays the same", "It gets bigger", "It disappears"], answer: "It gets bigger", explanation: "Closer to the lamp, the object blocks a wider spread of rays, so its shadow on the screen gets bigger.", difficulty: 2 },
          { key: "light-y6-09", kind: "single", prompt: "Why does a shadow have the same shape as the object that made it?", options: ["Light bends round the object", "Light travels in straight lines and the object blocks some of it", "The object gives out its own shadow", "Shadows are made from the colour of the object spreading onto the screen"], answer: "Light travels in straight lines and the object blocks some of it", explanation: "The rays pass straight by the edges of the object, so the blocked region has the same outline as the object.", difficulty: 2, diagnostic: true },
          { key: "light-y6-10", kind: "multi", prompt: "Which TWO statements are true?", options: ["We see a non-luminous object when light reflects off it into our eyes", "Light travels out of our eyes to the object", "If we look straight at a lamp, light travels from the lamp into our eyes", "Light can travel around corners"], answer: ["We see a non-luminous object when light reflects off it into our eyes", "If we look straight at a lamp, light travels from the lamp into our eyes"], explanation: "Light goes into our eyes, either straight from a source or after reflecting from an object. It does not come out of our eyes or bend round corners.", difficulty: 3 },
        ],
      },
      flashcards: [
        { front: "How does light travel?", back: "In straight lines." },
        { front: "Luminous object", back: "Gives out its own light (Sun, lamp)." },
        { front: "Non-luminous object", back: "Makes no light; we see it by reflected light." },
        { front: "How do we see a book?", back: "Light from a source reflects off the book into our eyes." },
        { front: "Which way do ray arrows point?", back: "From the source, to the object, to the eye." },
        { front: "Does light come out of our eyes?", back: "No. Light goes into our eyes." },
        { front: "Why is a shadow the same shape as its object?", back: "Light travels in straight lines and the object blocks some of it." },
        { front: "Move an object closer to the lamp…", back: "Its shadow gets bigger." },
        { front: "Why can we see the Moon?", back: "It reflects light from the Sun." },
        { front: "Scaling a shadow", back: "Shadow height = object height × (screen distance ÷ object distance)." },
      ],
    },
  },
};
