// Spanish — Grammar: Nouns, Articles & Adjectives (Years 7–9). Original content aligned to the DfE KS3 modern foreign languages programme of study (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const a = qb("esnoun", 7);
const b = qb("esnoun", 8);
const c = qb("esnoun", 9);

export const TOPIC: CTopic = {
  key: "esnoun",
  topic: "Grammar — Nouns, Articles & Adjectives",
  subject: "Spanish",
  years: {
    7: {
      year: 7,
      objectives: [
        "Recognise the gender of nouns from their endings, and remember common exceptions.",
        "Use the definite (el, la, los, las) and indefinite (un, una, unos, unas) articles.",
        "Form plurals of nouns, including those ending in a consonant, in -z and in -ción.",
        "Understand that articles and adjectives must match the noun in gender and number.",
      ],
      note: {
        title: "Year 7: Gender, articles and plurals",
        body: `## Gender

Every Spanish noun is masculine or feminine. Most nouns ending in **-o** are masculine (*el libro*) and most ending in **-a** are feminine (*la mesa*). Nouns ending in **-ción, -sión, -dad, -tad** are feminine (*la estación, la información, la verdad*).

**Watch out for exceptions:** *el día, el mapa, el tema, el idioma, el sistema* are masculine, and *la mano* is feminine.

| | singular | plural |
| --- | --- | --- |
| the (masc / fem) | el / la | los / las |
| a, an / some (masc) | un | unos |
| a, an / some (fem) | una | unas |

## Plurals

- Vowel at the end: add **-s** (*mesa → mesas*, *libro → libros*).
- Consonant at the end: add **-es** (*papel → papeles*).
- Ending in **-z**: change z to **c** and add **-es** (*lápiz → lápices*).
- Ending in **-ción**: add -es and **drop the accent** (*nación → naciones*).

## Model sentences

- En mi mochila hay un mapa y unas gafas.
- El profesor tiene dos lápices y tres carpetas.
- La nación tiene muchos ríos.

## Sound tip

**z** and **c** before e or i are "th" in Spain and "s" in Latin America: *lápices*. **-ción** is said "thyon" (or "syon"). **j** is a throaty h: *jardín*. **ll** is like y.

## Common mistakes

- Saying *la mapa* or *el mano*. Learn the exceptions with their article.
- Writing *naciónes*: the accent disappears in the plural.
- Writing *lápizes*: the z changes to c.`,
      },
      quiz: {
        title: "Nouns, Articles & Adjectives: Year 7 quiz",
        questions: [
          a.single("Which article goes with 'casa' (house)? ___ casa", "la", ["el", "los", "un"], "Casa ends in -a and is feminine, so the definite article is la.", 1),
          a.single("What is the plural of 'libro'?", "libros", ["libroes", "libres", "los libro"], "A noun ending in a vowel just adds -s: libros.", 1),
          a.short("Write the plural of 'profesor' (one word).", "profesores", "A noun ending in a consonant adds -es: profesores.", 1),
          a.single("Which of these nouns is feminine?", "canción", ["problema", "día", "mapa"], "Nouns ending in -ción are feminine. Problema, día and mapa are masculine even though they end in -a.", 2, true),
          a.single("What is the plural of 'ciudad' (city)?", "ciudades", ["ciudads", "ciudad", "los ciudad"], "Ciudad ends in a consonant, so add -es: ciudades.", 2),
          a.short("Write the plural of 'lección' (lesson).", "lecciones", "Add -es and drop the accent: lección becomes lecciones.", 2, { diag: true, strict: true }),
          a.multi("Which of these nouns are masculine even though they end in -a? Choose all that apply.", ["problema", "programa", "día"], ["mesa", "casa"], "Problema, programa and día are masculine (el problema, el programa, el día). Mesa and casa are feminine.", 2),
          a.single("Which means 'some dogs'?", "unos perros", ["unas perros", "un perros", "unos perro"], "Perros is masculine plural, so use unos and keep the -s on perros.", 2),
          a.single("Which sentence has all its articles correct? 'The house has a garden and a swimming pool.'", "La casa tiene un jardín y una piscina.", ["El casa tiene un jardín y una piscina.", "La casa tiene una jardín y una piscina.", "La casa tiene un jardín y un piscina."], "Casa and piscina are feminine (la, una), jardín is masculine (un).", 3),
          a.short("Write the plural of 'el pez' (fish), with the article.", "los peces", "Ending in -z: change z to c and add -es. The article becomes los.", 3, { acc: ["peces"] }),
        ],
      },
      flashcards: cards([
        ["el / la / los / las", "the (masc sg / fem sg / masc pl / fem pl)"],
        ["some (feminine plural), in Spanish", "unas"],
        ["Gender of nouns ending in -o", "usually masculine (el libro)"],
        ["Gender of nouns ending in -ción / -dad", "feminine (la estación, la verdad)"],
        ["el día, el mapa, el tema", "masculine, although they end in -a"],
        ["la mano", "feminine, although it ends in -o"],
        ["Plural after a vowel", "add -s (mesas)"],
        ["Plural after a consonant", "add -es (papeles)"],
        ["plural of lápiz, in Spanish", "lápices (z becomes c)"],
        ["nación → ?", "naciones (the accent disappears)"],
      ]),
    },
    8: {
      year: 8,
      objectives: [
        "Make adjectives agree in gender and number, including those ending in -e, a consonant, -or and -és.",
        "Place adjectives correctly (after the noun, with a few common exceptions such as buen).",
        "Use possessive adjectives (mi, tu, su, nuestro, vuestro, su) with the correct number and gender.",
        "Distinguish ser and estar and choose the right one for identity, origin, description, location and feeling.",
      ],
      note: {
        title: "Year 8: Adjectives, possessives and ser vs estar",
        body: `## Adjective agreement

Adjectives match the noun in **gender** and **number** and normally come **after** it.

| type | masc sg | fem sg | masc pl | fem pl |
| --- | --- | --- | --- | --- |
| -o | alto | alta | altos | altas |
| -e | inteligente | inteligente | inteligentes | inteligentes |
| consonant | fácil | fácil | fáciles | fáciles |
| -or | trabajador | trabajadora | trabajadores | trabajadoras |
| -és | inglés | inglesa | ingleses | inglesas |

*Bueno* shortens to **buen** before a masculine singular noun: *un buen amigo*, but *una buena amiga*.

## Possessives

mi(s), tu(s), su(s) agree with the thing owned in number only. **nuestro / nuestra / nuestros / nuestras** and **vuestro / vuestra / vuestros / vuestras** agree in gender and number.

## Ser or estar? (both mean "to be")

- **ser**: identity, origin, nationality, profession, description and character, time (*Mi tía es profesora y es muy inteligente.*)
- **estar**: location, and temporary states or feelings (*Hoy está cansada.*)
- Some adjectives change meaning: *es aburrido* (he is boring) but *está aburrido* (he is bored).

## Model sentences

- Los profesores españoles son simpáticos.
- Nuestro perro es pequeño pero vuestro gato es enorme.
- Mi tía es profesora y es muy inteligente. Hoy está cansada.

## Sound tip

Stress matters: *español* is "es-pa-NYOL" (the **ñ** is like "ny"), *trabajadora* is "tra-ba-ha-DOR-a" and *inteligente* is "in-teh-lee-HEN-teh". The stress does not move when you add an ending to a word that already has the natural stress, so *alto, alta, altos, altas* all stress the first syllable.

## Common mistakes

- Leaving the adjective in the masculine: *mi prima es simpático* should be **simpática**.
- Using ser for feelings or place: *soy cansado* should be **estoy** cansado.
- Keeping the accent: **inglés** has an accent, but **inglesa** and **ingleses** do not.`,
      },
      quiz: {
        title: "Nouns, Articles & Adjectives: Year 8 quiz",
        questions: [
          b.single("Complete: Mi hermana es ___.", "alta", ["alto", "altos", "altas"], "Hermana is feminine singular, so the adjective is alta.", 1),
          b.single("Which means 'my books'?", "mis libros", ["mi libros", "mis libro", "tus libro"], "Libros is plural so the possessive is mis.", 1),
          b.short("Complete: Los coches son ___. (red)", "rojos", "Coches is masculine plural, so rojo becomes rojos.", 1),
          b.single("Which means 'a big house'?", "una casa grande", ["una casa grando", "un casa grande", "una casa grandes"], "Casa is feminine singular. Grande ends in -e, so it does not change for gender.", 2, true),
          b.single("Complete: Ella ___ de Colombia.", "es", ["está", "son", "estás"], "Origin uses ser, and 'she' is es.", 2),
          b.short("Complete: Mis padres ___ en el jardín. (are, location)", "están", "Location uses estar. With mis padres (they) the form is están.", 2, { diag: true }),
          b.multi("In which of these English sentences would Spanish use SER? Choose all that apply.", ["Ana is a doctor.", "Pablo is from Chile.", "The exam is difficult."], ["The book is on the table.", "I am tired."], "Profession, origin and a characteristic use ser. Location (on the table) and a state (tired) use estar.", 2),
          b.single("Which means 'our house'?", "nuestra casa", ["nuestro casa", "nuestras casa", "vuestra casa"], "Nuestro agrees with the thing owned: casa is feminine singular, so nuestra.", 2),
          b.single("Complete: Hoy mi abuela ___ muy cansada, pero normalmente ___ muy activa.", "está … es", ["es … está", "está … está", "es … es"], "'Today … tired' is a temporary state (estar); 'normally active' describes her character (ser).", 3),
          b.short("Complete: Mis hermanas son muy ___. (trabajador)", "trabajadoras", "Hermanas is feminine plural, so trabajador becomes trabajadoras.", 3),
        ],
      },
      flashcards: cards([
        ["alto / alta / altos / altas", "tall (m sg / f sg / m pl / f pl)"],
        ["inteligente(s)", "clever (same for masculine and feminine)"],
        ["hard-working (girl), in Spanish", "trabajadora"],
        ["inglés → feminine plural", "inglesas"],
        ["un buen amigo", "a good friend (bueno shortens to buen)"],
        ["our (feminine singular), in Spanish", "nuestra"],
        ["ser is used for …", "identity, origin, profession, description, time"],
        ["estar is used for …", "location, temporary states and feelings"],
        ["es aburrido / está aburrido", "he is boring / he is bored"],
        ["Where does the adjective usually go?", "After the noun, agreeing with it"],
      ]),
    },
    9: {
      year: 9,
      objectives: [
        "Form and use comparatives and superlatives (más … que, tan … como, el más …, mejor, peor).",
        "Use direct and indirect object pronouns and place them correctly with conjugated verbs and infinitives.",
        "Make an introductory distinction between por and para.",
        "Use these structures accurately in longer written and spoken sentences.",
      ],
      note: {
        title: "Year 9: Comparatives, pronouns and por vs para",
        body: `## Comparatives and superlatives

- **más / menos + adjective + que**: *más alto que* (taller than), *menos caro que*.
- **tan + adjective + como**: *tan alta como* (as tall as). With nouns: **tanto / tanta / tantos / tantas … como**.
- Irregular: **mejor(es)** (better), **peor(es)** (worse), **mayor** (older), **menor** (younger). Say **mejor** (not *más bueno*) for "better" and **peor** (not *más malo*) for "worse".
- Superlative: **el / la / los / las (más) + adjective + de**: *la más simpática de la familia*, *el mejor de la clase*.

## Object pronouns

| | direct | indirect |
| --- | --- | --- |
| me / te | me, te | me, te |
| him, it (m) / her, it (f) | lo / la | le |
| them | los / las | les |

They go **before** a conjugated verb (*lo veo*) or **attach to the end** of an infinitive: *quiero verlo* or *lo quiero ver*.

## Por or para? (introduction)

**por**: because of / thanks for (*gracias por*), through or along (*por el parque*), by means of (*por teléfono*), part of the day (*por la mañana*).
**para**: purpose + infinitive (*para aprender*), for someone (*es para ti*), destination (*el tren para Madrid*), deadline (*para el lunes*).

## Model sentences

- Mi perro es tan grande como un caballo.
- Mi tía es la más simpática de la familia.
- Paseamos por la playa por la tarde. El autobús para Sevilla sale a las nueve.
- Compré el regalo y lo envié por correo.

## Sound tip

**j** is a throaty h: *mejor* is "meh-HOR". **ll** is like y. The little pronouns (*lo, la, los, las, le*) are not stressed, so they blend into the verb: *lo veo* is said "lo-BEH-o". *Por* and *para* are said "por" and "PA-ra".

## Common mistakes

- *Más bueno que* instead of **mejor que**.
- Repeating the noun again and again. Once the book has been mentioned, say **Lo leo** ("I read it").
- Confusing **por** and **para**: for a purpose with an infinitive use **para**.`,
      },
      quiz: {
        title: "Nouns, Articles & Adjectives: Year 9 quiz",
        questions: [
          c.single("Complete: Elena es más alta ___ Pablo.", "que", ["como", "de", "para"], "'Taller than' is más alta que.", 1),
          c.single("What does 'mejor' mean?", "better", ["worse", "older", "younger"], "Mejor is better and peor is worse.", 1),
          c.short("Complete: Ana es tan simpática ___ Luis.", "como", "'As … as' is tan + adjective + como.", 1),
          c.single("Which means 'She is the tallest in the class'?", "Es la más alta de la clase.", ["Es más alta que la clase.", "Es tan alta como la clase.", "Es el más alto de la clase."], "Superlative = la más + adjective + de. La (feminine) matches 'she'.", 2, true),
          c.single("Complete: 'Leo los libros' → '___ leo.'", "Los", ["Las", "Lo", "Le"], "Los libros is masculine plural, so the direct object pronoun is los.", 2),
          c.short("Complete with por or para: Este regalo es ___ mi madre.", "para", "Para is used for the person who receives something.", 2, { diag: true }),
          c.multi("In which sentences is 'para' correct? Choose all that apply.", ["Este libro es para ti.", "Estudio para ser médica."], ["Gracias para tu ayuda.", "Hablo para teléfono."], "Para is used for a recipient and for purpose + infinitive. Gracias por and por teléfono use por.", 2),
          c.single("Which means 'better than'?", "mejor que", ["más bueno que", "más mejor que", "mejor como"], "Bueno has an irregular comparative: mejor. We never say más bueno or más mejor.", 2),
          c.single("Which sentence is correct for 'I want to buy it' (la chaqueta)?", "Quiero comprarla.", ["Quiero comprarlo.", "Quiero comprar la.", "Quiero la comprar."], "La chaqueta is feminine, so the pronoun is la, attached to the infinitive: comprarla.", 3),
          c.short("Say in Spanish: 'He is as tall as his father.'", "Es tan alto como su padre.", "tan + adjective + como; su padre is his father.", 3, { acc: ["Él es tan alto como su padre."] }),
        ],
      },
      flashcards: cards([
        ["as … as, in Spanish", "tan … como"],
        ["tan … como", "as … as"],
        ["better, in Spanish", "mejor"],
        ["mayor / menor", "older / younger"],
        ["la más simpática de la familia", "the nicest in the family"],
        ["lo / la / los / las", "him or it / her or it / them (m) / them (f), direct"],
        ["quiero verlo = lo quiero ver", "I want to see it (two places for the pronoun)"],
        ["por", "because of, thanks for, through, by means of"],
        ["para", "purpose, for someone, destination, deadline"],
        ["Gracias por tu ayuda.", "Thanks for your help."],
      ]),
    },
  },
};
