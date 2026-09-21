// French — Current & Future Study and Employment (GCSE, Years 10 and 11). Original content aligned to the DfE GCSE modern foreign languages subject content (OGL v3.0).
import type { CTopic } from "../types";
import { qb, cards } from "./_h";

const q10 = qb("frwork", 10);
const q11 = qb("frwork", 11);

export const TOPIC: CTopic = {
  key: "frwork",
  topic: "Current & Future Study and Employment",
  subject: "French",
  years: {
    10: {
      year: 10,
      subtopic: "GCSE Year 10",
      yearsCovered: [10],
      objectives: [
        "Describe school life: subjects, timetable, rules, uniform, exams and homework, with opinions and reasons.",
        "Express obligation and permission (devoir, il est interdit de, on n'a pas le droit de).",
        "Compare school subjects and talk about school in the past (imperfect).",
        "Name jobs and say what you would like to do (je voudrais devenir …).",
        "Read short texts about school and translate simple sentences.",
      ],
      note: {
        title: "Year 10: school life, rules and career ideas",
        body: `## School vocabulary and rules

| French | English |
| --- | --- |
| une matière | a school subject |
| un emploi du temps | a timetable |
| le règlement intérieur | the school rules |
| un contrôle / un examen | a test / an exam |
| trop de + noun | too many / too much (no article) |
| il est interdit de + infinitive | it is forbidden to … |
| il est obligatoire de + infinitive | it is compulsory to … |
| on n'a pas le droit de + infinitive | we are not allowed to … |
| les élèves doivent + infinitive | pupils must … |

## Model sentences

- **Ma matière préférée, c'est l'histoire, car les cours sont variés.** = My favourite subject is history because the lessons are varied.
- **Je trouve l'art créatif et amusant.** = I find art creative and fun. (*trouver* + noun + adjective: the adjective agrees.)
- **Il y a trop d'élèves dans la classe.** = There are too many pupils in the class.
- **Il est interdit d'utiliser son portable en classe.** = It is forbidden to use your phone in class.
- **Quand j'étais plus jeune, je détestais les cours de sciences.** = When I was younger, I hated science lessons. (imperfect: a habit or feeling in the past)
- **Tu devrais réviser plus souvent.** = You should revise more often. (conditional of *devoir*)

## Jobs

After *être* and *devenir*, a job has **no article**: *Mon oncle est boulanger.* *Plus tard, je voudrais devenir infirmière.* Many jobs have a feminine form: *infirmier → infirmière*, *acteur → actrice*, *vétérinaire* (same for both).

## Common errors

- *J'ai beaucoup des devoirs* is wrong: **beaucoup de devoirs**.
- Forgetting agreement after *trouver*: *Je trouve les maths difficiles.*
- Leaving out **de** after *interdit* and *obligatoire*: *il est interdit de fumer*.`,
      },
      quiz: {
        title: "Current & Future Study and Employment: Year 10 quiz",
        questions: [
          q10.single("What does 'un emploi du temps' mean?", "a timetable", ["a job", "a holiday", "a school report"], "Emploi du temps literally means 'use of time'. Un emploi alone is a job.", 1),
          q10.short("Write in French: 'a school subject'.", "une matière", "Matière is feminine, so une matière.", 1, { na: true, acc: ["une matière scolaire"] }),
          q10.single("What does 'Il est obligatoire de porter des chaussures noires' mean?", "It is compulsory to wear black shoes.", ["It is forbidden to wear black shoes.", "It is possible to wear black shoes.", "It is unusual to wear black shoes."], "Obligatoire means compulsory. Forbidden is interdit.", 2),
          q10.short("Complete with one word: Au collège, on n'a pas le droit ____ manger en classe.", "de", "Avoir le droit is followed by de + infinitive.", 2, { diag: true }),
          q10.single(
            "Read the text. Why does Marc like science?\n\n« Au collège Jean-Moulin, les cours commencent à huit heures et finissent à seize heures trente. Le mercredi après-midi, il n'y a pas de cours, alors beaucoup d'élèves font du sport ou du théâtre. Les élèves ne portent pas d'uniforme, mais ils n'ont pas le droit d'utiliser leur portable pendant la journée. Marc adore les sciences parce que le professeur fait beaucoup d'expériences. En revanche, il trouve l'histoire trop théorique. Il mange à la cantine, où le repas coûte trois euros. »",
            "The teacher does a lot of experiments.",
            ["The lessons are short.", "There are no exams.", "Science is taught on Wednesday afternoons."],
            "Marc adore les sciences parce que le professeur fait beaucoup d'expériences. Wednesday afternoons have no lessons at all.",
            2, true,
          ),
          q10.multi("Which sentences are correct French? Choose all that apply.", ["Ma matière préférée, c'est l'anglais parce que la prof est sympa.", "Nous avons cinq cours par jour.", "Je trouve les maths difficiles mais utiles."], ["Je trouve les maths difficile mais utile.", "Mes profs sont très patients, mais il ne m'aide pas."], "After trouver the adjectives agree with the noun (plural), and the plural subject mes profs needs ils … m'aident.", 2),
          q10.single("Which sentence means 'I find history more interesting than geography'?", "Je trouve l'histoire plus intéressante que la géographie.", ["Je trouve l'histoire plus intéressant que la géographie.", "Je trouve l'histoire plus intéressante de la géographie.", "Je trouve l'histoire le plus intéressante que la géographie."], "Plus + adjective + que; the adjective agrees with histoire (feminine): intéressante.", 2),
          q10.short("Write in French: 'I would like to become a vet.'", "je voudrais devenir vétérinaire", "After devenir a job has no article. Vétérinaire is the same for men and women.", 2, { na: true, acc: ["j'aimerais devenir vétérinaire", "je veux devenir vétérinaire", "je voudrais être vétérinaire", "j'aimerais être vétérinaire"] }),
          q10.short("Translate into French: 'When I was in primary school, I had more free time.'", "quand j'étais à l'école primaire, j'avais plus de temps libre", "Use the imperfect (j'étais, j'avais) for a state or habit in the past; plus de + noun for 'more'.", 3, { na: true, acc: ["quand j'étais en primaire, j'avais plus de temps libre", "quand j'étais à l'école primaire j'avais plus de temps libre", "j'avais plus de temps libre quand j'étais à l'école primaire", "j'avais plus de temps libre quand j'étais en primaire"] }),
          q10.single("Which sentence means 'I have too much homework, so I am stressed'?", "J'ai trop de devoirs, donc je suis stressé.", ["J'ai trop des devoirs, donc je suis stressé.", "J'ai trop devoirs, donc je suis stressé.", "J'ai trop de devoirs, car je suis stressé."], "Trop de + noun with no article. Donc means 'so' (result), whereas car means 'because' and would reverse the logic.", 3),
          q10.short("Translate into French: 'You should ask the teacher for help.'", "tu devrais demander de l'aide au prof", "Devrais (conditional of devoir) + infinitive. Demander de l'aide à quelqu'un: à + le = au.", 3, { na: true, acc: ["tu devrais demander de l'aide au professeur", "tu devrais demander de l'aide à la prof", "tu devrais demander de l'aide à la professeure", "vous devriez demander de l'aide au prof", "vous devriez demander de l'aide au professeur", "vous devriez demander de l'aide à la prof", "vous devriez demander de l'aide à la professeure"] }),
          q10.written(
            "Write 5–6 sentences in French about your school: your favourite subject and why, one school rule and your opinion of it, and what job you would like to do in future.",
            "Ma matière préférée, c'est la biologie parce que je trouve les expériences intéressantes. Dans mon collège, il est obligatoire de porter un uniforme. À mon avis, c'est pratique, mais je le trouve un peu ennuyeux. Il y a aussi trop de devoirs le lundi, donc je suis souvent fatigué. Plus tard, je voudrais devenir médecin parce que j'aimerais aider les gens.",
            "Marking guide (10): all three elements covered (3); opinions with reasons (2); accurate use of an obligation or permission structure (2); job named without an article after devenir (1); accuracy of agreement, gender and spelling (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["un emploi du temps", "a timetable"],
        ["le règlement intérieur", "school rules"],
        ["il est interdit de + infinitive", "it is forbidden to …"],
        ["on n'a pas le droit de …", "we are not allowed to …"],
        ["I have too much homework.", "J'ai trop de devoirs."],
        ["Mon oncle est boulanger. (why no 'un'?)", "After être / devenir, a job has no article."],
        ["Tu devrais …", "You should … (conditional of devoir)"],
        ["Je trouve les cours ennuyeux.", "I find the lessons boring."],
        ["un contrôle", "a (class) test"],
        ["Quand j'étais plus jeune, je …", "When I was younger, I … (imperfect)"],
      ]),
    },
    11: {
      year: 11,
      subtopic: "GCSE Year 11",
      yearsCovered: [11],
      objectives: [
        "Talk about post-16 options: sixth form, college, apprenticeship and university.",
        "Describe work experience and part-time jobs in the past tense.",
        "Talk about future plans and ambitions (j'espère, je compte, quand + future).",
        "Understand and write simple job applications and formal letters.",
        "Give and justify opinions about jobs, pay and unemployment.",
      ],
      note: {
        title: "Year 11: work experience, plans and applications",
        body: `## Talking about the future

| Structure | Example |
| --- | --- |
| **j'espère / je compte / j'ai l'intention de** + infinitive | J'espère devenir architecte. |
| **avoir envie de** + infinitive | J'ai envie de travailler à l'étranger. |
| **quand** + future | Quand j'aurai dix-huit ans, je voyagerai seul. |

After *espérer* and *compter* there is no preposition (*j'espère partir*), but *j'ai l'intention* and *j'ai envie* take **de**. After **quand**, French uses the **future** if the event is in the future, unlike English: *Quand je serai grand, …* (When I am grown up, …).

## Work experience (past tense)

**Pendant mon stage dans une école, j'ai aidé les enfants à lire. C'était fatigant, mais enrichissant.** = During my placement at a school, I helped the children to read. It was tiring but rewarding. (perfect for actions, imperfect for descriptions)

## Vocabulary

un emploi à temps plein / à temps partiel (full-time / part-time job) · un salaire (a salary) · le chômage / être au chômage (unemployment) · un stage · un(e) stagiaire (trainee) · un CV · une lettre de motivation (cover letter) · un entretien (interview) · l'apprentissage (m) (apprenticeship) · postuler (to apply)

## Formal letters

Begin **Madame, Monsieur,** use **vous**, and end with *Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.* Start with *Je vous écris pour postuler à …*

## Common errors

- Writing *quand je quitte* for a future event: use *quand je quitterai*.
- Adding *de* after *espérer*: say *j'espère aller*, not *j'espère d'aller*.`,
      },
      quiz: {
        title: "Current & Future Study and Employment: Year 11 quiz",
        questions: [
          q11.single("What does 'un stage' mean in a school context?", "a work-experience placement", ["a school trip", "a strike", "a stadium"], "Un stage is a placement or period of work experience. The stage in a theatre is la scène.", 1),
          q11.short("Write in French: 'a part-time job'.", "un emploi à temps partiel", "À temps partiel means part-time. Un travail à temps partiel is also fine.", 1, { na: true, acc: ["un travail à temps partiel", "un job à temps partiel"] }),
          q11.single("Which sentence means 'When I leave school, I will look for a job'?", "Quand je quitterai l'école, je chercherai un emploi.", ["Quand je quitte l'école, je chercherai un emploi.", "Quand je quitterais l'école, je chercherai un emploi.", "Quand je vais quitter l'école, je chercher un emploi."], "After quand, a future event needs the future tense in both clauses: quitterai … chercherai.", 2, true),
          q11.short("Complete with the future tense of aller (one word): Après le lycée, j'____ à l'université.", "irai", "Aller has the irregular future stem ir-: j'irai.", 2, { na: true }),
          q11.single(
            "Read the text. What was the hardest thing at first?\n\n« Le mois dernier, j'ai fait un stage d'une semaine dans une petite boulangerie. Je me suis levé à cinq heures tous les matins, ce qui était difficile au début. J'ai appris à préparer la pâte et à servir les clients. Mon patron était très gentil, mais il parlait vite, alors je n'ai pas toujours compris ses instructions. Malgré la fatigue, j'ai adoré cette expérience. Après mes examens, j'espère faire un apprentissage dans un restaurant, car je voudrais devenir cuisinier. »",
            "Getting up very early.",
            ["Serving customers politely.", "Preparing the dough.", "Working with a kind boss."],
            "Je me suis levé à cinq heures tous les matins, ce qui était difficile au début. The boss was gentle (gentil), not difficult.",
            2, true,
          ),
          q11.multi("Which sentences are correct French? Choose all that apply.", ["J'espère faire des études de droit.", "Je compte travailler à l'étranger.", "Nous avons envie de voyager après le lycée."], ["J'espère de faire des études de droit.", "Je compte à travailler à l'étranger."], "Espérer and compter are followed directly by an infinitive, with no preposition.", 2),
          q11.single("Which sentence means 'She works part-time to earn a little money'?", "Elle travaille à temps partiel pour gagner un peu d'argent.", ["Elle travaille à temps partiel pour gagne un peu d'argent.", "Elle travaille à temps partiel pour gagner un peu de l'argent.", "Elle travaille à temps partiel pour gagnant un peu d'argent."], "Pour + infinitive (gagner), and un peu de + noun keeps de with no article.", 2),
          q11.short("Translate into French: 'After my exams, I will look for a job in a hotel.'", "après mes examens, je chercherai un emploi dans un hôtel", "Future tense (chercherai) for the plan; dans un hôtel for 'in a hotel'.", 3, { na: true, acc: ["après mes examens, je chercherai du travail dans un hôtel", "après mes examens, je chercherai un travail dans un hôtel", "après mes examens je chercherai un emploi dans un hôtel", "je chercherai un emploi dans un hôtel après mes examens", "je chercherai un travail dans un hôtel après mes examens", "après mes examens, je vais chercher un emploi dans un hôtel", "après mes examens, je vais chercher du travail dans un hôtel", "après mes examens, je vais chercher un travail dans un hôtel"] }),
          q11.short("Translate into French: 'During my work experience, I learned to use a computer.'", "pendant mon stage, j'ai appris à utiliser un ordinateur", "Pendant + noun for 'during'; apprendre à + infinitive; the perfect tense with avoir.", 3, { na: true, acc: ["pendant mon stage j'ai appris à utiliser un ordinateur", "pendant mon stage, j'ai appris à me servir d'un ordinateur", "pendant mon stage j'ai appris à me servir d'un ordinateur"] }),
          q11.single("You are writing a formal letter of application to a company. Which opening is most suitable?", "Madame, Monsieur,", ["Salut,", "Coucou tout le monde !", "Mon cher ami,"], "A formal letter to someone you don't know begins Madame, Monsieur, and uses vous.", 2),
          q11.single("Which sentence contains a MISTAKE?", "Ma sœur a travaillé dans un bureau depuis lundi.", ["Après mes examens, j'espère aller à l'université.", "J'ai fait un stage dans une école primaire.", "Mon père a un salaire élevé, mais il travaille beaucoup."], "For something that is still going on, depuis takes the present: ma sœur travaille dans un bureau depuis lundi.", 3),
          q11.written(
            "Write 6–8 sentences in French about your plans after Year 11 and your work experience or a part-time job. Include one sentence with quand + future and one with j'espère or je compte + infinitive.",
            "Après mes examens, j'espère faire un apprentissage dans un garage. L'année dernière, j'ai fait un stage d'une semaine dans un atelier de réparation. J'ai appris à changer une roue et c'était très intéressant. Quand j'aurai dix-huit ans, je passerai mon permis de conduire. Je compte aussi travailler à temps partiel pour gagner un peu d'argent. À mon avis, un salaire élevé est moins important qu'un travail agréable.",
            "Marking guide (12): both required structures used accurately (quand + future; j'espère / je compte + infinitive) (4); accurate past tense for work experience (2); opinion with a reason (2); job or study vocabulary (2); accuracy of spelling and agreement (2).",
            3,
          ),
        ],
      },
      flashcards: cards([
        ["un stage / un stagiaire", "a placement / a trainee"],
        ["un emploi à temps plein", "a full-time job"],
        ["être au chômage", "to be unemployed"],
        ["Quand j'aurai dix-huit ans, je …", "When I am eighteen, I will … (quand + future)"],
        ["J'espère + ?", "an infinitive with no preposition: J'espère partir."],
        ["une lettre de motivation", "a cover letter"],
        ["un entretien", "an interview"],
        ["l'apprentissage (m)", "apprenticeship"],
        ["Madame, Monsieur,", "the standard opening of a formal letter"],
        ["postuler", "to apply (for a job)"],
      ]),
    },
  },
};
