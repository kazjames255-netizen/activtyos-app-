// GCSE Biology — Infection & Response (Year 10).
import type { CTopic } from "../types";
import { N, S, M, W, yr } from "./_h";
import { ZONES } from "./_imgdata";

const IMG = ["b4inf-zones.png", "A round agar plate seen from above with a lawn of bacteria. Three paper discs labelled A, B and C carry different antibiotics. Around disc A there is a clear circle 12 millimetres across, around disc B a larger clear circle 20 millimetres across, and around disc C there is no clear zone at all."] as [string, string];

export const TOPIC: CTopic = {
  key: "b4inf", topic: "Biology — Infection & Response", subject: "Science",
  years: {
    10: yr("b4inf", 10, {
      obj: [
        "Describe how pathogens (bacteria, viruses, fungi, protists) cause disease and how they spread.",
        "Describe non-specific defences and the immune response: phagocytosis, antibodies, antitoxins, memory cells.",
        "Explain how vaccination provides immunity and how antibiotics and painkillers differ.",
        "Describe drug testing and development (pre-clinical and clinical trials, placebos, double-blind trials).",
        "Required practical: investigate the effect of antimicrobials on bacterial growth using aseptic technique.",
        "Triple stretch: monoclonal antibodies; plant disease.",
      ],
      note: ["GCSE Biology: pathogens, the immune system and medicines", `## Pathogens
| Type | Example | Notes |
| --- | --- | --- |
| Bacteria | Salmonella, gonorrhoea | reproduce by binary fission; release toxins |
| Virus | measles, HIV, tobacco mosaic virus | live inside cells |
| Fungus | rose black spot | spread by spores |
| Protist | malaria | spread by a **vector** (mosquito) |

## Defences
- Non-specific: skin, nose hairs and mucus, cilia in the trachea, stomach acid.
- **White blood cells**: **phagocytosis** (engulf pathogens), **antibodies** (bind to specific **antigens**), **antitoxins** (neutralise toxins).
- **Memory cells** make a faster, bigger second response.

## Medicines
**Vaccines** put harmless (dead or weakened) pathogens' antigens into the body so it makes antibodies and memory cells. **Antibiotics** kill bacteria only, not viruses. **Painkillers** treat symptoms, not the cause. Overuse of antibiotics allows **resistant** bacteria to survive and spread.

## Practical: antibiotic discs
Spread bacteria on agar, add discs, incubate (25 °C at school to avoid growing human pathogens). A larger **clear zone** = more effective antibiotic. Area of the zone = π × r² (r = ½ diameter).

## Worked calculation
Zone diameter 16 mm → r = 8 mm → area = 3.14 × 8² = **201 mm²** (to 3 s.f.).

**Growth:** if one bacterium divides every 30 min, after 2 hours it has divided 4 times: 2⁴ = 16 bacteria.`],
      quiz: "GCSE Biology: Infection & Response quiz",
      qs: [
        S(1, "Malaria is caused by a pathogen from which group?", "Protists", ["Bacteria", "Viruses", "Fungi"], "Malaria is caused by a protist spread by mosquitoes, which are vectors.", {}),
        S(1, "What is the name of the process in which a white blood cell engulfs and digests a pathogen?", "Phagocytosis", ["Antibody production", "Binary fission", "Vaccination"], "Phagocytes surround the pathogen and digest it. Antibodies and antitoxins are different responses.", {}),
        S(1, "Which type of medicine can kill bacteria but has no effect on viruses?", "Antibiotics", ["Painkillers", "Vaccines", "Antitoxins"], "Antibiotics such as penicillin kill bacteria. Viruses live inside your cells so are hard to kill without damaging them.", {}),
        N(2, "The plate shows the clear zone for antibiotic B. Calculate the area of the clear zone in mm² (π = 3.14).", 314, 1, "Diameter 20 mm so radius 10 mm. Area = π × r² = 3.14 × 10 × 10 = 314 mm².", () => 3.14 * (ZONES.B / 2) ** 2, { img: IMG, diag: true }),
        S(2, "What does the result for disc C suggest?", "The bacteria are resistant to antibiotic C", ["Antibiotic C is the most effective of the three", "Antibiotic C killed all the bacteria", "The plate was too cold"], "No clear zone means bacteria grew right up to the disc, so antibiotic C did not kill them: they are resistant to it.", { img: IMG }),
        S(2, "How does a vaccine give immunity?", "It stimulates white blood cells to make antibodies and memory cells for that antigen", ["It contains ready-made antibodies that kill the pathogen immediately and stay in the blood for life", "It kills bacteria in the blood", "It makes the pathogen mutate so it cannot reproduce"], "A vaccine contains harmless antigens. The immune system makes antibodies and memory cells, giving a quicker, stronger response if the real pathogen arrives.", { diag: true }),
        S(2, "In school, agar plates are incubated at about 25 °C rather than 37 °C. Why?", "To reduce the chance of growing pathogens that are harmful to humans", ["Because bacteria cannot grow at 37 °C, so no colonies would appear", "So that the agar jelly does not melt and the discs stay in place", "To make the bacteria grow as fast as possible in the time available"], "37 °C is body temperature, ideal for human pathogens. A lower temperature slows those down, making the experiment safer.", {}),
        M(2, "Which measures help to reduce the spread of infectious disease? Choose all that apply.", ["Vaccination", "Killing vectors such as mosquitoes"], ["Taking painkillers", "Taking antibiotics for a viral infection"], "Vaccination and controlling vectors stop transmission. Painkillers only relieve symptoms, and antibiotics do not work on viruses.", {}),
        S(2, "How is HIV spread?", "By contact with infected body fluids such as blood", ["By mosquito bites", "By drinking water that has been contaminated with the virus", "By droplets in coughs and sneezes"], "HIV is passed on through exchange of body fluids, for example sharing needles or unprotected sex.", {}),
        S(2, "Why do clinical trials of a new drug use a placebo and a double-blind design?", "So neither patients nor doctors know who has the drug, to avoid bias", ["So that the doctors can choose which patients receive the real drug", "To find out how much the drug will cost to produce on a large scale", "So patients can choose whether to take the drug or the placebo"], "A placebo has no drug in it. If neither patient nor doctor knows who has which, expectations cannot bias the results.", {}),
        N(3, "One bacterium divides by binary fission every 20 minutes. Assuming no cells die, how many bacteria are there after 3 hours?", 512, 0, "3 hours = 180 min = 9 divisions. Each division doubles the number, so 2⁹ = 512.", () => 2 ** (180 / 20)),
        S(3, "(Triple) Monoclonal antibodies can carry a drug to cancer cells. Why do they only bind to those cells?", "Each type is specific to one antigen found on the cancer cells", ["They are made from cancer cells, so they recognise other cancer cells", "They are attracted to any cell that is dividing rapidly, as cancer cells do", "They bind to every body cell, but only cancer cells absorb the drug"], "An antibody's binding site fits one antigen only, so antibodies made against a cancer-cell antigen attach only to those cells.", {}),
        W("Describe how the body defends itself against pathogens and explain how a vaccination can prevent future illness. [6 marks]", "Mark scheme (6): non-specific barriers such as skin, mucus/cilia, stomach acid (1); white blood cells engulf pathogens by phagocytosis (1); antigens on pathogen are recognised and lymphocytes make specific antibodies (1); antitoxins neutralise toxins (1); vaccine contains dead/weakened pathogen or antigens (1); memory cells are produced, so on real infection antibodies are made faster and in greater quantity (1)."),
      ],
      cards: [
        ["Four types of pathogen", "Bacteria, viruses, fungi, protists."],
        ["Vector", "An organism that spreads a pathogen, e.g. the mosquito for malaria."],
        ["Phagocytosis", "A white blood cell engulfs and digests a pathogen."],
        ["Antibody", "A protein made by white blood cells that binds to a specific antigen."],
        ["Antitoxin", "Made by white blood cells; neutralises toxins released by bacteria."],
        ["How does a vaccine work?", "Harmless antigens cause antibody + memory-cell production, so later infection meets a fast response."],
        ["Antibiotics vs viruses", "Antibiotics kill bacteria only; they do not work on viruses."],
        ["Antibiotic resistance", "Bacteria that survive antibiotics reproduce and spread; caused by overuse."],
        ["Why use a placebo?", "To compare with the real drug and remove expectation bias (double-blind)."],
        ["Area of a circular clear zone", "π × r², where r = diameter ÷ 2."],
        ["Aseptic technique aim", "Prevent contamination of the culture and unwanted microbes escaping."],
        ["Binary fission growth", "Number doubles each division: N × 2ⁿ."],
      ],
    }),
  },
};
