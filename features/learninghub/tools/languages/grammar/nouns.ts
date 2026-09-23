// MFL noun data (KS3/KS4 themes) + PURE helpers for articles, gender cues and plurals. Original word lists.
// Spanish/French plurals are formed by rule (with an exceptions list); German plurals are stored in the data.

export type NounLang = "es" | "fr" | "de";
export type Gender = "m" | "f" | "n";
export type Theme = "family" | "school" | "food" | "home" | "town" | "holidays" | "hobbies" | "clothes" | "body" | "jobs" | "animals" | "technology";
export const THEMES: Theme[] = ["family", "school", "food", "home", "town", "holidays", "hobbies", "clothes", "body", "jobs", "animals", "technology"];
export const THEME_LABEL: Record<Theme, string> = { family: "Family", school: "School", food: "Food & drink", home: "Home", town: "Town", holidays: "Holidays", hobbies: "Hobbies", clothes: "Clothes", body: "Body", jobs: "Jobs", animals: "Animals", technology: "Technology" };
export type Tier = "F" | "H"; // Foundation / Higher

export interface Noun {
  id: string; lang: NounLang; word: string; gender: Gender; en: string; theme: Theme; tier: Tier;
  /** German only: plural form without article ("Väter"). */
  plural?: string;
  /** Spanish feminine nouns that take "el" in the singular (stressed initial a-/ha-: el agua). */
  elAgua?: boolean;
  /** French: h aspiré — no elision (le haricot). */
  hAspire?: boolean;
}

// row: word|gender|english|theme|tier[|flag]   (German: word|gender|plural|english|theme|tier)
const T: Record<string, Theme> = { fam: "family", sch: "school", food: "food", home: "home", town: "town", hol: "holidays", hob: "hobbies", clo: "clothes", body: "body", job: "jobs", ani: "animals", tech: "technology" };
function parse(lang: NounLang, rows: string): Noun[] {
  return rows.trim().split("\n").map((line) => {
    const c = line.trim().split("|");
    if (lang === "de") { const [word, gender, plural, en, th, tier] = c; return { id: `de-${word}`, lang, word: word!, gender: gender as Gender, plural, en: en!, theme: T[th!]!, tier: tier as Tier }; }
    const [word, gender, en, th, tier, flag] = c;
    const n: Noun = { id: `${lang}-${word}`, lang, word: word!, gender: gender as Gender, en: en!, theme: T[th!]!, tier: tier as Tier };
    if (flag === "el") n.elAgua = true; if (flag === "h") n.hAspire = true;
    return n;
  });
}

const ES = parse("es", `
padre|m|father|fam|F
madre|f|mother|fam|F
hermano|m|brother|fam|F
hermana|f|sister|fam|F
abuelo|m|grandfather|fam|F
abuela|f|grandmother|fam|F
tío|m|uncle|fam|F
tía|f|aunt|fam|F
primo|m|cousin (boy)|fam|F
hijo|m|son|fam|F
familia|f|family|fam|F
colegio|m|school|sch|F
profesor|m|teacher (male)|sch|F
profesora|f|teacher (female)|sch|F
clase|f|class|sch|F
asignatura|f|school subject|sch|F
libro|m|book|sch|F
cuaderno|m|exercise book|sch|F
bolígrafo|m|pen|sch|F
mochila|f|school bag|sch|F
patio|m|playground|sch|F
horario|m|timetable|sch|H
examen|m|exam|sch|F
recreo|m|break time|sch|F
instituto|m|secondary school|sch|F
idioma|m|language|sch|H
pan|m|bread|food|F
leche|f|milk|food|F
queso|m|cheese|food|F
manzana|f|apple|food|F
naranja|f|orange|food|F
pescado|m|fish (to eat)|food|F
carne|f|meat|food|F
arroz|m|rice|food|F
huevo|m|egg|food|F
agua|f|water|food|F|el
ensalada|f|salad|food|F
bocadillo|m|sandwich|food|F
helado|m|ice cream|food|F
verdura|f|vegetable|food|F
postre|m|dessert|food|F
zumo|m|juice|food|F
casa|f|house|home|F
habitación|f|bedroom|home|F
cocina|f|kitchen|home|F
jardín|m|garden|home|F
cama|f|bed|home|F
mesa|f|table|home|F
silla|f|chair|home|F
puerta|f|door|home|F
ventana|f|window|home|F
salón|m|living room|home|F
baño|m|bathroom|home|F
piso|m|flat|home|F
ciudad|f|city|town|F
pueblo|m|village|town|F
calle|f|street|town|F
tienda|f|shop|town|F
iglesia|f|church|town|F
plaza|f|square|town|F
estación|f|station|town|F
parque|m|park|town|F
banco|m|bank|town|F
biblioteca|f|library|town|F
ayuntamiento|m|town hall|town|H
mercado|m|market|town|F
mapa|m|map|town|F
playa|f|beach|hol|F
hotel|m|hotel|hol|F
maleta|f|suitcase|hol|F
billete|m|ticket|hol|F
viaje|m|trip|hol|F
avión|m|plane|hol|F
tren|m|train|hol|F
verano|m|summer|hol|F
montaña|f|mountain|hol|F
piscina|f|swimming pool|hol|F
pasaporte|m|passport|hol|H
día|m|day|hol|F
deporte|m|sport|hob|F
fútbol|m|football|hob|F
música|f|music|hob|F
película|f|film|hob|F
baile|m|dance|hob|F
guitarra|f|guitar|hob|F
equipo|m|team|hob|F
partido|m|match|hob|F
juego|m|game|hob|F
canción|f|song|hob|F
natación|f|swimming|hob|H
camisa|f|shirt|clo|F
falda|f|skirt|clo|F
zapato|m|shoe|clo|F
pantalón|m|trousers|clo|F
vestido|m|dress|clo|F
abrigo|m|coat|clo|F
sombrero|m|hat|clo|F
calcetín|m|sock|clo|F
jersey|m|jumper|clo|F
camiseta|f|T-shirt|clo|F
bufanda|f|scarf|clo|F
gorra|f|cap|clo|F
cabeza|f|head|body|F
mano|f|hand|body|F
brazo|m|arm|body|F
pierna|f|leg|body|F
pie|m|foot|body|F
ojo|m|eye|body|F
nariz|f|nose|body|F
boca|f|mouth|body|F
oreja|f|ear|body|F
espalda|f|back|body|F
corazón|m|heart|body|H
dedo|m|finger|body|F
médico|m|doctor|job|F
enfermera|f|nurse|job|F
abogado|m|lawyer|job|H
cocinero|m|cook|job|F
bombero|m|firefighter|job|F
camarero|m|waiter|job|F
ingeniero|m|engineer|job|H
peluquero|m|hairdresser|job|H
actriz|f|actress|job|H
granjero|m|farmer|job|F
secretaria|f|secretary|job|F
perro|m|dog|ani|F
gato|m|cat|ani|F
caballo|m|horse|ani|F
pájaro|m|bird|ani|F
pez|m|fish (live)|ani|F
conejo|m|rabbit|ani|F
vaca|f|cow|ani|F
cerdo|m|pig|ani|F
oveja|f|sheep|ani|F
ratón|m|mouse|ani|F
tortuga|f|tortoise|ani|F
águila|f|eagle|ani|H|el
león|m|lion|ani|F
ordenador|m|computer|tech|F
móvil|m|mobile phone|tech|F
pantalla|f|screen|tech|F
teclado|m|keyboard|tech|F
correo|m|email / mail|tech|F
contraseña|f|password|tech|H
red|f|network|tech|H
cámara|f|camera|tech|F
página|f|page|tech|F
archivo|m|file|tech|H
aplicación|f|app|tech|F
videojuego|m|video game|tech|F
mensaje|m|message|tech|F
programa|m|program|tech|F
`);

const FR = parse("fr", `
père|m|father|fam|F
mère|f|mother|fam|F
frère|m|brother|fam|F
sœur|f|sister|fam|F
grand-père|m|grandfather|fam|F
grand-mère|f|grandmother|fam|F
oncle|m|uncle|fam|F
tante|f|aunt|fam|F
cousin|m|cousin (boy)|fam|F
cousine|f|cousin (girl)|fam|F
fils|m|son|fam|F
fille|f|daughter / girl|fam|F
famille|f|family|fam|F
mari|m|husband|fam|F
femme|f|wife / woman|fam|F
école|f|school|sch|F
collège|m|secondary school|sch|F
professeur|m|teacher|sch|F
classe|f|class|sch|F
livre|m|book|sch|F
cahier|m|exercise book|sch|F
stylo|m|pen|sch|F
cartable|m|school bag|sch|F
cour|f|playground|sch|F
leçon|f|lesson|sch|F
examen|m|exam|sch|F
matière|f|school subject|sch|F
trousse|f|pencil case|sch|F
règle|f|ruler|sch|F
gomme|f|rubber|sch|F
pain|m|bread|food|F
lait|m|milk|food|F
fromage|m|cheese|food|F
pomme|f|apple|food|F
orange|f|orange|food|F
poisson|m|fish|food|F
viande|f|meat|food|F
riz|m|rice|food|F
œuf|m|egg|food|F
eau|f|water|food|F
salade|f|salad|food|F
sandwich|m|sandwich|food|F
glace|f|ice cream|food|F
légume|m|vegetable|food|F
dessert|m|dessert|food|F
jus|m|juice|food|F
gâteau|m|cake|food|F
beurre|m|butter|food|F
haricot|m|bean|food|H|h
maison|f|house|home|F
chambre|f|bedroom|home|F
cuisine|f|kitchen|home|F
jardin|m|garden|home|F
lit|m|bed|home|F
table|f|table|home|F
chaise|f|chair|home|F
porte|f|door|home|F
fenêtre|f|window|home|F
salon|m|living room|home|F
appartement|m|flat|home|F
escalier|m|stairs|home|H
garage|m|garage|home|F
toit|m|roof|home|H
étage|m|floor / storey|home|H
ville|f|town / city|town|F
village|m|village|town|F
rue|f|street|town|F
magasin|m|shop|town|F
église|f|church|town|F
place|f|square|town|F
gare|f|station|town|F
parc|m|park|town|F
banque|f|bank|town|F
bibliothèque|f|library|town|F
mairie|f|town hall|town|H
marché|m|market|town|F
supermarché|m|supermarket|town|F
cinéma|m|cinema|town|F
pont|m|bridge|town|F
plage|f|beach|hol|F
hôtel|m|hotel|hol|F
valise|f|suitcase|hol|F
billet|m|ticket|hol|F
voyage|m|trip|hol|F
avion|m|plane|hol|F
train|m|train|hol|F
été|m|summer|hol|F
montagne|f|mountain|hol|F
camping|m|campsite|hol|F
piscine|f|swimming pool|hol|F
passeport|m|passport|hol|H
bateau|m|boat|hol|F
mer|f|sea|hol|F
tente|f|tent|hol|F
sport|m|sport|hob|F
football|m|football|hob|F
musique|f|music|hob|F
film|m|film|hob|F
danse|f|dance|hob|F
guitare|f|guitar|hob|F
équipe|f|team|hob|F
match|m|match|hob|F
jeu|m|game|hob|F
chanson|f|song|hob|F
natation|f|swimming|hob|H
lecture|f|reading|hob|F
théâtre|m|theatre|hob|F
chemise|f|shirt|clo|F
jupe|f|skirt|clo|F
chaussure|f|shoe|clo|F
pantalon|m|trousers|clo|F
robe|f|dress|clo|F
manteau|m|coat|clo|F
chapeau|m|hat|clo|F
chaussette|f|sock|clo|F
pull|m|jumper|clo|F
écharpe|f|scarf|clo|F
casquette|f|cap|clo|F
veste|f|jacket|clo|F
tête|f|head|body|F
main|f|hand|body|F
bras|m|arm|body|F
jambe|f|leg|body|F
pied|m|foot|body|F
œil|m|eye|body|F
nez|m|nose|body|F
bouche|f|mouth|body|F
oreille|f|ear|body|F
dos|m|back|body|F
cœur|m|heart|body|H
doigt|m|finger|body|F
dent|f|tooth|body|F
ventre|m|stomach|body|F
genou|m|knee|body|H
médecin|m|doctor|job|F
infirmière|f|nurse (female)|job|F
avocat|m|lawyer|job|H
cuisinier|m|cook|job|F
pompier|m|firefighter|job|F
serveur|m|waiter|job|F
ingénieur|m|engineer|job|H
coiffeur|m|hairdresser|job|H
boulanger|m|baker|job|F
actrice|f|actress|job|H
fermier|m|farmer|job|F
chien|m|dog|ani|F
chat|m|cat|ani|F
cheval|m|horse|ani|F
oiseau|m|bird|ani|F
lapin|m|rabbit|ani|F
vache|f|cow|ani|F
cochon|m|pig|ani|F
mouton|m|sheep|ani|F
souris|f|mouse|ani|F
tortue|f|tortoise|ani|F
lion|m|lion|ani|F
singe|m|monkey|ani|F
éléphant|m|elephant|ani|F
animal|m|animal|ani|F
ordinateur|m|computer|tech|F
portable|m|mobile phone|tech|F
écran|m|screen|tech|F
clavier|m|keyboard|tech|F
courriel|m|email|tech|H
réseau|m|network|tech|H
page|f|page|tech|F
fichier|m|file|tech|H
appli|f|app|tech|F
message|m|message|tech|F
tablette|f|tablet|tech|F
télévision|f|television|tech|F
téléphone|m|telephone|tech|F
site|m|website|tech|F
`);

const DE = parse("de", `
Vater|m|Väter|father|fam|F
Mutter|f|Mütter|mother|fam|F
Bruder|m|Brüder|brother|fam|F
Schwester|f|Schwestern|sister|fam|F
Großvater|m|Großväter|grandfather|fam|F
Großmutter|f|Großmütter|grandmother|fam|F
Onkel|m|Onkel|uncle|fam|F
Tante|f|Tanten|aunt|fam|F
Cousin|m|Cousins|cousin (boy)|fam|F
Cousine|f|Cousinen|cousin (girl)|fam|F
Sohn|m|Söhne|son|fam|F
Tochter|f|Töchter|daughter|fam|F
Familie|f|Familien|family|fam|F
Kind|n|Kinder|child|fam|F
Mädchen|n|Mädchen|girl|fam|F
Junge|m|Jungen|boy|fam|F
Baby|n|Babys|baby|fam|F
Mann|m|Männer|man|fam|F
Frau|f|Frauen|woman|fam|F
Schule|f|Schulen|school|sch|F
Lehrer|m|Lehrer|teacher (male)|sch|F
Lehrerin|f|Lehrerinnen|teacher (female)|sch|F
Klasse|f|Klassen|class|sch|F
Fach|n|Fächer|school subject|sch|F
Buch|n|Bücher|book|sch|F
Heft|n|Hefte|exercise book|sch|F
Stift|m|Stifte|pen|sch|F
Schulhof|m|Schulhöfe|playground|sch|F
Stundenplan|m|Stundenpläne|timetable|sch|F
Prüfung|f|Prüfungen|exam|sch|F
Pause|f|Pausen|break|sch|F
Tafel|f|Tafeln|board|sch|F
Federmäppchen|n|Federmäppchen|pencil case|sch|H
Lineal|n|Lineale|ruler|sch|F
Hausaufgabe|f|Hausaufgaben|homework task|sch|F
Rucksack|m|Rucksäcke|rucksack|sch|F
Note|f|Noten|grade|sch|F
Käse|m|Käse|cheese|food|F
Apfel|m|Äpfel|apple|food|F
Orange|f|Orangen|orange|food|F
Fisch|m|Fische|fish|food|F
Ei|n|Eier|egg|food|F
Salat|m|Salate|salad|food|F
Kuchen|m|Kuchen|cake|food|F
Wurst|f|Würste|sausage|food|F
Gemüse|n|Gemüse|vegetables|food|F
Nudel|f|Nudeln|noodle|food|F
Kartoffel|f|Kartoffeln|potato|food|F
Banane|f|Bananen|banana|food|F
Getränk|n|Getränke|drink|food|F
Suppe|f|Suppen|soup|food|F
Brötchen|n|Brötchen|bread roll|food|F
Tomate|f|Tomaten|tomato|food|F
Saft|m|Säfte|juice|food|F
Kaffee|m|Kaffees|coffee|food|F
Schokolade|f|Schokoladen|chocolate|food|F
Brot|n|Brote|bread|food|F
Haus|n|Häuser|house|home|F
Zimmer|n|Zimmer|room|home|F
Küche|f|Küchen|kitchen|home|F
Garten|m|Gärten|garden|home|F
Bett|n|Betten|bed|home|F
Tisch|m|Tische|table|home|F
Stuhl|m|Stühle|chair|home|F
Tür|f|Türen|door|home|F
Fenster|n|Fenster|window|home|F
Wohnung|f|Wohnungen|flat|home|F
Badezimmer|n|Badezimmer|bathroom|home|F
Treppe|f|Treppen|stairs|home|F
Dach|n|Dächer|roof|home|H
Keller|m|Keller|cellar|home|F
Sofa|n|Sofas|sofa|home|F
Schrank|m|Schränke|cupboard|home|F
Lampe|f|Lampen|lamp|home|F
Balkon|m|Balkone|balcony|home|F
Stadt|f|Städte|town / city|town|F
Dorf|n|Dörfer|village|town|F
Straße|f|Straßen|street|town|F
Geschäft|n|Geschäfte|shop|town|F
Kirche|f|Kirchen|church|town|F
Platz|m|Plätze|square|town|F
Bahnhof|m|Bahnhöfe|station|town|F
Park|m|Parks|park|town|F
Bank|f|Banken|bank|town|F
Bibliothek|f|Bibliotheken|library|town|F
Rathaus|n|Rathäuser|town hall|town|F
Markt|m|Märkte|market|town|F
Supermarkt|m|Supermärkte|supermarket|town|F
Kino|n|Kinos|cinema|town|F
Brücke|f|Brücken|bridge|town|F
Museum|n|Museen|museum|town|H
Schwimmbad|n|Schwimmbäder|swimming pool|town|F
Strand|m|Strände|beach|hol|F
Hotel|n|Hotels|hotel|hol|F
Koffer|m|Koffer|suitcase|hol|F
Fahrkarte|f|Fahrkarten|ticket|hol|F
Reise|f|Reisen|journey|hol|F
Flugzeug|n|Flugzeuge|plane|hol|F
Zug|m|Züge|train|hol|F
Sommer|m|Sommer|summer|hol|F
Berg|m|Berge|mountain|hol|F
Campingplatz|m|Campingplätze|campsite|hol|F
Pass|m|Pässe|passport|hol|H
Schiff|n|Schiffe|ship|hol|F
Meer|n|Meere|sea|hol|F
Zelt|n|Zelte|tent|hol|F
Insel|f|Inseln|island|hol|F
Ausflug|m|Ausflüge|trip|hol|F
Hobby|n|Hobbys|hobby|hob|F
Fußball|m|Fußbälle|football|hob|F
Film|m|Filme|film|hob|F
Tanz|m|Tänze|dance|hob|F
Gitarre|f|Gitarren|guitar|hob|F
Mannschaft|f|Mannschaften|team|hob|F
Spiel|n|Spiele|game|hob|F
Lied|n|Lieder|song|hob|F
Verein|m|Vereine|club|hob|H
Konzert|n|Konzerte|concert|hob|F
Klavier|n|Klaviere|piano|hob|F
Bild|n|Bilder|picture|hob|F
Fahrrad|n|Fahrräder|bicycle|hob|F
Foto|n|Fotos|photo|hob|F
Hemd|n|Hemden|shirt|clo|F
Rock|m|Röcke|skirt|clo|F
Schuh|m|Schuhe|shoe|clo|F
Hose|f|Hosen|trousers|clo|F
Kleid|n|Kleider|dress|clo|F
Mantel|m|Mäntel|coat|clo|F
Hut|m|Hüte|hat|clo|F
Socke|f|Socken|sock|clo|F
Pullover|m|Pullover|jumper|clo|F
T-Shirt|n|T-Shirts|T-shirt|clo|F
Schal|m|Schals|scarf|clo|F
Mütze|f|Mützen|cap|clo|F
Jacke|f|Jacken|jacket|clo|F
Stiefel|m|Stiefel|boot|clo|F
Bluse|f|Blusen|blouse|clo|F
Gürtel|m|Gürtel|belt|clo|F
Handschuh|m|Handschuhe|glove|clo|F
Krawatte|f|Krawatten|tie|clo|F
Kopf|m|Köpfe|head|body|F
Hand|f|Hände|hand|body|F
Arm|m|Arme|arm|body|F
Bein|n|Beine|leg|body|F
Fuß|m|Füße|foot|body|F
Auge|n|Augen|eye|body|F
Nase|f|Nasen|nose|body|F
Mund|m|Münder|mouth|body|F
Ohr|n|Ohren|ear|body|F
Rücken|m|Rücken|back|body|F
Herz|n|Herzen|heart|body|F
Finger|m|Finger|finger|body|F
Zahn|m|Zähne|tooth|body|F
Bauch|m|Bäuche|stomach|body|F
Knie|n|Knie|knee|body|F
Körper|m|Körper|body|body|F
Haar|n|Haare|hair|body|F
Hals|m|Hälse|neck|body|F
Arzt|m|Ärzte|doctor (male)|job|F
Ärztin|f|Ärztinnen|doctor (female)|job|F
Krankenschwester|f|Krankenschwestern|nurse|job|F
Anwalt|m|Anwälte|lawyer|job|H
Koch|m|Köche|cook|job|F
Feuerwehrmann|m|Feuerwehrmänner|firefighter|job|H
Kellner|m|Kellner|waiter|job|F
Ingenieur|m|Ingenieure|engineer|job|H
Friseur|m|Friseure|hairdresser|job|F
Bäcker|m|Bäcker|baker|job|F
Polizist|m|Polizisten|police officer|job|F
Bauer|m|Bauern|farmer|job|F
Sekretärin|f|Sekretärinnen|secretary|job|F
Verkäufer|m|Verkäufer|shop assistant|job|F
Mechaniker|m|Mechaniker|mechanic|job|F
Schauspieler|m|Schauspieler|actor|job|F
Hund|m|Hunde|dog|ani|F
Katze|f|Katzen|cat|ani|F
Pferd|n|Pferde|horse|ani|F
Vogel|m|Vögel|bird|ani|F
Kaninchen|n|Kaninchen|rabbit|ani|F
Kuh|f|Kühe|cow|ani|F
Schwein|n|Schweine|pig|ani|F
Schaf|n|Schafe|sheep|ani|F
Maus|f|Mäuse|mouse|ani|F
Schildkröte|f|Schildkröten|tortoise|ani|F
Löwe|m|Löwen|lion|ani|F
Affe|m|Affen|monkey|ani|F
Elefant|m|Elefanten|elephant|ani|F
Hase|m|Hasen|hare|ani|H
Ente|f|Enten|duck|ani|F
Bär|m|Bären|bear|ani|F
Computer|m|Computer|computer|tech|F
Handy|n|Handys|mobile phone|tech|F
Bildschirm|m|Bildschirme|screen|tech|F
Tastatur|f|Tastaturen|keyboard|tech|F
E-Mail|f|E-Mails|email|tech|F
Passwort|n|Passwörter|password|tech|F
Netzwerk|n|Netzwerke|network|tech|H
Kamera|f|Kameras|camera|tech|F
Seite|f|Seiten|page|tech|F
Datei|f|Dateien|file|tech|F
App|f|Apps|app|tech|F
Videospiel|n|Videospiele|video game|tech|F
Laptop|m|Laptops|laptop|tech|F
Nachricht|f|Nachrichten|message|tech|F
Tablet|n|Tablets|tablet|tech|F
Fernseher|m|Fernseher|television|tech|F
Drucker|m|Drucker|printer|tech|F
`);

export const NOUNS: Record<NounLang, Noun[]> = { es: ES, fr: FR, de: DE };
export const ALL_NOUNS: Noun[] = [...ES, ...FR, ...DE];
export const nounsFor = (lang: NounLang, theme?: Theme | "all") => NOUNS[lang].filter((n) => !theme || theme === "all" || n.theme === theme);

// ───────────────────────── articles ─────────────────────────
export type ArticleKind = "definite" | "indefinite";
export type Num = "sg" | "pl";
const stripAcc = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
/** French elision: vowel or mute h (not h aspiré). */
export const frElides = (n: Noun) => !n.hAspire && /^[aeiouyhàâæéèêëîïôœùûü]/i.test(n.word);
/** The article on its own. French "l'" for elision; German plural indefinite is "" (no article). */
export function article(lang: NounLang, n: Noun, kind: ArticleKind, number: Num = "sg"): string {
  const g = n.gender;
  if (lang === "es") {
    if (kind === "definite") return number === "pl" ? (g === "f" ? "las" : "los") : g === "f" ? (n.elAgua ? "el" : "la") : "el";
    return number === "pl" ? (g === "f" ? "unas" : "unos") : g === "f" ? (n.elAgua ? "un" : "una") : "un"; // "un agua" / "una agua" are both accepted by the RAE
  }
  if (lang === "fr") {
    if (kind === "definite") return number === "pl" ? "les" : frElides(n) ? "l'" : g === "f" ? "la" : "le";
    return number === "pl" ? "des" : g === "f" ? "une" : "un";
  }
  if (number === "pl") return kind === "definite" ? "die" : "";
  if (kind === "definite") return g === "m" ? "der" : g === "f" ? "die" : "das";
  return g === "f" ? "eine" : "ein";
}
/** "l'eau", "el agua", "das Mädchen", "les eaux". */
export function withArticle(lang: NounLang, n: Noun, kind: ArticleKind, number: Num = "sg"): string {
  const a = article(lang, n, kind, number), w = number === "pl" ? plural(lang, n) : n.word;
  return !a ? w : a.endsWith("'") ? a + w : `${a} ${w}`;
}

// ───────────────────────── plurals ─────────────────────────
/** Irregular plurals that no rule gives (or where the rule is unsafe). */
export const PLURAL_EXCEPTIONS: Record<"es" | "fr", Record<string, string>> = {
  es: { examen: "exámenes", jersey: "jerséis", régimen: "regímenes", carácter: "caracteres", mamá: "mamás", papá: "papás", sofá: "sofás", café: "cafés", menú: "menús", champú: "champús", rey: "reyes", ley: "leyes", lunes: "lunes", martes: "martes", crisis: "crisis", paraguas: "paraguas" },
  fr: { œil: "yeux", ciel: "cieux", monsieur: "messieurs", madame: "mesdames", mademoiselle: "mesdemoiselles", "grand-père": "grands-pères", "grand-mère": "grands-mères", travail: "travaux", vitrail: "vitraux", bijou: "bijoux", caillou: "cailloux", chou: "choux", genou: "genoux", hibou: "hiboux", joujou: "joujoux", pou: "poux", bal: "bals", festival: "festivals", carnaval: "carnavals", récital: "récitals", landau: "landaus", pneu: "pneus", bleu: "bleus" },
};
/** Plural of the bare noun. Spanish and French by rule + exceptions; German from the data. */
export function plural(lang: NounLang, n: Noun | string): string {
  const word = typeof n === "string" ? n : n.word;
  if (lang === "de") { if (typeof n === "string") throw new Error("German plural needs the noun record"); return n.plural ?? word; }
  const ex = PLURAL_EXCEPTIONS[lang][word]; if (ex) return ex;
  return lang === "es" ? esPlural(word) : frPlural(word);
}
const unAccent = (s: string) => s.replace(/[áéíóú]/, (c) => ({ á: "a", é: "e", í: "i", ó: "o", ú: "u" })[c]!);
export function esPlural(w: string): string {
  if (/[áéó]$/.test(w) || /[aeiou]$/.test(w)) return w + "s";               // casa → casas, (loanword stressed á é ó are in the exceptions list)
  if (/[íú]$/.test(w)) return w + "es";                                     // rubí → rubíes
  if (/z$/.test(w)) return w.slice(0, -1) + "ces";                          // nariz → narices, actriz → actrices, pez → peces
  if (/[áéíóú]s$/.test(w)) return unAccent(w) + "es";                       // francés → franceses (stressed last syllable)
  if (/s$/.test(w)) return w;                                               // unstressed final syllable: unchanged
  if (/[áéíóú]n$/.test(w)) return unAccent(w) + "es";                       // camión → camiones, jardín → jardines
  return w + "es";                                                          // ciudad → ciudades, papel → papeles, red → redes
}
export function frPlural(w: string): string {
  if (/[sxz]$/.test(w)) return w;                                           // bras, nez, prix
  if (/(eau|au|eu)$/.test(w)) return w + "x";                               // gâteau → gâteaux, jeu → jeux
  if (/al$/.test(w)) return w.slice(0, -2) + "aux";                         // cheval → chevaux
  return w + "s";
}

// ───────────────────────── gender cue ─────────────────────────
export interface GenderCue { token: string; symbol: string; letter: string; label: string }
/** Colour is only ever a helper: every cue also carries a symbol, a letter and a text label. Tokens are CSS custom properties from the app theme. */
export const GENDER_CUE: Record<Gender, GenderCue> = {
  m: { token: "--sig-blue", symbol: "♂", letter: "M", label: "masculine" },
  f: { token: "--sig-pink", symbol: "♀", letter: "F", label: "feminine" },
  n: { token: "--green", symbol: "⚲", letter: "N", label: "neuter" },
};
export const genderColour = (g: Gender): string => `var(${GENDER_CUE[g].token})`;
export const genderCue = (g: Gender): GenderCue => GENDER_CUE[g];
export const genderLabelText = (g: Gender) => `${GENDER_CUE[g].symbol} ${GENDER_CUE[g].letter} (${GENDER_CUE[g].label})`;
/** The articles a pupil can be asked to choose between. */
export const ARTICLE_CHOICES: Record<NounLang, Record<ArticleKind, string[]>> = {
  es: { definite: ["el", "la"], indefinite: ["un", "una"] },
  fr: { definite: ["le", "la", "l'"], indefinite: ["un", "une"] },
  de: { definite: ["der", "die", "das"], indefinite: ["ein", "eine"] },
};
