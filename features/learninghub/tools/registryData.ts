// The catalogue of every planned tool (docs/LEARNING_TOOLS_PLAN.md + docs/LEARNING_TOOLS_PLAN_v2_PROPOSAL.md), one line each:
//   id | title | subject (m e s l h x) | tier | key stages (digits) | surface (c f t) | tags | impl (d:<drawer tool> · w:<widget id>)
// `impl` = the tool that already runs today (an existing drawer tool / lesson widget, hosted unchanged); everything else is
// "In build" (P1) or "Coming soon" (P2) until its phase lands. Tags feed the automatic tool suggestions (tools/selection).
// Pure data + a parser — no React, no DOM — so it is selftested (registry.selftest.ts).
import type { KeyStage, Surface, ToolImpl, ToolMeta, ToolSubject } from "./types";
import type { HelpToolId } from "../remotesync/HelpTools";

const TABLE = `
M-01|Ruler|m|P1|234|c|ruler,measure,length,cm,mm,perimeter,scale drawing|d:ruler
M-02|Protractor 180°|m|P1|34|c|protractor,angle,measure angles,draw angles,degrees|d:protractor
M-03|Protractor 360°|m|P1|34|c|protractor,reflex angle,angle
M-04|Compasses|m|P1|34|c|compass,arc,construct,circle,loci
M-05|Set squares|m|P1|34|c|set square,parallel,perpendicular
M-06|Straight edge|m|P1|34|c|straight edge,construct,bisect
M-07|Construction checker|m|P1|34|c|construct,bisector,perpendicular,triangle,loci
M-08|Construction replay|m|P2|4|c|construct,replay
M-09|Angle facts board|m|P1|34|c|angle facts,parallel lines,triangle,polygon,interior angle,exterior angle
M-10|Bearings|m|P1|4|c|bearings,north,three-figure
M-11|Circle theorems|m|P2|4|c|circle theorem
M-12|Pythagoras & trig visualiser|m|P2|4|c|pythagoras,trigonometry,sohcahtoa
M-20|Paper backgrounds|m|P1|1234|c|squared paper,isometric,dotted,graph paper
M-21|Coordinate grid|m|P1|234|c|coordinates,quadrant,plot,axes,grid,position and direction|d:grid
M-22|Function plotter|m|P1|34|c|graph,linear graph,quadratic,gradient,function,y=mx
M-23|Transformations|m|P1|234|c|reflect,rotate,translate,enlarge,transformation,symmetry
M-24|Loci & regions|m|P2|4|c|loci,region
M-25|Nets & 3-D shapes|m|P2|234|c|nets,3-d shapes,plans,elevations,solid
M-26|Geoboard|m|P2|2|c|geoboard,area,perimeter
M-27|Tangrams & pattern blocks|m|P2|12|c|tangram,pentomino,pattern
M-40|Number line|m|P1|1234|c|number line,negative numbers,decimals,fractions,rounding|d:numberline
M-41|Place value chart|m|P1|12|c|place value,decimals,tens,hundreds
M-42|Base-10 blocks|m|P1|12|c|dienes,base 10,tens,ones
M-43|Bar model|m|P1|123|c|bar model,part whole,word problem
M-44|Fraction wall & circles|m|P1|1234|c|fractions,equivalent fractions,compare fractions,fraction wall|d:fractions
M-45|Hundred square|m|P1|12|c|hundred square,counting,multiples,patterns
M-46|Times-tables trainer|m|P1|23|f|times tables,multiplication,division facts,multiples|d:timestable
M-47|Counters (two-colour, directed)|m|P1|34|c|negative numbers,zero pairs,directed numbers
M-48|Algebra tiles|m|P1|34|c|algebra,expand,factorise,quadratic,tiles
M-49|Algebra discs|m|P2|34|c|collecting like terms
M-50|Balance equation solver|m|P1|34|c|equations,balance,solve,inverse operations
M-51|Prime factor tree & Venn|m|P1|34|c|prime factors,hcf,lcm,factor tree
M-52|Ratio table & double number line|m|P1|34|c|ratio,proportion,scale,double number line
M-53|Cuisenaire rods|m|P2|12|c|cuisenaire
M-54|Ten frame & number bonds|m|P1|1|c|ten frame,number bonds,within 10,within 20,make ten
M-55|Equation editor|m|P1|34|f|equation,expression,algebra,type an answer
M-60|Chart builder|m|P1|1234|c|bar chart,pictogram,pie chart,scatter graph,line graph,histogram,tally,frequency|d:plot
M-61|Frequency table & tally|m|P1|234|f|frequency table,grouped data,mean from a table
M-62|Probability tree|m|P1|34|c|probability,tree diagram,outcomes
M-63|Sample space & Venn|m|P1|34|c|sample space,venn diagram,two-way table
M-64|Dice, coin & spinner|m|P1|234|c|dice,spinner,coin,probability,relative frequency|d:dice
M-65|Averages tiles|m|P2|23|c|mean,median,mode,range
M-80|Scientific calculator|m|P1|34|f|calculator,standard form,powers,roots|d:calculator
M-81|Four-function calculator|m|P2|2|f|calculator
M-82|Clocks|m|P1|12|c|clock,time,analogue,digital,24-hour
M-83|Coins & notes|m|P1|12|c|money,coins,change,pounds,pence
M-84|Measuring scales|m|P2|23|c|reading scales,jug,thermometer
M-85|Area & perimeter grid|m|P1|234|c|area,perimeter,rectilinear,compound shapes
M-86|Unit converter trainer|m|P2|34|f|units,convert,metric,speed
M-87|Written-method scaffolds|m|P1|123|f|column addition,column subtraction,long multiplication,short division,written method
M-88|Rounding & bounds|m|P1|234|f|rounding,estimate,bounds,significant figures
M-89|Percentages|m|P1|234|c|percentage,increase,decrease,discount
M-90|Sequences|m|P1|234|f|sequence,nth term,pattern
M-91|Function machines|m|P1|34|c|function machine,inverse
M-92|Standard form & indices|m|P1|4|f|standard form,indices,surds,powers
E-01|Text annotator|e|P1|234|t|annotate,poem,extract,metaphor,simile,analysis,language,structure
E-02|Technique tagger|e|P1|34|t|technique,metaphor,simile,alliteration,find examples
E-03|Quotation bank|e|P1|34|t|quotation,evidence,theme,character,set text
E-04|Paragraph builder (PEE / PETAL)|e|P1|34|t|paragraph,pee,petal,point evidence explain,analysis
E-05|Essay planner|e|P1|34|t|essay,plan,argument,introduction,conclusion
E-06|Timed writing pad|e|P1|34|t|writing,timed,exam,extended writing
E-07|Word class & sentence parser|e|P1|234|t|word class,noun,verb,adjective,adverb,clause,subordinate,tense,grammar
E-08|Punctuation fixer|e|P1|234|t|punctuation,apostrophe,commas,speech marks,capital letters,full stops|w:punctFixer
E-09|Spelling trainer|e|P1|12|f|spelling,suffix,prefix,homophone,plural,silent letter|w:spellingLCWC
E-10|Letter & grapheme tiles|e|P1|12|c|grapheme,digraph,phoneme,gpc,phonics,letter tiles|w:wordMaker
E-11|Morphology explorer|e|P1|234|c|prefix,suffix,root word,morphology,etymology,word families
E-12|Vocabulary trainer|e|P1|234|f|vocabulary,tier 2,synonym,definition,key words
E-13|Poetry scanner|e|P2|34|t|poetry,stanza,rhyme,rhythm,sonnet
E-14|Comparison grid|e|P2|34|t|compare,similarities,differences,two texts
E-15|Readability checker|e|P2|34|t|sentence variety,improve writing
E-16|Comprehension questions|e|P1|234|t|comprehension,retrieval,inference,reading
E-17|Spelling bee|e|P2|12|f|spelling bee,game
N-01|Phonics blender|e|P1|1|f|phonics,blend,decode,gpc,sound buttons|w:phonicsBlender
N-02|Handwriting trace|e|P1|12|c|handwriting,letter formation,joins,cursive
N-03|Sentence combiner|e|P1|23|t|sentence,conjunction,combine,clause|w:clauseCombiner
N-04|Tense timeline|e|P1|234|c|tense,past,present,future,verb|w:tenseTimeline
N-05|Dictionary & thesaurus|e|P2|234|f|dictionary,thesaurus,synonym
N-06|Story mountain planner|e|P1|1234|t|narrative,story,plot,opening,build up,climax,resolution,recount|w:storyMountain
N-07|Character & setting map|e|P1|1234|t|character,setting,description,mind map
N-08|Writing frames (report, letter, speech)|e|P1|234|t|non-chronological report,letter,speech,persuasive,debate,instructions,diary
N-09|Read-aloud fluency|e|P1|12|f|read aloud,fluency,expression
N-10|Shakespeare annotator|e|P1|34|t|shakespeare,macbeth,romeo,tempest,soliloquy,glossary
N-11|GCSE language question trainer|e|P2|4|t|gcse,paper 1,paper 2,question 2,question 4
N-12|Drama & oracy cards|e|P1|1234|f|drama,role play,oracy,discussion,speaking
S-01|Label the diagram|s|P1|1234|c|label,diagram,cell,organ,structure,heart,eye,digestive,flower
S-02|Results table & graph|s|P1|234|c|results,table,graph,line of best fit,data,plot
S-03|Formula & units calculator|s|P1|34|f|calculate,formula,units,standard form,rearrange,energy,speed
S-04|Circuit builder|s|P1|234|c|circuit,current,resistance,potential difference,series,parallel|w:circuitBuilder
S-05|Equation balancer|s|P1|34|f|equation,balancing,reactants,products,combustion,neutralisation
S-06|Forces diagrams|s|P1|34|c|forces,friction,weight,resultant,newton,free body|w:forceMotion
S-07|Method & fair-test planner|s|P1|234|t|variables,fair test,investigation,hypothesis,method,plan,practical
S-08|Food chains & webs|s|P1|234|c|food chain,food web,producer,consumer,ecosystem,habitat|w:foodWeb
S-09|Particle model|s|P1|234|c|particle,states of matter,melting,boiling,diffusion,density|w:particleModel
S-10|Energy stores & Sankey|s|P1|34|c|energy,stores,transfer,sankey,efficiency
S-11|Waves|s|P1|34|c|waves,wavelength,frequency,amplitude,sound|w:waves
S-12|Ray diagrams|s|P1|34|c|light,reflection,refraction,lens,ray|d:lens
S-13|Periodic table|s|P1|34|c|periodic table,elements,groups,periods|d:periodic
S-14|Atoms & bonding|s|P1|34|c|atom,electron,bonding,ionic,covalent,isotope|d:bohr
S-15|Sort, classify & key|s|P1|1234|c|classify,key,sorting,materials,properties,rocks,conductor
S-16|Life cycles & sequences|s|P1|1234|c|life cycle,sequence,order,stages,digestion
S-17|Punnett squares|s|P1|4|c|punnett,inheritance,genetics,alleles
S-18|pH & indicators|s|P2|34|c|ph,indicator,acid,alkali
S-19|Virtual practicals|s|P2|34|c|practical,simulation,required practical
S-20|Physiology simulators|s|P2|34|c|heart rate,breathing,physiology
S-21|Motion graph builder|s|P2|4|c|distance-time,velocity-time,acceleration
S-22|Magnetic fields|s|P2|34|c|magnet,magnetic field,electromagnet
S-23|Space & orbits|s|P2|34|c|space,orbit,planets,seasons
S-24|Science unit converter|s|P2|34|f|units,convert,prefixes
S-25|Body systems|s|P2|34|c|body systems,organs
S-26|Microscope magnification|s|P2|34|f|microscope,magnification
S-27|Chemical tests lookup|s|P2|4|f|chemical tests,flame test,gas test
S-28|Conclusion scaffold|s|P2|34|t|conclusion,evaluate,method
L-01|Accent & symbol bar|l|P1|234|f|accent,accents,special characters
L-02|Marking policies|l|P1|234|f|accent marking,spelling policy
L-03|Verb conjugation trainer|l|P1|234|f|verb,tense,conjugation,present,perfect,imperfect,future,conditional|w:langVerbs
L-04|Sentence builder|l|P1|234|f|sentence,word order,connectives,negation,opinion|w:langOrder
L-05|Vocabulary trainer|l|P1|234|f|vocabulary,topic vocabulary
L-06|Dictation trainer|l|P1|4|f|dictation,listen,spelling
L-07|Sound–symbol trainer|l|P1|234|f|sounds,pronunciation,phonics|w:langSounds
L-08|Read-aloud trainer|l|P2|4|f|read aloud,pronunciation,speaking
L-09|Listening player|l|P1|234|f|listening,audio,transcript|w:langListen
L-10|Gender & articles|l|P1|234|f|gender,articles,masculine,feminine,neuter,possessive|w:langGender
L-11|German case trainer|l|P1|34|f|accusative,dative,genitive,nominative,case,prepositions
L-12|Adjective agreement|l|P1|34|f|adjective,agreement,position|w:langAgree
L-13|Translation tool|l|P1|234|f|translate,translation
L-14|Writing frame|l|P2|34|t|writing,paragraph,extended writing
L-15|Speaking prep|l|P2|34|f|role play,photo card,speaking
L-16|Numbers, dates & times|l|P1|234|f|numbers,dates,time,days,months,prices,age|w:langNumbers
L-17|Cognates & false friends|l|P2|34|f|cognates,false friends
L-18|Glossary pop-up|l|P2|34|t|glossary,lookup
L-19|Recognition game|l|P2|34|f|game,speed,recognition
L-20|Ser / estar chooser|l|P1|34|f|ser,estar,spanish
L-21|Negation drill|l|P1|34|f|negation,ne pas,nicht|w:langNegate
L-22|Perfect-tense helper|l|P1|34|f|perfect tense,avoir,être,haben,sein,auxiliary
L-23|Cloze & grammar drill|l|P1|34|f|gap fill,cloze,grammar
L-24|Reading comprehension checker|l|P1|34|f|reading,comprehension,questions
L-25|Dialogue role-play|l|P1|34|f|dialogue,conversation,role play|w:langDialogue
H-H01|Timeline builder|h|P1|234|c|timeline,chronology,century,dates|d:timeline
H-H02|Chronology sort|h|P1|234|f|chronology,order,before after
H-H03|Source analyser|h|P1|34|t|source,provenance,inference,reliability
H-H04|Interpretations comparer|h|P1|34|t|interpretation,historian
H-H05|Causation map|h|P1|34|c|cause,consequence,causation,diamond 9
H-H06|Change & continuity graph|h|P2|34|c|change,continuity
H-H07|Significance scorer|h|P2|34|f|significance
H-H08|Site plan annotator|h|P2|34|t|site,historic environment
H-H09|Judgement planner|h|P1|34|t|judgement,16 mark,essay,for and against
H-H10|Source frames|h|P2|34|t|source,frames
H-H13|Key-date retrieval|h|P2|34|f|dates,retrieval
H-G01|Map viewer|h|P2|234|c|map,atlas,places
H-G02|Grid references|h|P1|34|c|grid reference,4-figure,6-figure,os map
H-G03|Scale & distance|h|P1|34|c|scale,distance,map
H-G04|Contours & cross-sections|h|P1|34|c|contours,cross section,relief
H-G05|Compass & directions|h|P1|34|c|compass,directions|d:map
H-G06|Climate graph builder|h|P1|34|c|climate graph,temperature,rainfall
H-G07|Population pyramid|h|P1|34|c|population,pyramid
H-G08|Choropleth maker|h|P2|34|c|choropleth,shading map
H-G09|Fieldwork data kit|h|P2|34|f|fieldwork,survey,data
H-G10|Development scatter|h|P2|4|c|development,scatter,indicators
H-G11|Sketch-map annotator|h|P1|34|t|annotate,sketch,photo,label
H-G12|Map skills (practice maps)|h|P1|34|c|map skills,symbols,key
H-R01|Evaluation planner|h|P1|34|t|evaluate,for and against,conclusion,12 mark
H-R02|Concept map|h|P2|34|c|beliefs,concept map
H-R03|Viewpoint comparer|h|P2|34|t|viewpoints,perspectives
H-R04|Sources of wisdom bank|h|P2|34|f|sources of wisdom,authority
H-R05|Belief–teaching–practice|h|P2|34|c|belief,teaching,practice
X-01|Whiteboard (in Live lessons)|x|P1|12345|c|whiteboard,draw,board
X-02|Live classroom controls|x|P1|12345|c|live,classroom,controls
X-03|Timer & stopwatch|x|P1|12345|f|timer,stopwatch,countdown|d:timer
X-04|Name picker & groups|x|P2|12345|f|random,name picker,groups
X-05|Card sort & matching|x|P1|12345|f|sort,match,card sort,categorise
X-06|Diamond-9 ranking|x|P1|345|f|rank,diamond 9,prioritise
X-07|Venn, T-chart & table|x|P1|12345|c|venn,t-chart,table,compare
X-08|Read aloud (any text)|x|P1|12345|f|read aloud,text to speech,listen
X-09|Accessibility panel|x|P1|12345|f|dyslexia,font,spacing,contrast
X-10|Snip into homework|x|P2|345|f|screenshot,snip
X-11|Command-word helper|x|P1|45|f|command words,explain,evaluate,compare,describe,exam technique
X-12|Mind map|x|P1|12345|c|mind map,brainstorm,plan
X-13|Retrieval starter & revision planner|x|P1|345|f|revision,recap,retrieval,starter,review,consolidate
X-14|Exam timer (marks to minutes)|x|P1|45|f|exam,timer,marks,minutes
X-15|Sentence-stem bank|x|P1|1234|t|sentence stems,scaffold,talk
X-16|Glossary & flashcard export|x|P1|1234|f|glossary,key words,flashcards
X-17|Data-entry table|x|P1|234|f|table,data,enter results
X-20|Confidence rating|x|P2|12345|f|confidence,self assessment
D.tally|Tally counter|x|P1|12|c|tally,count,frequency|d:tally
D.spinner|Spinner|x|P1|1234|c|spinner,random,probability|d:spinner
D.symbols|Symbols|x|P1|1234|f|symbols,maths symbols|d:symbol
D.apparatus|Lab equipment|s|P1|234|c|apparatus,equipment,practical,bunsen|d:apparatus
`;

const SUBJ: Record<string, ToolSubject> = { m: "maths", e: "english", s: "science", l: "languages", h: "humanities", x: "cross" };
const SURF: Record<string, Surface> = { c: "canvas", f: "form", t: "text" };

export interface ToolRow extends Omit<ToolMeta, "status" | "impl"> { impl: ToolImpl | null }

/** Parse the catalogue. `impl` only names an existing tool (d:/w:) — the client registry checks it really exists and sets the status. */
export function parseCatalogue(): ToolRow[] {
  return TABLE.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const [id, title, s, tier, ks, surf, tags, impl] = line.split("|");
    if (!id || !title || !SUBJ[s!] || (tier !== "P1" && tier !== "P2") || !SURF[surf!]) throw new Error(`bad catalogue line: ${line}`);
    let i: ToolImpl | null = null;
    if (impl?.startsWith("d:")) i = { kind: "drawer", id: impl.slice(2) as HelpToolId };
    else if (impl?.startsWith("w:")) i = { kind: "widget", id: impl.slice(2) };
    return { id, title, subject: SUBJ[s!]!, tier, keyStages: [...ks!].map(Number) as KeyStage[], surface: SURF[surf!]!, tags: (tags ?? "").split(",").map((t) => t.trim()).filter(Boolean), impl: i, legacy: !!i };
  });
}

/** Subject guess for a lesson widget that has no catalogue row (the ~50 prototype widgets). */
export function widgetSubject(id: string): ToolSubject {
  if (/^lang/.test(id)) return "languages";
  if (/^(clauseCombiner|ordClass|phonicsBlender|punctFixer|spellingLCWC|storyMountain|tenseTimeline|wordClass|wordMaker)$/.test(id)) return "english";
  if (/^(atomBuilder|cellExplorer|circuitBuilder|equationBalancer|foodWeb|forceMotion|lightRays|particleModel|separation|waves)$/.test(id)) return "science";
  if (/^(angleExplorer|areaPerimeter|arrayBuilder|averagesDots|balance|chartBuilder|clockFace|coordGrid|fractionWall|functionMachine|linearGraph|measure|numberLine|percentGrid|placeValue|probSim|ratioBar|tenFrame|transformGrid|sharing)$/.test(id)) return "maths";
  return "cross";
}
