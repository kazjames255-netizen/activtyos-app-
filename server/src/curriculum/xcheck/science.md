# Science curriculum cross-check against DfE documents

Report only. No content file was edited. Scope: coverage, year/tier placement, scope and wording. The correctness of individual answer keys was not re-verified here (that is the QA pass's job).

## 1. Sources

Fetched (HTTP 200, saved locally in the session scratchpad, parsed locally). All fetching used `curl`, not WebFetch. PDF text was extracted with pypdf and pdfminer.

| # | Document | URL | Used for |
|---|---|---|---|
| 1 | National Curriculum in England: science programmes of study (one page covering KS1, KS2, KS3 and KS4) | https://www.gov.uk/government/publications/national-curriculum-in-england-science-programmes-of-study/national-curriculum-in-england-science-programmes-of-study | science-ks1, science-ks2, science-ks3 |
| 2 | GCSE subject content for biology, chemistry and physics (single sciences; PDF, updated May 2019) | https://assets.publishing.service.gov.uk/media/5cd2b951ed915d50c208b4d5/GCSE_single_science_updated_May_2019.pdf (landing page: https://www.gov.uk/government/publications/gcse-single-science) | science-ks4 |
| 3 | GCSE subject content for combined science (PDF, updated May 2019) | https://assets.publishing.service.gov.uk/media/5cd2b8b4ed915d50b6c44ffa/Combined_science_GCSE_updated_May_2019.pdf (landing page: https://www.gov.uk/government/publications/gcse-combined-science) | science-ks4, combined vs triple check |
| 4 | GCE AS and A level subject content for biology, chemistry, physics and psychology (PDF, April 2014) | https://assets.publishing.service.gov.uk/media/5a807949e5274a2e8ab50599/Science_AS_and_level_formatted.pdf (landing page: https://www.gov.uk/government/publications/gce-as-and-a-level-for-science) | science-ks5-bio, science-ks5-chem, science-ks5-phys |

Could not fetch, or fetched differently:
- My first guessed landing-page URLs for GCSE and A level returned 404 as HTML. I found the real pages and PDF attachments through the gov.uk content API (`https://www.gov.uk/api/content/<path>`) and downloaded the PDFs directly.
- There are no separate DfE "A level biology / chemistry / physics" documents. Biology, chemistry and physics are appendices 1 to 3 of source 4, so that is the only A-level source.
- No DfE document assigns Year 12 or Year 13. The A-level content marks AS in normal type and A2-only in **bold**. I recovered the bold from PDF font names (pdfminer). It looked reliable when spot-checked (for example, optical isomerism is bold and E-Z isomerism is not).
- Higher-tier content in the GCSE PDFs is marked by underlining, and text extraction lost it. I did not check Foundation versus Higher placement.
- "Triple-only" was derived by comparing the single-science and combined-science PDFs. I matched bullets automatically (token overlap) and then read the results manually. Where a statement is missing from the combined document it is treated as separate-sciences-only.
- Statements about what exam boards (AQA, OCR, Edexcel) add are not from a fetched source. They are marked "unverified" wherever I mention them.

Severity: H = would mislead a learner or break a stated policy, M = should fix, L = minor or judgement call.

Brief policy checked: "KS4 combined-science depth with triple-only stretch at difficulty 3" (docs/curriculum-content-brief.md, SCIENCE section).

## 2. Counts

| Pack | Gap | Misplaced or mislabelled | Out of scope or beyond the official text | Wording | Total |
|---|---|---|---|---|---|
| science-ks1 | 0 | 0 | 0 | 0 | 0 |
| science-ks2 | 1 | 0 | 6 | 1 | 8 |
| science-ks3 | 16 | 0 | 6 | 2 | 24 |
| science-ks4 | 5 | 12 | 4 | 2 | 23 |
| science-ks5-bio | 3 | 0 | 1 | 0 | 4 |
| science-ks5-chem | 1 | 3 | 1 | 0 | 5 |
| science-ks5-phys | 2 | 1 | 1 | 0 | 4 |
| **All** | **28** | **16** | **19** | **5** | **68** |

## 3. science-ks1 (Years 1 and 2)

All 8 statutory subject blocks (Y1 plants, animals, everyday materials, seasonal changes; Y2 living things and habitats, plants, animals, uses of everyday materials) have matching objectives, notes and questions, in the right year.

| Category | Result |
|---|---|
| Gap | None found. |
| Misplaced | None. |
| Out of scope | None found. The note guidance "seeds and bulbs need water but most do not need light" is respected (plants-y2 note and questions). |
| Wording | Objectives follow the official wording. No mismatches. |

## 4. science-ks2 (Years 3 to 6)

Every statutory block for Y3 to Y6 has a topic-year (plants, animals, rocks, light, forces and magnets in Y3; living things, animals, states, sound, electricity in Y4; living things, animals, properties and changes of materials, earth and space, forces in Y5; living things, animals, evolution, light, electricity in Y6). Year placement matches the official document throughout.

### Gap

| ID | Topic key, year | Official reference | Finding | Fix | Sev |
|---|---|---|---|---|---|
| K2-G1 | elec, Y4 | "identify common appliances that run on electricity" | Listed in the objectives, but the word "appliance" appears once in the whole file and no question tests it. | Add one d1 question and one flashcard. | L |

### Out of scope or beyond the year

| ID | Topic key, year | Official reference | Finding | Fix | Sev |
|---|---|---|---|---|---|
| K2-O1 | forces, Y5 (note, flashcard "Unit of force") | Y5 forces contains no units of force. | The newton and weight in newtons are taught. Force in newtons is a KS3 item ("forces measured in newtons"). | Drop the newton card and note line, or mark it as enrichment. | L |
| K2-O2 | forces, Y5 (objective 4, q03) | Working scientifically: "recording data ... repeat readings" | "Calculate a mean" is Y6 maths. Repeat readings are official; calculating a mean is not named. | Keep the repeats. Say "average" or make the mean optional. | L |
| K2-O3 | forces, Y5, q08 (d3) | "some mechanisms including levers, pulleys and gears allow a smaller force to have a greater effect" | The gear-ratio calculation (12 teeth against 24 teeth) goes beyond the statement. | Keep it as d3 stretch, or replace it with a qualitative item. | L |
| K2-O4 | light, Y6, q07 (d3) | "light travels in straight lines to explain why shadows have the same shape as the objects" | Computing shadow height from distances (similar triangles) is not in the programme. | Mark it as stretch or replace it. | L |
| K2-O5 | earth, Y5, q08 and q10, note table, flashcard | "describe the movement of the moon relative to the Earth" | Moon phases are not in the KS2 statutory text. | Keep as enrichment, but do not diagnose on it. | L |
| K2-O6 | living, Y6, q09, note, flashcard | Y4 note: "non-flowering plants, for example ferns and mosses" | Spores and conifer cones are not in the KS2 text. | Keep as d3 stretch or drop. | L |

### Wording

| ID | Topic key, year | Official reference | Finding | Fix | Sev |
|---|---|---|---|---|---|
| K2-W1 | elec, Y4, q08 | Y4: "cells, wires, bulbs, switches and buzzers"; Y6 introduces the battery symbol | "battery" is accepted as the answer for the single part that pushes the current round. Official terminology is "cell". | Accept "battery" only as a lenient alternative, or drop it. | L |

## 5. science-ks3 (Years 7 to 9)

The official KS3 text has no year split, so nothing can be misplaced against it. Findings are gaps and content that goes beyond KS3.

### Gaps (official requirement with no coverage)

| ID | Topic key, year | Official reference | Finding | Fix | Sev |
|---|---|---|---|---|---|
| K3-G1 | none (no file) | "the structure and functions of the human skeleton, to include support, protection, movement and making blood cells"; "biomechanics"; "antagonistic muscles" | No file mentions skeleton, bone or joint. The whole "skeletal and muscular systems" strand is missing. KS2 Y3 covers only the basics. | Add a Y7 topic, or add to bfunc. | H |
| K3-G2 | bcell, Y7 | "the role of diffusion in the movement of materials in and between cells" | Diffusion is not in bcell (it is only in cpart and bgas). | Add an objective, a note paragraph and a question. | M |
| K3-G3 | brep, Y8 | "menstrual cycle (without details of hormones)" | Not covered. | Add. | M |
| K3-G4 | bgas, Y8 | "using a pressure model to explain the movement of gases, including simple measurements of lung volume" | Only "the mechanism of breathing". No pressure model and no lung-volume measurement. | Add a model question and a lung-volume data question. | L |
| K3-G5 | becol or bgen, Y9 | "the importance of maintaining biodiversity and the use of gene banks" | The word biodiversity does not appear in any KS3 file. | Add. | M |
| K3-G6 | cele or creact | "properties of ceramics, polymers and composites (qualitative)" | Not covered. | Add a short note and questions. | M |
| K3-G7 | creact, Y8 (objective 1) | "representing chemical reactions using formulae and using equations" | The objective says word equations only. There is no "balanc" in creact. | Add symbol equations and formulae. | M |
| K3-G8 | cpart, Y7 | "Brownian motion in gases"; "internal energy stored in materials"; "the anomaly of ice-water transition" | None of these appears. | Add to cpart. | L |
| K3-G9 | pelec or none | "separation of positive or negative charges when objects are rubbed together: transfer of electrons ... the idea of electric field" | Static electricity is not covered anywhere. | Add. | H |
| K3-G10 | pelec or none | "magnetic poles, attraction and repulsion; magnetic fields by plotting with compass ... Earth's magnetism, compass and navigation" | Only electromagnets and the motor (pelec-y9) appear. No fields, compass or Earth's magnetism. | Add a magnetism topic-year. | H |
| K3-G11 | penergy | "heating and thermal equilibrium: ... energy transfer from the hotter to the cooler one, through contact (conduction) or radiation ... use of insulators" | "Conduction" does not appear in the KS3 files. Thermal transfer and equilibrium are not covered. | Add to penergy Y7. | H |
| K3-G12 | penergy or pforce | "simple machines give bigger force but at the expense of smaller movement: product of force and displacement unchanged" | "lever" does not appear. | Add. | L |
| K3-G13 | pforce, Y8 | "pressure in liquids, increasing with depth; upthrust effects, floating and sinking" | "depth" and "upthrust" do not appear. Only atmospheric pressure and force ÷ area are covered. | Add. | M |
| K3-G14 | pwave, Y8 | "waves on water as undulations ... transverse ... superposition"; "sound waves are longitudinal"; "auditory range"; "ultrasound" | None appears (no transverse, longitudinal, superposition or ultrasound). | Add a wave-basics topic-year. | M |
| K3-G15 | pwave, Y8 | "ray model to explain imaging in mirrors, the pinhole camera ... convex lens ... the human eye"; "colours ... differential colour effects in absorption and diffuse reflection" | No pinhole, lens, eye or colour absorption. Only reflection, refraction and prism appear. | Add. | M |
| K3-G16 | pforce, Y8 | "relative motion: trains and cars passing one another" | Not covered. | Add one item. | L |

### Out of scope (GCSE or beyond the KS3 statutory text)

| ID | Topic key, year | Official reference | Finding | Fix | Sev |
|---|---|---|---|---|---|
| K3-O1 | bfunc, Y8 (objective 3; q01 to q06, q10) | KS3 "Health" is only "the effects of recreational drugs" | Pathogens, communicable disease, immune defence and vaccination are GCSE content in the DfE GCSE documents (biology "Health, disease and the development of medicines"). | Mark as enrichment, or move to the KS4 b4inf topic. | M |
| K3-O2 | bgas, Y8 (objective 4; q03, q04, q05, q10) | "the reactants in, and products of, photosynthesis ... the adaptations of leaves" | "Factors that limit its rate" is GCSE content (biology "Photosynthesis": temperature, light intensity, carbon dioxide). | Keep the data-reading skill but drop the limiting-factor framing, or mark as stretch. | M |
| K3-O3 | bgen, Y9, q09 (d3) | "a simple model of chromosomes, genes and DNA in heredity" | A dominant/recessive Bb × Bb monohybrid cross is GCSE content. | Replace it with a variation or inheritance item, or label it stretch. | M |
| K3-O4 | pforce, Y9 (objectives 2 and 3; q06, q09) | "forces being needed to cause objects to stop or start moving, or to change their speed or direction (qualitative only)" | Newton's third law and F = ma are quantitative and GCSE content. The combined GCSE text has "apply Newton's Second Law in calculations". | Keep Newton 1 and qualitative motion. Drop q09 or mark it stretch. | M |
| K3-O5 | penergy, Y9 (objective 3, 4; q01, q02, q07, q08, q10) | "comparing power ratings of appliances in watts"; "comparing amounts of energy transferred (J, kJ, kW hour)" | Efficiency and Sankey diagrams, and P = E ÷ t, are GCSE content (the GCSE combined text lists "efficiency" and "power = work done ÷ time"). | Keep kWh cost items. Mark efficiency as stretch. | M |
| K3-O6 | pelec, Y9 (objective 2, q06) | "resistance, measured in ohms, as the ratio of potential difference to current" | Total resistance of resistors in series is GCSE combined content. | Mark as stretch. | L |

### Wording

| ID | Topic key, year | Official reference | Finding | Fix | Sev |
|---|---|---|---|---|---|
| K3-W1 | bcell, Y7 | "the structural adaptations of some unicellular organisms" | The objective only lists "unicellular organisms". The only tested item is a vocabulary question (q09). | Add the adaptation aspect (structure and function of one example). | L |
| K3-W2 | bfunc, Y7 (objective 2) | "calculations of energy requirements in a healthy daily diet" | The objective adds "the use of food tests", which is not in the KS3 text. | Keep as a practical, but drop it from the objectives as a statutory item. | L |

Matches the official wording closely (no issue): cearth (structure of the Earth, rock cycle), pspace (light year, seasons and tilt, g = 10 N/kg), cele, cpart (particle model, diffusion), creact (acids, neutralisation, catalysts), penergy Y7 (kilojoule food labels).

## 6. science-ks4 (GCSE, Y10 and Y11)

The DfE GCSE text does not assign Y10 or Y11. This section checks combined versus triple-only content, using the brief's policy that triple-only content sits at difficulty 3.

Method for identifying triple-only content: bullets in the single-science PDF with no counterpart in the combined PDF. Content confirmed as separate-sciences-only that matters below: Space physics (whole section); pyramids of biomass, trophic-level efficiency and decomposition rates; monoclonal antibodies; aseptic techniques; eye and brain; plant hormones; kidney, ADH, skin; DNA structure detail and protein synthesis; transition metals, nanoparticles, alloys, corrosion, ceramics; fuel cells and chemical cells; organic chemistry (homologous series, alkenes, polymerisation); molar gas volume; yield and atom economy; titration; ion tests, flame tests, instrumental methods; fertilisers and Haber; static electricity and electric fields; transformers, generator effect, microphones and speakers; pV = constant; pressure in fluids and upthrust; moments, levers, gears; lenses; black-body radiation; fission and fusion; red-shift and Big Bang.

### Mislabelled or misplaced (policy: triple-only content should be labelled and sit at d3)

`D` marks a diagnostic (placement) question.

| ID | Topic key, year | Official reference | Finding | Fix | Sev |
|---|---|---|---|---|---|
| K4-M1 | c4quant, Y11 (objectives 2 to 4) | Combined text: "explain how the mass of a solute and the volume of the solution is related to the concentration". There is no molar gas volume, no yield, no atom economy and no titration in the combined document. | q02 (d1, molar volume), q03 (d1, yield), q06 (d2, gas volume), q07 (d2, D, percentage yield), q08 (d2, atom economy), q09 (d2, yield), q10 (d2, titration apparatus) are all separate-sciences-only at d1 or d2. Only the concentration items (q01, q04 D, q05) are combined. Only titration is tagged "(higher tier)" and none is tagged triple. | Tag objectives 2 to 4 "(triple)". Move the items to d3, or flag them as triple-only. Replace the diagnostic q07 with q04 or q05. | H |
| K4-M2 | p4space, Y11 (whole topic) | The combined document contents list has no Space physics. Single physics has "Space physics: solar system; stability of orbital motions; satellites; red-shift". | All of q01 to q09 (d1 and d2, including D q04 and D q07) are triple-only. Only red-shift and Big Bang are tagged. | Mark the whole topic as triple physics. Remove the diagnostic flags if the placement paper is for combined students. | H |
| K4-M3 | c4anal, Y11 | Single only: "describe tests to identify aqueous cations and aqueous anions", "flame tests", "instrumental methods". | The objectives are tagged (triple) correctly, but q03 (d1, flame colour), q08 (d2), q09 (d2, D, halide test) and q10 (d2) are triple-only at d1 or d2. | Move to d3, or flag. Replace D q09. | H |
| K4-M4 | c4org, Y11 (objectives 3 and 4) | The combined text has only fractional distillation, "CnH2n+2 ... alkane homologous series" and cracking. Alkenes, bromine water and addition polymerisation are in the single-sciences "Organic chemistry" section. | q03 (d1, bromine water on an alkene), q09 (d2), q10 (d2, D, poly(propene)) are triple-only. q08 (d2, D, alkene from cracking) is borderline. Only alcohols, carboxylic acids and condensation polymers are tagged. (The claim that exam boards include alkenes in combined is unverified.) | Tag objectives 3 and 4 triple, or move the items to d3. | H |
| K4-M5 | c4bond, Y11 | Single only: "describe the composition of some important alloys", nanoparticles ("compare 'nano' dimensions..."). | q05 (d2, D, alloys), q08 (d2, nanoparticle size), q10 (d2, D, sun cream nanoparticles) are triple-only. Objectives 3 (alloys), 4 and 5 are untagged. | Tag them, or move to d3. | M |
| K4-M6 | c4atmo, Y11 (objective 5) | Single only: "describe the conditions which cause corrosion ... alloys ... ceramics, polymers, composites". | The objective is untagged. q03 (d1, rusting) is triple-only at d1. (q12 at d3 is fine.) | Tag it. Move q03. | M |
| K4-M7 | c4chem, Y11, q09 (d2) | Single only: "evaluate the advantages and disadvantages of hydrogen/oxygen and other fuel cells" | The objective is tagged (triple), but q09 (fuel-cell product) sits at d2. | Move to d3. | M |
| K4-M8 | p4mag, Y11 | Single only: "induced potential difference", "transformers", "microphones and speakers". Combined has permanent and induced magnets, the motor effect, and the National Grid in outline. | The objectives are tagged, but q04 (d2, D, transformer output), q05 (d2), q09 (d2, D, generator), q10 (d2, turns ratio) are triple-only at d2. | Move to d3, or flag. | H |
| K4-M9 | b4eco, Y11 | Single only: "describe pyramids of biomass ... calculate the efficiency of biomass transfers between trophic levels". | Objective 2 ("trophic levels, pyramids of biomass and biomass transfer efficiency") is untagged. q09 (d2, D, percentage energy transferred) is triple-only. q11 (d3) is fine. | Tag the objective, move q09 to d3 and replace the diagnostic. | M |
| K4-M10 | b4home, Y11 (objective 5) | Combined text: "explain the roles of thyroxine and adrenaline in the body, including thyroxine as an example of a negative feedback system" | The objective says "Triple stretch: thyroxine, adrenaline, ADH ... plant hormones". Thyroxine and adrenaline are core (both PDFs). Only one flashcard and one objective line mention them and no question tests them. | Relabel as core. Add a d2 question on thyroxine and negative feedback. | H |
| K4-M11 | p4energy, Y10 (objective 5) | Combined text: "explain ways of reducing unwanted energy transfer e.g. through lubrication, thermal insulation; describe the effects, on the rate of cooling of a building, of thickness and thermal conductivity of its walls (qualitative only)" | The objective says "thermal conduction, insulation and U-values (triple)". Insulation and conductivity are combined content. "U-value" appears in neither DfE document. | Relabel as core (qualitative). Remove U-values. | M |
| K4-M12 | b4inf, Y10 (required practical); b4cell | Single only: "explain the aseptic techniques used in culturing organisms" | The antimicrobial practical is presented as core, but the DfE combined text has no aseptic techniques. (Boards may include the practical; unverified.) | Add a "check your board" note, or tag it. | L |

### Gaps

| ID | Topic key, year | Official reference | Finding | Fix | Sev |
|---|---|---|---|---|---|
| K4-G1 | c4quant, Y10 | Combined text: "deduce the empirical formula of a compound from the relative numbers of atoms present or from a model or diagram and vice versa" | "empirical" appears in no KS4 file. | Add to c4quant Y10. | M |
| K4-G2 | c4atmo, Y11 | Combined text: "evaluate alternative biological methods of metal extraction (bacterial and phytoextraction)" | Not covered. | Add. | L |
| K4-G3 | c4anal, Y11 | Combined text: "describe, explain and exemplify the processes of filtration, crystallisation, simple distillation, and fractional distillation" | Objectives cover purity, chromatography and gas tests. Separation techniques are covered only in KS3. | Add an objective and question. | L |
| K4-G4 | b4home, Y11 | (see K4-M10) | Combined thyroxine/adrenaline content is present but unassessed. | Covered by the K4-M10 fix. | M |
| K4-G5 | multiple (optional) | Single-only strands: eye and brain; plant hormones and auxins (phototropism, gravitropism); kidney structure and skin thermoregulation; DNA nucleotide structure and protein synthesis; Darwin and Wallace; transition metals (c4atom obj 6, listed but no question); black-body radiation and seismic waves (listed in the p4wave objective) | Not covered at all (or listed with no question). | Optional triple d3 items. | L |

### Beyond the DfE text (check the target exam board; board content is unverified)

| ID | Topic key, year | Finding | Fix | Sev |
|---|---|---|---|---|
| K4-O1 | b4inh, Y11 (q06, q07 D, q10) | Pedigree/family-tree analysis is in neither DfE document. Objective 5 and three of these items depend on it, including a diagnostic. | Keep, but check with the exam board and avoid the diagnostic flag. | L |
| K4-O2 | b4org, Y10 (q08 D) | "Cardiac output" calculation is not in the DfE text (only structure and function of the heart). | Same as above. | L |
| K4-O3 | b4bio, Y10 (obj 2, q10) | "Oxygen debt" and chlorophyll as a limiting factor are not in the DfE text. The DfE lists temperature, light intensity and carbon dioxide. | Keep with a note. | L |
| K4-O4 | p4elec, Y10 (obj 3, q10) | DfE (both documents): "calculate the currents, potential differences and resistances in d.c. series circuits"; parallel is "qualitative explanation only". Parallel calculations are beyond the DfE letter. | Keep as d3 stretch. | L |

### Wording

| ID | Topic key, year | Finding | Fix | Sev |
|---|---|---|---|---|
| K4-W1 | c4atom, Y10 (objective 6) | "Describe the properties of transition metals": triple-only, untagged, and no question tests it. | Tag it or drop it. | L |
| K4-W2 | b4inh, Y11 (objective 6) | DfE: "describe the impact of developments in biology on classification systems". The objective narrows this to "Linnaeus, binomial names, three-domain system"; this is board-style detail. | Reword to the DfE phrase. | L |

Checked and consistent: b4bio, b4cell, b4inf, b4inh (Y10), c4chem (Y10 and most Y11), c4rate (Haber item is d3), p4atom (fission and fusion labelled, q12 at d3), p4force (moments and pressure tagged triple; q12 at d3), p4part (pV item at d3), p4wave (seismic, lens, black-body tagged).

## 7. science-ks5-bio (A level Y12 and Y13)

AS/A2 split (from bold text in Appendix 1): AS = biodiversity, exchange and transport, cells, biological molecules (including enzymes and DNA to protein). A2 = ecosystems, control systems, genetics and evolution, energy for biological processes. Our placement agrees (b5cell, b5div, b5enz, b5exch, b5mol, b5gen Y12 in Y12; b5ctrl, b5eco, b5resp, b5inh, b5tech and b5gen Y13 in Y13).

| ID | Category | Topic key, year | Official reference | Finding | Fix | Sev |
|---|---|---|---|---|---|---|
| B5-G1 | Gap | b5ctrl, Y13 | "stimuli, both internal and external, are detected leading to responses" (A2) | Sensory receptors, reflexes, plant responses (tropisms, taxis, kinesis) are absent. b5ctrl covers only nerves, muscle and hormones. | Add a topic-year. | M |
| B5-G2 | Gap | b5cell, Y12 | "the cell theory is a unifying concept in biology" | Not covered. | Add a card and a question. | L |
| B5-G3 | Gap | b5tech, Y13 | Appendix 5c (biology): "use of light microscope ... including use of a graticule", "safely use instruments for dissection", "use qualitative reagents", "colorimeter or potometer", "aseptic techniques ... agar plates and broth" | No graticule, dissection, colorimeter or potometer items. Aseptic technique appears only in b5imm, not in b5tech. Serial dilution, calibration, electrophoresis and chromatography are covered. | Add a practical-techniques section. | M |
| B5-O1 | Beyond DfE core | b5imm (Y12 and Y13) | Appendix 1 contains no disease or immunity bullet. | The immune response, vaccination, HIV and ELISA come from exam-board content (unverified). Fine as content, but not traceable to the DfE text. | Label as board-specific. | L |

## 8. science-ks5-chem (A level Y12 and Y13)

AS/A2 split (from bold text in Appendix 2). AS includes: empirical formulae, moles, titrations, atomic structure, bonding, enthalpy and Hess's law, collision theory, Kc as a concept, Brønsted-Lowry, Kw and pH of strong acids, oxidation states, group trends and period trends, E-Z (geometric) isomerism, addition and substitution reactions, mass spectrometry and IR. A2 (bold) includes: non-structured titration calculations, entropy and feasibility, rate equations, Kc calculation and the effect of temperature on Kc, Ka and buffers, electrode potentials, transition metals and complexes, optical isomerism, benzene, condensation polymerisation, electrophilic substitution and nucleophilic addition, NMR and chromatography.

| ID | Category | Topic key, year | Official reference | Finding | Fix | Sev |
|---|---|---|---|---|---|---|
| C5-G1 | Gap | c5anal or c5amt (practicals) | Appendix 5c (chemistry): "purify a solid product by recrystallization", "volumetric flask, including accurate technique for making up a standard solution", "pH meter or pH probe", "melting point apparatus" | No recrystallisation, no volumetric-flask/standard-solution item and no pH meter or probe item. Reflux, distillation, separating funnel, titration and rates methods are covered. | Add practical items. | M |
| C5-M1 | Misplaced | c5eq, Y12 (objective 2) | "equilibrium constants, Kc" is AS (normal); "calculation of Kc and reacting quantities" and "the effect of temperature changes on Kc" are A2 (bold). | Kc calculations from equilibrium amounts are placed in Y12. (Exam boards vary; unverified.) | Move the calculations to Y13 or note the board. | L |
| C5-M2 | Misplaced | c5eq, Y13 (objective 2) | "the Bronsted-Lowry theory ... The ionic product of water, Kw; pH and its calculation for strong acids and strong bases" is AS (normal). | Placed in Y13, one year later than the DfE split. | Note the board, or move. | L |
| C5-M3 | Misplaced | c5gp, Y13 (objective 1) | "trends in properties of elements across a period including: melting point; ionisation energy" is AS. | Period 3 trends sit in Y13. (Ionisation energy across period 3 is already in c5atom Y12.) | Move or split. | L |
| C5-O1 | Beyond DfE core | c5kin Y13, c5eq Y13, c5energy Y13, c5amt Y12 | The DfE text has rate equations and Kc but no Arrhenius equation, Kp, Born-Haber cycles or lattice enthalpy, or the ideal gas equation in chemistry. | These are exam-board additions (unverified). Fine, but not traceable to the DfE text. | Label as board-specific. | L |

## 9. science-ks5-phys (A level Y12 and Y13)

AS/A2 split (from bold text in Appendix 3). AS includes: vectors, mechanics (kinematics, dynamics F = ma, energy, momentum), Young modulus, current electricity, waves (polarisation, diffraction, interference, superposition and stationary waves), photons, wave-particle duality. A2 (bold): circular motion, SHM, capacitance, molecular kinetic theory and internal energy, nuclear decay, fission and fusion, E = mc², all of fields and electromagnetic induction.

| ID | Category | Topic key, year | Official reference | Finding | Fix | Sev |
|---|---|---|---|---|---|---|
| P5-G1 | Gap | p5meas, Y12 | "All physics specifications must require knowledge and understanding of: ... the estimation of physical quantities" | "estimat" and "order of magnitude" do not appear in p5meas. | Add estimation items. | M |
| P5-G2 | Gap | p5elec, p5wave (practicals) | Appendix 5c (physics): "signal generator and oscilloscope, including volts/division and time-base", "digital instruments, including electrical multimeters" | No file mentions an oscilloscope, signal generator or multimeter. Vernier/micrometer, light gates, ripple tank, laser, data loggers and radiation detectors are covered. | Add practical items. | M |
| P5-M1 | Misplaced | p5wave, Y13 (objectives 1 to 4) | "graphical treatment of superposition and stationary waves" is AS (normal text) | Stationary waves are placed in Y13. (Exam boards vary; unverified.) | Move to Y12 or note the board. | L |
| P5-O1 | Beyond DfE core | p5part Y12 (quarks, leptons), p5astro Y13, p5nuc Y13 (R = r₀A^(1/3)), p5field Y13 (Kepler, escape speed) | Not in the DfE list. | These are board-specific options (unverified). | Label as board-specific. | L |

## 10. Limits of this check

- Coverage was judged from the dumped objectives, note titles, flashcard fronts and question prompts (plus targeted keyword greps in the files). I did not read every note body, so a few partial-coverage items may exist inside notes that the greps did not catch.
- Answer keys and diagrams were not re-verified.
- Foundation/Higher underlining in the GCSE PDFs was not checked.
- AS/A2 bold detection relies on PDF font names and is a heuristic. Exam-board arrangements are not from a fetched source.
