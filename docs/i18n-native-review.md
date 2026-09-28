# Native-speaker review list: Urdu, Punjabi, Bengali, Welsh

Written 28 Sep 2026. These strings were added to the Teaching / Learning Hub during the build (Arcade mode, games summaries, Progress cards, Markbook, Marking & results, flashcards, and the games tab titles and blurbs). The English was final; the four languages below were written by the assistant without a native speaker and need checking before parents and children rely on them. Polish, Romanian, Portuguese, Spanish, French and Arabic went through the same fill and are lower risk, but a spot check is welcome.

How to review: read the English, judge the translation, and write the corrected text next to it. Please keep `{placeholders}` (for example `{name}`, `{n}`) exactly as they are, keep the tone friendly for children, and use Latin digits 0-9 as the rest of the app does. Register follows `docs/i18n-glossary.md` (Urdu: آپ; Punjabi: ਤੁਸੀਂ; Bengali: তুমি for children, আপনি for parents/tutors; Welsh: ti for children, chi for parents/tutors).

Send corrections back as a list of `key -> corrected text`; each key below is `area.key`. Games tab titles (`hubshell.lbl_games_*`) were translated as names, and can be changed if you would rather keep the English names.

Check the current gate with `npm run i18n:check` (fails if any hub string is missing or still English).

## Urdu (اردو)

| key | English | translation |
| --- | --- | --- |
| `hubgames.arc_title` | Arcade | آرکیڈ |
| `hubgames.arc_sub` | Fast and tense: {n} hearts, a ticking clock and a combo to build. | تیز اور سنسنی خیز: {n} دل، چلتی گھڑی اور بنانے کے لیے ایک کومبو۔ |
| `hubgames.arc_calm_note` | Calm mode is on: no hearts and no clock. Your score still counts. | پرسکون موڈ آن ہے: نہ دل، نہ گھڑی۔ آپ کا اسکور پھر بھی گنا جاتا ہے۔ |
| `hubgames.arc_run` | Arcade run | آرکیڈ راؤنڈ |
| `hubgames.arc_run_sub` | {n} questions. Keep your hearts! | {n} سوالات۔ اپنے دل بچائیں! |
| `hubgames.arc_daily` | Daily challenge | روزانہ چیلنج |
| `hubgames.arc_daily_sub` | The same questions for everyone today: {tables} | آج سب کے لیے ایک جیسے سوالات: {tables} |
| `hubgames.arc_endless` | Endless | لامتناہی |
| `hubgames.arc_endless_sub` | Keep going until your hearts run out. | جب تک آپ کے دل ختم نہ ہو جائیں، کھیلتے رہیں۔ |
| `hubgames.arc_play` | Play | کھیلیں |
| `hubgames.arc_best` | Best {n} | بہترین {n} |
| `hubgames.arc_no_best` | No score yet | ابھی تک کوئی اسکور نہیں |
| `hubgames.arc_top` | Top scores on this device | اس ڈیوائس پر سب سے اونچے اسکور |
| `hubgames.arc_score` | Score | اسکور |
| `hubgames.arc_hearts` | {n} of {max} hearts | {max} میں سے {n} دل |
| `hubgames.arc_combo` | Combo x{n} | کومبو x{n} |
| `hubgames.arc_game_over` | Game over | کھیل ختم |
| `hubgames.arc_over_live` | Game over. You scored {n}. | کھیل ختم۔ آپ کا اسکور {n} رہا۔ |
| `hubgames.arc_complete` | Run complete! | راؤنڈ مکمل! |
| `hubgames.arc_new_best` | New best! | نیا ریکارڈ! |
| `hubgames.arc_right` | {n} right | {n} درست |
| `hubgames.arc_best_streak` | best streak {n} | بہترین لگاتار {n} |
| `hubgames.arc_missed` | Worth another look | ایک بار پھر دیکھنے کے قابل |
| `hubgames.arc_again` | Play again | دوبارہ کھیلیں |
| `hubgames.arc_menu` | Back to Arcade | آرکیڈ پر واپس |
| `hubgames.tutor_heat_key` | One square per fact (row × column). Pale blue is new, gold is secure. | ہر حقیقت کے لیے ایک خانہ (قطار × کالم)۔ ہلکا نیلا نیا ہے، سنہری پکا ہے۔ |
| `hubgames.tutor_empty` | {name} hasn't played {game} yet. Once they do, you will see here which facts they know and how often they practise. | {name} نے ابھی تک {game} نہیں کھیلا۔ کھیلنے کے بعد یہاں نظر آئے گا کہ کون سے حقائق آتے ہیں اور مشق کتنی بار ہوتی ہے۔ |
| `hubgames.tutor_more` | More detail: speed and practice | مزید تفصیل: رفتار اور مشق |
| `hubgames.pl_title` | What {name} has practised in games | {name} نے کھیلوں میں کیا مشق کی |
| `hubgames.pl_none` | {name} hasn't played any games yet. | {name} نے ابھی تک کوئی کھیل نہیں کھیلا۔ |
| `hubgames.pl_started` | {name} has started a game but not finished a run yet, so there are no scores to show. A run counts once it is finished. | {name} نے ایک کھیل شروع کیا ہے مگر ابھی کوئی راؤنڈ مکمل نہیں کیا، اس لیے دکھانے کو کوئی اسکور نہیں۔ راؤنڈ مکمل ہونے پر ہی گنا جاتا ہے۔ |
| `hubgames.pl_week` | Played on {days} of {goal} days this week. | اس ہفتے {goal} میں سے {days} دن کھیلا۔ |
| `hubgames.pl_doing_well` | Doing well | اچھا جا رہا ہے |
| `hubgames.pl_getting_there` | Getting there | بہتری کی طرف |
| `hubgames.pl_needs_help` | Needs help | مدد درکار ہے |
| `hubgames.pl_just_started` | Just started | ابھی شروع کیا ہے |
| `hubgames.pl_partial` | Includes {n} answers from a run left part-way. | اس میں ادھورے چھوڑے گئے راؤنڈ کے {n} جوابات شامل ہیں۔ |
| `hubgames.pl_your_child` | Your child | آپ کا بچہ |
| `hubgames.pc_topics_from` | Topics from quizzes, with the score for each. Not lessons. | کوئز کے موضوعات، ہر ایک کے اسکور کے ساتھ۔ یہ اسباق نہیں ہیں۔ |
| `hubgames.pc_games` | Games | کھیل |
| `hubgames.pc_games_sub` | areas practised | مشق کیے گئے شعبے |
| `hubgames.pc_games_none` | Not played yet | ابھی تک نہیں کھیلا |
| `hubgames.pc_games_strong` | Strongest: {area} | سب سے مضبوط: {area} |
| `hubgames.pc_hw` | Homework | ہوم ورک |
| `hubgames.pc_hw_sub` | handed in | جمع کرائے |
| `hubgames.pc_hw_overdue` | {n} overdue | {n} تاخیر سے |
| `hubgames.pc_hw_todo` | {n} still to do | {n} باقی ہیں |
| `hubgames.pc_hw_clear` | All caught up | سب مکمل |
| `hubgames.pc_hw_none` | No homework yet | ابھی کوئی ہوم ورک نہیں |
| `hubgames.pc_hw_handed` | handed in | جمع کرائے |
| `hubgames.pc_hw_marked` | {n} marked | {n} کی جانچ ہو چکی |
| `hubgames.pc_hw_waiting` | {n} waiting to be marked | {n} جانچ کے منتظر |
| `hubgames.pc_hw_incomplete` | {n} not handed in | {n} جمع نہیں ہوئے |
| `hubgames.pc_cards_completed` | completed | مکمل |
| `hubgames.pc_cards` | Flashcards | فلیش کارڈز |
| `hubgames.pc_cards_sub` | due today | آج کے لیے |
| `hubgames.pc_cards_new` | {n} new to learn | {n} نئے سیکھنے کے لیے |
| `hubgames.pc_cards_none` | No cards yet | ابھی کوئی کارڈ نہیں |
| `hubgames.pl_right` | {pct}% right ({n} answers) | {pct}% درست ({n} جوابات) |
| `hubgames.pl_solved` | {n} solved | {n} حل ہوئے |
| `hubgames.pl_good_at` | Good at: {list} | ان میں اچھا: {list} |
| `hubgames.pl_needs_work` | Needs work: {list} | بہتری کی ضرورت: {list} |
| `hubgames.pl_best` | Strongest: {area}. | سب سے مضبوط: {area}۔ |
| `hubgames.pl_worst` | Needs the most help: {area}. | سب سے زیادہ مدد درکار: {area}۔ |
| `hubgames.pl_detail` | Times tables detail | پہاڑوں کی تفصیل |
| `hubgames.pl_a_times` | Times tables | پہاڑے |
| `hubgames.pl_a_geography` | Geography | جغرافیہ |
| `hubgames.pl_a_history` | History | تاریخ |
| `hubgames.pl_a_science` | Science | سائنس |
| `hubgames.pl_a_debate` | Persuasive writing | قائل کرنے والی تحریر |
| `hubgames.pl_a_reading` | Reading and inference | مطالعہ اور استنباط |
| `hubgames.pl_a_vocab` | Vocabulary | ذخیرۂ الفاظ |
| `hubgames.pl_a_spelling` | Spelling | ہجے |
| `hubgames.pl_a_computing` | Computing | کمپیوٹنگ |
| `hubgames.pl_a_data` | Data and statistics | ڈیٹا اور شماریات |
| `hubgames.pl_a_drills` | Mixed practice drills | ملی جلی مشقیں |
| `hubgames.pl_a_numbers` | Number patterns | عددی نمونے |
| `hubgames.pl_a_shapes` | Shapes and geometry | شکلیں اور جیومیٹری |
| `hubhomework.resSubject` | Subject | مضمون |
| `hubhomework.resAllSubjects` | All subjects | تمام مضامین |
| `hubhomework.resFlip` | Show | دکھائیں |
| `hubhomework.resFlipDots` | Dots | نقطے |
| `hubhomework.resFlipScore` | Scores | اسکور |
| `hubhomework.resFlipPct` | Percent | فیصد |
| `hubhomework.resUnmarkedKey` | Handed in, not marked yet | جمع کرایا، ابھی جانچا نہیں گیا |
| `hubhomework.resNeedsMarking` | Needs marking ({n}) | جانچ باقی ({n}) |
| `hubhomework.resOpen` | Open | کھولیں |
| `hubhomework.resClose` | Close | بند کریں |
| `hubhomework.resNothingToMark` | Nothing is waiting to be marked. | جانچ کے لیے کچھ باقی نہیں۔ |
| `hubhomework.resMarkBtn` | Mark | جانچیں |
| `hubhomework.resLateShort` | late | تاخیر |
| `hubhomework.resShowFewer` | Show fewer | کم دکھائیں |
| `hubhomework.resShowAllMark` | Show all {n} | تمام {n} دکھائیں |
| `hublessons.tfCompleted` | {p}% completed ({a} of {b} cards) | {p}% مکمل ({b} میں سے {a} کارڈز) |
| `hubshell.lbl_games_market` | Market Day | بازار کا دن |
| `hubshell.lbl_games_bakeoff` | Bake Off Blitz | تیز رفتار بیکنگ مقابلہ |
| `hubshell.lbl_games_reef` | Rhythm Reef | ردھم ریف |
| `hubshell.lbl_games_primereef` | Prime Reef | پرائم ریف |
| `hubshell.lbl_games_datacarnival` | Data Carnival | ڈیٹا کارنیوال |
| `hubshell.lbl_games_shapeworkshop` | Shape Workshop | شکلوں کی ورکشاپ |
| `hubshell.lbl_games_botfoundry` | Bot Foundry | روبوٹ فاؤنڈری |
| `hubshell.lbl_games_sortyard` | Sort Yard | چھانٹی گھر |
| `hubshell.lbl_games_training` | Training Ground | تربیتی میدان |
| `hubshell.lbl_games_compass` | Compass Quest | قطب نما کی مہم |
| `hubshell.lbl_games_museum` | Museum Vault | میوزیم کا خزانہ |
| `hubshell.lbl_games_colourlab` | Colour Lab | رنگوں کی لیب |
| `hubshell.lbl_games_debate` | Debate Keep | مباحثے کا قلعہ |
| `hubshell.lbl_games_detective` | Story Detective | کہانی کا کھوجی |
| `hubshell.lbl_games_vault` | Word Vault | الفاظ کا خزانہ |
| `hubshell.lbl_games_wordpop` | Word Pop | لفظوں کے غبارے |
| `hubshell.gamesMarketBlurb` | Run a market stall — give change, spot the best value, keep the books balanced. | بازار کا ایک اسٹال چلائیں — بقایا لوٹائیں، بہترین سودا پہچانیں اور حساب کتاب درست رکھیں۔ |
| `hubshell.gamesBakeoffBlurb` | Scale up a recipe, convert units and get ratios right before the judges arrive. | نسخے کی مقدار بڑھائیں، اکائیاں بدلیں اور ججوں کے آنے سے پہلے تناسب درست کریں۔ |
| `hubshell.gamesReefBlurb` | Spot the pattern in a reef of bubbles, shells and number sequences. | بلبلوں، سیپیوں اور عددی سلسلوں سے بھری چٹان میں نمونہ پہچانیں۔ |
| `hubshell.gamesPrimeReefBlurb` | Dive the reef spotting primes, factors and multiples before the next question surfaces. | چٹان میں غوطہ لگائیں اور اگلا سوال ابھرنے سے پہلے مفرد اعداد، جزوِ ضربی اور اضعاف پہچانیں۔ |
| `hubshell.gamesDataCarnivalBlurb` | Run the fairground stalls — read charts and find the mean, median, mode and range. | میلے کے اسٹال چلائیں — چارٹ پڑھیں اور اوسط، میڈین، موڈ اور رینج معلوم کریں۔ |
| `hubshell.gamesShapeWorkshopBlurb` | Build the workshop — shape properties, angles, symmetry and area/perimeter, piece by piece. | ورکشاپ بنائیں — شکلوں کی خصوصیات، زاویے، تشاکل اور رقبہ/احاطہ، ایک ایک ٹکڑا جوڑ کر۔ |
| `hubshell.gamesBotfoundryBlurb` | Build a program of instructions to guide your bot to the flag — sequence, loops and if-checks. | ہدایات کا ایک پروگرام بنائیں جو آپ کے روبوٹ کو جھنڈے تک پہنچائے — ترتیب، لوپ اور اگر والی جانچ۔ |
| `hubshell.gamesSortyardBlurb` | Classify real data, read a bar chart and put numbers in order. | اصل ڈیٹا کی درجہ بندی کریں، پٹی چارٹ پڑھیں اور اعداد کو ترتیب دیں۔ |
| `hubshell.gamesTrainingBlurb` | A quick practice sprint — spelling, science facts and more, tailored to what needs work. | مشق کی ایک مختصر دوڑ — ہجے، سائنس کے حقائق اور بہت کچھ، اس کے مطابق جس پر محنت کی ضرورت ہے۔ |
| `hubshell.gamesCompassBlurb` | Chart a course through compass directions, map reading and world geography. | قطب نما کی سمتوں، نقشہ پڑھنے اور دنیا کے جغرافیے سے گزرتا ہوا راستہ بنائیں۔ |
| `hubshell.gamesMuseumBlurb` | Unlock exhibits by getting timelines, historical figures and cause-and-effect right. | وقتی ترتیب، تاریخی شخصیات اور وجہ اور نتیجے کے صحیح جواب دے کر نمائشیں کھولیں۔ |
| `hubshell.gamesColourlabBlurb` | Run experiments with light, colour mixing and how we see colour. | روشنی، رنگوں کے ملاپ اور ہمارے رنگ دیکھنے کے طریقے پر تجربات کریں۔ |
| `hubshell.gamesDebateBlurb` | Spot persuasive techniques, judge the stronger argument and build a case that holds up. | قائل کرنے کی تراکیب پہچانیں، مضبوط دلیل کو جانچیں اور ایسا مقدمہ بنائیں جو ٹھہر سکے۔ |
| `hubshell.gamesDetectiveBlurb` | Crack the case by answering the clue — inference, tricky words in context and story order. | اشارے کا جواب دے کر معمہ حل کریں — قیاس، سیاق میں مشکل الفاظ اور کہانی کی ترتیب۔ |
| `hubshell.gamesVaultBlurb` | Unlock the vault: word meanings, synonyms, opposites and words in context. | خزانہ کھولیں: الفاظ کے معنی، ہم معنی الفاظ، متضاد اور سیاق میں الفاظ۔ |
| `hubshell.gamesWordpopBlurb` | Quick-fire spelling: homophones, tricky words and spelling patterns before the timer runs out. | تیز رفتار ہجے: ہم آواز الفاظ، مشکل الفاظ اور ہجوں کے نمونے، وقت ختم ہونے سے پہلے۔ |
| `hubshell.gamesLiteracySummaryTitle` | Word games | لفظی کھیل |
| `hubshell.gamesLiteracySummaryBody` | {played} of 4 games played · {points} points earned | 4 میں سے {played} کھیل کھیلے · {points} پوائنٹس حاصل |
| `hubshell.gamesQuizLoading` | Loading… | لوڈ ہو رہا ہے… |
| `hubshell.gamesQuizMarking` | Marking… | جانچ ہو رہی ہے… |
| `hubshell.gamesQuizBegin` | Start | شروع کریں |
| `hubshell.gamesRetry` | Try again | دوبارہ کوشش کریں |
| `hubshell.gamesQuizAlreadyRecorded` | Already recorded. | پہلے ہی درج ہو چکا ہے۔ |
| `hubshell.gamesQuizYouSaid` | You said | آپ نے کہا |
| `hubshell.gamesQuizAnswer` | Answer | جواب |
| `hubshell.gamesQuizPlayAgain` | Play again | دوبارہ کھیلیں |
| `hubshell.gamesQuizSkip` | Skip | چھوڑیں |
| `hubshell.gamesQuizNext` | Next | اگلا |
| `hubshell.gamesQuizFinish` | Finish | ختم کریں |
| `hubhow.tourBody` | A quick look at the main places. You can skip it. | اہم مقامات پر ایک مختصر نظر۔ آپ اسے چھوڑ سکتے ہیں۔ |
| `hubhow.watchBannerBody` | This is what {name} sees. View only: nothing here is saved. | {name} بالکل یہی دیکھتا ہے۔ صرف دیکھنے کے لیے: یہاں کچھ بھی محفوظ نہیں ہوتا۔ |

## Punjabi (ਪੰਜਾਬੀ)

| key | English | translation |
| --- | --- | --- |
| `hubgames.arc_title` | Arcade | ਆਰਕੇਡ |
| `hubgames.arc_sub` | Fast and tense: {n} hearts, a ticking clock and a combo to build. | ਤੇਜ਼ ਤੇ ਰੋਮਾਂਚਕ: {n} ਦਿਲ, ਟਿਕ-ਟਿਕ ਕਰਦੀ ਘੜੀ ਤੇ ਬਣਾਉਣ ਲਈ ਇੱਕ ਕੌਂਬੋ। |
| `hubgames.arc_calm_note` | Calm mode is on: no hearts and no clock. Your score still counts. | ਸ਼ਾਂਤ ਮੋਡ ਚਾਲੂ ਹੈ: ਨਾ ਦਿਲ, ਨਾ ਘੜੀ। ਤੁਹਾਡਾ ਸਕੋਰ ਫਿਰ ਵੀ ਗਿਣਿਆ ਜਾਂਦਾ ਹੈ। |
| `hubgames.arc_run` | Arcade run | ਆਰਕੇਡ ਦੌਰ |
| `hubgames.arc_run_sub` | {n} questions. Keep your hearts! | {n} ਸਵਾਲ। ਆਪਣੇ ਦਿਲ ਬਚਾ ਕੇ ਰੱਖੋ! |
| `hubgames.arc_daily` | Daily challenge | ਰੋਜ਼ਾਨਾ ਚੁਣੌਤੀ |
| `hubgames.arc_daily_sub` | The same questions for everyone today: {tables} | ਅੱਜ ਸਾਰਿਆਂ ਲਈ ਇੱਕੋ ਜਿਹੇ ਸਵਾਲ: {tables} |
| `hubgames.arc_endless` | Endless | ਬੇਅੰਤ |
| `hubgames.arc_endless_sub` | Keep going until your hearts run out. | ਜਦੋਂ ਤੱਕ ਤੁਹਾਡੇ ਦਿਲ ਖ਼ਤਮ ਨਾ ਹੋ ਜਾਣ, ਖੇਡਦੇ ਰਹੋ। |
| `hubgames.arc_play` | Play | ਖੇਡੋ |
| `hubgames.arc_best` | Best {n} | ਸਭ ਤੋਂ ਵਧੀਆ {n} |
| `hubgames.arc_no_best` | No score yet | ਹਾਲੇ ਕੋਈ ਸਕੋਰ ਨਹੀਂ |
| `hubgames.arc_top` | Top scores on this device | ਇਸ ਡਿਵਾਈਸ ’ਤੇ ਸਭ ਤੋਂ ਵੱਧ ਸਕੋਰ |
| `hubgames.arc_score` | Score | ਸਕੋਰ |
| `hubgames.arc_hearts` | {n} of {max} hearts | {max} ਵਿੱਚੋਂ {n} ਦਿਲ |
| `hubgames.arc_combo` | Combo x{n} | ਕੌਂਬੋ x{n} |
| `hubgames.arc_game_over` | Game over | ਖੇਡ ਖ਼ਤਮ |
| `hubgames.arc_over_live` | Game over. You scored {n}. | ਖੇਡ ਖ਼ਤਮ। ਤੁਹਾਡਾ ਸਕੋਰ {n} ਰਿਹਾ। |
| `hubgames.arc_complete` | Run complete! | ਦੌਰ ਪੂਰਾ! |
| `hubgames.arc_new_best` | New best! | ਨਵਾਂ ਰਿਕਾਰਡ! |
| `hubgames.arc_right` | {n} right | {n} ਸਹੀ |
| `hubgames.arc_best_streak` | best streak {n} | ਸਭ ਤੋਂ ਲੰਮੀ ਲਗਾਤਾਰ ਲੜੀ {n} |
| `hubgames.arc_missed` | Worth another look | ਇੱਕ ਵਾਰ ਹੋਰ ਵੇਖਣ ਯੋਗ |
| `hubgames.arc_again` | Play again | ਦੁਬਾਰਾ ਖੇਡੋ |
| `hubgames.arc_menu` | Back to Arcade | ਆਰਕੇਡ ’ਤੇ ਵਾਪਸ |
| `hubgames.tutor_heat_key` | One square per fact (row × column). Pale blue is new, gold is secure. | ਹਰ ਤੱਥ ਲਈ ਇੱਕ ਵਰਗ (ਕਤਾਰ × ਕਾਲਮ)। ਹਲਕਾ ਨੀਲਾ ਨਵਾਂ ਹੈ, ਸੁਨਹਿਰੀ ਪੱਕਾ ਹੈ। |
| `hubgames.tutor_empty` | {name} hasn't played {game} yet. Once they do, you will see here which facts they know and how often they practise. | {name}: ਹਾਲੇ {game} ਨਹੀਂ ਖੇਡੀ ਗਈ। ਖੇਡਣ ਤੋਂ ਬਾਅਦ ਇੱਥੇ ਦਿਸੇਗਾ ਕਿ ਕਿਹੜੇ ਤੱਥ ਆਉਂਦੇ ਹਨ ਤੇ ਅਭਿਆਸ ਕਿੰਨੀ ਵਾਰ ਹੁੰਦਾ ਹੈ। |
| `hubgames.tutor_more` | More detail: speed and practice | ਹੋਰ ਵੇਰਵਾ: ਰਫ਼ਤਾਰ ਅਤੇ ਅਭਿਆਸ |
| `hubgames.pl_title` | What {name} has practised in games | {name} ਨੇ ਖੇਡਾਂ ਵਿੱਚ ਕੀ ਅਭਿਆਸ ਕੀਤਾ |
| `hubgames.pl_none` | {name} hasn't played any games yet. | {name} ਨੇ ਹਾਲੇ ਤੱਕ ਕੋਈ ਖੇਡ ਨਹੀਂ ਖੇਡੀ। |
| `hubgames.pl_started` | {name} has started a game but not finished a run yet, so there are no scores to show. A run counts once it is finished. | {name} ਨੇ ਇੱਕ ਖੇਡ ਸ਼ੁਰੂ ਕੀਤੀ ਹੈ ਪਰ ਹਾਲੇ ਕੋਈ ਦੌਰ ਪੂਰਾ ਨਹੀਂ ਕੀਤਾ, ਇਸ ਲਈ ਦਿਖਾਉਣ ਲਈ ਕੋਈ ਸਕੋਰ ਨਹੀਂ। ਦੌਰ ਪੂਰਾ ਹੋਣ ’ਤੇ ਹੀ ਗਿਣਿਆ ਜਾਂਦਾ ਹੈ। |
| `hubgames.pl_week` | Played on {days} of {goal} days this week. | ਇਸ ਹਫ਼ਤੇ {goal} ਵਿੱਚੋਂ {days} ਦਿਨ ਖੇਡਿਆ। |
| `hubgames.pl_doing_well` | Doing well | ਵਧੀਆ ਚੱਲ ਰਿਹਾ ਹੈ |
| `hubgames.pl_getting_there` | Getting there | ਸੁਧਾਰ ਵੱਲ |
| `hubgames.pl_needs_help` | Needs help | ਮਦਦ ਦੀ ਲੋੜ ਹੈ |
| `hubgames.pl_just_started` | Just started | ਹੁਣੇ ਸ਼ੁਰੂ ਕੀਤਾ |
| `hubgames.pl_partial` | Includes {n} answers from a run left part-way. | ਇਸ ਵਿੱਚ ਅੱਧ ਵਿਚਾਲੇ ਛੱਡੇ ਦੌਰ ਦੇ {n} ਜਵਾਬ ਸ਼ਾਮਲ ਹਨ। |
| `hubgames.pl_your_child` | Your child | ਤੁਹਾਡਾ ਬੱਚਾ |
| `hubgames.pc_topics_from` | Topics from quizzes, with the score for each. Not lessons. | ਕੁਇਜ਼ ਤੋਂ ਟਾਪਿਕ, ਹਰੇਕ ਦੇ ਸਕੋਰ ਨਾਲ। ਇਹ ਪਾਠ ਨਹੀਂ ਹਨ। |
| `hubgames.pc_games` | Games | ਖੇਡਾਂ |
| `hubgames.pc_games_sub` | areas practised | ਅਭਿਆਸ ਕੀਤੇ ਖੇਤਰ |
| `hubgames.pc_games_none` | Not played yet | ਹਾਲੇ ਨਹੀਂ ਖੇਡਿਆ |
| `hubgames.pc_games_strong` | Strongest: {area} | ਸਭ ਤੋਂ ਮਜ਼ਬੂਤ: {area} |
| `hubgames.pc_hw` | Homework | ਹੋਮਵਰਕ |
| `hubgames.pc_hw_sub` | handed in | ਜਮ੍ਹਾਂ ਕਰਵਾਏ |
| `hubgames.pc_hw_overdue` | {n} overdue | {n} ਦੇਰੀ ਨਾਲ |
| `hubgames.pc_hw_todo` | {n} still to do | {n} ਬਾਕੀ ਹਨ |
| `hubgames.pc_hw_clear` | All caught up | ਸਭ ਪੂਰਾ |
| `hubgames.pc_hw_none` | No homework yet | ਹਾਲੇ ਕੋਈ ਹੋਮਵਰਕ ਨਹੀਂ |
| `hubgames.pc_hw_handed` | handed in | ਜਮ੍ਹਾਂ ਕਰਵਾਏ |
| `hubgames.pc_hw_marked` | {n} marked | {n} ਜਾਂਚੇ ਗਏ |
| `hubgames.pc_hw_waiting` | {n} waiting to be marked | {n} ਜਾਂਚ ਦੀ ਉਡੀਕ ਵਿੱਚ |
| `hubgames.pc_hw_incomplete` | {n} not handed in | {n} ਜਮ੍ਹਾਂ ਨਹੀਂ ਹੋਏ |
| `hubgames.pc_cards_completed` | completed | ਮੁਕੰਮਲ |
| `hubgames.pc_cards` | Flashcards | ਫਲੈਸ਼ਕਾਰਡ |
| `hubgames.pc_cards_sub` | due today | ਅੱਜ ਲਈ |
| `hubgames.pc_cards_new` | {n} new to learn | {n} ਨਵੇਂ ਸਿੱਖਣ ਲਈ |
| `hubgames.pc_cards_none` | No cards yet | ਹਾਲੇ ਕੋਈ ਕਾਰਡ ਨਹੀਂ |
| `hubgames.pl_right` | {pct}% right ({n} answers) | {pct}% ਸਹੀ ({n} ਜਵਾਬ) |
| `hubgames.pl_solved` | {n} solved | {n} ਹੱਲ ਕੀਤੇ |
| `hubgames.pl_good_at` | Good at: {list} | ਇਨ੍ਹਾਂ ਵਿੱਚ ਚੰਗਾ: {list} |
| `hubgames.pl_needs_work` | Needs work: {list} | ਸੁਧਾਰ ਦੀ ਲੋੜ: {list} |
| `hubgames.pl_best` | Strongest: {area}. | ਸਭ ਤੋਂ ਮਜ਼ਬੂਤ: {area}। |
| `hubgames.pl_worst` | Needs the most help: {area}. | ਸਭ ਤੋਂ ਵੱਧ ਮਦਦ ਦੀ ਲੋੜ: {area}। |
| `hubgames.pl_detail` | Times tables detail | ਪਹਾੜਿਆਂ ਦੀ ਤਫ਼ਸੀਲ |
| `hubgames.pl_a_times` | Times tables | ਪਹਾੜੇ |
| `hubgames.pl_a_geography` | Geography | ਭੂਗੋਲ |
| `hubgames.pl_a_history` | History | ਇਤਿਹਾਸ |
| `hubgames.pl_a_science` | Science | ਵਿਗਿਆਨ |
| `hubgames.pl_a_debate` | Persuasive writing | ਕਾਇਲ ਕਰਨ ਵਾਲੀ ਲਿਖਤ |
| `hubgames.pl_a_reading` | Reading and inference | ਪੜ੍ਹਨਾ ਅਤੇ ਅਨੁਮਾਨ |
| `hubgames.pl_a_vocab` | Vocabulary | ਸ਼ਬਦ-ਭੰਡਾਰ |
| `hubgames.pl_a_spelling` | Spelling | ਸ਼ਬਦ-ਜੋੜ |
| `hubgames.pl_a_computing` | Computing | ਕੰਪਿਊਟਿੰਗ |
| `hubgames.pl_a_data` | Data and statistics | ਡਾਟਾ ਅਤੇ ਅੰਕੜੇ |
| `hubgames.pl_a_drills` | Mixed practice drills | ਮਿਲਵੇਂ ਅਭਿਆਸ |
| `hubgames.pl_a_numbers` | Number patterns | ਸੰਖਿਆ ਪੈਟਰਨ |
| `hubgames.pl_a_shapes` | Shapes and geometry | ਆਕਾਰ ਅਤੇ ਜਿਓਮੈਟਰੀ |
| `hubhomework.resSubject` | Subject | ਵਿਸ਼ਾ |
| `hubhomework.resAllSubjects` | All subjects | ਸਾਰੇ ਵਿਸ਼ੇ |
| `hubhomework.resFlip` | Show | ਦਿਖਾਓ |
| `hubhomework.resFlipDots` | Dots | ਬਿੰਦੀਆਂ |
| `hubhomework.resFlipScore` | Scores | ਸਕੋਰ |
| `hubhomework.resFlipPct` | Percent | ਪ੍ਰਤੀਸ਼ਤ |
| `hubhomework.resUnmarkedKey` | Handed in, not marked yet | ਜਮ੍ਹਾਂ ਕਰਵਾਇਆ, ਹਾਲੇ ਜਾਂਚਿਆ ਨਹੀਂ |
| `hubhomework.resNeedsMarking` | Needs marking ({n}) | ਜਾਂਚ ਬਾਕੀ ({n}) |
| `hubhomework.resOpen` | Open | ਖੋਲ੍ਹੋ |
| `hubhomework.resClose` | Close | ਬੰਦ ਕਰੋ |
| `hubhomework.resNothingToMark` | Nothing is waiting to be marked. | ਜਾਂਚ ਲਈ ਕੁਝ ਵੀ ਬਾਕੀ ਨਹੀਂ। |
| `hubhomework.resMarkBtn` | Mark | ਜਾਂਚੋ |
| `hubhomework.resLateShort` | late | ਦੇਰੀ |
| `hubhomework.resShowFewer` | Show fewer | ਘੱਟ ਦਿਖਾਓ |
| `hubhomework.resShowAllMark` | Show all {n} | ਸਾਰੇ {n} ਦਿਖਾਓ |
| `hublessons.tfCompleted` | {p}% completed ({a} of {b} cards) | {p}% ਮੁਕੰਮਲ ({b} ਵਿੱਚੋਂ {a} ਕਾਰਡ) |
| `hubshell.lbl_games_market` | Market Day | ਮੰਡੀ ਦਾ ਦਿਨ |
| `hubshell.lbl_games_bakeoff` | Bake Off Blitz | ਤੇਜ਼ ਬੇਕਿੰਗ ਮੁਕਾਬਲਾ |
| `hubshell.lbl_games_reef` | Rhythm Reef | ਲੈਅ ਰੀਫ਼ |
| `hubshell.lbl_games_primereef` | Prime Reef | ਪ੍ਰਾਈਮ ਰੀਫ਼ |
| `hubshell.lbl_games_datacarnival` | Data Carnival | ਡਾਟਾ ਕਾਰਨੀਵਲ |
| `hubshell.lbl_games_shapeworkshop` | Shape Workshop | ਆਕਾਰਾਂ ਦੀ ਵਰਕਸ਼ਾਪ |
| `hubshell.lbl_games_botfoundry` | Bot Foundry | ਰੋਬੋਟ ਫਾਊਂਡਰੀ |
| `hubshell.lbl_games_sortyard` | Sort Yard | ਛਾਂਟੀ ਯਾਰਡ |
| `hubshell.lbl_games_training` | Training Ground | ਸਿਖਲਾਈ ਮੈਦਾਨ |
| `hubshell.lbl_games_compass` | Compass Quest | ਕੰਪਾਸ ਦੀ ਖੋਜ |
| `hubshell.lbl_games_museum` | Museum Vault | ਅਜਾਇਬ-ਘਰ ਦੀ ਤਿਜੌਰੀ |
| `hubshell.lbl_games_colourlab` | Colour Lab | ਰੰਗਾਂ ਦੀ ਲੈਬ |
| `hubshell.lbl_games_debate` | Debate Keep | ਬਹਿਸ ਦਾ ਕਿਲ੍ਹਾ |
| `hubshell.lbl_games_detective` | Story Detective | ਕਹਾਣੀ ਦਾ ਜਾਸੂਸ |
| `hubshell.lbl_games_vault` | Word Vault | ਸ਼ਬਦਾਂ ਦੀ ਤਿਜੌਰੀ |
| `hubshell.lbl_games_wordpop` | Word Pop | ਸ਼ਬਦ ਗੁਬਾਰੇ |
| `hubshell.gamesMarketBlurb` | Run a market stall — give change, spot the best value, keep the books balanced. | ਮੰਡੀ ਦਾ ਇੱਕ ਸਟਾਲ ਚਲਾਓ — ਬਕਾਇਆ ਮੋੜੋ, ਸਭ ਤੋਂ ਵਧੀਆ ਸੌਦਾ ਲੱਭੋ ਤੇ ਹਿਸਾਬ-ਕਿਤਾਬ ਠੀਕ ਰੱਖੋ। |
| `hubshell.gamesBakeoffBlurb` | Scale up a recipe, convert units and get ratios right before the judges arrive. | ਨੁਸਖ਼ੇ ਦੀ ਮਾਤਰਾ ਵਧਾਓ, ਇਕਾਈਆਂ ਬਦਲੋ ਤੇ ਜੱਜਾਂ ਦੇ ਆਉਣ ਤੋਂ ਪਹਿਲਾਂ ਅਨੁਪਾਤ ਠੀਕ ਕਰੋ। |
| `hubshell.gamesReefBlurb` | Spot the pattern in a reef of bubbles, shells and number sequences. | ਬੁਲਬੁਲਿਆਂ, ਸਿੱਪੀਆਂ ਤੇ ਸੰਖਿਆ-ਲੜੀਆਂ ਨਾਲ ਭਰੀ ਰੀਫ਼ ਵਿੱਚ ਪੈਟਰਨ ਲੱਭੋ। |
| `hubshell.gamesPrimeReefBlurb` | Dive the reef spotting primes, factors and multiples before the next question surfaces. | ਰੀਫ਼ ਵਿੱਚ ਗੋਤਾ ਲਾਓ ਤੇ ਅਗਲਾ ਸਵਾਲ ਉੱਭਰਨ ਤੋਂ ਪਹਿਲਾਂ ਅਭਾਜ ਸੰਖਿਆਵਾਂ, ਗੁਣਨਖੰਡ ਤੇ ਗੁਣਜ ਲੱਭੋ। |
| `hubshell.gamesDataCarnivalBlurb` | Run the fairground stalls — read charts and find the mean, median, mode and range. | ਮੇਲੇ ਦੇ ਸਟਾਲ ਚਲਾਓ — ਚਾਰਟ ਪੜ੍ਹੋ ਤੇ ਔਸਤ, ਮੀਡੀਅਨ, ਮੋਡ ਤੇ ਰੇਂਜ ਲੱਭੋ। |
| `hubshell.gamesShapeWorkshopBlurb` | Build the workshop — shape properties, angles, symmetry and area/perimeter, piece by piece. | ਵਰਕਸ਼ਾਪ ਬਣਾਓ — ਆਕਾਰਾਂ ਦੇ ਗੁਣ, ਕੋਣ, ਸਮਰੂਪਤਾ ਅਤੇ ਖੇਤਰਫਲ/ਘੇਰਾ, ਇੱਕ-ਇੱਕ ਟੁਕੜਾ ਜੋੜ ਕੇ। |
| `hubshell.gamesBotfoundryBlurb` | Build a program of instructions to guide your bot to the flag — sequence, loops and if-checks. | ਹਦਾਇਤਾਂ ਦਾ ਇੱਕ ਪ੍ਰੋਗਰਾਮ ਬਣਾਓ ਜੋ ਤੁਹਾਡੇ ਰੋਬੋਟ ਨੂੰ ਝੰਡੇ ਤੱਕ ਪਹੁੰਚਾਏ — ਕ੍ਰਮ, ਲੂਪ ਤੇ ਜੇ-ਜਾਂਚ। |
| `hubshell.gamesSortyardBlurb` | Classify real data, read a bar chart and put numbers in order. | ਅਸਲੀ ਡਾਟਾ ਦੀ ਵੰਡ ਕਰੋ, ਪੱਟੀ ਚਾਰਟ ਪੜ੍ਹੋ ਤੇ ਸੰਖਿਆਵਾਂ ਨੂੰ ਕ੍ਰਮ ਵਿੱਚ ਰੱਖੋ। |
| `hubshell.gamesTrainingBlurb` | A quick practice sprint — spelling, science facts and more, tailored to what needs work. | ਅਭਿਆਸ ਦੀ ਇੱਕ ਛੋਟੀ ਦੌੜ — ਸ਼ਬਦ-ਜੋੜ, ਵਿਗਿਆਨ ਦੇ ਤੱਥ ਤੇ ਹੋਰ ਬਹੁਤ ਕੁਝ, ਉਸ ਮੁਤਾਬਕ ਜਿਸ ’ਤੇ ਮਿਹਨਤ ਦੀ ਲੋੜ ਹੈ। |
| `hubshell.gamesCompassBlurb` | Chart a course through compass directions, map reading and world geography. | ਕੰਪਾਸ ਦੀਆਂ ਦਿਸ਼ਾਵਾਂ, ਨਕਸ਼ਾ ਪੜ੍ਹਨ ਅਤੇ ਦੁਨੀਆ ਦੇ ਭੂਗੋਲ ਵਿੱਚੋਂ ਦੀ ਆਪਣਾ ਰਾਹ ਬਣਾਓ। |
| `hubshell.gamesMuseumBlurb` | Unlock exhibits by getting timelines, historical figures and cause-and-effect right. | ਸਮਾਂ-ਰੇਖਾਵਾਂ, ਇਤਿਹਾਸਕ ਸ਼ਖ਼ਸੀਅਤਾਂ ਤੇ ਕਾਰਨ ਤੇ ਨਤੀਜੇ ਦੇ ਸਹੀ ਜਵਾਬ ਦੇ ਕੇ ਪ੍ਰਦਰਸ਼ਨੀਆਂ ਖੋਲ੍ਹੋ। |
| `hubshell.gamesColourlabBlurb` | Run experiments with light, colour mixing and how we see colour. | ਰੌਸ਼ਨੀ, ਰੰਗਾਂ ਦੇ ਮੇਲ ਅਤੇ ਸਾਡੇ ਰੰਗ ਵੇਖਣ ਦੇ ਢੰਗ ਬਾਰੇ ਤਜਰਬੇ ਕਰੋ। |
| `hubshell.gamesDebateBlurb` | Spot persuasive techniques, judge the stronger argument and build a case that holds up. | ਕਾਇਲ ਕਰਨ ਦੀਆਂ ਤਕਨੀਕਾਂ ਪਛਾਣੋ, ਮਜ਼ਬੂਤ ਦਲੀਲ ਪਰਖੋ ਤੇ ਅਜਿਹੀ ਗੱਲ ਬਣਾਓ ਜੋ ਟਿਕ ਸਕੇ। |
| `hubshell.gamesDetectiveBlurb` | Crack the case by answering the clue — inference, tricky words in context and story order. | ਸੁਰਾਗ ਦਾ ਜਵਾਬ ਦੇ ਕੇ ਬੁਝਾਰਤ ਹੱਲ ਕਰੋ — ਅਨੁਮਾਨ, ਪ੍ਰਸੰਗ ਵਿੱਚ ਔਖੇ ਸ਼ਬਦ ਤੇ ਕਹਾਣੀ ਦਾ ਕ੍ਰਮ। |
| `hubshell.gamesVaultBlurb` | Unlock the vault: word meanings, synonyms, opposites and words in context. | ਤਿਜੌਰੀ ਖੋਲ੍ਹੋ: ਸ਼ਬਦਾਂ ਦੇ ਅਰਥ, ਸਮਾਨਾਰਥਕ, ਵਿਰੋਧੀ ਸ਼ਬਦ ਤੇ ਪ੍ਰਸੰਗ ਵਿੱਚ ਸ਼ਬਦ। |
| `hubshell.gamesWordpopBlurb` | Quick-fire spelling: homophones, tricky words and spelling patterns before the timer runs out. | ਫਟਾਫਟ ਸ਼ਬਦ-ਜੋੜ: ਇੱਕੋ ਜਿਹੀ ਆਵਾਜ਼ ਵਾਲੇ ਸ਼ਬਦ, ਔਖੇ ਸ਼ਬਦ ਤੇ ਸ਼ਬਦ-ਜੋੜ ਦੇ ਪੈਟਰਨ, ਸਮਾਂ ਮੁੱਕਣ ਤੋਂ ਪਹਿਲਾਂ। |
| `hubshell.gamesLiteracySummaryTitle` | Word games | ਸ਼ਬਦਾਂ ਦੀਆਂ ਖੇਡਾਂ |
| `hubshell.gamesLiteracySummaryBody` | {played} of 4 games played · {points} points earned | 4 ਵਿੱਚੋਂ {played} ਖੇਡਾਂ ਖੇਡੀਆਂ · {points} ਅੰਕ ਕਮਾਏ |
| `hubshell.gamesQuizLoading` | Loading… | ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ… |
| `hubshell.gamesQuizMarking` | Marking… | ਜਾਂਚ ਹੋ ਰਹੀ ਹੈ… |
| `hubshell.gamesQuizBegin` | Start | ਸ਼ੁਰੂ ਕਰੋ |
| `hubshell.gamesRetry` | Try again | ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ |
| `hubshell.gamesQuizAlreadyRecorded` | Already recorded. | ਪਹਿਲਾਂ ਹੀ ਦਰਜ ਹੋ ਚੁੱਕਾ ਹੈ। |
| `hubshell.gamesQuizYouSaid` | You said | ਤੁਸੀਂ ਕਿਹਾ |
| `hubshell.gamesQuizAnswer` | Answer | ਜਵਾਬ |
| `hubshell.gamesQuizPlayAgain` | Play again | ਦੁਬਾਰਾ ਖੇਡੋ |
| `hubshell.gamesQuizSkip` | Skip | ਛੱਡੋ |
| `hubshell.gamesQuizNext` | Next | ਅੱਗੇ |
| `hubshell.gamesQuizFinish` | Finish | ਮੁਕਾਓ |
| `hubhow.tourBody` | A quick look at the main places. You can skip it. | ਮੁੱਖ ਥਾਵਾਂ ਦੀ ਇੱਕ ਛੋਟੀ ਝਲਕ। ਤੁਸੀਂ ਇਸਨੂੰ ਛੱਡ ਸਕਦੇ ਹੋ। |
| `hubhow.watchBannerBody` | This is what {name} sees. View only: nothing here is saved. | {name} ਬਿਲਕੁਲ ਇਹੀ ਵੇਖਦਾ ਹੈ। ਸਿਰਫ਼ ਵੇਖਣ ਲਈ: ਇੱਥੇ ਕੁਝ ਵੀ ਸੰਭਾਲਿਆ ਨਹੀਂ ਜਾਂਦਾ। |

## Bengali (বাংলা)

| key | English | translation |
| --- | --- | --- |
| `hubgames.arc_title` | Arcade | আর্কেড |
| `hubgames.arc_sub` | Fast and tense: {n} hearts, a ticking clock and a combo to build. | দ্রুত ও উত্তেজনাপূর্ণ: {n}টি হৃদয়, টিক-টিক করা ঘড়ি আর গড়ে তোলার জন্য একটি কম্বো। |
| `hubgames.arc_calm_note` | Calm mode is on: no hearts and no clock. Your score still counts. | শান্ত মোড চালু আছে: কোনো হৃদয় নেই, কোনো ঘড়ি নেই। তোমার স্কোর তবুও গণনা হবে। |
| `hubgames.arc_run` | Arcade run | আর্কেড রান |
| `hubgames.arc_run_sub` | {n} questions. Keep your hearts! | {n}টি প্রশ্ন। তোমার হৃদয়গুলো বাঁচিয়ে রাখো! |
| `hubgames.arc_daily` | Daily challenge | প্রতিদিনের চ্যালেঞ্জ |
| `hubgames.arc_daily_sub` | The same questions for everyone today: {tables} | আজ সবার জন্য একই প্রশ্ন: {tables} |
| `hubgames.arc_endless` | Endless | অন্তহীন |
| `hubgames.arc_endless_sub` | Keep going until your hearts run out. | যতক্ষণ না তোমার হৃদয়গুলো শেষ হয়, চালিয়ে যাও। |
| `hubgames.arc_play` | Play | খেলো |
| `hubgames.arc_best` | Best {n} | সেরা {n} |
| `hubgames.arc_no_best` | No score yet | এখনও কোনো স্কোর নেই |
| `hubgames.arc_top` | Top scores on this device | এই ডিভাইসের সেরা স্কোর |
| `hubgames.arc_score` | Score | স্কোর |
| `hubgames.arc_hearts` | {n} of {max} hearts | {max}টির মধ্যে {n}টি হৃদয় |
| `hubgames.arc_combo` | Combo x{n} | কম্বো x{n} |
| `hubgames.arc_game_over` | Game over | খেলা শেষ |
| `hubgames.arc_over_live` | Game over. You scored {n}. | খেলা শেষ। তোমার স্কোর {n}। |
| `hubgames.arc_complete` | Run complete! | রান শেষ! |
| `hubgames.arc_new_best` | New best! | নতুন রেকর্ড! |
| `hubgames.arc_right` | {n} right | {n}টি সঠিক |
| `hubgames.arc_best_streak` | best streak {n} | সবচেয়ে বড় টানা সিরিজ {n} |
| `hubgames.arc_missed` | Worth another look | আরেকবার দেখার মতো |
| `hubgames.arc_again` | Play again | আবার খেলো |
| `hubgames.arc_menu` | Back to Arcade | আর্কেডে ফিরে যাও |
| `hubgames.tutor_heat_key` | One square per fact (row × column). Pale blue is new, gold is secure. | প্রতিটি তথ্যের জন্য একটি বর্গ (সারি × কলাম)। হালকা নীল মানে নতুন, সোনালি মানে পাকা। |
| `hubgames.tutor_empty` | {name} hasn't played {game} yet. Once they do, you will see here which facts they know and how often they practise. | {name} এখনও {game} খেলেনি। খেললে এখানে দেখা যাবে কোন তথ্যগুলো জানা আছে এবং কতবার অনুশীলন হয়েছে। |
| `hubgames.tutor_more` | More detail: speed and practice | আরও বিস্তারিত: গতি ও অনুশীলন |
| `hubgames.pl_title` | What {name} has practised in games | {name} খেলায় কী অনুশীলন করেছে |
| `hubgames.pl_none` | {name} hasn't played any games yet. | {name} এখনও কোনো খেলা খেলেনি। |
| `hubgames.pl_started` | {name} has started a game but not finished a run yet, so there are no scores to show. A run counts once it is finished. | {name} একটি খেলা শুরু করেছে কিন্তু এখনও কোনো রান শেষ করেনি, তাই দেখানোর মতো কোনো স্কোর নেই। রান শেষ হলেই গণনা হয়। |
| `hubgames.pl_week` | Played on {days} of {goal} days this week. | এই সপ্তাহে {goal} দিনের মধ্যে {days} দিন খেলা হয়েছে। |
| `hubgames.pl_doing_well` | Doing well | ভালো করছে |
| `hubgames.pl_getting_there` | Getting there | উন্নতি করছে |
| `hubgames.pl_needs_help` | Needs help | সাহায্য দরকার |
| `hubgames.pl_just_started` | Just started | সবে শুরু |
| `hubgames.pl_partial` | Includes {n} answers from a run left part-way. | এতে মাঝপথে ছেড়ে দেওয়া রানের {n}টি উত্তর অন্তর্ভুক্ত। |
| `hubgames.pl_your_child` | Your child | আপনার সন্তান |
| `hubgames.pc_topics_from` | Topics from quizzes, with the score for each. Not lessons. | কুইজ থেকে টপিক, প্রতিটির স্কোরসহ। এগুলো পাঠ নয়। |
| `hubgames.pc_games` | Games | খেলা |
| `hubgames.pc_games_sub` | areas practised | অনুশীলন করা ক্ষেত্র |
| `hubgames.pc_games_none` | Not played yet | এখনও খেলা হয়নি |
| `hubgames.pc_games_strong` | Strongest: {area} | সবচেয়ে শক্তিশালী: {area} |
| `hubgames.pc_hw` | Homework | বাড়ির কাজ |
| `hubgames.pc_hw_sub` | handed in | জমা দেওয়া |
| `hubgames.pc_hw_overdue` | {n} overdue | {n}টি বিলম্বিত |
| `hubgames.pc_hw_todo` | {n} still to do | {n}টি বাকি |
| `hubgames.pc_hw_clear` | All caught up | সব শেষ |
| `hubgames.pc_hw_none` | No homework yet | এখনও কোনো বাড়ির কাজ নেই |
| `hubgames.pc_hw_handed` | handed in | জমা দেওয়া |
| `hubgames.pc_hw_marked` | {n} marked | {n}টি মূল্যায়িত |
| `hubgames.pc_hw_waiting` | {n} waiting to be marked | {n}টি মূল্যায়নের অপেক্ষায় |
| `hubgames.pc_hw_incomplete` | {n} not handed in | {n}টি জমা দেওয়া হয়নি |
| `hubgames.pc_cards_completed` | completed | সম্পন্ন |
| `hubgames.pc_cards` | Flashcards | ফ্ল্যাশকার্ড |
| `hubgames.pc_cards_sub` | due today | আজকের জন্য |
| `hubgames.pc_cards_new` | {n} new to learn | {n}টি নতুন শেখার জন্য |
| `hubgames.pc_cards_none` | No cards yet | এখনও কোনো কার্ড নেই |
| `hubgames.pl_right` | {pct}% right ({n} answers) | {pct}% সঠিক ({n}টি উত্তর) |
| `hubgames.pl_solved` | {n} solved | {n}টি সমাধান হয়েছে |
| `hubgames.pl_good_at` | Good at: {list} | ভালো: {list} |
| `hubgames.pl_needs_work` | Needs work: {list} | উন্নতি দরকার: {list} |
| `hubgames.pl_best` | Strongest: {area}. | সবচেয়ে শক্তিশালী: {area}। |
| `hubgames.pl_worst` | Needs the most help: {area}. | সবচেয়ে বেশি সাহায্য দরকার: {area}। |
| `hubgames.pl_detail` | Times tables detail | নামতার বিস্তারিত |
| `hubgames.pl_a_times` | Times tables | নামতা |
| `hubgames.pl_a_geography` | Geography | ভূগোল |
| `hubgames.pl_a_history` | History | ইতিহাস |
| `hubgames.pl_a_science` | Science | বিজ্ঞান |
| `hubgames.pl_a_debate` | Persuasive writing | প্ররোচনামূলক লেখা |
| `hubgames.pl_a_reading` | Reading and inference | পড়া ও অনুমান |
| `hubgames.pl_a_vocab` | Vocabulary | শব্দভান্ডার |
| `hubgames.pl_a_spelling` | Spelling | বানান |
| `hubgames.pl_a_computing` | Computing | কম্পিউটিং |
| `hubgames.pl_a_data` | Data and statistics | উপাত্ত ও পরিসংখ্যান |
| `hubgames.pl_a_drills` | Mixed practice drills | মিশ্র অনুশীলন |
| `hubgames.pl_a_numbers` | Number patterns | সংখ্যার নমুনা |
| `hubgames.pl_a_shapes` | Shapes and geometry | আকার ও জ্যামিতি |
| `hubhomework.resSubject` | Subject | বিষয় |
| `hubhomework.resAllSubjects` | All subjects | সব বিষয় |
| `hubhomework.resFlip` | Show | দেখান |
| `hubhomework.resFlipDots` | Dots | বিন্দু |
| `hubhomework.resFlipScore` | Scores | স্কোর |
| `hubhomework.resFlipPct` | Percent | শতাংশ |
| `hubhomework.resUnmarkedKey` | Handed in, not marked yet | জমা দেওয়া হয়েছে, এখনও মূল্যায়ন হয়নি |
| `hubhomework.resNeedsMarking` | Needs marking ({n}) | মূল্যায়ন বাকি ({n}) |
| `hubhomework.resOpen` | Open | খুলুন |
| `hubhomework.resClose` | Close | বন্ধ করুন |
| `hubhomework.resNothingToMark` | Nothing is waiting to be marked. | মূল্যায়নের জন্য কিছুই বাকি নেই। |
| `hubhomework.resMarkBtn` | Mark | মূল্যায়ন করুন |
| `hubhomework.resLateShort` | late | দেরি |
| `hubhomework.resShowFewer` | Show fewer | কম দেখান |
| `hubhomework.resShowAllMark` | Show all {n} | সব {n}টি দেখান |
| `hublessons.tfCompleted` | {p}% completed ({a} of {b} cards) | {p}% সম্পন্ন ({b}টির মধ্যে {a}টি কার্ড) |
| `hubshell.lbl_games_market` | Market Day | বাজারের দিন |
| `hubshell.lbl_games_bakeoff` | Bake Off Blitz | ঝটপট বেকিং প্রতিযোগিতা |
| `hubshell.lbl_games_reef` | Rhythm Reef | ছন্দের প্রবাল প্রাচীর |
| `hubshell.lbl_games_primereef` | Prime Reef | মৌলিক সংখ্যার প্রবাল |
| `hubshell.lbl_games_datacarnival` | Data Carnival | উপাত্ত কার্নিভাল |
| `hubshell.lbl_games_shapeworkshop` | Shape Workshop | আকারের কর্মশালা |
| `hubshell.lbl_games_botfoundry` | Bot Foundry | রোবট ফাউন্ড্রি |
| `hubshell.lbl_games_sortyard` | Sort Yard | বাছাই-আঙিনা |
| `hubshell.lbl_games_training` | Training Ground | প্রশিক্ষণ মাঠ |
| `hubshell.lbl_games_compass` | Compass Quest | দিকদর্শনের অভিযান |
| `hubshell.lbl_games_museum` | Museum Vault | জাদুঘরের ভল্ট |
| `hubshell.lbl_games_colourlab` | Colour Lab | রঙের গবেষণাগার |
| `hubshell.lbl_games_debate` | Debate Keep | বিতর্কের দুর্গ |
| `hubshell.lbl_games_detective` | Story Detective | গল্পের গোয়েন্দা |
| `hubshell.lbl_games_vault` | Word Vault | শব্দের ভল্ট |
| `hubshell.lbl_games_wordpop` | Word Pop | শব্দের বেলুন |
| `hubshell.gamesMarketBlurb` | Run a market stall — give change, spot the best value, keep the books balanced. | বাজারের একটি দোকান চালাও — ফেরত দাও, সেরা দাম খুঁজে নাও আর হিসাব ঠিক রাখো। |
| `hubshell.gamesBakeoffBlurb` | Scale up a recipe, convert units and get ratios right before the judges arrive. | রেসিপির পরিমাণ বাড়াও, একক বদলাও আর বিচারকরা আসার আগে অনুপাত ঠিক করো। |
| `hubshell.gamesReefBlurb` | Spot the pattern in a reef of bubbles, shells and number sequences. | বুদবুদ, ঝিনুক আর সংখ্যার ক্রমে ভরা প্রবাল প্রাচীরে নমুনা খুঁজে বের করো। |
| `hubshell.gamesPrimeReefBlurb` | Dive the reef spotting primes, factors and multiples before the next question surfaces. | প্রবাল প্রাচীরে ডুব দাও আর পরের প্রশ্ন ভেসে ওঠার আগে মৌলিক সংখ্যা, উৎপাদক ও গুণিতক খুঁজে নাও। |
| `hubshell.gamesDataCarnivalBlurb` | Run the fairground stalls — read charts and find the mean, median, mode and range. | মেলার দোকানগুলো চালাও — চার্ট পড়ো আর গড়, মধ্যমা, প্রচুরক ও পরিসর বের করো। |
| `hubshell.gamesShapeWorkshopBlurb` | Build the workshop — shape properties, angles, symmetry and area/perimeter, piece by piece. | কর্মশালা গড়ো — আকারের বৈশিষ্ট্য, কোণ, প্রতিসমতা এবং ক্ষেত্রফল/পরিসীমা, এক টুকরো এক টুকরো করে। |
| `hubshell.gamesBotfoundryBlurb` | Build a program of instructions to guide your bot to the flag — sequence, loops and if-checks. | নির্দেশনার একটি প্রোগ্রাম বানাও যা তোমার রোবটকে পতাকা পর্যন্ত নিয়ে যাবে — ক্রম, লুপ আর যদি-পরীক্ষা। |
| `hubshell.gamesSortyardBlurb` | Classify real data, read a bar chart and put numbers in order. | আসল উপাত্ত শ্রেণিবদ্ধ করো, পট্টি-চার্ট পড়ো আর সংখ্যাগুলো ক্রমানুসারে সাজাও। |
| `hubshell.gamesTrainingBlurb` | A quick practice sprint — spelling, science facts and more, tailored to what needs work. | অনুশীলনের একটি ছোট দৌড় — বানান, বিজ্ঞানের তথ্য আরও অনেক কিছু, যেখানে উন্নতি দরকার সেই অনুযায়ী। |
| `hubshell.gamesCompassBlurb` | Chart a course through compass directions, map reading and world geography. | দিকনির্দেশ, মানচিত্র পড়া আর বিশ্বের ভূগোলের মধ্য দিয়ে নিজের পথ ঠিক করো। |
| `hubshell.gamesMuseumBlurb` | Unlock exhibits by getting timelines, historical figures and cause-and-effect right. | সময়রেখা, ঐতিহাসিক ব্যক্তিত্ব আর কারণ-ফলাফলের সঠিক উত্তর দিয়ে প্রদর্শনী খুলে ফেলো। |
| `hubshell.gamesColourlabBlurb` | Run experiments with light, colour mixing and how we see colour. | আলো, রঙ মেশানো আর আমরা কীভাবে রঙ দেখি তা নিয়ে পরীক্ষা চালাও। |
| `hubshell.gamesDebateBlurb` | Spot persuasive techniques, judge the stronger argument and build a case that holds up. | প্ররোচনার কৌশল চিনে নাও, শক্তিশালী যুক্তি বিচার করো আর টিকে থাকার মতো একটি যুক্তি সাজাও। |
| `hubshell.gamesDetectiveBlurb` | Crack the case by answering the clue — inference, tricky words in context and story order. | সূত্রের উত্তর দিয়ে রহস্য ভেদ করো — অনুমান, প্রসঙ্গে কঠিন শব্দ আর গল্পের ক্রম। |
| `hubshell.gamesVaultBlurb` | Unlock the vault: word meanings, synonyms, opposites and words in context. | ভল্ট খোলো: শব্দের অর্থ, সমার্থক, বিপরীত শব্দ আর প্রসঙ্গে শব্দ। |
| `hubshell.gamesWordpopBlurb` | Quick-fire spelling: homophones, tricky words and spelling patterns before the timer runs out. | ঝটপট বানান: সমোচ্চারিত শব্দ, কঠিন শব্দ আর বানানের নমুনা, সময় শেষ হওয়ার আগে। |
| `hubshell.gamesLiteracySummaryTitle` | Word games | শব্দের খেলা |
| `hubshell.gamesLiteracySummaryBody` | {played} of 4 games played · {points} points earned | 4টির মধ্যে {played}টি খেলা খেলা হয়েছে · {points} পয়েন্ট অর্জিত |
| `hubshell.gamesQuizLoading` | Loading… | লোড হচ্ছে… |
| `hubshell.gamesQuizMarking` | Marking… | মূল্যায়ন হচ্ছে… |
| `hubshell.gamesQuizBegin` | Start | শুরু করো |
| `hubshell.gamesRetry` | Try again | আবার চেষ্টা করো |
| `hubshell.gamesQuizAlreadyRecorded` | Already recorded. | আগেই নথিভুক্ত হয়েছে। |
| `hubshell.gamesQuizYouSaid` | You said | তুমি বলেছ |
| `hubshell.gamesQuizAnswer` | Answer | উত্তর |
| `hubshell.gamesQuizPlayAgain` | Play again | আবার খেলো |
| `hubshell.gamesQuizSkip` | Skip | এড়িয়ে যাও |
| `hubshell.gamesQuizNext` | Next | পরবর্তী |
| `hubshell.gamesQuizFinish` | Finish | শেষ করো |
| `hubhow.tourBody` | A quick look at the main places. You can skip it. | প্রধান জায়গাগুলোর একটি সংক্ষিপ্ত ঝলক। চাইলে বাদ দিতে পারেন। |
| `hubhow.watchBannerBody` | This is what {name} sees. View only: nothing here is saved. | {name} ঠিক এটিই দেখে। শুধু দেখার জন্য: এখানে কিছুই সংরক্ষিত হয় না। |

## Welsh (Cymraeg)

| key | English | translation |
| --- | --- | --- |
| `hubgames.arc_title` | Arcade | Arcade |
| `hubgames.arc_sub` | Fast and tense: {n} hearts, a ticking clock and a combo to build. | Cyflym a thyn: {n} calon, cloc yn tician a chombo i’w adeiladu. |
| `hubgames.arc_calm_note` | Calm mode is on: no hearts and no clock. Your score still counts. | Mae modd tawel ymlaen: dim calonnau a dim cloc. Mae dy sgôr yn dal i gyfrif. |
| `hubgames.arc_run` | Arcade run | Rownd Arcade |
| `hubgames.arc_run_sub` | {n} questions. Keep your hearts! | {n} cwestiwn. Cadw dy galonnau! |
| `hubgames.arc_daily` | Daily challenge | Her ddyddiol |
| `hubgames.arc_daily_sub` | The same questions for everyone today: {tables} | Yr un cwestiynau i bawb heddiw: {tables} |
| `hubgames.arc_endless` | Endless | Diddiwedd |
| `hubgames.arc_endless_sub` | Keep going until your hearts run out. | Dal ati nes bydd dy galonnau wedi darfod. |
| `hubgames.arc_play` | Play | Chwarae |
| `hubgames.arc_best` | Best {n} | Gorau: {n} |
| `hubgames.arc_no_best` | No score yet | Dim sgôr eto |
| `hubgames.arc_top` | Top scores on this device | Y sgorau uchaf ar y ddyfais hon |
| `hubgames.arc_score` | Score | Sgôr |
| `hubgames.arc_hearts` | {n} of {max} hearts | {n} o {max} calon |
| `hubgames.arc_combo` | Combo x{n} | Combo x{n} |
| `hubgames.arc_game_over` | Game over | Gêm drosodd |
| `hubgames.arc_over_live` | Game over. You scored {n}. | Gêm drosodd. Dy sgôr oedd {n}. |
| `hubgames.arc_complete` | Run complete! | Rownd wedi’i chwblhau! |
| `hubgames.arc_new_best` | New best! | Record newydd! |
| `hubgames.arc_right` | {n} right | {n} cywir |
| `hubgames.arc_best_streak` | best streak {n} | rhediad gorau {n} |
| `hubgames.arc_missed` | Worth another look | Werth edrych eto |
| `hubgames.arc_again` | Play again | Chwarae eto |
| `hubgames.arc_menu` | Back to Arcade | Yn ôl i Arcade |
| `hubgames.tutor_heat_key` | One square per fact (row × column). Pale blue is new, gold is secure. | Un sgwâr i bob ffaith (rhes × colofn). Glas golau yw newydd, aur yw diogel. |
| `hubgames.tutor_empty` | {name} hasn't played {game} yet. Once they do, you will see here which facts they know and how often they practise. | {name}: heb chwarae {game} eto. Unwaith y bydd, fe welwch yma pa ffeithiau maen nhw’n eu gwybod a pha mor aml maen nhw’n ymarfer. |
| `hubgames.tutor_more` | More detail: speed and practice | Mwy o fanylion: cyflymder ac ymarfer |
| `hubgames.pl_title` | What {name} has practised in games | Ymarfer mewn gemau: {name} |
| `hubgames.pl_none` | {name} hasn't played any games yet. | {name}: heb chwarae unrhyw gêm eto. |
| `hubgames.pl_started` | {name} has started a game but not finished a run yet, so there are no scores to show. A run counts once it is finished. | {name}: wedi dechrau gêm ond heb orffen rownd eto, felly does dim sgorau i’w dangos. Mae rownd yn cyfrif ar ôl ei gorffen. |
| `hubgames.pl_week` | Played on {days} of {goal} days this week. | Wedi chwarae ar {days} o {goal} diwrnod yr wythnos hon. |
| `hubgames.pl_doing_well` | Doing well | Yn dda |
| `hubgames.pl_getting_there` | Getting there | Ar y ffordd |
| `hubgames.pl_needs_help` | Needs help | Angen help |
| `hubgames.pl_just_started` | Just started | Newydd ddechrau |
| `hubgames.pl_partial` | Includes {n} answers from a run left part-way. | Yn cynnwys {n} ateb o rownd a adawyd hanner ffordd. |
| `hubgames.pl_your_child` | Your child | Eich plentyn |
| `hubgames.pc_topics_from` | Topics from quizzes, with the score for each. Not lessons. | Testunau o’r cwisiau, gyda’r sgôr i bob un. Nid gwersi ydyn nhw. |
| `hubgames.pc_games` | Games | Gemau |
| `hubgames.pc_games_sub` | areas practised | meysydd ymarfer |
| `hubgames.pc_games_none` | Not played yet | Heb chwarae eto |
| `hubgames.pc_games_strong` | Strongest: {area} | Cryfaf: {area} |
| `hubgames.pc_hw` | Homework | Gwaith cartref |
| `hubgames.pc_hw_sub` | handed in | wedi’u cyflwyno |
| `hubgames.pc_hw_overdue` | {n} overdue | {n} yn hwyr |
| `hubgames.pc_hw_todo` | {n} still to do | {n} i’w gwneud |
| `hubgames.pc_hw_clear` | All caught up | Popeth wedi’i wneud |
| `hubgames.pc_hw_none` | No homework yet | Dim gwaith cartref eto |
| `hubgames.pc_hw_handed` | handed in | wedi’u cyflwyno |
| `hubgames.pc_hw_marked` | {n} marked | {n} wedi’u marcio |
| `hubgames.pc_hw_waiting` | {n} waiting to be marked | {n} yn aros i’w marcio |
| `hubgames.pc_hw_incomplete` | {n} not handed in | {n} heb eu cyflwyno |
| `hubgames.pc_cards_completed` | completed | wedi’u cwblhau |
| `hubgames.pc_cards` | Flashcards | Cardiau fflach |
| `hubgames.pc_cards_sub` | due today | i’w gwneud heddiw |
| `hubgames.pc_cards_new` | {n} new to learn | {n} newydd i’w dysgu |
| `hubgames.pc_cards_none` | No cards yet | Dim cardiau eto |
| `hubgames.pl_right` | {pct}% right ({n} answers) | {pct}% yn gywir ({n} ateb) |
| `hubgames.pl_solved` | {n} solved | {n} wedi’u datrys |
| `hubgames.pl_good_at` | Good at: {list} | Da am: {list} |
| `hubgames.pl_needs_work` | Needs work: {list} | Angen gwaith: {list} |
| `hubgames.pl_best` | Strongest: {area}. | Cryfaf: {area}. |
| `hubgames.pl_worst` | Needs the most help: {area}. | Angen mwyaf o help: {area}. |
| `hubgames.pl_detail` | Times tables detail | Manylion: tablau lluosi |
| `hubgames.pl_a_times` | Times tables | Tablau lluosi |
| `hubgames.pl_a_geography` | Geography | Daearyddiaeth |
| `hubgames.pl_a_history` | History | Hanes |
| `hubgames.pl_a_science` | Science | Gwyddoniaeth |
| `hubgames.pl_a_debate` | Persuasive writing | Ysgrifennu perswadiol |
| `hubgames.pl_a_reading` | Reading and inference | Darllen a chasglu |
| `hubgames.pl_a_vocab` | Vocabulary | Geirfa |
| `hubgames.pl_a_spelling` | Spelling | Sillafu |
| `hubgames.pl_a_computing` | Computing | Cyfrifiadura |
| `hubgames.pl_a_data` | Data and statistics | Data ac ystadegau |
| `hubgames.pl_a_drills` | Mixed practice drills | Ymarferion cymysg |
| `hubgames.pl_a_numbers` | Number patterns | Patrymau rhif |
| `hubgames.pl_a_shapes` | Shapes and geometry | Siapiau a geometreg |
| `hubhomework.resSubject` | Subject | Pwnc |
| `hubhomework.resAllSubjects` | All subjects | Pob pwnc |
| `hubhomework.resFlip` | Show | Dangos |
| `hubhomework.resFlipDots` | Dots | Dotiau |
| `hubhomework.resFlipScore` | Scores | Sgoriau |
| `hubhomework.resFlipPct` | Percent | Canran |
| `hubhomework.resUnmarkedKey` | Handed in, not marked yet | Cyflwynwyd, heb ei farcio eto |
| `hubhomework.resNeedsMarking` | Needs marking ({n}) | Angen marcio ({n}) |
| `hubhomework.resOpen` | Open | Agor |
| `hubhomework.resClose` | Close | Cau |
| `hubhomework.resNothingToMark` | Nothing is waiting to be marked. | Does dim yn aros i’w farcio. |
| `hubhomework.resMarkBtn` | Mark | Marcio |
| `hubhomework.resLateShort` | late | hwyr |
| `hubhomework.resShowFewer` | Show fewer | Dangos llai |
| `hubhomework.resShowAllMark` | Show all {n} | Dangos pob un ({n}) |
| `hublessons.tfCompleted` | {p}% completed ({a} of {b} cards) | {p}% wedi’i gwblhau ({a} o {b} cerdyn) |
| `hubshell.lbl_games_market` | Market Day | Diwrnod y Farchnad |
| `hubshell.lbl_games_bakeoff` | Bake Off Blitz | Cystadleuaeth Pobi Gyflym |
| `hubshell.lbl_games_reef` | Rhythm Reef | Riff Rhythm |
| `hubshell.lbl_games_primereef` | Prime Reef | Riff Priflau |
| `hubshell.lbl_games_datacarnival` | Data Carnival | Carnifal Data |
| `hubshell.lbl_games_shapeworkshop` | Shape Workshop | Gweithdy Siapiau |
| `hubshell.lbl_games_botfoundry` | Bot Foundry | Ffowndri Robotiaid |
| `hubshell.lbl_games_sortyard` | Sort Yard | Iard Trefnu |
| `hubshell.lbl_games_training` | Training Ground | Maes Hyfforddi |
| `hubshell.lbl_games_compass` | Compass Quest | Ymchwil y Cwmpawd |
| `hubshell.lbl_games_museum` | Museum Vault | Cell Ddiogel yr Amgueddfa |
| `hubshell.lbl_games_colourlab` | Colour Lab | Labordy Lliw |
| `hubshell.lbl_games_debate` | Debate Keep | Caer y Ddadl |
| `hubshell.lbl_games_detective` | Story Detective | Ditectif Straeon |
| `hubshell.lbl_games_vault` | Word Vault | Cell Ddiogel Geiriau |
| `hubshell.lbl_games_wordpop` | Word Pop | Geiriau Balŵn |
| `hubshell.gamesMarketBlurb` | Run a market stall — give change, spot the best value, keep the books balanced. | Rhedeg stondin farchnad — rho newid, dod o hyd i’r fargen orau a chadw’r cyfrifon yn gytbwys. |
| `hubshell.gamesBakeoffBlurb` | Scale up a recipe, convert units and get ratios right before the judges arrive. | Graddio rysáit, trawsnewid unedau a chael y cymarebau’n gywir cyn i’r beirniaid gyrraedd. |
| `hubshell.gamesReefBlurb` | Spot the pattern in a reef of bubbles, shells and number sequences. | Darganfod y patrwm mewn riff o swigod, cregyn a dilyniannau rhif. |
| `hubshell.gamesPrimeReefBlurb` | Dive the reef spotting primes, factors and multiples before the next question surfaces. | Deifio yn y riff gan ddod o hyd i briflau, ffactorau a lluosrifau cyn i’r cwestiwn nesaf godi. |
| `hubshell.gamesDataCarnivalBlurb` | Run the fairground stalls — read charts and find the mean, median, mode and range. | Rhedeg stondinau’r ffair — darllen siartiau a chanfod y cymedr, y canolrif, y modd a’r amrediad. |
| `hubshell.gamesShapeWorkshopBlurb` | Build the workshop — shape properties, angles, symmetry and area/perimeter, piece by piece. | Adeiladu’r gweithdy — priodweddau siapiau, onglau, cymesuredd ac arwynebedd/perimedr, darn wrth ddarn. |
| `hubshell.gamesBotfoundryBlurb` | Build a program of instructions to guide your bot to the flag — sequence, loops and if-checks. | Adeiladu rhaglen o gyfarwyddiadau i arwain dy robot at y faner — dilyniant, dolenni a gwiriadau “os”. |
| `hubshell.gamesSortyardBlurb` | Classify real data, read a bar chart and put numbers in order. | Dosbarthu data go iawn, darllen siart bar a rhoi rhifau mewn trefn. |
| `hubshell.gamesTrainingBlurb` | A quick practice sprint — spelling, science facts and more, tailored to what needs work. | Sbrint ymarfer cyflym — sillafu, ffeithiau gwyddoniaeth a mwy, wedi’i deilwra i’r hyn sydd angen gwaith. |
| `hubshell.gamesCompassBlurb` | Chart a course through compass directions, map reading and world geography. | Mapio taith drwy gyfeiriadau’r cwmpawd, darllen mapiau a daearyddiaeth y byd. |
| `hubshell.gamesMuseumBlurb` | Unlock exhibits by getting timelines, historical figures and cause-and-effect right. | Datgloi arddangosion drwy gael llinellau amser, ffigurau hanesyddol ac achos ac effaith yn gywir. |
| `hubshell.gamesColourlabBlurb` | Run experiments with light, colour mixing and how we see colour. | Cynnal arbrofion gyda golau, cymysgu lliwiau a sut rydyn ni’n gweld lliw. |
| `hubshell.gamesDebateBlurb` | Spot persuasive techniques, judge the stronger argument and build a case that holds up. | Adnabod technegau perswadio, barnu’r ddadl gryfaf ac adeiladu achos sy’n dal dŵr. |
| `hubshell.gamesDetectiveBlurb` | Crack the case by answering the clue — inference, tricky words in context and story order. | Datrys yr achos drwy ateb y cliw — casglu ymhlyg, geiriau anodd yn eu cyd-destun a threfn y stori. |
| `hubshell.gamesVaultBlurb` | Unlock the vault: word meanings, synonyms, opposites and words in context. | Datgloi’r gell ddiogel: ystyron geiriau, cyfystyron, gwrthdroadau a geiriau yn eu cyd-destun. |
| `hubshell.gamesWordpopBlurb` | Quick-fire spelling: homophones, tricky words and spelling patterns before the timer runs out. | Sillafu cyflym: homoffonau, geiriau anodd a phatrymau sillafu cyn i’r amserydd ddod i ben. |
| `hubshell.gamesLiteracySummaryTitle` | Word games | Gemau geiriau |
| `hubshell.gamesLiteracySummaryBody` | {played} of 4 games played · {points} points earned | {played} o 4 gêm wedi’u chwarae · {points} pwynt wedi’u hennill |
| `hubshell.gamesQuizLoading` | Loading… | Wrthi’n llwytho… |
| `hubshell.gamesQuizMarking` | Marking… | Wrthi’n marcio… |
| `hubshell.gamesQuizBegin` | Start | Dechrau |
| `hubshell.gamesRetry` | Try again | Rho gynnig arall arni |
| `hubshell.gamesQuizAlreadyRecorded` | Already recorded. | Wedi’i gofnodi’n barod. |
| `hubshell.gamesQuizYouSaid` | You said | Dywedaist ti |
| `hubshell.gamesQuizAnswer` | Answer | Ateb |
| `hubshell.gamesQuizPlayAgain` | Play again | Chwarae eto |
| `hubshell.gamesQuizSkip` | Skip | Hepgor |
| `hubshell.gamesQuizNext` | Next | Nesaf |
| `hubshell.gamesQuizFinish` | Finish | Gorffen |
| `hubhow.tourBody` | A quick look at the main places. You can skip it. | Cipolwg byr ar y prif leoedd. Gallwch ei hepgor. |
| `hubhow.watchBannerBody` | This is what {name} sees. View only: nothing here is saved. | Dyma beth mae {name} yn ei weld. Gwylio’n unig: nid oes dim yn cael ei gadw yma. |
