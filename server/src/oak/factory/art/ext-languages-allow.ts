// X5: literal-emoji extension for French / Spanish / German decks. Only concrete nouns whose emoji is an unambiguous depiction; matched on the WHOLE
// WORD in the target language AND its English gloss (an English gloss is only listed when the English word has no other common meaning).
// Registered at the bottom of allowlist.ts by ONE call: registerLanguageEmoji(EMOJI, EMOJI_AVOID). Entries whose emoji already exists in the base
// list are MERGED (extra words / language subjects added), never duplicated.
// Left out on purpose (false friends / several meanings): fr pain-as-English-pain, chat-as-English-chat (vetoed by phrase), fr ours (English "ours"),
// fr/es café (coffee OR café), banco/Bank (bank OR bench), lengua/langue (tongue OR language), règle/regla (ruler OR rule), fr pêche (peach OR fishing),
// fr souris (mouse OR animal), fr avocat (avocado OR lawyer), es langosta (lobster OR locust), de Bein/Laden/Geschäft/Eis/Hut/Rock/Gift, fr baskets, orange,
// rose, star, foot, hand, heart, key, mouse, plane; the Eiffel Tower is NOT 🗼 (that is Tokyo Tower).
import type { EmojiEntry, Subject } from "./types";

const LANG: Subject[] = ["French", "Spanish", "German"];
interface L { e: string; n: string; en?: string[]; fr?: string[]; es?: string[]; de?: string[]; note?: string }
const L = (e: string, n: string, en: string[], fr: string[], es: string[], de: string[], note?: string): L => ({ e, n, en, fr, es, de, ...(note ? { note } : {}) });

// French words that start with a vowel / mute h are also matched with their elided article (l'oiseau -> "loiseau" after normalisation)
const elide = (ws: string[]) => ws.flatMap((w) => (/^[aeiouyàâäéèêëîïôöùûüœh]/i.test(w) && !w.includes(" ") && !["hibou", "homard", "haricot", "héros"].includes(w) ? [w, `l’${w}`] : [w]));

const LIST: L[] = [
  // animals (plural forms that are not simply +s are listed)
  L("🐕", "dog", [], [], [], ["hunde"]),
  L("🐈", "cat", [], [], [], ["katzen"]),
  L("🐎", "horse", [], ["chevaux"], [], ["pferde"]),
  L("🐄", "cow", [], [], [], ["kühe"]),
  L("🐖", "pig", [], [], [], ["schweine"]),
  L("🐑", "ewe (sheep)", [], [], [], ["schafe"]),
  L("🐦", "bird", [], ["oiseaux"], [], ["vögel"]),
  L("🦆", "duck", ["duck"], ["canard"], ["pato"], ["ente"]),
  L("🐢", "turtle", ["turtle", "tortoise"], ["tortue"], ["tortuga"], ["schildkröte"]),
  L("🦜", "parrot", ["parrot"], ["perroquet"], ["loro"], ["papagei"]),
  L("🐼", "panda", ["panda"], ["panda"], ["panda"], ["panda"]),
  L("🐨", "koala", ["koala"], ["koala"], ["koala"], ["koala"]),
  L("🐐", "goat", ["goat"], ["chèvre"], ["cabra"], ["ziege"]),
  L("🦌", "deer", ["deer"], ["cerf"], ["ciervo"], ["hirsch"]),
  L("🐫", "camel", ["camel"], ["chameau"], ["camello"], ["kamel"]),
  L("🦅", "eagle", ["eagle"], ["aigle"], ["águila"], ["adler"]),
  L("🦢", "swan", ["swan"], ["cygne"], ["cisne"], ["schwan"]),
  L("🐛", "bug (caterpillar)", ["caterpillar"], ["chenille"], ["oruga"], ["raupe"]),
  L("🦀", "crab", ["crab"], ["crabe"], ["cangrejo"], ["krabbe"]),
  L("🦞", "lobster", ["lobster"], ["homard"], [], ["hummer"]),
  L("🐟", "fish", ["fish"], ["poisson"], ["pez", "peces"], ["fisch"]),
  // plants / weather / nature
  L("🌳", "tree", [], [], ["árboles"], ["bäume"]),
  L("🌴", "palm tree", ["palm tree"], ["palmier"], ["palmera"], ["palme"]),
  L("🍂", "fallen leaf (autumn)", ["autumn"], ["automne"], ["otoño"], ["herbst"]),
  L("🌨️", "cloud with snow", ["snow"], ["neige"], ["nieve"], ["schnee"]),
  L("⛈️", "cloud with lightning and rain", ["thunderstorm"], ["orage"], ["tormenta"], ["gewitter"]),
  L("🌬️", "wind face", ["wind"], ["vent"], ["viento"], ["wind"]),
  L("🌫️", "fog", ["fog"], ["brouillard"], ["niebla"], ["nebel"]),
  L("🌙", "crescent moon", ["moon"], ["lune"], ["luna"], ["mond"]),
  L("🏝️", "desert island", ["island"], ["île"], ["isla"], ["insel"]),
  L("🌊", "water wave (sea)", ["sea"], ["mer"], ["mar"], ["meer"]),
  L("🏖️", "beach with umbrella", ["beach"], ["plage"], ["playa"], ["strand"]),
  // food and drink
  L("🍎", "red apple", [], [], [], ["äpfel"]),
  L("🥚", "egg", [], ["œufs", "oeufs"], [], ["eier"]),
  L("🍉", "watermelon", ["watermelon"], ["pastèque"], ["sandía"], ["wassermelone"]),
  L("🥑", "avocado", ["avocado"], [], ["aguacate"], ["avocado"]),
  L("🥦", "broccoli", ["broccoli"], ["brocoli"], ["brócoli"], ["brokkoli"]),
  L("🧅", "onion", ["onion"], ["oignon"], ["cebolla"], ["zwiebel"]),
  L("🥒", "cucumber", ["cucumber"], ["concombre"], ["pepino"], ["gurke"]),
  L("🥖", "baguette", ["baguette"], ["baguette"], ["baguette"], ["baguette"]),
  L("🍔", "hamburger", ["hamburger"], ["hamburger"], ["hamburguesa"], ["hamburger"]),
  L("🍟", "french fries", ["french fries"], ["frites"], ["patatas fritas"], []),
  L("🍝", "spaghetti", ["spaghetti"], ["spaghettis", "spaghetti"], ["espaguetis"], ["spaghetti"]),
  L("🥩", "cut of meat", ["meat"], ["viande"], ["carne"], ["fleisch"]),
  L("🍗", "poultry leg", [], ["poulet"], ["pollo"], ["hähnchen", "hühnchen"]),
  L("🍪", "cookie", ["biscuit", "cookie"], ["biscuit"], ["galleta"], ["keks", "plätzchen"]),
  L("🥗", "green salad", ["salad"], ["salade"], ["ensalada"], ["salat"]),
  L("🥪", "sandwich", ["sandwich"], ["sandwich"], ["bocadillo", "sándwich"], ["sandwich"]),
  L("🧃", "beverage box (juice)", ["juice"], ["jus"], ["zumo"], ["saft"]),
  L("💧", "droplet (water)", ["water"], ["eau"], ["agua"], ["wasser"]),
  L("🍬", "candy", [], ["bonbon"], ["caramelo"], ["bonbon"]),
  L("🎂", "birthday cake", ["birthday cake"], ["gâteau d’anniversaire"], ["tarta de cumpleaños"], ["geburtstagskuchen"]),
  L("🥄", "spoon", ["spoon"], ["cuillère"], ["cuchara"], ["löffel"]),
  L("☕", "hot beverage (coffee)", ["coffee"], [], [], ["kaffee"]),
  // school, home, things
  L("🖊️", "pen", ["pen"], ["stylo"], ["bolígrafo"], ["kugelschreiber"]),
  L("📓", "notebook", ["notebook", "exercise book"], ["cahier"], ["cuaderno"], ["heft"]),
  L("📏", "straight ruler", [], [], [], ["lineal"]),
  L("🖨️", "printer", ["printer"], ["imprimante"], ["impresora"], ["drucker"]),
  L("⌨️", "keyboard", [], ["clavier"], ["teclado"], ["tastatur"]),
  L("📞", "telephone receiver", ["telephone"], ["téléphone"], ["teléfono"], ["telefon"]),
  L("📱", "mobile phone", ["smartphone"], ["téléphone portable"], [], ["smartphone"]),
  L("📻", "radio", ["radio"], ["radio"], ["radio"], ["radio"]),
  L("🎧", "headphone", ["headphones"], [], ["auriculares"], ["kopfhörer"]),
  L("🎮", "video game", ["video game"], ["jeu vidéo"], ["videojuego"], ["videospiel"]),
  L("🧸", "teddy bear", ["teddy bear"], ["peluche", "ours en peluche"], ["peluche", "osito de peluche"], ["teddybär", "kuscheltier"]),
  L("📰", "newspaper", ["newspaper"], [], ["periódico"], ["zeitung"]),
  L("🎒", "school satchel", ["school bag", "backpack", "rucksack"], ["cartable", "sac à dos"], ["mochila"], ["rucksack", "schulranzen"]),
  L("👜", "handbag", ["handbag"], ["sac à main"], ["bolso"], ["handtasche"]),
  L("🪟", "window", ["window"], ["fenêtre"], ["ventana"], ["fenster"]),
  L("🛁", "bathtub", ["bathtub"], ["baignoire"], ["bañera"], ["badewanne"]),
  L("🪑", "chair", ["chair"], ["chaise"], ["silla"], ["stuhl"]),
  L("🏡", "house with garden", ["garden"], ["jardin"], ["jardín"], ["garten"]),
  L("🪥", "toothbrush", ["toothbrush"], ["brosse à dents"], ["cepillo de dientes"], ["zahnbürste"]),
  L("🗺️", "world map", ["map"], [], ["mapa"], ["landkarte"]),
  L("🧳", "luggage", ["suitcase"], ["valise"], ["maleta"], ["koffer"]),
  L("💶", "euro banknote", ["euro"], ["euro"], ["euro"], ["euro"]),
  L("🎅", "Father Christmas", ["father christmas", "santa claus"], ["père noël"], ["papá noel"], ["weihnachtsmann"]),
  L("🎆", "fireworks", ["fireworks"], ["feu d’artifice"], ["fuegos artificiales"], ["feuerwerk"]),
  L("🎪", "circus tent", ["circus"], ["cirque"], ["circo"], ["zirkus"]),
  // clothes
  L("🧢", "billed cap", [], ["casquette"], ["gorra"], ["kappe"]),
  L("👞", "man's shoe", ["shoe"], ["chaussure"], ["zapato"], ["schuh", "schuhe"]),
  L("🩳", "shorts", ["shorts"], [], [], ["shorts"]),
  L("🧣", "scarf", ["scarf"], ["écharpe"], ["bufanda"], ["schal"]),
  L("🧤", "gloves", ["glove"], ["gants"], ["guantes"], ["handschuhe"]),
  L("👔", "necktie", [], ["cravate"], ["corbata"], ["krawatte"]),
  L("👟", "running shoe", ["trainers", "sneakers"], [], [], ["turnschuhe"]),
  // body / people
  L("👄", "mouth", ["mouth"], ["bouche"], ["boca"], ["mund"]),
  L("👅", "tongue", ["tongue"], [], [], ["zunge"]),
  L("👶", "baby", ["baby"], ["bébé"], ["bebé"], ["baby"]),
  L("🧑‍🏫", "teacher", ["teacher"], ["professeur", "enseignant"], ["profesor", "profesora", "maestro", "maestra"], ["lehrer", "lehrerin"]),
  L("🧑‍⚕️", "health worker (doctor)", ["doctor"], ["médecin"], ["médico", "médica"], ["arzt", "ärztin"]),
  // places
  L("🏨", "hotel", ["hotel"], ["hôtel"], ["hotel"], ["hotel"]),
  L("🏭", "factory", ["factory"], ["usine"], ["fábrica"], ["fabrik"]),
  L("🏟️", "stadium", ["stadium"], ["stade"], ["estadio"], ["stadion"]),
  L("🌉", "bridge at night", ["bridge"], ["pont"], ["puente"], ["brücke"]),
  L("🚉", "station", ["railway station", "train station"], ["gare"], [], ["bahnhof"]),
  L("🚏", "bus stop", ["bus stop"], ["arrêt de bus", "arrêt d’autobus"], ["parada de autobús"], ["haltestelle"]),
  L("🚦", "vertical traffic light", ["traffic light"], ["feu rouge"], ["semáforo"], ["ampel"]),
  L("⛽", "fuel pump", ["petrol station"], ["station-service"], ["gasolinera"], ["tankstelle"]),
  L("🕌", "mosque", ["mosque"], ["mosquée"], ["mezquita"], ["moschee"]),
  L("🕍", "synagogue", ["synagogue"], ["synagogue"], ["sinagoga"], ["synagoge"]),
  L("📮", "postbox", ["postbox", "post box"], ["boîte aux lettres"], ["buzón"], ["briefkasten"]),
  L("🏪", "convenience store (shop)", [], ["magasin"], ["tienda"], []),
  L("🏥", "hospital", [], [], [], ["krankenhäuser"]),
  L("🏠", "house", [], [], [], ["häuser"]),
  L("🎭", "performing arts (theatre)", ["theatre", "theater"], ["théâtre"], ["teatro"], ["theater"]),
  L("🎦", "cinema", ["cinema"], ["cinéma"], ["cine"], ["kino"]),
  // transport
  L("🚕", "taxi", ["taxi"], ["taxi"], ["taxi"], ["taxi"]),
  L("🚑", "ambulance", ["ambulance"], ["ambulance"], ["ambulancia"], ["krankenwagen"]),
  L("🚒", "fire engine", ["fire engine"], ["camion de pompiers"], ["camión de bomberos"], ["feuerwehrauto"]),
  L("🚓", "police car", ["police car"], ["voiture de police"], ["coche de policía"], ["polizeiauto"]),
  L("🚜", "tractor", ["tractor"], ["tracteur"], ["tractor"], ["traktor"]),
  L("🏍️", "motorcycle", ["motorbike", "motorcycle"], ["moto"], ["moto"], ["motorrad"]),
  L("🚁", "helicopter", ["helicopter"], ["hélicoptère"], ["helicóptero"], ["hubschrauber", "helikopter"]),
  L("⛵", "sailboat", ["sailing boat", "sailboat"], ["voilier"], ["velero"], ["segelboot"]),
  L("🚇", "metro", [], ["métro"], [], ["u-bahn"]),
  L("🚋", "tram car", ["tram"], ["tramway"], ["tranvía"], ["straßenbahn"]),
  L("🚡", "aerial tramway", ["cable car"], ["téléphérique"], ["teleférico"], ["seilbahn"]),
  L("🚚", "delivery truck", ["lorry", "truck"], ["camion"], ["camión"], ["lastwagen", "lkw"]),
  L("🛴", "kick scooter", ["scooter"], ["trottinette"], ["patinete"], ["roller"]),
  L("🛹", "skateboard", ["skateboard"], ["skateboard"], ["monopatín"], ["skateboard"]),
  // sport and leisure
  L("🏀", "basketball", ["basketball"], ["basket-ball", "basketball"], ["baloncesto"], ["basketball"]),
  L("🎾", "tennis", ["tennis"], ["tennis"], ["tenis"], ["tennis"]),
  L("🏓", "ping pong", ["table tennis"], ["tennis de table", "ping-pong"], ["tenis de mesa", "ping-pong"], ["tischtennis"]),
  L("🏉", "rugby football", ["rugby"], ["rugby"], ["rugby"], ["rugby"]),
  L("🏊", "person swimming", ["swimming"], ["natation"], ["natación"], []),
  L("🚴", "person biking", ["cycling"], ["cyclisme"], ["ciclismo"], ["radfahren"]),
  L("⛷️", "skier", ["skiing"], ["ski"], ["esquí"], ["skifahren"]),
  L("🥋", "martial arts uniform", ["judo"], ["judo"], ["judo"], ["judo"]),
  L("🎣", "fishing pole", ["fishing"], [], [], ["angeln"]),
  L("🎷", "saxophone", ["saxophone"], ["saxophone"], ["saxofón"], ["saxophon"]),
];

/** English phrases that make a word mean something else (checked against the whole slide + lesson title) */
export const EMOJI_AVOID_LANGUAGES = [
  // "chat" (French cat) is also an English word
  "chat with", "a chat", "to chat", "chat about", "chat room", "chatroom", "group chat", "online chat", "chatting", "have a chat", "chat show",
  // English senses of a word that is also on the list
  "in pain", "pain in", "pain relief", "pen pal", "pen friend", "penfriend", "mother tongue", "native tongue", "tongue twister",
  // a school TRIP / report is not the school building
  "school trip", "school report", "school journey",
  // pronunciation lessons (sound titles such as "[o/au/eau]" quote a spelling, not the noun)
  "the sound", "the sounds", "pronouncing", "recognising and", "contrasting",
  // pronunciation / sound-symbol lessons quote foreign words only as sound examples (eau, ei, oi ...): never a picture of the word
  "ssc", "sound symbol", "sound-symbol", "pronunciation", "pronounced", "pronounce", "silent letter", "silent final",
];

/** base-list words that are ALSO common verb forms in the same language (il lit = he reads, elle porte = she wears): removed so they never trigger a picture */
const REMOVE: { emoji: string; fr?: string[]; es?: string[]; de?: string[] }[] = [
  { emoji: "🚪", fr: ["porte"] },   // porter: "elle porte" = she wears
  { emoji: "🛏️", fr: ["lit"] },     // lire: "il lit" = he reads
];

export function registerLanguageEmoji(EMOJI: EmojiEntry[], EMOJI_AVOID: string[]): void {
  for (const x of LIST) {
    const fr = elide(x.fr ?? []), es = x.es ?? [], de = x.de ?? [], en = x.en ?? [];
    const cur = EMOJI.find((e) => e.emoji === x.e);
    if (cur) {
      for (const s of LANG) if (!(cur.subjects as string[]).includes(s)) cur.subjects.push(s);
      cur.words = [...new Set([...cur.words, ...en])];
      cur.fr = [...new Set([...(cur.fr ?? []), ...fr])]; cur.es = [...new Set([...(cur.es ?? []), ...es])]; cur.de = [...new Set([...(cur.de ?? []), ...de])];
    } else {
      EMOJI.push({ emoji: x.e, name: x.n, words: en, fr, es, de, subjects: [...LANG], ...(x.note ? { note: x.note } : {}) });
    }
  }
  for (const r of REMOVE) { const e = EMOJI.find((x) => x.emoji === r.emoji); if (e) { if (r.fr) e.fr = (e.fr ?? []).filter((w) => !r.fr!.includes(w)); if (r.es) e.es = (e.es ?? []).filter((w) => !r.es!.includes(w)); if (r.de) e.de = (e.de ?? []).filter((w) => !r.de!.includes(w)); } }
  // elided forms for the French words of the base entries too (l'oiseau, l'arbre, l'école ...)
  for (const e of EMOJI) if (e.fr) e.fr = [...new Set(elide(e.fr))];
  for (const a of EMOJI_AVOID_LANGUAGES) if (!EMOJI_AVOID.includes(a)) EMOJI_AVOID.push(a);
}
