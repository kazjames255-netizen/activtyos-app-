// GCSE Biology — Homeostasis & Response (Year 11).
import type { CTopic } from "../types";
import { N, S, M, T, W, yr } from "./_h";
import { GLUC } from "./_imgdata";

const IMG = ["b4home-glucose.png", "A line graph of blood glucose concentration in millimoles per dm³ against time in minutes for two people after a meal at time zero. Person A stays low, peaking at 7.5 at 30 minutes then returning to about 5. Person B starts at 9, rises to a peak of 18 at 90 minutes and stays high at 15 at 180 minutes."] as [string, string];

export const TOPIC: CTopic = {
  key: "b4home", topic: "Biology — Homeostasis & Response", subject: "Science",
  years: {
    11: yr("b4home", 11, {
      obj: [
        "Explain homeostasis and negative feedback; describe the roles of receptors, coordination centres and effectors.",
        "Describe the structure and function of the nervous system, reflex arcs and the reaction time practical.",
        "Describe the endocrine system and control of blood glucose by insulin and glucagon; compare type 1 and type 2 diabetes.",
        "Describe hormones in human reproduction: the menstrual cycle, contraception and fertility treatments.",
        "Triple stretch: thyroxine, adrenaline, ADH and osmoregulation, the kidney, plant hormones.",
      ],
      note: ["GCSE Biology: keeping the body in balance", `## Homeostasis
Homeostasis keeps internal conditions (temperature, blood glucose, water) within narrow limits using **negative feedback**: a change is detected and the response reverses it.
**stimulus → receptor → coordination centre → effector → response**

## Nervous system
A **reflex arc** is fast and automatic: receptor → **sensory neurone** → relay neurone (spinal cord) → **motor neurone** → effector (muscle or gland). At a **synapse** a chemical crosses a gap.

## Hormones (endocrine system)
Hormones are chemicals released into the blood by glands; they act more slowly but for longer than nerves.

| Hormone | Source | Effect |
| --- | --- | --- |
| Insulin | pancreas | glucose → glycogen; lowers blood glucose |
| Glucagon | pancreas | glycogen → glucose; raises blood glucose |
| FSH / LH | pituitary | egg maturation / ovulation |
| Oestrogen, progesterone | ovaries | thicken uterus lining |

**Type 1 diabetes**: pancreas makes no insulin (treated with insulin injections). **Type 2**: cells stop responding to insulin (linked to obesity; diet and exercise).

## Worked example: reaction time
Drop-catch results: 0.24, 0.26, 0.60, 0.25, 0.25 s. 0.60 s is anomalous. Mean of the rest = (0.24 + 0.26 + 0.25 + 0.25) ÷ 4 = **0.25 s**.

**Working scientifically:** one repeated measurement varies naturally, so decide whether a difference is bigger than the spread before claiming an effect.`],
      quiz: "GCSE Biology: Homeostasis & Response quiz",
      qs: [
        S(1, "What is homeostasis?", "Maintaining a constant internal environment", ["Keeping the temperature of the surroundings constant", "Making hormones in glands", "Sending impulses along neurones"], "Homeostasis is the regulation of internal conditions such as temperature and blood glucose so cells can work properly.", {}),
        S(1, "Which hormone lowers blood glucose concentration?", "Insulin", ["Glucagon", "Adrenaline", "Oestrogen"], "Insulin, from the pancreas, makes cells take up glucose and the liver store it as glycogen.", {}),
        S(1, "Which shows the correct order of a reflex arc?", "Receptor → sensory neurone → relay neurone → motor neurone → effector", ["Receptor → motor neurone → relay neurone → sensory neurone → effector", "Effector → sensory neurone → brain → motor neurone → receptor", "Receptor → relay neurone → effector → sensory neurone"], "Impulses go from receptor along the sensory neurone to the CNS, across a relay neurone, then along the motor neurone to the effector.", {}),
        N(2, "Use the graph to find the highest blood glucose concentration reached by person B (in mmol/dm³).", 18, 0.3, "Read the highest point on B's line: 18 mmol/dm³ at 90 minutes.", () => Math.max(...GLUC.B), { img: IMG }),
        N(2, "At 60 minutes, how much higher is person B's blood glucose than person A's (in mmol/dm³)?", 11, 0.3, "At 60 minutes B is 17 and A is 6.0, so the difference is 17 − 6 = 11 mmol/dm³.", () => GLUC.B[2] - GLUC.A[2], { img: IMG, diag: true }),
        S(2, "Person B may have type 1 diabetes. Why does their glucose stay high after the meal?", "Little or no insulin is released, so glucose is not taken into cells or stored as glycogen", ["Too much glucagon is released, so glucose is stored as glycogen and then released straight back into the blood", "Their cells do not respond to glucagon", "Their liver makes too much insulin"], "Without insulin, glucose stays in the blood. Person A's pancreas releases insulin, bringing the level back to normal.", { img: IMG }),
        S(2, "Which statement describes type 2 diabetes?", "Body cells no longer respond properly to insulin", ["The pancreas produces no insulin at all from childhood", "It is caused by a virus", "It is always treated with blood transfusions"], "In type 2 diabetes, cells become resistant to insulin. Obesity is a major risk factor; diet and exercise help.", {}),
        M(2, "Which statements about the menstrual cycle are correct? Choose all that apply.", ["FSH causes an egg to mature in the ovary", "LH stimulates the release of an egg (ovulation)"], ["Oestrogen is made by the pituitary gland", "Progesterone stimulates ovulation"], "The pituitary gland releases FSH and LH. FSH matures an egg; LH triggers ovulation. Oestrogen and progesterone come from the ovaries.", {}),
        T(2, "Name the type of neurone that carries impulses from a receptor to the central nervous system.", "sensory neurone", ["sensory neuron", "sensory", "a sensory neurone", "sensory neurones", "sensory neurons", "a sensory neuron", "sensory nerve cell"], "Sensory neurones carry impulses to the CNS. Motor neurones carry them to the effector.", {}),
        N(2, "Five reaction times (in seconds) were recorded: 0.21, 0.19, 0.45, 0.20, 0.20. Ignore the anomalous result and calculate the mean reaction time.", 0.2, 0.005, "0.45 s is far from the others so is anomalous. Mean = (0.21 + 0.19 + 0.20 + 0.20) ÷ 4 = 0.80 ÷ 4 = 0.20 s.", () => (0.21 + 0.19 + 0.2 + 0.2) / 4, { diag: true }),
        S(3, "(Triple) On a hot day a person sweats a lot. What happens to ADH and urine?", "More ADH is released, so the kidneys reabsorb more water and the urine is small in volume and concentrated", ["Less ADH is released, so the kidneys reabsorb less water and a large volume of dilute urine is produced", "More insulin is released, so the kidneys remove the extra glucose and the urine contains glucose", "ADH stops the sweat glands working, so no extra water is lost and the urine stays normal"], "Water loss makes the blood more concentrated. The pituitary releases more ADH, so the kidney tubules reabsorb more water. This is negative feedback.", {}),
        S(3, "A student's mean reaction time is 0.20 s with the right hand and 0.18 s with the left hand, but the results in each set vary by about 0.05 s. What is the best conclusion?", "The difference is smaller than the variation, so no reliable difference can be claimed without more repeats", ["The left hand is definitely faster, because its mean reaction time is lower", "The right hand is definitely faster, because most people are right-handed", "The results are invalid, because repeated readings should all be exactly the same"], "If the natural spread in repeated readings (±0.05 s) is bigger than the difference in means (0.02 s), the evidence is weak. More repeats are needed.", {}),
        W("Explain how the body controls blood glucose concentration after a carbohydrate-rich meal, and explain what goes wrong in type 1 diabetes. [6 marks]", "Mark scheme (6): after a meal glucose concentration rises (1); detected by the pancreas (1); pancreas releases insulin into the blood (1); insulin makes liver and muscle cells take up glucose and convert it to glycogen (1); blood glucose falls back to normal by negative feedback (1); in type 1 the pancreas does not produce enough insulin so glucose stays high, and is treated by insulin injections and diet (1). Glucagon converts glycogen back to glucose when levels are low (bonus link)."),
      ],
      cards: [
        ["Homeostasis", "Keeping internal conditions constant using negative feedback."],
        ["Negative feedback", "A change is detected and the response reverses it, returning conditions to normal."],
        ["Reflex arc order", "Receptor → sensory neurone → relay neurone → motor neurone → effector."],
        ["Nervous vs hormonal response", "Nervous: fast, short-lived. Hormonal: slower, longer-lasting."],
        ["Insulin", "Made by the pancreas; lowers blood glucose (glucose → glycogen)."],
        ["Glucagon", "Made by the pancreas; raises blood glucose (glycogen → glucose)."],
        ["Type 1 diabetes", "Pancreas makes little or no insulin; treated with insulin injections."],
        ["Type 2 diabetes", "Cells resistant to insulin; linked to obesity; diet, exercise, medication."],
        ["FSH and LH roles", "FSH: egg matures and oestrogen released. LH: ovulation."],
        ["Progesterone role", "Maintains the uterus lining."],
        ["Why fewer repeats give weak evidence", "Natural variation may be as big as the difference being measured."],
        ["ADH (triple)", "Released by the pituitary; makes kidneys reabsorb more water."],
      ],
    }),
  },
};
