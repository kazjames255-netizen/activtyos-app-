import json
D='features/learninghub/tools/selection/rules/'
# (tool, weight, any, none, years, why)
M=[
("w.placeValue",.7,[r"place value",r"column (addition|subtraction)",r"\b\d+ ?digit",r"composition of numbers",r"\btens\b",r"\bones\b",r"hundreds",r"decompos",r"\bdecimals?\b"],None,None,"Place-value counters show what each digit is worth"),
("w.tenFrame",.5,[r"within (10|20)",r"numbers? (0|1|6|11|20)\b",r"composition of numbers",r"number bonds?",r"addition and subtraction facts",r"counting (to|and|recognising)",r"bridging"],None,[1,3],"A ten frame makes number bonds and counting visible"),
("w.numberLine",.5,[r"number line",r"counting",r"bridging",r"additive (structures|relationships)",r"compensation",r"\baddition\b",r"\bsubtraction\b",r"adding and subtracting",r"sequenc"],None,[1,6],"Hopping on a number line models addition and subtraction"),
("w.clockFace",.85,[r"\bclocks?\b",r"\btelling the time\b",r"\btell the time\b",r"time (write|convert|sequencing)",r"o'clock",r"half past",r"12 and 24 hour"],None,None,"A clock face to set and read times"),
("w.measure",.5,[r"\bmeasures?\b",r"\bmass\b",r"capacity",r"\bvolume\b",r"converting units",r"compound measures",r"sense of measure",r"conversion of measures"],None,None,"Reading a scale is the core skill in measures"),
("w.areaPerimeter",.85,[r"\bperimeter\b",r"\barea\b",r"compound shapes"],None,None,"Build shapes on a grid to explore area and perimeter"),
("w.arrayBuilder",.5,[r"multipl\w+",r"\barrays?\b",r"times tables?",r"\bfactors?\b",r"\bmultiples?\b",r"distributive",r"commutative",r"associative",r"doubling and halving"],[r"multiplicative relationships",r"vectors?"],None,"An array turns multiplication into a picture"),
("w.sharing",.5,[r"\bdivi(sion|de|ding)\b",r"\bsharing\b",r"grouping",r"part.whole"],None,None,"Share and group objects to see division"),
("w.fractionWall",.7,[r"fractions?",r"\btenths\b",r"hundredths",r"parts and wholes",r"part.whole",r"equivalen\w+ fractions?"],None,None,"The fraction wall compares fractions side by side"),
("w.percentGrid",.75,[r"percent\w*",r"proportionality",r"decimals? and",r"fractions,? decimals"],None,None,"A 100-grid links fractions, decimals and percentages"),
("w.ratioBar",.75,[r"\bratios?\b",r"proportion",r"multiplicative relationships",r"comparing quantities"],None,None,"A bar model shows how a ratio splits a whole"),
("w.balance",.5,[r"equations?",r"solving",r"unknowns?",r"simultaneous",r"rearrang\w+",r"equivalence",r"expressions",r"algebra\w*"],None,None,"Balancing scales models solving an equation"),
("w.functionMachine",.5,[r"\bfunctions?\b",r"sequences",r"formulae",r"\binverse\b",r"expressions and"],None,None,"A function machine shows input, rule and output"),
("w.linearGraph",.5,[r"linear graphs?",r"straight.line",r"\bgradient\b",r"real life graphs",r"graphs?",r"y ?= ?mx",r"non linear"],None,[7,13],"Drag m and c to see how the line changes"),
("w.angleExplorer",.7,[r"\bangles?\b",r"right angles",r"turns?\b",r"position and direction"],None,None,"Explore angles and turns hands-on"),
("w.averagesDots",.8,[r"\bmean\b",r"\bmedian\b",r"\bmode\b",r"averages?",r"\brange\b"],None,None,"Dot plots show mean, median, mode and range"),
("w.chartBuilder",.5,[r"charts?",r"pictograms?",r"bar (chart|graph)",r"\bdata\b",r"statistics",r"tables? and"],None,None,"Build a chart from the data"),
("M-21",.5,[r"transformations?",r"position and direction",r"translat\w+",r"reflect\w+",r"enlarge\w+"],None,None,"A coordinate grid to plot the shape and its image"),
("M-20",.5,[r"symmetry",r"plans and elevations",r"\bshapes?\b",r"compound shapes",r"draw"],None,None,"Squared or isometric paper to draw on"),
("M-01",.5,[r"similarity",r"pythagoras",r"parallel and perpendicular"],None,None,"A ruler to measure lengths and sides"),
("M-04",.5,[r"circle theorems?",r"\bcircles?\b",r"loci"],None,None,"Compasses to draw circles and arcs"),
("M-80",.5,[r"surface area",r"volume of",r"pyramids",r"compound measures",r"iteration",r"order of operations",r"percentages",r"maths in the workplace",r"maths and the environment",r"thinking critically",r"proof",r"algebraic manipulation",r"converting units",r"arithmetic procedures",r"direct and inverse",r"understanding percentages"],None,[7,13],"A scientific calculator for multi-step calculations"),
("M-40",.5,[r"\bmoney\b",r"\bcoins?\b",r"unitising",r"counting in (2s|5s|10s)",r"multiples of"],None,[1,3],"A number line to count in steps and add amounts of money"),
("X-05",.5,[r"\bmoney\b",r"\bcoins?\b",r"unitising",r"\bcompar\w+",r"\bmatch\w*",r"\bsort\w*"],None,[1,6],"Sort and match cards to compare values"),
]
S=[
("w.equationBalancer",.7,[r"balanc\w+ (chemical |symbol )?equations?",r"conservation of mass",r"word equations?",r"chemical equations?"],None,None,"Balance the atoms on each side of the equation"),
("w.lightRays",.7,[r"\blight\b",r"refract\w+",r"reflect\w+",r"\blenses?\b",r"\brays?\b"],None,None,"Bend a light ray to see reflection and refraction"),
("w.atomBuilder",.75,[r"\batom\w*",r"protons?",r"electrons?",r"neutrons?",r"electron (shells?|configuration)",r"isotopes?"],None,None,"Build an atom to see its particles"),
("w.cellExplorer",.75,[r"\bcells?\b",r"organelles?",r"microscop\w+",r"mitochondria",r"nucleus"],None,None,"Explore the parts inside a cell"),
("w.separation",.75,[r"mixtures?",r"filtration",r"distillation",r"chromatography",r"evaporat\w+",r"separat\w+",r"dissolv\w+"],None,None,"Choose the right method to separate a mixture"),
("w.neurone",.75,[r"neurones?",r"neurons?",r"nervous system",r"nerve",r"reflex",r"synapse"],None,None,"Send a nerve impulse along a neurone"),
("D.apparatus",.5,[r"apparatus",r"equipment",r"required practical",r"practical",r"investigat\w+",r"experiment\w*",r"method\b"],None,None,"Lab equipment to name and choose for the practical"),
]
E=[
("w.storyMountain",.7,[r"story (mountain|structure|plan\w*)",r"narrative",r"plot",r"\bstory\b.*\b(write|writing|plan)"],None,None,"Climb the story mountain to plan the plot"),
("w.wordClass",.7,[r"word class(es)?",r"\bnouns?\b",r"\bverbs?\b",r"adjectives?",r"adverbs?",r"pronouns?",r"prepositions?",r"conjunctions?",r"determiners?",r"\bgrammar\b"],None,None,"Colour words by class to practise grammar"),
("H-H02",.5,[r"chronolog\w+",r"order of events",r"sequenc\w+ (the )?events"],[r"non.chronological",r"timeline"],None,"Put events in order on a chronology sort"),
]
L=[
("w.langAgree",.5,[r"agree\w*",r"adjectives?",r"gender"],None,None,"Adjective agreement practice"),
("w.langVerbs",.5,[r"\bverbs?\b",r"conjugat\w+",r"\btenses?\b",r"infinitive"],None,None,"Build a verb table"),
("w.langFlash",.5,[r"vocabular\w+",r"\bfamily\b",r"colours?",r"animals?",r"\bfood\b",r"school",r"home",r"hobbies",r"weather"],None,None,"Flip, hear and remember the words"),
("w.langGender",.5,[r"gender",r"\barticles?\b",r"masculine",r"feminine",r"\bder\b|\bdie\b|\bdas\b|\bel\b|\bla\b|\ble\b"],None,None,"Sort nouns by gender"),
("w.langNumbers",.5,[r"numbers?",r"\bdates?\b",r"\btime\b",r"\bage\b",r"birthday"],None,None,"Say it with numbers"),
("w.langOrder",.5,[r"word order",r"sentence (structure|building)",r"\bquestions?\b",r"negati\w+",r"opinions?"],None,None,"Word-order workshop for building sentences"),
]
C=[
("w.fractionBar",.7,[r"simplif\w+ fractions?",r"equivalent fractions?",r"lowest terms",r"algebraic fractions",r"\bfractions?\b"],None,[3,13],"Simplify a fraction by dividing top and bottom together"),
("X-03",.5,[r"\btimers?\b",r"stopwatch",r"reaction time",r"timed",r"speed",r"\bseconds\b",r"time taken"],None,None,"A timer for timed activities and time measurements"),
("D.tally",.5,[r"\btally\b",r"frequency tables?",r"survey",r"\bcount\w* (the )?(number|how many)",r"\bdata (collection|handling)",r"pictograms?"],None,None,"Tally counter to record counts as you go"),
("D.symbols",.5,[r"symbols?",r"\bsigns?\b",r"greater than|less than",r"inequalit\w+",r"notation",r"\bkey\b"],None,None,"A symbols palette for maths and science notation"),
]
def add(file,prefix,items,subject):
    p=D+file; r=json.load(open(p)); ids={x['id'] for x in r['rules']}
    for i,(tool,w,any_,none,yrs,why) in enumerate(items):
        rid=f"{prefix}.{tool}.assign"
        if rid in ids: continue
        o={"id":rid,"tool":tool,"weight":w,"any":any_}
        if none:o["none"]=none
        if yrs:o["years"]=yrs
        if subject:o["subject"]=subject
        o["why"]=why
        r['rules'].append(o)
    json.dump(r,open(p,'w'),indent=1,ensure_ascii=False); open(p,'a').write("\n")
add('maths.json','maths',M,['maths']);add('science.json','science',S,['science']);add('english.json','english',E,['english'])
add('languages.json','languages',L,['languages']);add('cross.json','cross',C,None)
