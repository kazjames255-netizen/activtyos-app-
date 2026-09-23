// Original UK KS1-KS4 content for the card sort, sequencer and Venn tools.
import type { KeyStage, ToolSubject } from "../types";
import type { SequenceSet, SortSet, VennSet, VennZone } from "./sorting";

type KS = KeyStage[];
/** cards: [text, index into cats] */
const S = (id: string, title: string, subject: ToolSubject, keyStages: KS, instruction: string, cats: string[], cards: [string, number][], explanation?: string): SortSet => ({
  id, title, subject, keyStages, instruction, explanation,
  categories: cats.map((label, i) => ({ id: `k${i}`, label })),
  cards: cards.map(([text, c], i) => ({ id: `${id}.c${i}`, text, cat: `k${c}` })),
});
const Q = (id: string, title: string, subject: ToolSubject, keyStages: KS, instruction: string, steps: string[], explanation?: string): SequenceSet => ({
  id, title, subject, keyStages, instruction, explanation, steps: steps.map((text, i) => ({ id: `${id}.s${i}`, text })),
});
const Z: Record<string, VennZone> = { l: "left", b: "both", r: "right" };
const V = (id: string, title: string, subject: ToolSubject, keyStages: KS, instruction: string, left: string, right: string, cards: [string, "l" | "b" | "r"][], explanation?: string): VennSet => ({
  id, title, subject, keyStages, instruction, left, right, explanation,
  cards: cards.map(([text, z], i) => ({ id: `${id}.c${i}`, text, zone: Z[z]! })),
});

export const SORT_SETS: SortSet[] = [
  // ---- Science
  S("sci-living", "Living or non-living", "science", [1], "Sort each thing into living or non-living.", ["Living", "Non-living"],
    [["Dog", 0], ["Oak tree", 0], ["Mushroom", 0], ["Bee", 0], ["Rock", 1], ["Chair", 1], ["Water", 1], ["Plastic bag", 1]], "Living things move, grow, feed, reproduce, sense and respire."),
  S("sci-vertebrates", "Vertebrate classes", "science", [1, 2], "Put each animal in its vertebrate class.", ["Mammal", "Bird", "Fish", "Reptile", "Amphibian"],
    [["Dolphin", 0], ["Bat", 0], ["Penguin", 1], ["Eagle", 1], ["Salmon", 2], ["Shark", 2], ["Snake", 3], ["Crocodile", 3], ["Frog", 4], ["Newt", 4]], "Bats and dolphins feed milk to their young; penguins are birds that cannot fly."),
  S("sci-plants", "Plant groups", "science", [1, 2], "Which plant group does each plant belong to?", ["Flowering plant", "Conifer", "Fern", "Moss"],
    [["Rose", 0], ["Daisy", 0], ["Pine", 1], ["Spruce", 1], ["Bracken", 2], ["Hart's-tongue", 2], ["Sphagnum", 3], ["Haircap", 3]]),
  S("sci-states", "States of matter", "science", [2, 3], "Is each one a solid, a liquid or a gas?", ["Solid", "Liquid", "Gas"],
    [["Iron nail", 0], ["Sand", 0], ["Wood", 0], ["Milk", 1], ["Oil", 1], ["Orange juice", 1], ["Helium", 2], ["Oxygen", 2]], "Sand pours, but each grain is a solid."),
  S("sci-conduct", "Conductors and insulators", "science", [2, 3], "Does it let electricity flow easily?", ["Conductor", "Insulator"],
    [["Copper wire", 0], ["Iron nail", 0], ["Aluminium foil", 0], ["Graphite pencil lead", 0], ["Rubber", 1], ["Plastic ruler", 1], ["Wood", 1], ["Glass", 1]]),
  S("sci-magnetic", "Magnetic or not", "science", [1, 2], "Would a magnet pick it up?", ["Magnetic", "Not magnetic"],
    [["Iron nail", 0], ["Steel paperclip", 0], ["Steel screw", 0], ["Wooden pencil", 1], ["Aluminium foil", 1], ["Copper wire", 1], ["Glass marble", 1], ["Plastic comb", 1]], "Only a few metals, mainly iron, steel, nickel and cobalt, are magnetic."),
  S("sci-ph", "Acid, alkali or neutral", "science", [3, 4], "Sort each substance by its pH.", ["Acid", "Alkali", "Neutral"],
    [["Lemon juice", 0], ["Vinegar", 0], ["Hydrochloric acid", 0], ["Soap solution", 1], ["Bleach", 1], ["Sodium hydroxide", 1], ["Distilled water", 2], ["Sugar solution", 2]], "Acids are below pH 7, alkalis above 7, neutral is 7."),
  S("sci-energy", "Renewable or non-renewable", "science", [3, 4], "Will this energy source run out?", ["Renewable", "Non-renewable"],
    [["Solar", 0], ["Wind", 0], ["Tidal", 0], ["Hydroelectric", 0], ["Coal", 1], ["Oil", 1], ["Natural gas", 1], ["Uranium", 1]]),
  S("sci-forces", "Contact or non-contact forces", "science", [3, 4], "Does the force need things to touch?", ["Contact force", "Non-contact force"],
    [["Friction", 0], ["Air resistance", 0], ["Tension", 0], ["Normal reaction", 0], ["Gravity", 1], ["Magnetic force", 1], ["Electrostatic force", 1]]),
  S("sci-separate", "Separating mixtures", "science", [2, 3], "Which method separates each mixture?", ["Filtration", "Evaporation", "Distillation", "Chromatography"],
    [["Sand from water", 0], ["Tea leaves from tea", 0], ["Salt from salt solution", 1], ["Copper sulfate crystals from solution", 1], ["Pure water from sea water", 2], ["Ethanol from water", 2], ["Colours in felt-tip ink", 3], ["Pigments in spinach", 3]]),
  S("sci-ecm", "Elements, compounds, mixtures", "science", [3, 4], "Is it an element, a compound or a mixture?", ["Element", "Compound", "Mixture"],
    [["Oxygen", 0], ["Iron", 0], ["Gold", 0], ["Water", 1], ["Carbon dioxide", 1], ["Sodium chloride", 1], ["Air", 2], ["Sea water", 2], ["Brass", 2]], "A compound has different atoms chemically joined; a mixture is not joined."),
  S("sci-changes", "Physical or chemical change", "science", [3, 4], "Is a new substance made?", ["Physical change", "Chemical change"],
    [["Melting ice", 0], ["Dissolving sugar", 0], ["Boiling water", 0], ["Cutting paper", 0], ["Burning wood", 1], ["Rusting iron", 1], ["Baking a cake", 1], ["Frying an egg", 1]]),
  S("sci-food", "Food groups", "science", [2, 3], "Which nutrient is each food mostly a source of?", ["Carbohydrate", "Protein", "Fat", "Vitamins (fruit and veg)"],
    [["Rice", 0], ["Pasta", 0], ["Chicken", 1], ["Lentils", 1], ["Butter", 2], ["Olive oil", 2], ["Carrot", 3], ["Apple", 3]]),
  S("sci-diet", "Herbivore, carnivore, omnivore", "science", [2], "What does each animal eat?", ["Herbivore", "Carnivore", "Omnivore"],
    [["Rabbit", 0], ["Cow", 0], ["Lion", 1], ["Eagle", 1], ["Bear", 2], ["Pig", 2], ["Human", 2]]),
  S("sci-planets", "Types of planet", "science", [2, 3], "Rocky planet or gas/ice giant?", ["Rocky planet", "Gas or ice giant"],
    [["Mercury", 0], ["Venus", 0], ["Earth", 0], ["Mars", 0], ["Jupiter", 1], ["Saturn", 1], ["Uranus", 1], ["Neptune", 1]]),
  S("sci-metals", "Metals and non-metals", "science", [3, 4], "Sort by the element's properties.", ["Metal", "Non-metal"],
    [["Copper", 0], ["Iron", 0], ["Magnesium", 0], ["Sulfur", 1], ["Oxygen", 1], ["Carbon (diamond)", 1]]),
  // ---- Maths
  S("mat-oep", "Prime, even or odd", "maths", [2, 3], "Prime numbers first; then the rest by even or odd.", ["Prime", "Even, not prime", "Odd, not prime"],
    [["3", 0], ["7", 0], ["13", 0], ["17", 0], ["4", 1], ["10", 1], ["18", 1], ["26", 1], ["9", 2], ["15", 2], ["21", 2], ["25", 2]], "2 is the only even prime."),
  S("mat-2d3d", "2D or 3D shapes", "maths", [1, 2], "Is it flat (2D) or solid (3D)?", ["2D shape", "3D shape"],
    [["Square", 0], ["Circle", 0], ["Triangle", 0], ["Hexagon", 0], ["Cube", 1], ["Sphere", 1], ["Cone", 1], ["Pyramid", 1]]),
  S("mat-faces", "Faces of 3D shapes", "maths", [1, 2], "Does it have a curved surface?", ["Has a curved surface", "Flat faces only"],
    [["Sphere", 0], ["Cylinder", 0], ["Cone", 0], ["Cube", 1], ["Cuboid", 1], ["Triangular prism", 1], ["Square-based pyramid", 1]]),
  S("mat-triangles", "Types of triangle", "maths", [2, 3], "Match each description to a triangle.", ["Equilateral", "Isosceles (not equilateral)", "Scalene"],
    [["Three equal sides", 0], ["All angles are 60°", 0], ["Two equal sides", 1], ["Two equal angles", 1], ["No equal sides", 2], ["Sides of 5 cm, 7 cm and 9 cm", 2]]),
  S("mat-quads", "Types of quadrilateral", "maths", [2, 3], "Match each clue to a quadrilateral.", ["Rhombus", "Rectangle", "Trapezium", "Kite"],
    [["Four equal sides, angles not 90°", 0], ["All sides equal, diagonals cross at right angles", 0], ["Opposite sides equal, four right angles", 1], ["Diagonals are equal in length", 1], ["Exactly one pair of parallel sides", 2], ["Parallel sides of different lengths", 2], ["Two pairs of equal adjacent sides", 3], ["No parallel sides, diagonals cross at right angles", 3]]),
  S("mat-equiv", "Fractions, decimals, percentages", "maths", [2, 3], "Which value does each one equal?", ["One half", "One quarter", "Three quarters"],
    [["0.5", 0], ["50%", 0], ["5/10", 0], ["0.25", 1], ["25%", 1], ["2/8", 1], ["0.75", 2], ["75%", 2], ["6/8", 2]]),
  S("mat-data", "Discrete or continuous data", "maths", [3, 4], "Can it be counted, or is it measured?", ["Discrete", "Continuous"],
    [["Shoe size", 0], ["Pupils in a class", 0], ["Goals scored", 0], ["Cars in a car park", 0], ["Height", 1], ["Time to run 100 m", 1], ["Mass of a parcel", 1], ["Temperature", 1]]),
  S("mat-rational", "Rational or irrational", "maths", [4], "Can it be written as a fraction of two integers?", ["Rational", "Irrational"],
    [["1/3", 0], ["0.75", 0], ["√9", 0], ["√16", 0], ["√2", 1], ["π", 1], ["√5", 1], ["√3", 1]], "√9 = 3 and √16 = 4 are whole numbers, so they are rational."),
  S("mat-sqcube", "Square or cube numbers", "maths", [2, 3], "Is it a square number or a cube number?", ["Square number", "Cube number"],
    [["16", 0], ["25", 0], ["49", 0], ["8", 1], ["27", 1], ["64", 1], ["125", 1]]),
  // ---- English
  S("eng-wordclass", "Word classes", "english", [2, 3], "Noun, verb, adjective or adverb?", ["Noun", "Verb", "Adjective", "Adverb"],
    [["table", 0], ["freedom", 0], ["run", 1], ["jumped", 1], ["happy", 2], ["blue", 2], ["quickly", 3], ["softly", 3]]),
  S("eng-factop", "Fact or opinion", "english", [2, 3], "Can it be checked, or is it what someone thinks?", ["Fact", "Opinion"],
    [["London is the capital of England.", 0], ["Water boils at 100°C at sea level.", 0], ["A week has seven days.", 0], ["Winter is the best season.", 1], ["Cats make better pets than dogs.", 1], ["This film is boring.", 1]]),
  S("eng-formal", "Formal or informal", "english", [3, 4], "Which register would you use in a letter to a head teacher?", ["Formal", "Informal"],
    [["I regret to inform you", 0], ["Yours faithfully", 0], ["Dear Sir or Madam", 0], ["I would be grateful if", 0], ["Hiya", 1], ["Cheers mate", 1], ["Gonna", 1], ["See you later", 1]]),
  S("eng-figurative", "Figurative language", "english", [3, 4], "Simile, metaphor or personification?", ["Simile", "Metaphor", "Personification"],
    [["As brave as a lion", 0], ["She ran like the wind", 0], ["The moon is a silver coin", 1], ["Life is a journey", 1], ["The wind whispered secrets", 2], ["The sun smiled down on us", 2]], "A simile says 'like' or 'as'; a metaphor says it IS; personification gives human actions to things."),
  S("eng-sentences", "Sentence types", "english", [2, 3], "Statement, question, command or exclamation?", ["Statement", "Question", "Command", "Exclamation"],
    [["The bus is late.", 0], ["It rained all night.", 0], ["What time is it?", 1], ["Where do you live?", 1], ["Close the door.", 2], ["Sit down.", 2], ["What a lovely day!", 3], ["How cold it is!", 3]]),
  S("eng-verbs", "Regular or irregular past tense", "english", [2], "Does the past tense end in -ed?", ["Regular (-ed)", "Irregular"],
    [["walked", 0], ["jumped", 0], ["played", 0], ["went", 1], ["ate", 1], ["ran", 1], ["brought", 1]]),
  // ---- Languages
  S("lan-es-gender", "Spanish: el or la", "languages", [3], "Is the Spanish noun masculine or feminine?", ["Masculine (el)", "Feminine (la)"],
    [["libro", 0], ["perro", 0], ["coche", 0], ["mesa", 1], ["casa", 1], ["ventana", 1]]),
  S("lan-fr-gender", "French: le or la", "languages", [3], "Is the French noun masculine or feminine?", ["Masculine (le)", "Feminine (la)"],
    [["garçon", 0], ["livre", 0], ["fromage", 0], ["table", 1], ["maison", 1], ["porte", 1]]),
  S("lan-de-gender", "German: der, die or das", "languages", [3, 4], "Which article goes with each German noun?", ["der (masculine)", "die (feminine)", "das (neuter)"],
    [["Tisch", 0], ["Mann", 0], ["Frau", 1], ["Lampe", 1], ["Tür", 1], ["Haus", 2], ["Buch", 2], ["Kind", 2]]),
  S("lan-fr-tense", "French: which tense?", "languages", [3, 4], "Present, past (perfect) or future?", ["Present", "Past", "Future"],
    [["je mange", 0], ["il joue", 0], ["j'ai mangé", 1], ["il a joué", 1], ["je mangerai", 2], ["il jouera", 2]]),
  S("lan-es-tense", "Spanish: which tense?", "languages", [3, 4], "Present, past (preterite) or future?", ["Present", "Past", "Future"],
    [["hablo", 0], ["como", 0], ["hablé", 1], ["comí", 1], ["hablaré", 2], ["comeré", 2]]),
  S("lan-fr-register", "French: tu or vous", "languages", [3, 4], "Formal (vous) or informal (tu)?", ["Formal", "Informal"],
    [["Vous avez faim ?", 0], ["Bonjour, Madame", 0], ["Comment allez-vous ?", 0], ["Tu as faim ?", 1], ["Salut !", 1], ["Comment vas-tu ?", 1]]),
  // ---- Humanities
  S("hum-sources", "Primary or secondary source", "humanities", [2, 3, 4], "Made at the time, or made later about it?", ["Primary source", "Secondary source"],
    [["Diary of a soldier", 0], ["Photograph taken at the time", 0], ["Letter from a Victorian child", 0], ["Roman coin found in a field", 0], ["Textbook", 1], ["Encyclopedia", 1], ["Documentary made today", 1], ["Biography written last year", 1]]),
  S("hum-causes", "Types of cause", "humanities", [3, 4], "Political, economic, social or religious cause?", ["Political", "Economic", "Social", "Religious"],
    [["Rulers fight for power", 0], ["A new law is passed", 0], ["Prices rise and trade falls", 1], ["Many people lose their jobs", 1], ["Crowded, unhealthy towns", 2], ["People demand fairer treatment", 2], ["Churches disagree about beliefs", 3], ["People follow a new faith", 3]]),
  S("hum-geog", "Physical or human geography", "humanities", [2, 3], "Made by nature or by people?", ["Physical feature", "Human feature"],
    [["River", 0], ["Mountain", 0], ["Glacier", 0], ["Volcano", 0], ["City", 1], ["Railway", 1], ["Farm", 1], ["Airport", 1]]),
  S("hum-ages", "Stone, Bronze or Iron Age", "humanities", [2], "Which age does each belong to?", ["Stone Age", "Bronze Age", "Iron Age"],
    [["Flint tools", 0], ["Cave paintings", 0], ["Bronze axe heads", 1], ["Beaker pots", 1], ["Iron ploughs", 2], ["Iron swords", 2]]),
];

export const SEQUENCE_SETS: SequenceSet[] = [
  Q("seq-butterfly", "Life cycle of a butterfly", "science", [1, 2], "Put the stages in order.", ["Egg laid on a leaf", "Caterpillar hatches and eats", "Chrysalis forms", "Adult butterfly comes out"]),
  Q("seq-frog", "Life cycle of a frog", "science", [1, 2], "Put the stages in order.", ["Frogspawn in the pond", "Tadpole hatches", "Tadpole grows back legs", "Froglet grows front legs", "Adult frog leaves the water"]),
  Q("seq-plant", "Life cycle of a flowering plant", "science", [1, 2], "Put the stages in order.", ["Seed germinates", "Seedling grows", "Mature plant grows flowers", "Flowers are pollinated", "Seeds form in the fruit", "Seeds are dispersed"]),
  Q("seq-digestion", "Path of food", "science", [2, 3], "Follow the food through the body.", ["Mouth", "Oesophagus", "Stomach", "Small intestine", "Large intestine", "Anus"]),
  Q("seq-water", "The water cycle", "science", [2, 3], "Put the stages in order.", ["Sun heats water", "Water evaporates", "Vapour rises and cools", "Vapour condenses into clouds", "Rain falls", "Water runs back to the sea"]),
  Q("seq-foodchain", "A food chain", "science", [2], "Start with the energy source.", ["The Sun gives light energy", "Grass makes food by photosynthesis", "A rabbit eats the grass", "A fox eats the rabbit"]),
  Q("seq-investigation", "Scientific investigation", "science", [2, 3, 4], "Put the stages of an investigation in order.", ["Ask a question", "Make a prediction", "Plan a fair test", "Collect the results", "Present the data", "Write a conclusion", "Evaluate the method"]),
  Q("seq-rock", "The rock cycle", "science", [3, 4], "Follow a sedimentary rock's journey.", ["Rock is weathered", "Pieces are eroded and carried away", "Sediment is deposited", "Layers are compacted and cemented", "Heat and pressure make metamorphic rock", "Rock melts to magma", "Magma cools into igneous rock"]),
  Q("seq-circulation", "Blood through the heart", "science", [3, 4], "Follow blood from the body back to the body.", ["Vena cava", "Right atrium", "Right ventricle", "Pulmonary artery", "Lungs", "Pulmonary vein", "Left atrium", "Left ventricle", "Aorta"]),
  Q("seq-mitosis", "Mitosis (simple)", "science", [4], "Put the stages of cell division in order.", ["DNA is copied", "Chromosomes line up in the middle", "Copies are pulled to opposite ends", "Two nuclei form", "The cell splits into two"]),
  Q("seq-planets", "Planets from the Sun", "science", [2, 3], "Nearest the Sun first.", ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"]),
  Q("seq-distil", "Fractional distillation of crude oil", "science", [4], "Put the method in order.", ["Crude oil is heated", "It vaporises", "Vapour enters the column", "Vapour rises and cools", "Each fraction condenses at its boiling point", "Fractions are collected"]),
  Q("mat-bidmas", "Order of operations", "maths", [2, 3], "Which is done first, then next?", ["Brackets", "Indices", "Division", "Multiplication", "Addition", "Subtraction"]),
  Q("mat-units", "Length units", "maths", [2, 3], "Smallest to largest.", ["Millimetre", "Centimetre", "Metre", "Kilometre"]),
  Q("hum-events1", "British history in order", "humanities", [3], "Earliest first.", ["Battle of Hastings (1066)", "Magna Carta sealed (1215)", "Spanish Armada defeated (1588)", "Great Fire of London (1666)", "Battle of Waterloo (1815)"]),
  Q("hum-events2", "Twentieth century events", "humanities", [3, 4], "Earliest first.", ["First World War begins (1914)", "Some women get the vote (1918)", "Second World War begins (1939)", "NHS founded (1948)", "First Moon landing (1969)", "Berlin Wall falls (1989)"]),
  Q("eng-essay", "Writing an essay", "english", [3, 4], "Put the stages in order.", ["Read the question", "Plan your points", "Write an introduction", "Write paragraphs with evidence", "Write a conclusion", "Proofread"]),
  Q("cross-pancakes", "Making pancakes", "cross", [2, 3], "Put the method in order.", ["Weigh flour into a bowl", "Crack eggs into a well", "Whisk in milk to make batter", "Heat a little oil in a pan", "Pour in batter and cook until golden", "Flip and cook the other side"]),
];

export const VENN_SETS: VennSet[] = [
  V("ven-cells", "Plant and animal cells", "science", [3, 4], "Where does each feature belong?", "Plant cell", "Animal cell",
    [["Cell wall", "l"], ["Chloroplasts", "l"], ["Large permanent vacuole", "l"], ["Nucleus", "b"], ["Cell membrane", "b"], ["Mitochondria", "b"], ["Stores energy as glycogen", "r"], ["Irregular, rounded shape", "r"]]),
  V("ven-vertebrates", "Mammals and birds", "science", [2, 3], "Where does each fact belong?", "Mammal", "Bird",
    [["Fur or hair", "l"], ["Feeds young on milk", "l"], ["Feathers", "r"], ["Lays hard-shelled eggs", "r"], ["Warm-blooded", "b"], ["Has a backbone", "b"], ["Breathes with lungs", "b"]]),
  V("ven-multiples", "Multiples of 3 and 4", "maths", [2, 3], "Is the number a multiple of 3, of 4, or both?", "Multiples of 3", "Multiples of 4",
    [["9", "l"], ["15", "l"], ["21", "l"], ["8", "r"], ["16", "r"], ["20", "r"], ["12", "b"], ["24", "b"], ["36", "b"]]),
  V("ven-shapes", "Squares and rectangles", "maths", [2, 3], "Where does each fact belong?", "Square only", "Rectangle only",
    [["All four sides equal", "l"], ["Diagonals cross at right angles", "l"], ["Adjacent sides can differ in length", "r"], ["Can have a long pair and a short pair of sides", "r"], ["Four right angles", "b"], ["Two pairs of parallel sides", "b"], ["Four sides", "b"], ["Diagonals are equal", "b"]]),
  V("ven-fluids", "Liquids and gases", "science", [3], "Where does each fact belong?", "Liquid", "Gas",
    [["Has a fixed volume", "l"], ["Particles are touching", "l"], ["Spreads out to fill its container", "r"], ["Easily squashed", "r"], ["Can flow", "b"], ["Particles are always moving", "b"]]),
  V("ven-water", "Rivers and lakes", "humanities", [2, 3], "Where does each fact belong?", "River", "Lake",
    [["Flows in one direction", "l"], ["Has a source and a mouth", "l"], ["Water is mostly still", "r"], ["Surrounded by land", "r"], ["Home to wildlife", "b"], ["Made of water", "b"]]),
  V("ven-books", "Fiction and non-fiction", "english", [2, 3], "Where does each feature belong?", "Fiction", "Non-fiction",
    [["Made-up characters", "l"], ["A plot", "l"], ["Index and glossary", "r"], ["Facts and diagrams", "r"], ["Has a title", "b"], ["Can have chapters", "b"]]),
];

export const SUBJECTS_WITH_SETS: ToolSubject[] = ["science", "maths", "english", "languages", "humanities", "cross"];
