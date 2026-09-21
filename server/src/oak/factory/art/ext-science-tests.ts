// X3 policy unit tests for the Science extension (ext-science*.ts): for EVERY picture a POSITIVE slide that must get exactly that picture and a NEGATIVE slide
// (a passing mention, or an `avoid` / `requires` gate the picture must respect) that must not; question slides never get a picture; numeric pictures are refused
// when the slide has digits. Imported by cli.ts (runExtScienceTests).
import type { Slide } from "../../../../../features/learninghub/lesson/slides/types";
import { chooseArt } from "./select";
import { EXT_SCIENCE } from "./ext-science";
import { ELEMENT_NAMES } from "./ext-science-chem1";
import { PICS } from "./library";
import type { Pic } from "./types";

type Row = { id: string; pos: [title: string, lead: string]; neg?: [title: string, lead: string, expect?: string[]] };
const R = (id: string, pos: Row["pos"], neg?: Row["neg"]): Row => ({ id: `x3-${id}`, pos, neg });

const ROWS: Row[] = [
  // ── human body ──
  R("skeleton", ["The human skeleton", "The human skeleton is made of bones that support the body."], ["Animal skeletons", "Different animals have different skeletons, such as an endoskeleton."]),
  R("digestive-system", ["The digestive system", "Food passes through the digestive system: the mouth, oesophagus, stomach and small intestine."], ["Cows and digestion", "A cow is a ruminant with a digestive system of four stomachs and food."]),
  R("respiratory-system", ["The breathing system", "Air passes down the trachea into the lungs when we breathe."], ["Cellular respiration", "Cellular respiration releases energy in cells; the lungs supply the oxygen.", ["respiration"]]),
  R("alveoli", ["Alveoli", "Oxygen passes into the blood across the alveoli."]),
  R("heart", ["The human heart", "The heart has four chambers: two atria and two ventricles that pump blood."], ["Heart rate", "Your heart rate rises when you exercise so the heart pumps blood faster."]),
  R("circulation", ["The double circulatory system", "The double circulatory system carries blood to the lungs and then to the body."], ["Fish circulation", "A fish has a single circulatory system with one loop."]),
  R("blood-vessels", ["Arteries, veins and capillaries", "Blood vessels carry blood around the body: arteries, veins and capillaries."], ["Leaf veins", "The veins of a leaf carry water."]),
  R("blood", ["Red blood cells", "Red blood cells carry oxygen; white blood cells fight infection; platelets help clotting."], ["Blood glucose", "Blood glucose is controlled by insulin. Blood cells are not affected."]),
  R("nervous-system", ["The nervous system", "The nervous system includes the brain, the spinal cord and nerves."]),
  R("reflex-arc", ["A reflex arc", "A reflex arc links a stimulus to a response through a receptor and an effector."], ["Reflex angles", "A reflex angle is bigger than a straight line."]),
  R("neurone", ["The neurone", "A neurone is a nerve cell that carries electrical impulses."], ["Sensory neurones", "A sensory neurone carries impulses from receptors to the spinal cord."]),
  R("eye", ["The human eye", "Light enters the eye through the cornea and is focused on the retina."], ["Compound eyes", "An insect has a compound eye made of many lenses."]),
  R("ear", ["The human ear", "Sound makes the ear drum vibrate and the cochlea sends impulses to the brain."]),
  R("urinary-system", ["The kidneys", "The kidneys filter the blood and make urine that flows down the ureters to the bladder."], ["Kidney beans", "Kidney beans are a good source of protein."]),
  R("sperm-egg", ["Sperm and egg cells", "A sperm cell has a tail; an egg cell is much larger."], ["Pollen and ovules", "In flowers the pollen carries the male gametes. The egg cell is in the ovule of the plant."]),
  R("female-repro", ["The female reproductive system", "The female reproductive system has ovaries, oviducts and a uterus."], ["Ovary and ovule", "An ovule sits inside the ovary of a carpel."]),
  R("male-repro", ["The male reproductive system", "The testes make sperm, which travel along the sperm duct."]),
  R("teeth", ["Types of teeth", "Incisors cut food and molars grind food in your teeth."], ["Molar mass", "Molar mass is the mass of one mole; teeth are made of calcium phosphate."]),
  R("tooth-structure", ["The structure of a tooth", "A tooth has enamel on the outside and dentine inside the tooth."]),
  // ── plants and life cycles ──
  R("leaf-structure", ["Inside a leaf", "A leaf has palisade cells that photosynthesise in a plant."]),
  R("stomata", ["Stomata", "Guard cells open and close the stomata in a leaf."]),
  R("root-hair-cell", ["Root hair cells", "A root hair cell takes in water from the soil."]),
  R("xylem-phloem", ["Xylem and phloem", "Xylem carries water up the plant and phloem carries sugars."]),
  R("transpiration", ["Transpiration", "Water evaporates from the leaves in transpiration."]),
  R("seed", ["The structure of a seed", "A seed has a testa, a cotyledon, a radicle and a plumule."]),
  R("germination", ["Germination", "Germination needs water, oxygen and warmth for a seed to grow."]),
  R("plant-life-cycle", ["The life cycle of a flowering plant", "A flowering plant makes seeds that are dispersed and germinate."], ["The life cycle of a fern", "A fern has a life cycle of a plant with spores; the life cycle of a flowering plant is different."]),
  R("butterfly-cycle", ["The life cycle of a butterfly", "A butterfly starts as an egg, then a caterpillar, then a chrysalis."], ["The frog and butterfly", "The life cycle of a butterfly is not like a frog."]),
  R("frog-cycle", ["The life cycle of a frog", "A frog starts as frogspawn, then a tadpole grows legs."]),
  // ── cells and genetics ──
  R("bacterial-cell", ["Bacterial cells", "A bacterial cell has no nucleus and a loop of genetic material."], ["Bacteriophage", "A bacteriophage is a virus that infects a bacterial cell."]),
  R("yeast-cell", ["Yeast cells", "Yeast is a single-celled fungus that reproduces by budding."]),
  R("specialised-cells", ["Specialised cells", "Specialised cells are adapted to do a particular job."]),
  R("mitosis", ["Mitosis", "Mitosis makes two identical cells."], ["Meiosis", "Meiosis makes gametes, unlike mitosis, which makes identical cells."]),
  R("dna", ["The structure of DNA", "DNA is a double helix made of two strands joined by base pairs."], ["RNA and mRNA", "mRNA copies the DNA in the nucleus."]),
  R("genome", ["Chromosomes and genes", "Genes are sections of DNA found on chromosomes in the nucleus."], ["Genetic engineering", "In genetic engineering a gene is moved into another organism."]),
  R("punnett-square", ["Punnett squares", "A Punnett square predicts the offspring of a genetic cross."]),
  R("alleles", ["Alleles", "Alleles are different versions of a gene, so a genotype can be homozygous or heterozygous."]),
  R("natural-selection", ["Natural selection", "Individuals with helpful features survive and reproduce."], ["Selective breeding", "Selective breeding is artificial selection, unlike natural selection."]),
  R("vertebrates", ["Vertebrates", "Vertebrates include fish, amphibians, reptiles, birds and mammals."], ["Invertebrates and vertebrates", "Invertebrates have no backbone, unlike vertebrates."]),
  R("invertebrates", ["Invertebrates", "Invertebrates such as insects, spiders and snails have no backbone."], ["Vertebrates and invertebrates", "A vertebrate has a backbone; an invertebrate does not."]),
  R("classification-key", ["Classification keys", "A classification key uses yes and no questions to identify organisms."]),
  R("five-kingdoms", ["The five kingdoms", "Classification sorts organisms into animals, plants, fungi, protists and prokaryotes."], ["Three domains", "The three domain system of classification replaced the five kingdoms."]),
  R("taxonomy", ["Taxonomy", "Taxonomy sorts organisms from kingdom to species."]),
  R("biomass-pyramid", ["A pyramid of biomass", "The biomass decreases at each trophic level."], ["A pyramid of numbers", "A pyramid of numbers can be inverted, unlike a pyramid of biomass."]),
  R("carbon-cycle", ["The carbon cycle", "Carbon moves between the air, living things and fossil fuels."]),
  R("predator-prey", ["Predator and prey", "Predator numbers change after the prey numbers."]),
  R("quadrat", ["Using a quadrat", "A quadrat is used to sample plants in a field."]),
  R("balanced-diet", ["A balanced diet", "A healthy diet has carbohydrates, proteins, fats, vitamins and fibre."], ["Plant nutrients", "Nutrients such as nitrates are transported in the phloem of a plant."]),
  R("antagonistic-muscles", ["Antagonistic muscles", "The biceps and triceps work as a pair."]),
  R("enzyme", ["Enzymes", "An enzyme has an active site where the substrate fits."], ["Enzyme concentration", "The enzyme concentration changes the rate of reaction."]),
  R("diffusion", ["Diffusion", "Diffusion is the movement of particles from a high to a low concentration."], ["Diffusion and active transport", "Diffusion does not need energy but active transport does.", ["x3-active-transport"]]),
  R("osmosis", ["Osmosis", "Osmosis is the movement of water across a partially permeable membrane."], ["Reverse osmosis", "Reverse osmosis is used to make drinking water."]),
  R("active-transport", ["Active transport", "Active transport uses energy to move particles against a concentration gradient."]),
  R("microscope", ["The light microscope", "A light microscope has an eyepiece lens and objective lenses."], ["Electron microscopy", "An electron microscope has better resolution than a light microscope."]),
  R("levels-organisation", ["Levels of organisation", "Cells make tissues, tissues make organs and organs make organ systems."], ["Potato tissue", "The tissue of a potato loses mass in strong sugar solution."]),
  R("endocrine", ["The endocrine system", "Glands release hormones into the blood."], ["Plant hormones", "Auxin is a plant hormone that causes cells to elongate."]),
  R("homeostasis", ["Homeostasis", "Negative feedback keeps conditions in the body steady."]),
  R("phototropism", ["Phototropism", "Shoots grow towards light because of auxin."], ["Phototropism and gravitropism", "Roots show gravitropism but shoots show phototropism."]),
  R("pathogens", ["Pathogens", "Pathogens are microorganisms that cause communicable diseases."], ["Non-communicable diseases", "Heart disease is a non-communicable disease, not caused by pathogens."]),
  // ── chemistry ──
  R("glassware", ["Laboratory apparatus", "A beaker, a conical flask and a measuring cylinder are used in experiments."]),
  R("heating-apparatus", ["The Bunsen burner", "A Bunsen burner heats a beaker on a tripod and gauze."], ["The safety flame", "The safety flame of a Bunsen burner is yellow."]),
  R("meniscus", ["The meniscus", "Read the volume at the bottom of the meniscus in a measuring cylinder."]),
  R("titration", ["Titration", "Solution is added from a burette until the indicator changes colour."]),
  R("dissolving", ["Soluble and insoluble", "A solute dissolves in a solvent to make a solution."], ["Concentration of solutions", "The concentration of a solution is the mass of solute per volume of solvent."]),
  R("filtration", ["Filtration", "The filter paper holds back the residue and the filtrate passes through the funnel."], ["Water filters", "A water filter cleans drinking water."]),
  R("distillation", ["Simple distillation", "The condenser cools the vapour into the distillate."], ["Fractional distillation", "Fractional distillation separates crude oil in a fractionating column with a condenser."]),
  R("crystallisation", ["Crystallisation", "Crystals form when the solution cools in the evaporating basin."]),
  R("chromatography", ["Paper chromatography", "The solvent front moves up the paper and separates the spots."], ["Gas chromatography", "Gas chromatography separates a mixture."]),
  R("subatomic", ["Protons, neutrons and electrons", "The nucleus of an atom contains protons and neutrons."], ["Neutron stars", "A neutron star forms when a supernova leaves a very dense core.", ["x3-star-life-cycle"]]),
  R("atomic-number", ["Atomic number and mass number", "The mass number is the total number of particles in the nucleus."]),
  R("isotopes", ["Isotopes", "Isotopes have the same number of protons but different neutrons."], ["Radioactive isotopes", "A radioactive isotope decays with a half-life."]),
  R("ionic-bonding", ["Ionic bonding", "Sodium gives an electron to chlorine, making ions that attract."], ["Covalent and ionic bonding", "Ionic bonding differs from covalent bonding and metallic bonding."]),
  R("ionic-lattice", ["A giant ionic lattice", "An ionic lattice has ions held by strong attractions."]),
  R("covalent-bond", ["Covalent bonds", "A covalent bond is a shared pair of electrons."], ["Ionic and covalent bonds", "Ionic bonds transfer electrons but a covalent bond shares them."]),
  R("carbon-forms", ["Diamond and graphite", "Diamond and graphite are giant covalent forms of carbon atoms."], ["Graphene and fullerenes", "Graphite, graphene and fullerenes are forms of carbon."]),
  R("metallic-bonding", ["Metallic bonding", "Metals have delocalised electrons that are free to move."]),
  // ── reactions, atmosphere, earth and space ──
  R("reactivity-series", ["The reactivity series", "Metals are placed in a reactivity series from potassium to gold."]),
  R("metals-nonmetals", ["Metals and non-metals", "Metals conduct heat and non-metals are brittle."], ["Metal oxides", "Metal oxides react with acids; non-metal oxides are acidic."]),
  R("conservation-of-mass", ["Conservation of mass", "Atoms are not lost in a reaction, so mass is conserved."]),
  R("combustion", ["Combustion", "A fuel burns in oxygen in a combustion reaction."], ["Incomplete combustion", "Incomplete combustion makes carbon monoxide and soot when a fuel burns."]),
  R("neutralisation", ["Neutralisation", "An acid is neutralised by an alkali."], ["Neutralisation with carbonates", "An acid is neutralised by a carbonate."]),
  R("acid-reactions", ["Reactions of acids", "Acids react with metals to make a salt and hydrogen."], ["Acids and the pH scale", "Acids and alkalis are measured with an indicator on the pH scale.", ["ph-scale"]]),
  R("electrolysis", ["Electrolysis", "In electrolysis ions move to the cathode and the anode."], ["Electric cells", "An electric cell uses an electrolyte to make a voltage in a battery."]),
  R("rate-graph", ["Rate of reaction", "The rate of reaction is shown by the steepness of the graph."], ["Rate at equilibrium", "At equilibrium the rate of reaction forwards equals the rate backwards."]),
  R("catalyst", ["Catalysts", "A catalyst speeds up a reaction without being used up."], ["Enzymes as catalysts", "An enzyme is a biological catalyst.", ["x3-enzyme"]]),
  R("atmosphere", ["Gases in the air", "The gases in the air are mostly nitrogen and oxygen."], ["The early atmosphere", "The composition of the atmosphere was different billions of years ago."]),
  R("greenhouse", ["The greenhouse effect", "Greenhouse gases trap heat in the atmosphere."], ["Greenhouse growing", "A greenhouse effect helps plants grow; a glasshouse warms them."]),
  R("rock-cycle", ["The rock cycle", "Rocks are recycled over time."]),
  R("rock-types", ["Types of rock", "Igneous, sedimentary and metamorphic rocks form in different ways."]),
  R("seasons", ["The seasons", "The tilt of the Earth on its axis causes the seasons."], ["Spring weather", "The seasons bring changes in the weather, so the Earth and plants change."]),
  R("day-night", ["Day and night", "The Earth spins so one side faces the Sun."]),
  R("eclipses", ["Solar and lunar eclipses", "An eclipse happens when the Sun, Earth and Moon line up."]),
  R("orbits", ["Orbits", "The Moon orbits the Earth."], ["Geostationary orbits", "A geostationary satellite has an orbit above the equator."]),
  R("star-life-cycle", ["The life cycle of a star", "A star forms in a nebula and ends as a white dwarf."]),
  R("gravity", ["Gravity", "Gravity is a force that pulls objects towards the Earth."], ["Gravity and seedlings", "Seedlings grow in response to gravity."]),
  // ── physics ──
  R("speed-triangle", ["Calculating speed", "Average speed is distance divided by time."], ["Orbital speed", "The orbital speed of a satellite is its distance divided by time."]),
  R("density-triangle", ["Density", "Density is mass divided by volume."], ["Population density", "Population density is the number of people per area of land, with mass migration and volume."]),
  R("pressure-triangle", ["Pressure", "Pressure is force divided by area."], ["Blood pressure", "Blood pressure is a force over an area in the arteries."]),
  R("acceleration-triangle", ["Acceleration", "Acceleration is the change in velocity divided by time."], ["Newton's second law", "Newton's second law links acceleration, resultant force and mass."]),
  R("wave-equation", ["The wave equation", "The wave speed depends on the frequency and wavelength."]),
  R("ohms-law", ["Ohm's law", "The resistance of a resistor in a circuit is found using Ohm's law."], ["Air resistance", "Air resistance is a force that opposes the current of air; a circuit is not involved.", ["x3-friction-resistance"]]),
  R("measuring-electricity", ["Ammeters and voltmeters", "An ammeter measures current in a circuit."], ["Electric shock", "High voltage causes an electric shock; insulators keep us safe."]),
  R("iv-graphs", ["Filament lamp and diode", "The resistance of a filament lamp changes as it heats up."]),
  R("electromagnet", ["Electromagnets", "A coil of wire around an iron core makes an electromagnet."], ["The electric motor", "An electric motor uses an electromagnet."]),
  R("magnetic-field", ["Magnetic fields", "The magnetic field of a magnet is shown by field lines."], ["The Earth's magnetic field", "The Earth's magnetic field acts on a compass and a magnet."]),
  R("electrostatics", ["Static electricity", "Like charges repel and opposite charges attract."]),
  R("energy-stores", ["Energy stores", "Energy is transferred between energy stores."], ["Energy transfers in food chains", "Energy transfer between trophic levels in a food chain."]),
  R("sankey", ["Sankey diagrams", "A Sankey diagram shows useful and wasted energy."], ["Efficiency of a reaction", "The efficiency of a reaction affects the yield and cost of a chemical."]),
  R("energy-resources", ["Energy resources", "Renewable energy resources will not run out but fossil fuels will."], ["Fuel cells", "A hydrogen fuel cell is an energy resource that makes electricity."]),
  R("heat-transfer", ["Conduction, convection and radiation", "Thermal energy is transferred by heat transfer."], ["Electrical conduction", "Electrical conduction in a metal needs free electrons and heat."]),
  R("moments", ["Moments", "A moment is the turning effect of a force about a pivot."], ["Momentum", "Momentum depends on mass and velocity, so a force acting changes it."]),
  R("hookes-law", ["Hooke's law", "A spring extends in proportion to the force until the limit of proportionality."], ["Elastic potential energy", "The energy of a spring is found from the spring constant and force."]),
  R("friction-resistance", ["Friction", "Friction is a force that slows a moving object."], ["Friction and lubricants", "A lubricant reduces friction, which is a force that slows moving surfaces."]),
  R("forces-arrows", ["Force arrows", "A force arrow shows the size and direction of a force."], ["Balanced force arrows", "Balanced forces have force arrows of the same size.", ["balanced-forces"]]),
  R("contact-forces", ["Contact and non-contact forces", "Friction is a contact force and gravity is a non-contact force."]),
  R("terminal-velocity", ["Terminal velocity", "A falling object reaches terminal velocity when air resistance equals its weight."]),
  R("stopping-distance", ["Stopping distance", "The stopping distance is the thinking distance plus the braking distance."]),
  R("work-done", ["Work done", "Work done is the force times the distance moved."], ["Work done against friction", "Work done against friction heats the surfaces; the force moves a distance.", ["x3-friction-resistance"]]),
  R("seeing-light", ["Light sources", "A light source gives out light which travels in straight lines."], ["Light intensity", "The light intensity depends on the distance from the light source."]),
  R("shadow", ["Shadows", "An opaque object blocks light and makes a shadow."], ["Solar eclipse shadows", "A shadow of the Moon falls on the Earth in a solar eclipse; the light is blocked.", ["x3-eclipses"]]),
  R("materials-light", ["Transparent, translucent and opaque", "Materials let different amounts of light through."]),
  R("prism", ["Dispersion of light", "A prism splits white light into the colours of the spectrum."], ["Triangular prisms", "A triangular prism has a volume; light is not involved in this shape of prism."]),
  R("lenses", ["Convex and concave lenses", "A convex lens brings light rays to a principal focus."], ["Camera lenses", "A camera uses a convex lens to make an image of light rays at the focus."]),
  R("sound-travel", ["Sound waves", "Sound waves travel from a sound source through the air."], ["Electronic music", "A sound wave can be shown as an electronic signal."]),
  R("pitch-loudness", ["Pitch and loudness", "A high pitch sound has a high frequency and a loud sound has a big amplitude."], ["The football pitch", "A football pitch has markings; a sound is not involved."]),
  R("wave-frequency", ["Frequency", "Frequency is the number of waves per second, measured in hertz."], ["Allele frequency", "Allele frequency is the proportion of a gene in a population.", ["x3-alleles"]]),
  R("radiation-penetration", ["Alpha, beta and gamma radiation", "Alpha particles are stopped by paper while gamma rays penetrate."], ["Beta carotene", "Beta carotene is a pigment in carrots; radiation from a source is not involved."]),
  R("half-life", ["Half-life", "The half-life is the time for the activity of a radioactive isotope to halve."]),
  R("fission", ["Nuclear fission", "A neutron splits a large nucleus in nuclear fission."], ["Binary fission", "Bacteria reproduce by binary fission."]),
  R("fusion", ["Nuclear fusion", "Nuclear fusion joins hydrogen nuclei in stars."], ["Fusion and fission", "Nuclear fusion joins nuclei but nuclear fission splits them."]),
  R("atom-models", ["The plum pudding model", "The plum pudding model was replaced by the nuclear model."]),
  R("national-grid", ["The National Grid", "A step-up transformer raises the voltage in the National Grid."]),
  R("ac-dc", ["Alternating current", "Direct current flows one way but alternating current changes direction."], ["The generator", "A generator makes alternating current by induction."]),
  R("mains-wires", ["Mains electricity", "The live wire, neutral wire and earth wire are in a plug."]),
  R("conductors-insulators", ["Electrical conductors and insulators", "Metals are electrical conductors and plastic is an electrical insulator."], ["Thermal conductors", "A thermal insulator keeps heat in; electrical insulators are different."]),
];

// ── image-QA regression rows (art/qaGates.ts round 2): (title, lead, key stage) -> exact pictures ──
type Gate = { name: string; title: string; lead: string; ks: string; expect: string[] };
const GATES: Gate[] = [
  { name: "greenhouse effect is not drawn on a population-growth slide", title: "Key idea 2", lead: "Population growth can lead to increased demand for food, loss of habitats and more production of greenhouse gases.", ks: "ks2", expect: [] },
  { name: "greenhouse effect is not drawn on a biodiversity / deforestation slide", title: "Key words", lead: "Deforestation is the removal of trees. Biodiversity is the range of living organisms. Greenhouse gases contribute to global warming.", ks: "ks4", expect: [] },
  { name: "greenhouse effect still drawn for the effect itself", title: "The greenhouse effect", lead: "Greenhouse gases in the atmosphere absorb infrared and keep the Earth warm.", ks: "ks3", expect: ["x3-greenhouse"] },
  { name: "natural selection is not drawn on a time-scales slide", title: "Key words", lead: "One billion is one thousand million. Evolution: the characteristics of species gradually change over time.", ks: "ks3", expect: [] },
  { name: "natural selection is not drawn on a fossil-evidence slide", title: "Evolution: evidence", lead: "Fossils are evidence that living things have changed over time, which is evolution.", ks: "ks2", expect: [] },
  { name: "natural selection still drawn for evolution by natural selection", title: "Evolution by natural selection", lead: "Evolution happens because the best adapted individuals survive and reproduce.", ks: "ks3", expect: ["x3-natural-selection"] },
  { name: "alleles picture (B / b) is refused when the slide uses P / p", title: "Dominant and recessive", lead: "Purple (P) is dominant to white (p): PP and Pp individuals are purple and pp individuals are white. The alleles present are the genotype.", ks: "ks4", expect: [] },
  { name: "alleles picture (B / b) is refused when the slide uses E / e", title: "Genotypes", lead: "EE is homozygous dominant, Ee is heterozygous and ee is homozygous recessive: the alleles present are the genotype.", ks: "ks4", expect: [] },
  { name: "alleles picture is drawn when the slide uses B / b", title: "Genotypes", lead: "BB is homozygous dominant, Bb is heterozygous and bb is homozygous recessive: the alleles present are the genotype.", ks: "ks4", expect: ["x3-alleles"] },
  { name: "Punnett square (B / b) is refused when the slide uses T / t", title: "Punnett squares", lead: "A Punnett square for a Tt and Tt cross predicts the offspring of the genetic cross.", ks: "ks4", expect: [] },
  { name: "Punnett square is drawn when the slide uses B / b", title: "Punnett squares", lead: "A Punnett square for a Bb and Bb cross predicts the offspring of the genetic cross.", ks: "ks4", expect: ["x3-punnett-square"] },
  { name: "bacterial cell (plasmids, flagellum) is not drawn for KS2", title: "Microorganisms that help us", lead: "Bacteria are microorganisms; some bacteria help us make yoghurt and cheese.", ks: "ks2", expect: [] },
  { name: "bacterial cell is drawn for KS3", title: "Bacterial cells", lead: "A bacterial cell has no nucleus and a loop of genetic material.", ks: "ks3", expect: ["x3-bacterial-cell"] },
  { name: "female reproductive system is not drawn for KS2", title: "Changes in humans before and after birth", lead: "A baby grows inside the uterus of its mother for about nine months.", ks: "ks2", expect: [] },
  { name: "female reproductive system is drawn for KS3", title: "The female reproductive system", lead: "The female reproductive system has ovaries, oviducts and a uterus.", ks: "ks3", expect: ["x3-female-repro"] },
  { name: "male reproductive system is not drawn for KS2", title: "Key words", lead: "The testes are part of the male reproductive system, which changes during puberty.", ks: "ks2", expect: [] },
];
/** every <text> baseline and every <rect> must lie inside the picture's viewBox (labels that fell off the bottom edge / a box past the frame were found in the image QA) */
function insideFrame(p: Pic): string[] {
  const bad: string[] = [];
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(p.svg); if (!vb) return [`${p.id}: no viewBox`];
  const W = Number(vb[1]), H = Number(vb[2]);
  for (const m of p.svg.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)"/g)) { const y = Number(m[2]); if (y > H - 1) bad.push(`${p.id}: text baseline y=${y} below the ${W}x${H} frame`); } // (bottom edge only: rotated axis labels sit in transform groups)
  for (const m of p.svg.matchAll(/<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) { const y = Number(m[2]) + Number(m[4]), x = Number(m[1]) + Number(m[3]); if (y > H + 0.5 || x > W + 0.5) bad.push(`${p.id}: rect ends at (${x}, ${y}) outside the ${W}x${H} frame`); }
  return bad;
}

const S = (kind: Slide["kind"], title: string, lead: string) => ({ kind, title, blocks: [{ t: "lead" as const, text: lead }] });
const got = (kind: Slide["kind"], title: string, lead: string, lessonTitle = "") => chooseArt(S(kind, title, lead), { subject: "Science", keyStage: "ks3", lessonTitle }).pics; // ks3: satisfies the KS-scoped pictures (art/qaGates.ts)
const same = (a: string[], b: string[]) => a.length === b.length && b.every((x) => a.includes(x));

export function runExtScienceTests(): { problems: string[]; tests: number } {
  const bad: string[] = []; let tests = 0;
  const elementRows: Row[] = ELEMENT_NAMES.map((n) => ({ id: `x3-atom-${n}`, pos: [`Electronic structure of ${n}`, `A ${n} atom has its electrons arranged in shells.`] as [string, string], neg: [`The ${n} ion`, `A ${n} ion is formed when the ${n} atom loses or gains electrons.`] as [string, string] }));
  const rows = [...ROWS, ...elementRows];
  const have = new Set(rows.map((r) => r.id));
  for (const p of EXT_SCIENCE) if (!have.has(p.id)) bad.push(`X3: picture ${p.id} has no test row`);
  for (const r of rows) {
    const p = EXT_SCIENCE.find((x) => x.id === r.id);
    if (!p) { bad.push(`X3 test row for unknown picture ${r.id}`); continue; }
    tests++; { const g = got("explain", r.pos[0], r.pos[1]); if (!same(g, [r.id])) bad.push(`X3 TEST ${r.id}: "${r.pos[0]}" expected [${r.id}] got [${g}]`); }
    tests++; if (got("practice", r.pos[0], r.pos[1]).length) bad.push(`X3 TEST ${r.id}: a practice slide must get no picture`);
    tests++; { const g = chooseArt({ kind: "check", title: r.pos[0], blocks: [{ t: "choice", q: r.pos[1], options: ["a", "b"], answer: 0 }] as Slide["blocks"] }, { subject: "Science" }).pics; if (g.length) bad.push(`X3 TEST ${r.id}: a question slide must get no picture`); }
    tests++; { const g = got("explain", "Starter", `Last lesson we met ${p.concepts[0]}.`); if (g.includes(r.id)) bad.push(`X3 NEG ${r.id}: a passing mention must not get the picture`); }
    tests++; { const g = chooseArt(S("explain", r.pos[0], r.pos[1]), { subject: "Maths" }).pics; if (g.includes(r.id)) bad.push(`X3 TEST ${r.id}: must not appear in a Maths lesson`); }
    if (r.neg) { tests++; const g = got("explain", r.neg[0], r.neg[1]); const want = r.neg[2] ?? []; if (!same(g, want)) bad.push(`X3 NEG ${r.id}: "${r.neg[0]}" / "${r.neg[1]}" expected [${want}] got [${g}]`); }
    if (p.numeric) { tests++; if (got("explain", r.pos[0], `${r.pos[1]} For example 12 and 5.`).includes(r.id)) bad.push(`X3 TEST ${r.id}: a numeric picture must be refused when the slide has digits`); }
  }
  for (const g of GATES) { tests++; const got = chooseArt(S("explain", g.title, g.lead), { subject: "Science", keyStage: g.ks }).pics; if (!same(got, g.expect)) bad.push(`X3 GATE "${g.name}": expected [${g.expect}] got [${got}]`); }
  for (const p of PICS) if ((p.subjects as string[]).includes("Science")) { tests++; bad.push(...insideFrame(p)); }
  return { problems: bad, tests };
}
