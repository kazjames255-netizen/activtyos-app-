// GCSE Biology — Organisation (Year 10: digestion, enzymes, blood & heart; Year 11: plant tissues, transport, non-communicable disease).
import type { CTopic } from "../types";
import { N, S, M, T, W, yr } from "./_h";
import { ENZYME } from "./_imgdata";

const IMG = ["b4org-enzyme.png", "A graph of the rate of an amylase-catalysed reaction against temperature from 10 to 60 degrees Celsius. The rate rises steeply to a peak, then falls sharply and reaches zero at 60 degrees."] as [string, string];

export const TOPIC: CTopic = {
  key: "b4org", topic: "Biology — Organisation", subject: "Science",
  years: {
    10: yr("b4org", 10, {
      obj: [
        "Describe the levels of organisation: cells, tissues, organs, organ systems, organisms.",
        "Explain the lock-and-key model of enzyme action and the effect of temperature and pH on rate.",
        "Describe the human digestive system, digestive enzymes and the role of bile.",
        "Describe the structure and function of the heart, blood vessels and blood; calculate cardiac output.",
        "Carry out food tests (Benedict's, iodine, biuret, ethanol) and enzyme rate investigations.",
        "Explain cardiovascular disease and its treatments (statins, stents, valves).",
      ],
      note: ["GCSE Biology: enzymes, digestion and the circulatory system", `## Levels of organisation
cell → tissue → organ → organ system → organism. The digestive system, for example, contains glandular tissue (makes enzymes), muscular tissue and epithelial tissue.

## Enzymes
Enzymes are biological **catalysts** made of protein. The **substrate** fits the enzyme's **active site** (lock and key). Too hot or the wrong pH and the active site changes shape: the enzyme is **denatured**.

| Enzyme | Substrate → products |
| --- | --- |
| Amylase | starch → simple sugars |
| Protease | protein → amino acids |
| Lipase | fat (lipid) → fatty acids + glycerol |

**Bile** (made in the liver, stored in the gall bladder) is alkaline and **emulsifies** fat, giving a bigger surface area for lipase.

## Circulation
The heart is a double pump. Blood: right atrium → right ventricle → pulmonary artery → lungs → pulmonary vein → left atrium → left ventricle → aorta → body. Arteries: thick, elastic walls (high pressure). Veins: valves. Capillaries: one cell thick.

## Key equation and worked example
**cardiac output = stroke volume × heart rate**
Stroke volume 64 cm³, heart rate 80 beats/min: 64 × 80 = **5120 cm³/min**.

**Food tests:** Benedict's + heat → brick red (sugar); iodine → blue-black (starch); biuret → purple (protein); ethanol then water → cloudy (lipid).

**Working scientifically:** in enzyme practicals control pH, temperature and concentration; the rate is often 1 ÷ time.`],
      quiz: "GCSE Biology: Organisation quiz (Year 10)",
      qs: [
        S(1, "Which is the correct order of organisation from smallest to largest?", "Cell → tissue → organ → organ system", ["Tissue → cell → organ → organ system", "Cell → organ → tissue → organ system", "Organ → tissue → cell → organism"], "Similar cells form a tissue, tissues form an organ, and organs working together form an organ system.", {}),
        S(1, "Lipase is an enzyme. Which products does it make from fat?", "Fatty acids and glycerol", ["Amino acids", "Simple sugars", "Starch and water only"], "Lipase breaks lipids (fats) into three fatty acids and one glycerol. Protease makes amino acids; amylase makes sugars.", {}),
        S(1, "Which type of blood vessel has thick, elastic walls to cope with high pressure?", "Artery", ["Vein", "Capillary", "Vena cava"], "Arteries carry blood away from the heart at high pressure, so they have thick muscular and elastic walls.", {}),
        N(2, "Use the graph to find the optimum temperature for this enzyme, in °C.", 40, 2, "The optimum is the temperature at the highest point of the curve, where the rate is greatest.", () => ENZYME.temp[ENZYME.rate.indexOf(Math.max(...ENZYME.rate))], { img: IMG, diag: true }),
        S(2, "Using the graph, why does the rate fall sharply above the optimum temperature?", "The enzyme's active site changes shape, so the substrate no longer fits", ["The substrate is used up more quickly at high temperature, so there is none left to react", "The enzyme molecules are killed", "The enzyme is digested by the substrate"], "High temperatures break bonds holding the enzyme's shape. The active site changes shape (denaturing) and can no longer bind the substrate. Enzymes are not living, so they cannot be \"killed\".", { img: IMG }),
        S(2, "What are the functions of bile?", "It emulsifies fat and makes conditions alkaline for the enzymes", ["It digests fat into fatty acids and glycerol and makes conditions acidic", "It digests protein in the stomach", "It stores glucose as glycogen"], "Bile is alkaline (neutralises acid from the stomach) and breaks large fat droplets into small ones, increasing the surface area for lipase. It is not an enzyme.", {}),
        M(2, "Which of these produce digestive enzymes? Choose all that apply.", ["Salivary glands", "Pancreas", "Stomach"], ["Liver", "Gall bladder"], "Salivary glands (amylase), stomach (protease) and pancreas (amylase, protease, lipase) all make enzymes. The liver makes bile and the gall bladder only stores it.", {}),
        N(2, "A patient has a stroke volume of 70 cm³ and a heart rate of 75 beats per minute. Calculate the cardiac output in cm³ per minute.", 5250, 1, "Cardiac output = stroke volume × heart rate = 70 × 75 = 5250 cm³/min.", () => 70 * 75, { diag: true }),
        S(2, "A student tests a food sample. Which test and result shows that protein is present?", "Biuret solution turns from blue to purple", ["Iodine solution turns from orange to blue-black", "Benedict's solution and heat gives a brick-red colour", "Ethanol then water gives a cloudy white layer"], "Biuret is the protein test (blue → purple). Iodine tests for starch, Benedict's for reducing sugars and the ethanol emulsion test for lipids.", {}),
        S(2, "Why do mature red blood cells have no nucleus?", "There is more space for haemoglobin to carry oxygen", ["The nucleus would be damaged by the oxygen they carry", "They do not need DNA because they are too small", "It makes them stick together to form clots"], "No nucleus and a biconcave shape give more room for haemoglobin and a larger surface area for oxygen uptake.", {}),
        S(3, "Fatty deposits narrow the coronary arteries of a patient. Why might this cause a heart attack?", "Heart muscle gets too little oxygen and glucose, so it cannot respire enough to contract", ["The blood in the coronary arteries becomes too rich in oxygen, which damages the muscle", "The heart valves cannot close, so blood flows backwards into the atria", "White blood cells cannot reach the heart muscle, so it becomes infected"], "The coronary arteries supply the heart muscle itself. If blood flow is blocked, the muscle cannot respire aerobically, stops contracting and dies.", {}),
        N(3, "Using the graph, how many times greater is the rate of reaction at 40 °C than at 20 °C? Give a number.", 3.2, 0.15, "Read the rates: 16 at 40 °C and 5 at 20 °C. 16 ÷ 5 = 3.2 times greater.", () => ENZYME.rate[3] / ENZYME.rate[1], { img: IMG }),
        W("Describe the path taken by blood as it flows through the heart and lungs, starting from the vena cava, and explain why the left ventricle wall is thicker than the right. [6 marks]", "Mark scheme (6): deoxygenated blood enters the right atrium from the vena cava (1); passes through a valve into the right ventricle (1); pumped out via the pulmonary artery to the lungs (1); oxygenated blood returns by the pulmonary vein to the left atrium (1); passes to the left ventricle and is pumped out through the aorta to the body (1); valves prevent backflow. Left ventricle wall thicker (1) because it pumps blood at higher pressure around the whole body, while the right pumps only to the nearby lungs."),
      ],
      cards: [
        ["Levels of organisation", "Cell → tissue → organ → organ system → organism."],
        ["Amylase: substrate and products", "Starch → simple sugars (maltose then glucose)."],
        ["Protease: substrate and products", "Protein → amino acids."],
        ["Lipase: substrate and products", "Fats (lipids) → fatty acids + glycerol."],
        ["Why is an enzyme denatured by high temperature?", "The active site changes shape so the substrate no longer fits."],
        ["Two roles of bile", "Alkaline (neutralises stomach acid) and emulsifies fats (larger surface area)."],
        ["Cardiac output equation", "cardiac output = stroke volume × heart rate."],
        ["Benedict's test result for sugar", "Heat: blue → green → yellow → orange → brick red."],
        ["Iodine test result for starch", "Orange-brown → blue-black."],
        ["Biuret test result for protein", "Blue → purple (lilac)."],
        ["Artery vs vein", "Artery: thick walls, high pressure, away from heart. Vein: valves, low pressure, towards heart."],
        ["What does a stent do?", "Holds a narrowed coronary artery open so blood can flow."],
      ],
    }),
    11: yr("b4org", 11, {
      obj: [
        "Describe plant tissues (epidermis, palisade and spongy mesophyll, xylem, phloem, meristem) and relate them to function.",
        "Explain transpiration and translocation, and the factors affecting the rate of transpiration.",
        "Explain the role of guard cells and stomata.",
        "Describe non-communicable diseases, risk factors, cancer (benign and malignant), and interpret correlation data.",
        "Calculate stomatal density and water uptake from potometer data.",
      ],
      note: ["GCSE Biology: plant organisation and non-communicable disease", `## Plant tissues
- **Epidermis**: protective outer layer, waxy cuticle reduces water loss.
- **Palisade mesophyll**: packed with chloroplasts; main site of photosynthesis.
- **Spongy mesophyll**: air spaces for gas exchange.
- **Xylem**: dead cells, lignin-strengthened tubes; carry **water and mineral ions** upwards (transpiration stream).
- **Phloem**: living cells; **translocation** of dissolved sugars in both directions, using energy.
- **Meristem**: cells at shoot and root tips that divide and differentiate.

## Transpiration
Water evaporates from the leaf through open **stomata**, opened and closed by **guard cells**. It is faster in **hot, dry, windy, bright** conditions. If loss exceeds uptake, cells lose turgor and the plant **wilts**.

## Disease
Non-communicable diseases (cardiovascular disease, cancer, type 2 diabetes) are not passed on by pathogens. Risk factors include smoking, obesity, alcohol and diet. A **benign** tumour stays in one place; a **malignant** tumour invades and spreads. A **correlation** shows a link but does not prove cause.

## Key equations and worked example
| Quantity | Equation |
| --- | --- |
| Stomatal density | stomata ÷ area of view |
| Water volume in capillary | π × r² × distance moved |

A field of view of 0.50 mm² contains 45 stomata: 45 ÷ 0.50 = **90 stomata per mm²**.

**Working scientifically:** in a potometer, keep temperature, light and air movement constant, and repeat to calculate a mean.`],
      quiz: "GCSE Biology: Organisation quiz (Year 11)",
      qs: [
        S(1, "Which plant tissue transports water and mineral ions from the roots to the leaves?", "Xylem", ["Phloem", "Palisade mesophyll", "Epidermis"], "Xylem vessels carry water and mineral ions upwards. Phloem carries dissolved sugars.", {}),
        S(1, "Which cells open and close the stomata?", "Guard cells", ["Root hair cells", "Palisade cells", "Xylem cells"], "Guard cells change shape as they gain or lose water, opening or closing the stoma.", {}),
        S(1, "Which of these is a non-communicable disease?", "Type 2 diabetes", ["Cholera", "Tuberculosis (TB)", "Influenza"], "Non-communicable diseases are not caused by pathogens and cannot be passed from person to person. The others are infectious.", {}),
        M(2, "Which conditions increase the rate of transpiration? Choose all that apply.", ["A higher temperature", "Windy conditions"], ["High humidity", "Stomata closing"], "Heat gives water molecules more energy and wind removes water vapour near the leaf, steepening the diffusion gradient. Humid air and closed stomata slow transpiration.", {}),
        S(2, "What is the main function of the palisade mesophyll layer?", "It contains many chloroplasts for photosynthesis", ["It transports sugars down to the roots", "It controls water loss by opening and closing its guard cells", "It makes the leaf waterproof"], "Palisade cells are tightly packed near the top of the leaf and contain many chloroplasts, so most photosynthesis happens there.", {}),
        S(2, "Which statement about translocation is correct?", "Phloem carries dissolved sugars in both directions and needs energy", ["Xylem carries sugars only towards the roots", "Phloem carries water in one direction only by transpiration", "It moves sugars by diffusion only, with no energy needed"], "Translocation in the living phloem moves sucrose from leaves to growing or storage tissues, and needs energy from respiration.", {}),
        S(2, "What is the difference between a benign and a malignant tumour?", "Malignant cells invade neighbouring tissue and spread to form secondary tumours", ["Benign tumours spread to other organs but malignant ones stay in one place", "Malignant tumours are always caused by smoking, while benign ones are inherited", "Benign tumours are caused by pathogens, so they can be passed from person to person"], "Benign tumours grow in one place inside a membrane. Malignant cells break away and spread in the blood, forming secondary tumours.", { diag: true }),
        S(2, "A study finds that people who smoke have a higher rate of coronary heart disease. Which conclusion is BEST supported?", "Smoking is correlated with a higher risk of heart disease, but other factors could contribute", ["Smoking is the only cause of heart disease, so non-smokers are not at risk", "Heart disease makes people start smoking to cope with the stress of being ill", "The study proves that smoking directly causes heart disease in everyone who smokes"], "A correlation shows a link, but other risk factors (diet, exercise, genes) may also play a part. A well-designed study helps to argue for a causal link.", {}),
        T(2, "Name the plant tissue at the tips of shoots and roots whose cells divide and differentiate.", "meristem", ["meristems", "meristem tissue", "apical meristem", "meristematic tissue", "meristem cells", "the meristem"], "Meristem tissue contains unspecialised cells that can divide and become xylem, phloem or other tissues.", {}),
        N(2, "A microscope field of view has an area of 0.30 mm² and contains 24 stomata. Calculate the stomatal density in stomata per mm².", 80, 0.5, "Stomatal density = number of stomata ÷ area = 24 ÷ 0.30 = 80 per mm².", () => 24 / 0.3, { diag: true }),
        N(3, "In a potometer, an air bubble moves 42 mm in 6 minutes along a capillary tube of radius 0.5 mm. Calculate the rate of water uptake in mm³ per minute (π = 3.14, to 1 d.p.).", 5.5, 0.1, "Volume = π × r² × distance = 3.14 × 0.5² × 42 = 32.97 mm³. Divide by 6 min: 5.5 mm³ per min.", () => (3.14 * 0.5 * 0.5 * 42) / 6),
        S(3, "In hot, dry weather a plant closes its stomata. What is the trade-off?", "Less water is lost but less carbon dioxide enters, so photosynthesis slows", ["Less water is lost and photosynthesis speeds up because the leaf stays cooler", "Less oxygen escapes, so more is available for respiration inside the leaf", "No water is lost and photosynthesis is unaffected because the leaf stores carbon dioxide"], "Stomata allow both water vapour out and CO₂ in. Closing them saves water at the cost of a lower photosynthesis rate.", {}),
        W("Explain how the structure of a leaf is adapted for photosynthesis. [6 marks]", "Mark scheme (6, any 6 with linked explanation): broad, flat, thin leaf gives a large surface area and short diffusion path for gases and light (1); palisade cells packed near top with many chloroplasts to absorb light (1); transparent upper epidermis lets light through (1); stomata (with guard cells) let CO₂ in and oxygen/water vapour out (1); air spaces in spongy mesophyll allow gases to diffuse (1); xylem brings water for photosynthesis and phloem removes sugars (1); waxy cuticle reduces water loss (1)."),
      ],
      cards: [
        ["Function of xylem", "Carries water and mineral ions upwards (transpiration stream); strengthened by lignin."],
        ["Function of phloem", "Translocation of dissolved sugars in both directions; living cells, uses energy."],
        ["Function of guard cells", "Open and close stomata to control gas exchange and water loss."],
        ["Function of palisade mesophyll", "Most photosynthesis; many chloroplasts."],
        ["Function of meristem", "Cells that divide and differentiate at shoot and root tips."],
        ["Four factors that increase transpiration", "Higher temperature, lower humidity, more wind, more light."],
        ["Why does a plant wilt?", "Water loss exceeds uptake, so cells lose turgor pressure."],
        ["Benign vs malignant", "Benign stays in place; malignant invades and spreads (secondary tumours)."],
        ["Give three risk factors for non-communicable disease", "Smoking, obesity/poor diet, alcohol (also lack of exercise)."],
        ["Correlation vs cause", "A link between two variables does not prove one causes the other."],
        ["Stomatal density equation", "number of stomata ÷ area of field of view."],
        ["Volume of water in a capillary", "π × r² × distance moved."],
      ],
    }),
  },
};
