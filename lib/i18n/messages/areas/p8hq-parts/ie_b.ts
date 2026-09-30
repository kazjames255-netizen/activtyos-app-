// p8hq: International Expansion report, section s3 (unit economics). Order: pl, ro, ur, pa, bn, ar, pt, es, fr, cy.
export const IE_B: Record<string, string[]> = {
  s3: [
    // pl
    `## 3. Ekonomia jednostkowa, uczciwie poddana testom obciążeniowym

### Założenia oparte na faktycznym procesie sprzedaży (kontakt wychodzący + rozmowy demo, a nie samoobsługa)

| Wskaźnik | Scenariusz bazowy | Zakres |
|---|---|---|
| Mieszany ARPU | £50–55/mies. | Przechyla się ku dołowi, ponieważ większość leadów to jednoosobowi/mali operatorzy |
| CAC | ~£1 200/klienta | £800 (wydajnie) – £2 000 (pesymistycznie) — wynika z kosztu pracy SDR (~£3 700/mies./handlowca ÷ ~4,5 klienta/handlowca/mies.), a nie z wydatków na reklamę |
| Miesięczny churn | 5%/mies. (~46% rocznie) | 4–7%/mies. — małe firmy są mniej lojalne niż duże: sezonowy przepływ gotówki, zamykanie jednoosobowych działalności, niski koszt zmiany |
| Marża brutto | 70% | 65–75% — intensywna obsługa małych firm obniża ją poniżej typowych 80%+ dla SaaS w samoobsłudze |
| Średni czas życia klienta | 20 miesięcy (1 ÷ 5%) | |

**Problem strukturalny nasilający churn:** konkurenci pobierający prowizję tworzą realny koszt zmiany — zmiana dostawcy oznacza przebudowę przepływów płatności. Model {brand} bez prowizji nie daje takiego uzależnienia poza zwykłym przywiązaniem do produktu, co powinno przesuwać churn ku *wyższemu* krańcowi zakresu, a nie niższemu.

### Liczba kluczowa

| Scenariusz | LTV (zysk brutto) | CAC | LTV:CAC | Zwrot |
|---|---|---|---|---|
| Optymistyczny | £1 608 | £800 | 2,0:1 | 16 miesięcy |
| **Bazowy** | **£770** | **£1 200** | **0,64:1** | **31 miesięcy** |
| Pesymistyczny | £386 | £2 000 | 0,19:1 | 74 miesiące |

Zdrowy SaaS to **3:1 LTV:CAC ze zwrotem <12 miesięcy.** Scenariusz bazowy to **poniżej 1:1, ze zwrotem po 31 miesiącach przy średnim czasie życia klienta 20 miesięcy** — co oznacza, że przy założeniach medianowych **{brand} może nie odzyskać CAC, zanim przeciętny klient zrezygnuje.** To najważniejszy wniosek tego raportu: zanim pytanie „jak duże to może być” w ogóle ma sens, trzeba odpowiedzieć, „czy pozyskiwanie nowych klientów jest w ogóle opłacalne” — a dziś jest to niezmierzone, a nie tylko nieskalowane.

### Rachunek wstecz od zysku £10M

- Przy *hojnej* marży netto 25% (poziom dojrzałego SaaS, którego 2-letnia firma nie osiągnie): zysk £10M wymaga **£40M ARR → ~60 600 klientów** — więcej niż *cały obecny lejek leadów* skonwertowany w 100% przy zerowym churnie.
- Przy bardziej realistycznej marży netto 10% dla wciąż rosnącej firmy: **£100M ARR → ~150 000 klientów.** Nierealne z bazy 50 tys. leadów w 24 miesiące.
- Licząc zamiast tego w przód, hojnie: **15 000 płacących klientów w 24. miesiącu** (już ~30% *całej* dzisiejszej bazy leadów, ogromny sukces przy starcie z 0% skontaktowanych) daje **£9,9M ARR, £6,9M zysku brutto**. Po odjęciu realistycznych kosztów operacyjnych w tej skali — obsługa klienta (~1 konsultant na 300–400 kont → 38–50 etatów, £1,6–2,2M/rok), sprzedaż (15–20 etatów, £0,7–1,0M/rok), inżynieria/G&A (15–20 etatów, £0,9–1,2M/rok), plus bieżący koszt gotówkowy CAC — **zysk netto wynosi około £1–3M, możliwe że próg rentowności. Nie £10M.**

### Uczciwe przeformułowanie

- **Zysk £10M w 2 lata: niewiarygodny według żadnego porównania ani ścieżki ekonomii jednostkowej.**
- **Zysk £1–3M w 2 lata, przy 5 000–8 000 klientów w UK i rozsądnej ekonomii jednostkowej: wiarygodny**, i zgodny z tym, co się działo, gdy najszybciej rosnące realne podmioty w tej kategorii w końcu do czegoś doszły.
- **Zysk £10M to realistyczny wynik w perspektywie 4–6 lat**, i tylko jeśli nastąpią dwie zmiany strukturalne: (1) ograniczenie churnu — umowy roczne, lepszy onboarding lub skromna prowizja, która również tworzy koszt zmiany; (2) monetyzacja silnika leadów (patrz niżej) zamiast polegania wyłącznie na przychodach z subskrypcji.

### Kwartał po kwartale: jak faktycznie realizuje się ścieżka £1–3M

Ilustracyjny plan tempa, wyliczony wstecz z wiarygodnego zakresu 5 000–8 000 klientów / £1–3M powyżej, przy mieszanym ARPU £50–55/mies. i bazowym churnie 5%/mies. — to nie nowa prognoza i nie hojny scenariusz 15 000 klientów. Jedyne liczby w tym raporcie, które są *zmierzone, a nie modelowane*, znajdują się w sekcji „Start w poniedziałek” powyżej; wszystko poniżej jest celem planistycznym do realizacji i kwartalnej korekty w miarę napływu prawdziwych danych kohortowych.

| Kwartał | Aktywni klienci netto (narastająco) | ARR brutto (ilustracyjnie) | Co musi być prawdą |
|---|---|---|---|
| Q1 (mies. 1–3) | ~600 | ~£0,4M | Pierwsza kohorta z 19 284 przygotowanych leadów faktycznie wysłana i doprowadzona do realnego wyniku |
| Q2 (mies. 4–6) | ~1 400 | ~£0,9M | Lejek jest zinstrumentowany; istnieją pierwsze realne wskaźniki konwersji i CAC |
| Q3 (mies. 7–9) | ~2 300 | ~£1,5M | Najlepsze segmenty zidentyfikowane i wzmocnione; najgorsze zamknięte |
| Q4 (mies. 10–12) | ~3 300 | ~£2,2M | Zamknięcie roku 1: faktyczny LTV:CAC w porównaniu z bazowym 0,64:1, raport dla zarządu |
| Q5 (mies. 13–15) | ~4 300 | ~£2,8M | Dźwignia redukcji churnu (umowy roczne / pilotaż prowizji) uruchomiona i mierzona |
| Q6 (mies. 16–18) | ~5 200 | ~£3,4M | Obsługa klienta rozbudowana z wyprzedzeniem względem proporcji ~1:300–400 z §3, by churn nie wzrósł |
| Q7 (mies. 19–21) | ~6 000 | ~£4,0M | Silnik opłat za sukces daje mierzalną linię przychodów, nie tylko subskrypcje |
| Q8 (mies. 22–24) | ~6 750 | ~£4,5M | Pełne rozliczenie kosztów operacyjnych z 2 lat względem struktury kosztów z §3; zysk netto mieści się w przedziale £1–3M albo raport zostaje zaktualizowany o przyczyny |

Co konkretnie dzieje się w każdym kwartale — konkretne działania, a nie slogany strategiczne:

**Q1 — napraw i udowodnij lejek.** Wyślij pierwsze 500 z 19 284 szkiców w kolejce, potem skaluj do pełnej zaległości w cotygodniowych partiach, gdy wskaźniki odpowiedzi/demo się utrzymają. Doprowadź \`uncertain_verify.mjs\` do końca dla 6 640 leadów o niepewnej klasyfikacji. Wyznacz jedną osobę odpowiedzialną za odpowiadanie leadom i umawianie dem tego samego dnia. Uruchom śledzenie statusów (nowy → skontaktowany → demo → wygrany/utracony), aby Q2 miał prawdziwe dane. Przygotuj i wyceń warunki opłaty za sukces.

**Q2 — usystematyzuj to, co zadziałało.** Pobierz liczby kohorty z Q1: realny wskaźnik odpowiedzi, realny wskaźnik demo-do-zamknięcia, realny CAC wg źródła leadów i kategorii aktywności. Wytnij najsłabsze segmenty z przyszłych wysyłek; zaoszczędzony wysiłek przeznacz na najlepsze. Zatrudnij pierwszego dedykowanego SDR tylko wtedy, gdy wyłaniający się CAC uprawdopodobni rachunek zwrotu z §3 — nie wcześniej. Przedstaw silnik leadów z opłatą za sukces 10–20 realnym dostawcom i zdobądź pierwsze płatne pilotaże.

**Q3 — skaluj UK, bramkuj zagranicę.** Dalej skaluj sprzedaż i dema w UK. Sprawdź kryteria bramki z §4 na realnych danych: czy konwersja w UK utrzymała się na poziomie 8–12%+ przez dwa kolejne miesiące? Jeśli tak, zatwierdź ograniczony test w Irlandii za £15–25 tys. (tylko strona docelowa + wydatki na reklamę, zgodnie z §4) — nie powinien zabrać ani godziny osobom prowadzącym lejek w UK. Jeśli nie, jeszcze go nie zaczynaj; powiedz to otwarcie i dalej pracuj nad UK.

**Q4 — udowodnij lub zamknij, potem poinformuj zarząd.** Zamknij rok 1 z faktycznym LTV:CAC, faktycznym churnem i faktycznym CAC — a nie założeniami scenariusza bazowego z §3. Jeśli test w Irlandii się odbył, zastosuj jego wcześniej zarejestrowaną bramkę zamknięcia/skalowania. Przedstaw zarządowi realne liczby roku 1 na tle ram £1–3M/£10M z tego raportu, w tym miejsca, gdzie rzeczywistość odbiegła od planu, i dlaczego.

**Q5–Q6 — wzmacniaj to, co działa.** Przeznacz budżet na ten kanał (subskrypcja w UK, silnik opłat za sukces w UK lub Irlandia), który pokazuje najlepszy LTV:CAC, a nie ten, który wydaje się najbardziej ekscytujący. Rozbuduj obsługę klienta przed wzrostem liczby klientów, by churn nie przekroczył bazowych 5%/mies. wraz ze wzrostem bazy. Zweryfikuj każde założenie z §3 na pełnym roku realnych danych kohortowych i odpowiednio zaktualizuj liczby w tym raporcie.

**Q7–Q8 — osiągnij wynik, nie tylko na niego licz.** Dąż do przedziału 5 000–8 000 klientów w UK (plus Irlandia, jeśli się rozwinęła). Przeprowadź pełne rozliczenie kosztów operacyjnych — obsługa, sprzedaż, inżynieria/G&A — względem struktury kosztów z §3, aby zysk netto był zmierzonym wynikiem, a nie aspiracją. Przedstaw końcowe 2-letnie podsumowanie dla zarządu: czy wylądowało na £1–3M, jak przewidywał ten raport, a jeśli nie, dokładnie dlaczego.`,

    // ro
    `## 3. Economia unitară, testată onest la stres

### Ipoteze construite pe procesul real de vânzare (abordare outbound + apeluri demo, nu self-serve)

| Indicator | Scenariu de bază | Interval |
|---|---|---|
| ARPU mixt | £50–55/lună | Înclină spre limita inferioară deoarece majoritatea lead-urilor sunt operatori individuali/mici |
| CAC | ~£1.200/client | £800 (eficient) – £2.000 (pesimist) — determinat de costul cu forța de muncă SDR (~£3.700/lună/reprezentant ÷ ~4,5 clienți/reprezentant/lună), nu de cheltuielile cu reclama |
| Churn lunar | 5%/lună (~46% anualizat) | 4–7%/lună — IMM-urile sunt mai puțin fidele decât marile companii: flux de numerar sezonier, închideri de persoane fizice autorizate, cost redus de schimbare |
| Marjă brută | 70% | 65–75% — suportul intensiv pentru IMM-uri o reduce sub cei 80%+ tipici ai SaaS self-serve |
| Durata medie de viață a clientului | 20 de luni (1 ÷ 5%) | |

**Problema structurală care agravează churn-ul:** concurenții cu comision creează un cost real de schimbare — schimbarea furnizorului înseamnă refacerea fluxurilor de plată. Modelul fără comision al {brand} nu are o asemenea blocare dincolo de atașamentul obișnuit față de produs, ceea ce ar trebui să împingă churn-ul spre capătul *superior* al intervalului, nu spre cel inferior.

### Cifra principală

| Scenariu | LTV (profit brut) | CAC | LTV:CAC | Recuperare |
|---|---|---|---|---|
| Optimist | £1.608 | £800 | 2,0:1 | 16 luni |
| **Scenariu de bază** | **£770** | **£1.200** | **0,64:1** | **31 de luni** |
| Pesimist | £386 | £2.000 | 0,19:1 | 74 de luni |

Un SaaS sănătos are **3:1 LTV:CAC cu recuperare <12 luni.** Scenariul de bază de aici este **sub 1:1, cu recuperare în 31 de luni față de o durată medie de viață a clientului de 20 de luni** — adică, la ipoteze mediane, **{brand} poate să nu-și recupereze CAC-ul înainte ca clientul mediu să plece.** Aceasta este cea mai importantă concluzie a raportului: înainte ca „cât de mare poate deveni” să fie întrebarea corectă, trebuie să existe un răspuns la „este achiziția de clienți noi profitabilă în general” — iar astăzi este nemăsurată, nu doar nescalată.

### Calcul invers de la un profit de £10M

- La o marjă netă *generoasă* de 25% (nivel de SaaS matur pe care o companie de 2 ani nu îl va atinge): un profit de £10M necesită **£40M ARR → ~60.600 de clienți** — mai mult decât *întregul pipeline actual de lead-uri* convertit 100%, cu churn zero.
- La o marjă netă mai realistă de 10% pentru o companie încă în creștere: **£100M ARR → ~150.000 de clienți.** Nu este plauzibil dintr-o bază de 50 de mii de lead-uri în 24 de luni.
- Calculând în schimb înainte, generos: **15.000 de clienți plătitori până în luna 24** (deja ~30% din *întreaga* bază actuală de lead-uri, o victorie uriașă de la un început cu 0% contactați) dau **£9,9M ARR, £6,9M profit brut**. Scăzând cheltuieli operaționale realiste la această scară — suport (~1 reprezentant CS la 300–400 de conturi → 38–50 FTE, £1,6–2,2M/an), vânzări (15–20 FTE, £0,7–1,0M/an), inginerie/G&A (15–20 FTE, £0,9–1,2M/an), plus costul continuu în numerar al CAC — **profitul net ajunge în jur de £1–3M, posibil chiar la pragul de rentabilitate. Nu £10M.**

### Reformularea onestă

- **Profit de £10M în 2 ani: nu este credibil pe baza niciunui comparabil sau a vreunei căi de economie unitară găsite.**
- **Profit de £1–3M în 2 ani, cu 5.000–8.000 de clienți în Marea Britanie și o economie unitară sănătoasă: credibil**, și corespunde cu ce s-a întâmplat când cei mai rapid în creștere comparabili reali din această categorie au ajuns în cele din urmă undeva.
- **Un profit de £10M este un rezultat realist pe 4–6 ani**, și doar dacă se întâmplă două corecții structurale: (1) reducerea churn-ului — contracte anuale, onboarding mai bun sau un comision modest care creează și el cost de schimbare; (2) monetizarea motorului de lead-uri (vezi mai jos) în loc să te bazezi doar pe veniturile din abonamente.

### Trimestru cu trimestru: cum se întâmplă de fapt calea £1–3M

Un plan ilustrativ de ritm, calculat invers din intervalul credibil de 5.000–8.000 de clienți / £1–3M de mai sus, la un ARPU mixt de £50–55/lună și churn-ul de bază de 5%/lună — nu o prognoză nouă și nu scenariul generos de 15.000 de clienți. Singurele cifre din acest raport care sunt *măsurate, nu modelate* se află în „Începe luni” de mai sus; tot ce urmează este o țintă de planificare de executat și de revizuit trimestrial pe măsură ce sosesc date reale de cohortă.

| Trimestru | Clienți activi nets (cumulat) | ARR brut (ilustrativ) | Ce trebuie să fie adevărat |
|---|---|---|---|
| T1 (luna 1–3) | ~600 | ~£0,4M | Prima cohortă din cele 19.284 de lead-uri redactate este efectiv trimisă și dusă până la un rezultat real |
| T2 (luna 4–6) | ~1.400 | ~£0,9M | Pâlnia este instrumentată; există primele cifre reale de conversie și CAC |
| T3 (luna 7–9) | ~2.300 | ~£1,5M | Cele mai bune segmente identificate și amplificate; cele mai slabe eliminate |
| T4 (luna 10–12) | ~3.300 | ~£2,2M | Închiderea anului 1: LTV:CAC real comparat cu scenariul de bază 0,64:1, raport pentru consiliu |
| T5 (luna 13–15) | ~4.300 | ~£2,8M | Pârghia de reducere a churn-ului (contracte anuale / pilot de comision) activă și măsurată |
| T6 (luna 16–18) | ~5.200 | ~£3,4M | Funcția de suport/CS extinsă înaintea raportului ~1:300–400 din §3, ca churn-ul să nu crească brusc |
| T7 (luna 19–21) | ~6.000 | ~£4,0M | Motorul de taxe de succes aduce o linie de venituri măsurabilă, nu doar abonamente |
| T8 (luna 22–24) | ~6.750 | ~£4,5M | Raport complet de cheltuieli operaționale pe 2 ani față de structura de costuri din §3; profitul net ajunge în intervalul £1–3M sau raportul este actualizat cu motivele |

Ce se întâmplă concret în fiecare trimestru — mișcări concrete, nu vorbe strategice:

**T1 — repară și dovedește pâlnia.** Trimite primele 500 din cele 19.284 de ciorne în coadă, apoi extinde la toată restanța în loturi săptămânale odată ce ratele de răspuns/demo se mențin. Rulează \`uncertain_verify.mjs\` până la rezolvare pe cele 6.640 de lead-uri din nivelul incert. Desemnează o persoană responsabilă de răspunsul la lead-uri și de programarea demo-urilor în aceeași zi. Pune în funcțiune urmărirea statusului (nou → contactat → demo → câștigat/pierdut) astfel încât T2 să aibă date reale. Redactează și prețuiește termenii taxei de succes.

**T2 — sistematizează ce a funcționat.** Extrage cifrele cohortei din T1: rata reală de răspuns, rata reală demo-la-închidere, CAC real pe sursă de lead și categorie de activitate. Elimină segmentele cele mai slabe din trimiterile viitoare; redirecționează efortul economisit către cele mai bune. Angajează primul SDR dedicat doar dacă CAC-ul rezultat face plauzibil calculul de recuperare din §3 — nu înainte. Prezintă motorul de lead-uri cu taxă de succes la 10–20 de furnizori reali și obține primele proiecte pilot plătite.

**T3 — scalează Marea Britanie, condiționează internaționalul.** Continuă să scalezi abordarea/demo-urile din Marea Britanie. Verifică criteriile de poartă din §4 pe date reale: a rămas conversia din Marea Britanie la 8–12%+ două luni consecutive? Dacă da, aprobă testul limitat din Irlanda de £15–25 mii (doar pagină de destinație + cheltuieli cu reclama, conform §4) — nu trebuie să ia nicio oră de la cei care conduc pâlnia din Marea Britanie. Dacă nu, nu-l porni încă; spune-o deschis și continuă să lucrezi pe Marea Britanie.

**T4 — dovedește sau oprește, apoi informează consiliul.** Închide anul 1 cu LTV:CAC real, churn real și CAC real — nu cu ipotezele scenariului de bază din §3. Dacă testul din Irlanda a rulat, aplică poarta sa preînregistrată de oprire/scalare. Prezintă consiliului cifrele reale din anul 1 față de încadrarea £1–3M/£10M a acestui raport, inclusiv unde realitatea a deviat de la plan și de ce.

**T5–T6 — amplifică ce funcționează.** Pune bugetul în spatele canalului (abonament Marea Britanie, motor de taxe de succes Marea Britanie sau Irlanda) care arată cel mai bun LTV:CAC, nu în spatele celui care pare cel mai captivant. Construiește suportul/CS înaintea numărului de clienți, ca churn-ul să nu depășească treptat scenariul de bază de 5%/lună pe măsură ce baza crește. Reevaluează fiecare ipoteză din §3 pe un an întreg de date reale de cohortă și actualizează cifrele din acest raport în consecință.

**T7–T8 — atinge cifra, nu doar spera la ea.** Împinge spre intervalul de 5.000–8.000 de clienți din Marea Britanie (plus Irlanda dacă a scalat). Rulează raportul complet de cheltuieli operaționale — suport, vânzări, inginerie/G&A — față de structura de costuri din §3, astfel încât profitul net să fie un rezultat măsurat, nu o aspirație. Livrează raportul final pe 2 ani pentru consiliu: a ajuns la £1–3M așa cum a prezis acest raport și, dacă nu, exact de ce nu.`,

    // ur
    `## 3. یونٹ اکنامکس، ایمانداری سے کڑی جانچ کے ساتھ

### مفروضات، جو اصل سیلز طریقہ کار پر مبنی ہیں (آؤٹ باؤنڈ + ڈیمو کالز، سیلف سروس نہیں)

| ان پٹ | بنیادی صورت | حد |
|---|---|---|
| مخلوط ARPU | £50–55/ماہ | نچلی طرف جھکتا ہے کیونکہ زیادہ تر لیڈز اکیلے/چھوٹے آپریٹرز ہیں |
| CAC | ~£1,200/گاہک | £800 (مؤثر) – £2,000 (مایوس کن) — SDR کی لیبر لاگت سے طے ہوتا ہے (~£3,700/ماہ/نمائندہ ÷ ~4.5 گاہک/نمائندہ/ماہ)، اشتہاری اخراجات سے نہیں |
| ماہانہ churn | 5%/ماہ (~46% سالانہ) | 4–7%/ماہ — چھوٹے کاروبار بڑے اداروں کے مقابلے میں کم وفادار ہوتے ہیں: موسمی نقدی بہاؤ، واحد مالک کے کاروبار کا بند ہونا، بدلنے کی کم لاگت |
| مجموعی مارجن | 70% | 65–75% — چھوٹے کاروباروں کی بھرپور سپورٹ اسے سیلف سروس SaaS کے عام 80%+ سے نیچے کھینچتی ہے |
| گاہک کی اوسط مدت | 20 ماہ (1 ÷ 5%) | |

**churn کو بڑھانے والا ڈھانچہ جاتی مسئلہ:** کمیشن لینے والے حریف حقیقی سوئچنگ لاگت پیدا کرتے ہیں — فراہم کنندہ بدلنے کا مطلب ادائیگی کے نظام دوبارہ بنانا ہے۔ {brand} کے بغیر کمیشن ماڈل میں عام پروڈکٹ سے لگاؤ کے علاوہ ایسی کوئی پابندی نہیں، جو churn کو حد کے *اوپری* سرے کی طرف دھکیلے گی، نچلے کی طرف نہیں۔

### اصل عدد

| صورت | LTV (مجموعی منافع) | CAC | LTV:CAC | واپسی کی مدت |
|---|---|---|---|---|
| پر امید | £1,608 | £800 | 2.0:1 | 16 ماہ |
| **بنیادی صورت** | **£770** | **£1,200** | **0.64:1** | **31 ماہ** |
| مایوس کن | £386 | £2,000 | 0.19:1 | 74 ماہ |

صحت مند SaaS **3:1 LTV:CAC اور <12 ماہ کی واپسی** رکھتا ہے۔ یہاں بنیادی صورت **1:1 سے کم، 31 ماہ کی واپسی کے ساتھ جبکہ گاہک کی اوسط مدت 20 ماہ ہے** — یعنی اوسط مفروضوں پر **{brand} اوسط گاہک کے چھوڑ جانے سے پہلے اپنا CAC واپس نہ کر سکے۔** یہ اس رپورٹ کا سب سے اہم نتیجہ ہے: "یہ کتنا بڑا ہو سکتا ہے" درست سوال بننے سے پہلے، "کیا نئے گاہک حاصل کرنا منافع بخش ہے بھی" کا جواب چاہیے — اور آج یہ صرف غیر وسیع نہیں بلکہ ناپا ہی نہیں گیا۔

### £10M منافع سے پیچھے کی طرف حساب

- *فراخدلانہ* 25% خالص مارجن پر (پختہ SaaS کی سطح جو 2 سال پرانی کمپنی حاصل نہیں کر پائے گی): £10M منافع کے لیے **£40M ARR → ~60,600 گاہک** درکار ہیں — یہ *موجودہ پوری لیڈ پائپ لائن* کے 100% تبدیل ہونے اور صفر churn سے بھی زیادہ ہے۔
- اب بھی بڑھتی کمپنی کے لیے زیادہ حقیقت پسندانہ 10% خالص مارجن پر: **£100M ARR → ~150,000 گاہک۔** 24 ماہ میں 50 ہزار لیڈز کے ڈیٹا بیس سے ممکن نہیں۔
- اس کے بجائے آگے کا حساب، فراخدلی سے: **ماہ 24 تک 15,000 ادائیگی کرنے والے گاہک** (آج کے *پورے* لیڈ ڈیٹا بیس کا ~30%، 0% رابطہ شدہ سے آغاز کے مقابلے میں بڑی کامیابی) **£9.9M ARR، £6.9M مجموعی منافع** دیتے ہیں۔ اس پیمانے پر حقیقت پسندانہ آپریٹنگ اخراجات منہا کریں — سپورٹ (~300–400 اکاؤنٹس فی CS نمائندہ → 38–50 FTE، £1.6–2.2M/سال)، سیلز (15–20 FTE، £0.7–1.0M/سال)، انجینئرنگ/G&A (15–20 FTE، £0.9–1.2M/سال)، نیز جاری CAC نقد لاگت — اور **خالص منافع تقریباً £1–3M رہتا ہے، غالباً برابر برابر۔ £10M نہیں۔**

### ایماندارانہ نئی ترتیب

- **2 سال میں £10M منافع: کسی بھی موازنے یا یونٹ اکنامکس کے راستے پر قابلِ یقین نہیں۔**
- **2 سال میں £1–3M منافع، برطانیہ میں 5,000–8,000 گاہکوں اور معقول یونٹ اکنامکس کے ساتھ: قابلِ یقین**، اور اس سے مطابقت رکھتا ہے جو اس زمرے کے تیز ترین بڑھتے حقیقی حریفوں کے ساتھ آخرکار ہوا۔
- **£10M منافع 4–6 سال کا حقیقت پسندانہ نتیجہ ہے**، اور صرف اس صورت میں جب دو ڈھانچہ جاتی اصلاحات ہوں: (1) churn کم کرنا — سالانہ معاہدے، بہتر آن بورڈنگ، یا معمولی کمیشن لائن جو سوئچنگ لاگت بھی پیدا کرے؛ (2) صرف سبسکرپشن آمدنی پر انحصار کرنے کے بجائے لیڈ انجن سے آمدنی بنانا (نیچے دیکھیں)۔

### سہ ماہی بہ سہ ماہی: £1–3M کا راستہ حقیقت میں کیسے بنتا ہے

ایک مثالی رفتار کا منصوبہ، جو اوپر کی قابلِ یقین 5,000–8,000 گاہک / £1–3M حد سے پیچھے کی طرف حساب لگا کر £50–55/ماہ مخلوط ARPU اور 5%/ماہ بنیادی churn پر بنایا گیا — نئی پیش گوئی نہیں، اور نہ ہی 15,000 گاہکوں کی فراخدلانہ صورت۔ اس رپورٹ میں صرف وہی اعداد جو *ناپے گئے ہیں، ماڈل نہیں*، اوپر "پیر سے شروع کریں" میں ہیں؛ نیچے سب کچھ عمل کرنے کا منصوبہ جاتی ہدف ہے جسے حقیقی کوہورٹ ڈیٹا آنے پر ہر سہ ماہی میں نظرِ ثانی کرنا ہے۔

| سہ ماہی | خالص فعال گاہک (مجموعی) | مجموعی ARR (مثالی) | کیا سچ ہونا چاہیے |
|---|---|---|---|
| Q1 (ماہ 1–3) | ~600 | ~£0.4M | 19,284 تیار کردہ لیڈز کا پہلا گروپ واقعی بھیجا گیا اور حقیقی نتیجے تک پہنچایا گیا |
| Q2 (ماہ 4–6) | ~1,400 | ~£0.9M | فنل میں پیمائش کا نظام ہے؛ پہلی حقیقی تبدیلی کی شرح اور CAC کے اعداد موجود ہیں |
| Q3 (ماہ 7–9) | ~2,300 | ~£1.5M | بہترین کارکردگی والے حصے پہچان کر ان پر زور دیا گیا؛ بدترین بند کیے گئے |
| Q4 (ماہ 10–12) | ~3,300 | ~£2.2M | سال 1 کا اختتام: اصل LTV:CAC کا 0.64:1 بنیادی صورت سے موازنہ، بورڈ رپورٹ |
| Q5 (ماہ 13–15) | ~4,300 | ~£2.8M | churn کم کرنے کا ذریعہ (سالانہ معاہدے / کمیشن پائلٹ) فعال اور ناپا جا رہا ہے |
| Q6 (ماہ 16–18) | ~5,200 | ~£3.4M | سپورٹ/CS §3 کے ~1:300–400 تناسب سے پہلے بڑھایا گیا تاکہ churn نہ بڑھے |
| Q7 (ماہ 19–21) | ~6,000 | ~£4.0M | کامیابی فیس انجن صرف سبسکرپشنز نہیں بلکہ قابلِ پیمائش آمدنی کی لائن دے رہا ہے |
| Q8 (ماہ 22–24) | ~6,750 | ~£4.5M | §3 کے لاگت ڈھانچے کے مقابلے میں پورے 2 سال کے آپریٹنگ اخراجات کی رپورٹ؛ خالص منافع £1–3M کی حد میں آتا ہے یا رپورٹ کو وجوہات کے ساتھ اپ ڈیٹ کیا جاتا ہے |

ہر سہ ماہی میں خاص طور پر کیا ہوتا ہے — ٹھوس اقدامات، حکمتِ عملی کی باتیں نہیں:

**Q1 — فنل ٹھیک کریں اور ثابت کریں۔** قطار میں موجود 19,284 مسودوں میں سے پہلے 500 بھیجیں، پھر جب جواب/ڈیمو کی شرحیں برقرار رہیں تو ہفتہ وار گروپوں میں پورے بیک لاگ تک بڑھائیں۔ 6,640 غیر یقینی درجے کی لیڈز پر \`uncertain_verify.mjs\` کو مکمل ہونے تک چلائیں۔ ایک نامزد شخص کو لیڈز کو جواب دینے اور اسی دن ڈیمو بک کرنے کا ذمہ دار بنائیں۔ اسٹیٹس ٹریکنگ (نئی → رابطہ شدہ → ڈیمو → جیتی/کھوئی) قائم کریں تاکہ Q2 کے پاس حقیقی ڈیٹا ہو۔ کامیابی فیس کی شرائط کا مسودہ اور قیمت تیار کریں۔

**Q2 — جو کام کیا اسے منظم کریں۔** Q1 کوہورٹ کے اعداد نکالیں: حقیقی جواب کی شرح، حقیقی ڈیمو سے بندش کی شرح، لیڈ کے ذریعے اور سرگرمی کے زمرے کے لحاظ سے حقیقی CAC۔ آئندہ ارسال سے بدترین حصے نکال دیں؛ بچی ہوئی کوشش بہترین پر لگائیں۔ پہلا مخصوص SDR تبھی رکھیں جب ابھرتا ہوا CAC §3 کے واپسی کے حساب کو معقول بنائے — اس سے پہلے نہیں۔ کامیابی فیس لیڈ انجن 10–20 حقیقی فراہم کنندگان کو پیش کریں اور پہلے ادا شدہ پائلٹ حاصل کریں۔

**Q3 — برطانیہ کو بڑھائیں، بین الاقوامی پر شرط رکھیں۔** برطانیہ میں ارسال/ڈیمو کی رفتار بڑھاتے رہیں۔ حقیقی ڈیٹا پر §4 کی شرائط جانچیں: کیا برطانیہ میں تبدیلی دو مسلسل مہینے 8–12%+ رہی؟ اگر ہاں تو £15–25 ہزار کے محدود آئرلینڈ ٹیسٹ کی منظوری دیں (صرف لینڈنگ پیج + اشتہاری خرچ، §4 کے مطابق) — یہ برطانوی فنل چلانے والوں سے ایک گھنٹہ بھی نہ لے۔ اگر نہیں تو ابھی شروع نہ کریں؛ کھل کر کہیں اور برطانیہ پر کام جاری رکھیں۔

**Q4 — ثابت کریں یا بند کریں، پھر بورڈ کو بتائیں۔** سال 1 کو حقیقی LTV:CAC، حقیقی churn اور حقیقی CAC کے ساتھ بند کریں — §3 کے بنیادی مفروضات کے ساتھ نہیں۔ اگر آئرلینڈ ٹیسٹ چلا تو اس کی پہلے سے درج بندش/توسیع کی شرط لگائیں۔ سال 1 کے حقیقی اعداد کو اس رپورٹ کے £1–3M/£10M کے فریم کے مقابلے میں بورڈ کے سامنے رکھیں، بشمول یہ کہ حقیقت منصوبے سے کہاں اور کیوں مختلف ہوئی۔

**Q5–Q6 — جو کام کر رہا ہے اسے مضبوط کریں۔** بجٹ اس چینل کے پیچھے لگائیں (برطانیہ سبسکرپشن، برطانیہ کامیابی فیس انجن، یا آئرلینڈ) جو بہترین LTV:CAC دکھائے، اس کے نہیں جو سب سے دلچسپ لگے۔ گاہکوں کی تعداد سے پہلے CS/سپورٹ بنائیں تاکہ بنیاد بڑھنے پر churn بنیادی 5%/ماہ سے آگے نہ بڑھے۔ §3 کے ہر مفروضے کو پورے سال کے حقیقی کوہورٹ ڈیٹا کے مقابلے میں دوبارہ جانچیں اور اس رپورٹ کے اعداد اسی کے مطابق اپ ڈیٹ کریں۔

**Q7–Q8 — عدد حاصل کریں، صرف امید نہ رکھیں۔** برطانیہ کے 5,000–8,000 گاہکوں کی حد کی طرف بڑھیں (اگر آئرلینڈ بڑھا تو اسے ملا کر)۔ §3 کے لاگت ڈھانچے کے مقابلے میں پوری آپریٹنگ اخراجات کی رپورٹ چلائیں — سپورٹ، سیلز، انجینئرنگ/G&A — تاکہ خالص منافع ایک ناپا ہوا نتیجہ ہو، خواہش نہیں۔ آخری 2 سالہ بورڈ رپورٹ دیں: کیا یہ £1–3M پر پہنچا جیسا اس رپورٹ نے پیش گوئی کی تھی، اور اگر نہیں تو ٹھیک ٹھیک کیوں نہیں۔`,

    // pa
    `## 3. ਯੂਨਿਟ ਅਰਥਸ਼ਾਸਤਰ, ਇਮਾਨਦਾਰੀ ਨਾਲ ਕਠੋਰ ਜਾਂਚ ਸਮੇਤ

### ਮੰਨਤਾਂ, ਅਸਲ ਵਿਕਰੀ ਢੰਗ 'ਤੇ ਆਧਾਰਿਤ (ਆਊਟਬਾਊਂਡ + ਡੈਮੋ ਕਾਲਾਂ, ਸੈਲਫ-ਸਰਵਿਸ ਨਹੀਂ)

| ਇਨਪੁੱਟ | ਬੁਨਿਆਦੀ ਸਥਿਤੀ | ਸੀਮਾ |
|---|---|---|
| ਮਿਸ਼ਰਤ ARPU | £50–55/ਮਹੀਨਾ | ਹੇਠਾਂ ਵੱਲ ਝੁਕਦਾ ਹੈ ਕਿਉਂਕਿ ਜ਼ਿਆਦਾਤਰ ਲੀਡਾਂ ਇਕੱਲੇ/ਛੋਟੇ ਓਪਰੇਟਰ ਹਨ |
| CAC | ~£1,200/ਗਾਹਕ | £800 (ਕੁਸ਼ਲ) – £2,000 (ਨਿਰਾਸ਼ਾਵਾਦੀ) — SDR ਦੀ ਮਜ਼ਦੂਰੀ ਲਾਗਤ ਨਾਲ ਤੈਅ (~£3,700/ਮਹੀਨਾ/ਪ੍ਰਤੀਨਿਧੀ ÷ ~4.5 ਗਾਹਕ/ਪ੍ਰਤੀਨਿਧੀ/ਮਹੀਨਾ), ਇਸ਼ਤਿਹਾਰੀ ਖਰਚ ਨਾਲ ਨਹੀਂ |
| ਮਹੀਨਾਵਾਰ churn | 5%/ਮਹੀਨਾ (~46% ਸਾਲਾਨਾ) | 4–7%/ਮਹੀਨਾ — ਛੋਟੇ ਕਾਰੋਬਾਰ ਵੱਡੇ ਅਦਾਰਿਆਂ ਨਾਲੋਂ ਘੱਟ ਵਫ਼ਾਦਾਰ ਹੁੰਦੇ ਹਨ: ਮੌਸਮੀ ਨਕਦੀ ਪ੍ਰਵਾਹ, ਇਕੱਲੇ ਵਪਾਰੀ ਦਾ ਬੰਦ ਹੋਣਾ, ਬਦਲਣ ਦੀ ਘੱਟ ਲਾਗਤ |
| ਕੁੱਲ ਮਾਰਜਿਨ | 70% | 65–75% — ਛੋਟੇ ਕਾਰੋਬਾਰਾਂ ਦੀ ਭਾਰੀ ਸਹਾਇਤਾ ਇਸਨੂੰ ਸੈਲਫ-ਸਰਵਿਸ SaaS ਦੇ ਆਮ 80%+ ਤੋਂ ਹੇਠਾਂ ਖਿੱਚਦੀ ਹੈ |
| ਗਾਹਕ ਦੀ ਔਸਤ ਮਿਆਦ | 20 ਮਹੀਨੇ (1 ÷ 5%) | |

**churn ਨੂੰ ਵਧਾਉਣ ਵਾਲੀ ਢਾਂਚਾਗਤ ਸਮੱਸਿਆ:** ਕਮਿਸ਼ਨ ਲੈਣ ਵਾਲੇ ਮੁਕਾਬਲੇਬਾਜ਼ ਅਸਲ ਬਦਲਣ ਦੀ ਲਾਗਤ ਬਣਾਉਂਦੇ ਹਨ — ਪ੍ਰਦਾਤਾ ਬਦਲਣ ਦਾ ਮਤਲਬ ਭੁਗਤਾਨ ਪ੍ਰਵਾਹ ਨੂੰ ਨਵੇਂ ਸਿਰਿਓਂ ਬਣਾਉਣਾ ਹੈ। {brand} ਦੇ ਬਿਨਾਂ ਕਮਿਸ਼ਨ ਵਾਲੇ ਮਾਡਲ ਵਿੱਚ ਆਮ ਉਤਪਾਦ ਲਗਾਅ ਤੋਂ ਇਲਾਵਾ ਅਜਿਹੀ ਕੋਈ ਬੰਦਿਸ਼ ਨਹੀਂ, ਜੋ churn ਨੂੰ ਸੀਮਾ ਦੇ *ਉੱਚੇ* ਸਿਰੇ ਵੱਲ ਧੱਕੇਗੀ, ਨੀਵੇਂ ਵੱਲ ਨਹੀਂ।

### ਮੁੱਖ ਅੰਕੜਾ

| ਸਥਿਤੀ | LTV (ਕੁੱਲ ਮੁਨਾਫ਼ਾ) | CAC | LTV:CAC | ਵਸੂਲੀ |
|---|---|---|---|---|
| ਆਸ਼ਾਵਾਦੀ | £1,608 | £800 | 2.0:1 | 16 ਮਹੀਨੇ |
| **ਬੁਨਿਆਦੀ ਸਥਿਤੀ** | **£770** | **£1,200** | **0.64:1** | **31 ਮਹੀਨੇ** |
| ਨਿਰਾਸ਼ਾਵਾਦੀ | £386 | £2,000 | 0.19:1 | 74 ਮਹੀਨੇ |

ਸਿਹਤਮੰਦ SaaS **3:1 LTV:CAC ਅਤੇ <12 ਮਹੀਨੇ ਦੀ ਵਸੂਲੀ** ਰੱਖਦਾ ਹੈ। ਇੱਥੇ ਬੁਨਿਆਦੀ ਸਥਿਤੀ **1:1 ਤੋਂ ਘੱਟ ਹੈ, 31 ਮਹੀਨੇ ਦੀ ਵਸੂਲੀ ਨਾਲ ਜਦਕਿ ਗਾਹਕ ਦੀ ਔਸਤ ਮਿਆਦ 20 ਮਹੀਨੇ ਹੈ** — ਭਾਵ ਔਸਤ ਮੰਨਤਾਂ 'ਤੇ **{brand} ਔਸਤ ਗਾਹਕ ਦੇ ਛੱਡਣ ਤੋਂ ਪਹਿਲਾਂ ਆਪਣਾ CAC ਵਾਪਸ ਨਾ ਲੈ ਸਕੇ।** ਇਹ ਇਸ ਰਿਪੋਰਟ ਦਾ ਸਭ ਤੋਂ ਮਹੱਤਵਪੂਰਨ ਨਤੀਜਾ ਹੈ: "ਇਹ ਕਿੰਨਾ ਵੱਡਾ ਹੋ ਸਕਦਾ ਹੈ" ਸਹੀ ਸਵਾਲ ਬਣਨ ਤੋਂ ਪਹਿਲਾਂ, "ਕੀ ਨਵੇਂ ਗਾਹਕ ਲਿਆਉਣਾ ਮੁਨਾਫ਼ੇ ਵਾਲਾ ਹੈ ਵੀ" ਦਾ ਜਵਾਬ ਚਾਹੀਦਾ ਹੈ — ਅਤੇ ਅੱਜ ਇਹ ਸਿਰਫ਼ ਅਣ-ਵਧਿਆ ਨਹੀਂ, ਮਾਪਿਆ ਹੀ ਨਹੀਂ ਗਿਆ।

### £10M ਮੁਨਾਫ਼ੇ ਤੋਂ ਪਿੱਛੇ ਵੱਲ ਹਿਸਾਬ

- *ਖੁੱਲ੍ਹਦਿਲੇ* 25% ਸ਼ੁੱਧ ਮਾਰਜਿਨ 'ਤੇ (ਪੱਕੇ SaaS ਦਾ ਪੱਧਰ ਜੋ 2 ਸਾਲ ਪੁਰਾਣੀ ਕੰਪਨੀ ਨਹੀਂ ਛੂਹੇਗੀ): £10M ਮੁਨਾਫ਼ੇ ਲਈ **£40M ARR → ~60,600 ਗਾਹਕ** ਚਾਹੀਦੇ ਹਨ — ਇਹ *ਮੌਜੂਦਾ ਪੂਰੀ ਲੀਡ ਪਾਈਪਲਾਈਨ* ਦੇ 100% ਬਦਲਣ ਅਤੇ ਜ਼ੀਰੋ churn ਤੋਂ ਵੀ ਵੱਧ ਹੈ।
- ਅਜੇ ਵੀ ਵਧ ਰਹੀ ਕੰਪਨੀ ਲਈ ਵਧੇਰੇ ਯਥਾਰਥਵਾਦੀ 10% ਸ਼ੁੱਧ ਮਾਰਜਿਨ 'ਤੇ: **£100M ARR → ~150,000 ਗਾਹਕ।** 24 ਮਹੀਨਿਆਂ ਵਿੱਚ 50 ਹਜ਼ਾਰ ਲੀਡਾਂ ਦੇ ਡੇਟਾਬੇਸ ਤੋਂ ਸੰਭਵ ਨਹੀਂ।
- ਇਸ ਦੀ ਬਜਾਏ ਅੱਗੇ ਵੱਲ ਹਿਸਾਬ, ਖੁੱਲ੍ਹਦਿਲੀ ਨਾਲ: **ਮਹੀਨਾ 24 ਤੱਕ 15,000 ਭੁਗਤਾਨ ਕਰਨ ਵਾਲੇ ਗਾਹਕ** (ਅੱਜ ਦੇ *ਪੂਰੇ* ਲੀਡ ਡੇਟਾਬੇਸ ਦਾ ~30%, 0% ਸੰਪਰਕ ਤੋਂ ਸ਼ੁਰੂ ਕਰਨ ਦੇ ਮੁਕਾਬਲੇ ਵੱਡੀ ਜਿੱਤ) **£9.9M ARR, £6.9M ਕੁੱਲ ਮੁਨਾਫ਼ਾ** ਦਿੰਦੇ ਹਨ। ਉਸ ਪੱਧਰ 'ਤੇ ਯਥਾਰਥਵਾਦੀ ਸੰਚਾਲਨ ਖਰਚ ਘਟਾਓ — ਸਹਾਇਤਾ (~300–400 ਖਾਤਿਆਂ ਪਿੱਛੇ 1 CS ਪ੍ਰਤੀਨਿਧੀ → 38–50 FTE, £1.6–2.2M/ਸਾਲ), ਵਿਕਰੀ (15–20 FTE, £0.7–1.0M/ਸਾਲ), ਇੰਜੀਨੀਅਰਿੰਗ/G&A (15–20 FTE, £0.9–1.2M/ਸਾਲ), ਨਾਲ ਜਾਰੀ CAC ਨਕਦ ਲਾਗਤ — ਅਤੇ **ਸ਼ੁੱਧ ਮੁਨਾਫ਼ਾ ਲਗਭਗ £1–3M ਰਹਿੰਦਾ ਹੈ, ਸੰਭਵ ਤੌਰ 'ਤੇ ਬਰਾਬਰ-ਬਰਾਬਰ। £10M ਨਹੀਂ।**

### ਇਮਾਨਦਾਰ ਨਵੀਂ ਤਰਤੀਬ

- **2 ਸਾਲਾਂ ਵਿੱਚ £10M ਮੁਨਾਫ਼ਾ: ਕਿਸੇ ਵੀ ਤੁਲਨਾ ਜਾਂ ਯੂਨਿਟ ਅਰਥਸ਼ਾਸਤਰ ਦੇ ਰਾਹ 'ਤੇ ਭਰੋਸੇਯੋਗ ਨਹੀਂ।**
- **2 ਸਾਲਾਂ ਵਿੱਚ £1–3M ਮੁਨਾਫ਼ਾ, ਯੂਕੇ ਵਿੱਚ 5,000–8,000 ਗਾਹਕਾਂ ਅਤੇ ਸਮਝਦਾਰ ਯੂਨਿਟ ਅਰਥਸ਼ਾਸਤਰ ਨਾਲ: ਭਰੋਸੇਯੋਗ**, ਅਤੇ ਉਸ ਨਾਲ ਮੇਲ ਖਾਂਦਾ ਹੈ ਜੋ ਇਸ ਸ਼੍ਰੇਣੀ ਦੇ ਸਭ ਤੋਂ ਤੇਜ਼ੀ ਨਾਲ ਵਧਦੇ ਅਸਲ ਮੁਕਾਬਲੇਬਾਜ਼ਾਂ ਨਾਲ ਆਖ਼ਰਕਾਰ ਹੋਇਆ।
- **£10M ਮੁਨਾਫ਼ਾ 4–6 ਸਾਲਾਂ ਦਾ ਯਥਾਰਥਵਾਦੀ ਨਤੀਜਾ ਹੈ**, ਅਤੇ ਸਿਰਫ਼ ਤਾਂ ਜੇ ਦੋ ਢਾਂਚਾਗਤ ਸੁਧਾਰ ਹੋਣ: (1) churn ਘਟਾਉਣਾ — ਸਾਲਾਨਾ ਇਕਰਾਰਨਾਮੇ, ਬਿਹਤਰ ਆਨਬੋਰਡਿੰਗ, ਜਾਂ ਮਾਮੂਲੀ ਕਮਿਸ਼ਨ ਲਾਈਨ ਜੋ ਬਦਲਣ ਦੀ ਲਾਗਤ ਵੀ ਬਣਾਏ; (2) ਸਿਰਫ਼ ਸਬਸਕ੍ਰਿਪਸ਼ਨ ਆਮਦਨ 'ਤੇ ਨਿਰਭਰ ਰਹਿਣ ਦੀ ਬਜਾਏ ਲੀਡ ਇੰਜਣ ਤੋਂ ਕਮਾਈ ਕਰਨਾ (ਹੇਠਾਂ ਵੇਖੋ)।

### ਤਿਮਾਹੀ-ਦਰ-ਤਿਮਾਹੀ: £1–3M ਦਾ ਰਾਹ ਅਸਲ ਵਿੱਚ ਕਿਵੇਂ ਬਣਦਾ ਹੈ

ਇੱਕ ਉਦਾਹਰਣ ਰਫ਼ਤਾਰ ਯੋਜਨਾ, ਉੱਪਰ ਦੀ ਭਰੋਸੇਯੋਗ 5,000–8,000 ਗਾਹਕ / £1–3M ਸੀਮਾ ਤੋਂ ਪਿੱਛੇ ਵੱਲ ਹਿਸਾਬ ਲਾ ਕੇ, £50–55/ਮਹੀਨਾ ਮਿਸ਼ਰਤ ARPU ਅਤੇ 5%/ਮਹੀਨਾ ਬੁਨਿਆਦੀ churn 'ਤੇ — ਨਵੀਂ ਪੇਸ਼ੀਨਗੋਈ ਨਹੀਂ, ਅਤੇ 15,000 ਗਾਹਕਾਂ ਵਾਲੀ ਖੁੱਲ੍ਹਦਿਲੀ ਵਾਲੀ ਸਥਿਤੀ ਵੀ ਨਹੀਂ। ਇਸ ਰਿਪੋਰਟ ਵਿੱਚ ਸਿਰਫ਼ ਉਹੀ ਅੰਕੜੇ ਜੋ *ਮਾਪੇ ਗਏ ਹਨ, ਮਾਡਲ ਨਹੀਂ*, ਉੱਪਰ "ਸੋਮਵਾਰ ਤੋਂ ਸ਼ੁਰੂ ਕਰੋ" ਵਿੱਚ ਹਨ; ਹੇਠਾਂ ਸਭ ਕੁਝ ਅਮਲ ਕਰਨ ਲਈ ਯੋਜਨਾ ਟੀਚਾ ਹੈ, ਜਿਸਨੂੰ ਅਸਲ ਕੋਹੋਰਟ ਡੇਟਾ ਆਉਣ 'ਤੇ ਹਰ ਤਿਮਾਹੀ ਸੋਧਣਾ ਹੈ।

| ਤਿਮਾਹੀ | ਸ਼ੁੱਧ ਸਰਗਰਮ ਗਾਹਕ (ਕੁੱਲ) | ਕੁੱਲ ARR (ਉਦਾਹਰਣ) | ਕੀ ਸੱਚ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ |
|---|---|---|---|
| Q1 (ਮਹੀਨਾ 1–3) | ~600 | ~£0.4M | 19,284 ਤਿਆਰ ਲੀਡਾਂ ਦਾ ਪਹਿਲਾ ਸਮੂਹ ਅਸਲ ਵਿੱਚ ਭੇਜਿਆ ਗਿਆ ਅਤੇ ਅਸਲ ਨਤੀਜੇ ਤੱਕ ਪਹੁੰਚਾਇਆ ਗਿਆ |
| Q2 (ਮਹੀਨਾ 4–6) | ~1,400 | ~£0.9M | ਫਨਲ ਵਿੱਚ ਮਾਪ ਪ੍ਰਣਾਲੀ ਹੈ; ਪਹਿਲੇ ਅਸਲ ਤਬਦੀਲੀ ਦਰ ਅਤੇ CAC ਅੰਕੜੇ ਮੌਜੂਦ ਹਨ |
| Q3 (ਮਹੀਨਾ 7–9) | ~2,300 | ~£1.5M | ਸਭ ਤੋਂ ਵਧੀਆ ਹਿੱਸੇ ਪਛਾਣ ਕੇ ਉਨ੍ਹਾਂ 'ਤੇ ਜ਼ੋਰ ਦਿੱਤਾ; ਸਭ ਤੋਂ ਮਾੜੇ ਬੰਦ ਕੀਤੇ |
| Q4 (ਮਹੀਨਾ 10–12) | ~3,300 | ~£2.2M | ਸਾਲ 1 ਦਾ ਅੰਤ: ਅਸਲ LTV:CAC ਦੀ 0.64:1 ਬੁਨਿਆਦੀ ਸਥਿਤੀ ਨਾਲ ਤੁਲਨਾ, ਬੋਰਡ ਰਿਪੋਰਟ |
| Q5 (ਮਹੀਨਾ 13–15) | ~4,300 | ~£2.8M | churn ਘਟਾਉਣ ਦਾ ਸਾਧਨ (ਸਾਲਾਨਾ ਇਕਰਾਰਨਾਮੇ / ਕਮਿਸ਼ਨ ਪਾਇਲਟ) ਚਾਲੂ ਅਤੇ ਮਾਪਿਆ ਜਾ ਰਿਹਾ ਹੈ |
| Q6 (ਮਹੀਨਾ 16–18) | ~5,200 | ~£3.4M | ਸਹਾਇਤਾ/CS §3 ਦੇ ~1:300–400 ਅਨੁਪਾਤ ਤੋਂ ਪਹਿਲਾਂ ਵਧਾਈ ਗਈ ਤਾਂ ਜੋ churn ਨਾ ਵਧੇ |
| Q7 (ਮਹੀਨਾ 19–21) | ~6,000 | ~£4.0M | ਸਫਲਤਾ ਫੀਸ ਇੰਜਣ ਸਿਰਫ਼ ਸਬਸਕ੍ਰਿਪਸ਼ਨਾਂ ਨਹੀਂ, ਮਾਪਣਯੋਗ ਆਮਦਨ ਲਾਈਨ ਦੇ ਰਿਹਾ ਹੈ |
| Q8 (ਮਹੀਨਾ 22–24) | ~6,750 | ~£4.5M | §3 ਦੇ ਲਾਗਤ ਢਾਂਚੇ ਦੇ ਮੁਕਾਬਲੇ ਪੂਰੇ 2 ਸਾਲ ਦੇ ਸੰਚਾਲਨ ਖਰਚਾਂ ਦੀ ਰਿਪੋਰਟ; ਸ਼ੁੱਧ ਮੁਨਾਫ਼ਾ £1–3M ਦੀ ਸੀਮਾ ਵਿੱਚ ਆਉਂਦਾ ਹੈ ਜਾਂ ਰਿਪੋਰਟ ਕਾਰਨਾਂ ਸਮੇਤ ਅੱਪਡੇਟ ਹੁੰਦੀ ਹੈ |

ਹਰ ਤਿਮਾਹੀ ਵਿੱਚ ਖ਼ਾਸ ਤੌਰ 'ਤੇ ਕੀ ਹੁੰਦਾ ਹੈ — ਠੋਸ ਕਦਮ, ਰਣਨੀਤੀ ਦੀਆਂ ਗੱਲਾਂ ਨਹੀਂ:

**Q1 — ਫਨਲ ਠੀਕ ਕਰੋ ਅਤੇ ਸਾਬਤ ਕਰੋ।** ਕਤਾਰ ਵਿੱਚ ਲੱਗੇ 19,284 ਖਰੜਿਆਂ ਵਿੱਚੋਂ ਪਹਿਲੇ 500 ਭੇਜੋ, ਫਿਰ ਜਦੋਂ ਜਵਾਬ/ਡੈਮੋ ਦਰਾਂ ਟਿਕੀਆਂ ਰਹਿਣ ਤਾਂ ਹਫ਼ਤਾਵਾਰੀ ਸਮੂਹਾਂ ਵਿੱਚ ਪੂਰੇ ਬੈਕਲਾਗ ਤੱਕ ਵਧਾਓ। 6,640 ਅਨਿਸ਼ਚਿਤ ਪੱਧਰ ਦੀਆਂ ਲੀਡਾਂ 'ਤੇ \`uncertain_verify.mjs\` ਨੂੰ ਮੁਕੰਮਲ ਹੋਣ ਤੱਕ ਚਲਾਓ। ਲੀਡਾਂ ਨੂੰ ਜਵਾਬ ਦੇਣ ਅਤੇ ਉਸੇ ਦਿਨ ਡੈਮੋ ਬੁੱਕ ਕਰਨ ਲਈ ਇੱਕ ਨਾਮਜ਼ਦ ਵਿਅਕਤੀ ਨੂੰ ਜ਼ਿੰਮੇਵਾਰ ਬਣਾਓ। ਸਥਿਤੀ ਟਰੈਕਿੰਗ (ਨਵੀਂ → ਸੰਪਰਕ ਕੀਤਾ → ਡੈਮੋ → ਜਿੱਤੀ/ਗੁਆਚੀ) ਸਥਾਪਿਤ ਕਰੋ ਤਾਂ ਜੋ Q2 ਕੋਲ ਅਸਲ ਡੇਟਾ ਹੋਵੇ। ਸਫਲਤਾ ਫੀਸ ਦੀਆਂ ਸ਼ਰਤਾਂ ਦਾ ਖਰੜਾ ਅਤੇ ਕੀਮਤ ਤਿਆਰ ਕਰੋ।

**Q2 — ਜੋ ਕੰਮ ਕੀਤਾ ਉਸਨੂੰ ਵਿਵਸਥਿਤ ਕਰੋ।** Q1 ਕੋਹੋਰਟ ਦੇ ਅੰਕੜੇ ਕੱਢੋ: ਅਸਲ ਜਵਾਬ ਦਰ, ਅਸਲ ਡੈਮੋ-ਤੋਂ-ਬੰਦ ਦਰ, ਲੀਡ ਸਰੋਤ ਅਤੇ ਗਤੀਵਿਧੀ ਸ਼੍ਰੇਣੀ ਅਨੁਸਾਰ ਅਸਲ CAC। ਭਵਿੱਖ ਦੀਆਂ ਭੇਜਣੀਆਂ ਤੋਂ ਸਭ ਤੋਂ ਮਾੜੇ ਹਿੱਸੇ ਕੱਟੋ; ਬਚੀ ਮਿਹਨਤ ਸਭ ਤੋਂ ਵਧੀਆ 'ਤੇ ਲਗਾਓ। ਪਹਿਲਾ ਸਮਰਪਿਤ SDR ਤਾਂ ਹੀ ਰੱਖੋ ਜੇ ਉੱਭਰਦਾ CAC §3 ਦੀ ਵਸੂਲੀ ਦੇ ਹਿਸਾਬ ਨੂੰ ਵਾਜਬ ਬਣਾਵੇ — ਇਸ ਤੋਂ ਪਹਿਲਾਂ ਨਹੀਂ। ਸਫਲਤਾ ਫੀਸ ਲੀਡ ਇੰਜਣ 10–20 ਅਸਲ ਪ੍ਰਦਾਤਾਵਾਂ ਨੂੰ ਪੇਸ਼ ਕਰੋ ਅਤੇ ਪਹਿਲੇ ਭੁਗਤਾਨ ਵਾਲੇ ਪਾਇਲਟ ਲਓ।

**Q3 — ਯੂਕੇ ਵਧਾਓ, ਅੰਤਰਰਾਸ਼ਟਰੀ ਨੂੰ ਸ਼ਰਤ ਨਾਲ ਬੰਨ੍ਹੋ।** ਯੂਕੇ ਵਿੱਚ ਭੇਜਣ/ਡੈਮੋ ਦੀ ਰਫ਼ਤਾਰ ਵਧਾਉਂਦੇ ਰਹੋ। ਅਸਲ ਡੇਟਾ ਨਾਲ §4 ਦੀਆਂ ਸ਼ਰਤਾਂ ਜਾਂਚੋ: ਕੀ ਯੂਕੇ ਤਬਦੀਲੀ ਲਗਾਤਾਰ ਦੋ ਮਹੀਨੇ 8–12%+ ਰਹੀ? ਜੇ ਹਾਂ, ਤਾਂ £15–25 ਹਜ਼ਾਰ ਦੇ ਸੀਮਤ ਆਇਰਲੈਂਡ ਟੈਸਟ ਨੂੰ ਹਰੀ ਝੰਡੀ ਦਿਓ (ਸਿਰਫ਼ ਲੈਂਡਿੰਗ ਪੰਨਾ + ਇਸ਼ਤਿਹਾਰੀ ਖਰਚ, §4 ਅਨੁਸਾਰ) — ਇਹ ਯੂਕੇ ਫਨਲ ਚਲਾਉਣ ਵਾਲਿਆਂ ਤੋਂ ਇੱਕ ਘੰਟਾ ਵੀ ਨਾ ਲਵੇ। ਜੇ ਨਹੀਂ, ਤਾਂ ਅਜੇ ਸ਼ੁਰੂ ਨਾ ਕਰੋ; ਖੁੱਲ੍ਹ ਕੇ ਕਹੋ ਅਤੇ ਯੂਕੇ 'ਤੇ ਕੰਮ ਜਾਰੀ ਰੱਖੋ।

**Q4 — ਸਾਬਤ ਕਰੋ ਜਾਂ ਬੰਦ ਕਰੋ, ਫਿਰ ਬੋਰਡ ਨੂੰ ਦੱਸੋ।** ਸਾਲ 1 ਨੂੰ ਅਸਲ LTV:CAC, ਅਸਲ churn ਅਤੇ ਅਸਲ CAC ਨਾਲ ਬੰਦ ਕਰੋ — §3 ਦੀਆਂ ਬੁਨਿਆਦੀ ਮੰਨਤਾਂ ਨਾਲ ਨਹੀਂ। ਜੇ ਆਇਰਲੈਂਡ ਟੈਸਟ ਚੱਲਿਆ ਤਾਂ ਉਸਦੀ ਪਹਿਲਾਂ ਦਰਜ ਬੰਦ/ਵਿਸਥਾਰ ਸ਼ਰਤ ਲਾਗੂ ਕਰੋ। ਸਾਲ 1 ਦੇ ਅਸਲ ਅੰਕੜੇ ਇਸ ਰਿਪੋਰਟ ਦੇ £1–3M/£10M ਢਾਂਚੇ ਦੇ ਮੁਕਾਬਲੇ ਬੋਰਡ ਸਾਹਮਣੇ ਰੱਖੋ, ਇਹ ਸਮੇਤ ਕਿ ਹਕੀਕਤ ਯੋਜਨਾ ਤੋਂ ਕਿੱਥੇ ਅਤੇ ਕਿਉਂ ਵੱਖਰੀ ਰਹੀ।

**Q5–Q6 — ਜੋ ਕੰਮ ਕਰ ਰਿਹਾ ਹੈ ਉਸਨੂੰ ਮਜ਼ਬੂਤ ਕਰੋ।** ਬਜਟ ਉਸ ਚੈਨਲ ਦੇ ਪਿੱਛੇ ਲਗਾਓ (ਯੂਕੇ ਸਬਸਕ੍ਰਿਪਸ਼ਨ, ਯੂਕੇ ਸਫਲਤਾ ਫੀਸ ਇੰਜਣ, ਜਾਂ ਆਇਰਲੈਂਡ) ਜੋ ਸਭ ਤੋਂ ਵਧੀਆ LTV:CAC ਦਿਖਾਵੇ, ਉਸ ਦੇ ਪਿੱਛੇ ਨਹੀਂ ਜੋ ਸਭ ਤੋਂ ਦਿਲਚਸਪ ਲੱਗੇ। ਗਾਹਕਾਂ ਦੀ ਗਿਣਤੀ ਤੋਂ ਪਹਿਲਾਂ CS/ਸਹਾਇਤਾ ਬਣਾਓ ਤਾਂ ਜੋ ਆਧਾਰ ਵਧਣ 'ਤੇ churn ਬੁਨਿਆਦੀ 5%/ਮਹੀਨਾ ਤੋਂ ਉੱਪਰ ਨਾ ਜਾਵੇ। §3 ਦੀ ਹਰ ਮੰਨਤ ਨੂੰ ਪੂਰੇ ਸਾਲ ਦੇ ਅਸਲ ਕੋਹੋਰਟ ਡੇਟਾ ਨਾਲ ਦੁਬਾਰਾ ਜਾਂਚੋ ਅਤੇ ਇਸ ਰਿਪੋਰਟ ਦੇ ਅੰਕੜੇ ਉਸ ਅਨੁਸਾਰ ਅੱਪਡੇਟ ਕਰੋ।

**Q7–Q8 — ਅੰਕੜਾ ਹਾਸਲ ਕਰੋ, ਸਿਰਫ਼ ਉਮੀਦ ਨਾ ਰੱਖੋ।** ਯੂਕੇ ਦੇ 5,000–8,000 ਗਾਹਕਾਂ ਦੀ ਸੀਮਾ ਵੱਲ ਵਧੋ (ਜੇ ਆਇਰਲੈਂਡ ਵਧਿਆ ਤਾਂ ਉਸ ਸਮੇਤ)। §3 ਦੇ ਲਾਗਤ ਢਾਂਚੇ ਦੇ ਮੁਕਾਬਲੇ ਪੂਰੀ ਸੰਚਾਲਨ ਖਰਚ ਰਿਪੋਰਟ ਚਲਾਓ — ਸਹਾਇਤਾ, ਵਿਕਰੀ, ਇੰਜੀਨੀਅਰਿੰਗ/G&A — ਤਾਂ ਜੋ ਸ਼ੁੱਧ ਮੁਨਾਫ਼ਾ ਮਾਪਿਆ ਹੋਇਆ ਨਤੀਜਾ ਹੋਵੇ, ਇੱਛਾ ਨਹੀਂ। ਅੰਤਿਮ 2 ਸਾਲਾ ਬੋਰਡ ਰਿਪੋਰਟ ਦਿਓ: ਕੀ ਇਹ £1–3M 'ਤੇ ਪਹੁੰਚਿਆ ਜਿਵੇਂ ਇਸ ਰਿਪੋਰਟ ਨੇ ਅਨੁਮਾਨ ਲਾਇਆ ਸੀ, ਅਤੇ ਜੇ ਨਹੀਂ ਤਾਂ ਬਿਲਕੁਲ ਕਿਉਂ ਨਹੀਂ।`,

    // bn
    `## ৩. ইউনিট অর্থনীতি, সততার সাথে কঠোর পরীক্ষাসহ

### অনুমান, প্রকৃত বিক্রয় পদ্ধতির ভিত্তিতে (আউটবাউন্ড + ডেমো কল, সেলফ-সার্ভিস নয়)

| ইনপুট | বেস কেস | পরিসর |
|---|---|---|
| মিশ্র ARPU | £50–55/মাস | নিচের দিকে ঝুঁকে কারণ বেশিরভাগ লিড একক/ছোট অপারেটর |
| CAC | ~£1,200/গ্রাহক | £800 (দক্ষ) – £2,000 (হতাশাবাদী) — SDR-এর শ্রম খরচ দ্বারা চালিত (~£3,700/মাস/প্রতিনিধি ÷ ~৪.৫ গ্রাহক/প্রতিনিধি/মাস), বিজ্ঞাপন ব্যয় নয় |
| মাসিক churn | ৫%/মাস (~৪৬% বার্ষিক) | ৪–৭%/মাস — ছোট ব্যবসা বড় প্রতিষ্ঠানের চেয়ে কম আনুগত্যশীল: মৌসুমি নগদ প্রবাহ, একক মালিকের ব্যবসা বন্ধ, পরিবর্তনের কম খরচ |
| মোট মার্জিন | ৭০% | ৬৫–৭৫% — ছোট ব্যবসার ঘন সহায়তা এটিকে সেলফ-সার্ভিস SaaS-এর সাধারণ ৮০%+ এর নিচে টানে |
| গ্রাহকের গড় জীবনকাল | ২০ মাস (১ ÷ ৫%) | |

**churn বাড়ানো কাঠামোগত সমস্যা:** কমিশন নেওয়া প্রতিযোগীরা প্রকৃত পরিবর্তন-খরচ তৈরি করে — প্রদানকারী বদলানো মানে পেমেন্ট প্রবাহ নতুন করে সাজানো। {brand}-এর কমিশনবিহীন মডেলে সাধারণ পণ্যপ্রীতির বাইরে এমন বাঁধন নেই, যা churn-কে পরিসরের *উচ্চ* প্রান্তের দিকে ঠেলবে, নিচের দিকে নয়।

### মূল সংখ্যা

| পরিস্থিতি | LTV (মোট মুনাফা) | CAC | LTV:CAC | পুনরুদ্ধার |
|---|---|---|---|---|
| আশাবাদী | £1,608 | £800 | ২.০:১ | ১৬ মাস |
| **বেস কেস** | **£770** | **£1,200** | **০.৬৪:১** | **৩১ মাস** |
| হতাশাবাদী | £386 | £2,000 | ০.১৯:১ | ৭৪ মাস |

সুস্থ SaaS-এ **৩:১ LTV:CAC এবং <১২ মাসের পুনরুদ্ধার** থাকে। এখানে বেস কেস **১:১-এর নিচে, ৩১ মাসের পুনরুদ্ধারসহ যেখানে গ্রাহকের গড় জীবনকাল ২০ মাস** — অর্থাৎ মধ্যক অনুমানে **গড় গ্রাহক চলে যাওয়ার আগে {brand} তার CAC ফেরত নাও পেতে পারে।** এটি এই প্রতিবেদনের সবচেয়ে গুরুত্বপূর্ণ সিদ্ধান্ত: "এটি কত বড় হতে পারে" সঠিক প্রশ্ন হওয়ার আগে, "নতুন গ্রাহক সংগ্রহ আদৌ লাভজনক কি না" তার উত্তর দরকার — আর আজ এটি শুধু অসম্প্রসারিত নয়, পরিমাপই করা হয়নি।

### £১০M মুনাফা থেকে পেছনের হিসাব

- *উদার* ২৫% নিট মার্জিনে (পরিপক্ক SaaS-এর স্তর যা ২ বছরের কোম্পানি ছুঁতে পারবে না): £১০M মুনাফার জন্য **£৪০M ARR → ~৬০,৬০০ গ্রাহক** দরকার — যা *বর্তমান পুরো লিড পাইপলাইন* ১০০% রূপান্তরিত ও শূন্য churn হলেও বেশি।
- এখনও বাড়তে থাকা কোম্পানির জন্য আরও বাস্তবসম্মত ১০% নিট মার্জিনে: **£১০০M ARR → ~১৫০,০০০ গ্রাহক।** ২৪ মাসে ৫০ হাজার লিডের ডেটাবেস থেকে সম্ভব নয়।
- বরং উদারভাবে সামনের দিকে হিসাব: **২৪তম মাসে ১৫,০০০ অর্থ প্রদানকারী গ্রাহক** (আজকের *পুরো* লিড ডেটাবেসের ~৩০%, ০% যোগাযোগ থেকে শুরুর তুলনায় বিশাল সাফল্য) দেয় **£৯.৯M ARR, £৬.৯M মোট মুনাফা**। সেই স্তরে বাস্তবসম্মত পরিচালন ব্যয় বাদ দিন — সহায়তা (~৩০০–৪০০ অ্যাকাউন্টে ১ CS প্রতিনিধি → ৩৮–৫০ FTE, £১.৬–২.২M/বছর), বিক্রয় (১৫–২০ FTE, £০.৭–১.০M/বছর), ইঞ্জিনিয়ারিং/G&A (১৫–২০ FTE, £০.৯–১.২M/বছর), সাথে চলমান CAC নগদ খরচ — এবং **নিট মুনাফা প্রায় £১–৩M-এ নামে, সম্ভবত ব্রেকইভেন। £১০M নয়।**

### সৎ পুনর্বিন্যাস

- **২ বছরে £১০M মুনাফা: পাওয়া কোনো তুলনা বা ইউনিট অর্থনীতির পথেই বিশ্বাসযোগ্য নয়।**
- **২ বছরে £১–৩M মুনাফা, যুক্তরাজ্যে ৫,০০০–৮,০০০ গ্রাহক ও যুক্তিসঙ্গত ইউনিট অর্থনীতিসহ: বিশ্বাসযোগ্য**, এবং এই বিভাগের সবচেয়ে দ্রুত বাড়া প্রকৃত প্রতিযোগীরা শেষ পর্যন্ত যা অর্জন করেছে তার সাথে মেলে।
- **£১০M মুনাফা ৪–৬ বছরের বাস্তবসম্মত ফলাফল**, এবং শুধু যদি দুটি কাঠামোগত সমাধান হয়: (১) churn কমানো — বার্ষিক চুক্তি, উন্নত অনবোর্ডিং, বা পরিবর্তন-খরচও তৈরি করে এমন সামান্য কমিশন লাইন; (২) শুধু সাবস্ক্রিপশন আয়ের ওপর নির্ভর না করে লিড ইঞ্জিন থেকে আয় করা (নিচে দেখুন)।

### ত্রৈমাসিক ভিত্তিতে: £১–৩M পথ আসলে কীভাবে ঘটে

একটি উদাহরণমূলক গতির পরিকল্পনা, উপরের বিশ্বাসযোগ্য ৫,০০০–৮,০০০ গ্রাহক / £১–৩M পরিসর থেকে পেছন দিকে হিসাব করে, £৫০–৫৫/মাস মিশ্র ARPU এবং ৫%/মাস বেস-কেস churn-এ — নতুন পূর্বাভাস নয়, আর ১৫,০০০ গ্রাহকের উদার কেসও নয়। এই প্রতিবেদনে শুধু যে সংখ্যাগুলি *পরিমাপ করা, মডেল করা নয়*, তা উপরের "সোমবার থেকে শুরু"-তে আছে; নিচের সবকিছু কার্যকর করার পরিকল্পনা-লক্ষ্য, যা প্রকৃত কোহর্ট ডেটা এলে প্রতি ত্রৈমাসিকে সংশোধন করতে হবে।

| ত্রৈমাসিক | নিট সক্রিয় গ্রাহক (ক্রমযোজিত) | মোট ARR (উদাহরণ) | কী সত্য হতে হবে |
|---|---|---|---|
| Q1 (মাস ১–৩) | ~৬০০ | ~£০.৪M | ১৯,২৮৪টি খসড়া লিডের প্রথম কোহর্ট সত্যিই পাঠানো ও প্রকৃত ফলাফল পর্যন্ত কাজ করা |
| Q2 (মাস ৪–৬) | ~১,৪০০ | ~£০.৯M | ফানেলে পরিমাপ ব্যবস্থা আছে; প্রথম প্রকৃত রূপান্তর হার ও CAC সংখ্যা আছে |
| Q3 (মাস ৭–৯) | ~২,৩০০ | ~£১.৫M | সেরা সেগমেন্ট চিহ্নিত করে জোর দেওয়া; সবচেয়ে খারাপগুলি বন্ধ |
| Q4 (মাস ১০–১২) | ~৩,৩০০ | ~£২.২M | বছর ১ শেষ: প্রকৃত LTV:CAC ০.৬৪:১ বেস কেসের সাথে তুলনা, বোর্ড রিপোর্ট |
| Q5 (মাস ১৩–১৫) | ~৪,৩০০ | ~£২.৮M | churn কমানোর উপায় (বার্ষিক চুক্তি / কমিশন পাইলট) চালু ও পরিমাপিত |
| Q6 (মাস ১৬–১৮) | ~৫,২০০ | ~£৩.৪M | সহায়তা/CS §৩-এর ~১:৩০০–৪০০ অনুপাতের আগেই বাড়ানো যাতে churn না বাড়ে |
| Q7 (মাস ১৯–২১) | ~৬,০০০ | ~£৪.০M | সাফল্য-ফি ইঞ্জিন শুধু সাবস্ক্রিপশন নয়, পরিমাপযোগ্য আয়ের লাইন দিচ্ছে |
| Q8 (মাস ২২–২৪) | ~৬,৭৫০ | ~£৪.৫M | §৩-এর খরচ কাঠামোর বিপরীতে পূর্ণ ২ বছরের পরিচালন ব্যয় রিপোর্ট; নিট মুনাফা £১–৩M সীমায় আসে বা কারণসহ প্রতিবেদন হালনাগাদ হয় |

প্রতিটি ত্রৈমাসিকে নির্দিষ্টভাবে কী ঘটে — কৌশলের বুলি নয়, বাস্তব পদক্ষেপ:

**Q1 — ফানেল ঠিক করুন ও প্রমাণ করুন।** সারিতে থাকা ১৯,২৮৪টি খসড়ার প্রথম ৫০০টি পাঠান, তারপর উত্তর/ডেমো হার টিকে থাকলে সাপ্তাহিক ব্যাচে পুরো ব্যাকলগে বাড়ান। ৬,৬৪০টি অনিশ্চিত-স্তরের লিডে \`uncertain_verify.mjs\` সমাধান পর্যন্ত চালান। লিডদের উত্তর দেওয়া ও একই দিনে ডেমো বুক করার জন্য একজন নির্দিষ্ট ব্যক্তিকে দায়িত্ব দিন। স্ট্যাটাস ট্র্যাকিং (নতুন → যোগাযোগ করা → ডেমো → জেতা/হারানো) চালু করুন যাতে Q2-এর হাতে প্রকৃত ডেটা থাকে। সাফল্য-ফি শর্তাবলির খসড়া ও মূল্য নির্ধারণ করুন।

**Q2 — যা কাজ করেছে তা পদ্ধতিবদ্ধ করুন।** Q1 কোহর্টের সংখ্যা বের করুন: প্রকৃত উত্তর হার, প্রকৃত ডেমো-থেকে-ক্লোজ হার, লিড উৎস ও কার্যকলাপ বিভাগ অনুযায়ী প্রকৃত CAC। ভবিষ্যৎ পাঠানো থেকে সবচেয়ে খারাপ সেগমেন্ট বাদ দিন; বাঁচানো শ্রম সেরাগুলিতে লাগান। প্রথম নিবেদিত SDR তখনই নিন যদি উদীয়মান CAC §৩-এর পুনরুদ্ধার হিসাবকে বিশ্বাসযোগ্য করে — তার আগে নয়। সাফল্য-ফি লিড ইঞ্জিন ১০–২০ প্রকৃত প্রদানকারীর কাছে উপস্থাপন করুন ও প্রথম অর্থপ্রদত্ত পাইলট নিন।

**Q3 — যুক্তরাজ্য বাড়ান, আন্তর্জাতিককে শর্তাধীন রাখুন।** যুক্তরাজ্যে পাঠানো/ডেমোর গতি বাড়াতে থাকুন। প্রকৃত ডেটায় §৪-এর শর্ত যাচাই করুন: যুক্তরাজ্যের রূপান্তর কি টানা দুই মাস ৮–১২%+ ছিল? হ্যাঁ হলে £১৫–২৫ হাজারের সীমিত আয়ারল্যান্ড পরীক্ষায় সবুজ সংকেত দিন (শুধু ল্যান্ডিং পেজ + বিজ্ঞাপন ব্যয়, §৪ অনুযায়ী) — এটি যুক্তরাজ্যের ফানেল চালানো মানুষদের থেকে এক ঘণ্টাও নেবে না। না হলে এখনই শুরু করবেন না; প্রকাশ্যে বলুন এবং যুক্তরাজ্যে কাজ চালিয়ে যান।

**Q4 — প্রমাণ করুন বা বন্ধ করুন, তারপর বোর্ডকে জানান।** বছর ১ শেষ করুন প্রকৃত LTV:CAC, প্রকৃত churn ও প্রকৃত CAC দিয়ে — §৩-এর বেস-কেস অনুমান দিয়ে নয়। আয়ারল্যান্ড পরীক্ষা চালানো হলে তার আগে-নিবন্ধিত বন্ধ/বড়-করার শর্ত প্রয়োগ করুন। বছর ১-এর প্রকৃত সংখ্যা এই প্রতিবেদনের £১–৩M/£১০M কাঠামোর বিপরীতে বোর্ডে উপস্থাপন করুন, বাস্তবতা পরিকল্পনা থেকে কোথায় ও কেন আলাদা হয়েছে সহ।

**Q5–Q6 — যা কাজ করছে তা আরও জোরদার করুন।** বাজেট সেই চ্যানেলের পেছনে দিন (যুক্তরাজ্য সাবস্ক্রিপশন, যুক্তরাজ্য সাফল্য-ফি ইঞ্জিন বা আয়ারল্যান্ড) যেটি সেরা LTV:CAC দেখায়, যেটি সবচেয়ে উত্তেজনাপূর্ণ মনে হয় সেটির পেছনে নয়। গ্রাহক সংখ্যার আগে CS/সহায়তা গড়ুন যাতে ভিত্তি বাড়লে churn বেস-কেস ৫%/মাস ছাড়িয়ে না যায়। §৩-এর প্রতিটি অনুমান পুরো বছরের প্রকৃত কোহর্ট ডেটার বিপরীতে নতুন করে যাচাই করুন এবং সেই অনুযায়ী এই প্রতিবেদনের সংখ্যা হালনাগাদ করুন।

**Q7–Q8 — সংখ্যাটি অর্জন করুন, শুধু আশা করবেন না।** যুক্তরাজ্যের ৫,০০০–৮,০০০ গ্রাহকের পরিসরের দিকে এগোন (আয়ারল্যান্ড বাড়লে সেটিসহ)। §৩-এর খরচ কাঠামোর বিপরীতে পূর্ণ পরিচালন ব্যয় রিপোর্ট চালান — সহায়তা, বিক্রয়, ইঞ্জিনিয়ারিং/G&A — যাতে নিট মুনাফা পরিমাপিত ফলাফল হয়, আকাঙ্ক্ষা নয়। চূড়ান্ত ২ বছরের বোর্ড রিপোর্ট দিন: এই প্রতিবেদনের পূর্বাভাস অনুযায়ী কি £১–৩M-এ পৌঁছেছে, আর না হলে ঠিক কেন নয়।`,

    // ar
    `## 3. اقتصاديات الوحدة، مُختبَرة بصدق تحت الضغط

### الافتراضات، مبنية على عملية المبيعات الفعلية (تواصل صادر + مكالمات عرض توضيحي، وليس خدمة ذاتية)

| المُدخل | الحالة الأساسية | النطاق |
|---|---|---|
| ARPU المختلط | £50–55/شهر | يميل نحو الحد الأدنى لأن معظم العملاء المحتملين مشغّلون أفراد/صغار |
| CAC | ~£1,200/عميل | £800 (كفؤ) – £2,000 (متشائم) — تحدده تكلفة عمالة SDR (~£3,700/شهر/مندوب ÷ ~4.5 عميل/مندوب/شهر) وليس الإنفاق الإعلاني |
| معدل المغادرة الشهري (churn) | 5%/شهر (~46% سنويًا) | 4–7%/شهر — الشركات الصغيرة أقل التصاقًا من المؤسسات الكبيرة: تدفق نقدي موسمي، إغلاق الأعمال الفردية، تكلفة تحويل منخفضة |
| الهامش الإجمالي | 70% | 65–75% — الدعم المكثف للشركات الصغيرة يخفضه عن 80%+ المعتاد لـ SaaS الخدمة الذاتية |
| متوسط عمر العميل | 20 شهرًا (1 ÷ 5%) | |

**المشكلة الهيكلية التي تفاقم المغادرة:** المنافسون الذين يأخذون عمولة يخلقون تكلفة تحويل حقيقية — فتغيير المزوّد يعني إعادة بناء مسارات الدفع. أما نموذج {brand} بلا عمولة فلا يملك قيدًا كهذا سوى التعلق العادي بالمنتج، مما يدفع المغادرة نحو الطرف *الأعلى* من النطاق لا الأدنى.

### الرقم الرئيسي

| السيناريو | LTV (الربح الإجمالي) | CAC | LTV:CAC | فترة الاسترداد |
|---|---|---|---|---|
| متفائل | £1,608 | £800 | 2.0:1 | 16 شهرًا |
| **الحالة الأساسية** | **£770** | **£1,200** | **0.64:1** | **31 شهرًا** |
| متشائم | £386 | £2,000 | 0.19:1 | 74 شهرًا |

يتمتع SaaS السليم بنسبة **3:1 LTV:CAC مع استرداد <12 شهرًا.** الحالة الأساسية هنا **أقل من 1:1، مع استرداد خلال 31 شهرًا مقابل متوسط عمر عميل 20 شهرًا** — أي أنه وفق الافتراضات المتوسطة **قد لا يسترد {brand} تكلفة الاكتساب قبل أن يغادر العميل المتوسط.** هذه أهم نتيجة في هذا التقرير: قبل أن يصبح «إلى أي حجم يمكن أن ينمو» هو السؤال الصحيح، يلزم جواب عن «هل اكتساب العملاء الجدد مربح أصلًا» — واليوم هو غير مُقاس، وليس فقط غير موسَّع.

### الحساب عكسيًا من ربح 10 ملايين جنيه

- عند هامش صافٍ *سخي* 25% (مستوى SaaS ناضج لن تبلغه شركة عمرها عامان): يتطلب ربح £10M **£40M ARR → ~60,600 عميل** — أكثر من *كامل مسار العملاء المحتملين الحالي* محوَّلًا بنسبة 100% وبلا مغادرة.
- عند هامش صافٍ 10% أكثر واقعية لشركة ما زالت تنمو: **£100M ARR → ~150,000 عميل.** غير معقول من قاعدة 50 ألف عميل محتمل خلال 24 شهرًا.
- وبالحساب للأمام بسخاء بدلًا من ذلك: **15,000 عميل دافع بحلول الشهر 24** (أي ~30% من *كامل* قاعدة العملاء المحتملين اليوم، وهو انتصار كبير مقارنةً بالبدء من 0% تواصل) يعطي **£9.9M ARR، £6.9M ربحًا إجماليًا**. اطرح نفقات تشغيل واقعية بهذا الحجم — الدعم (~مندوب CS واحد لكل 300–400 حساب → 38–50 FTE، £1.6–2.2M/سنة)، المبيعات (15–20 FTE، £0.7–1.0M/سنة)، الهندسة/G&A (15–20 FTE، £0.9–1.2M/سنة)، إضافةً إلى التكلفة النقدية المستمرة لـ CAC — و**يستقر صافي الربح حول £1–3M، وربما عند نقطة التعادل. وليس £10M.**

### إعادة الصياغة الصريحة

- **ربح £10M خلال عامين: غير موثوق وفق أي مقارنة أو أي مسار لاقتصاديات الوحدة وُجد.**
- **ربح £1–3M خلال عامين، مع 5,000–8,000 عميل في المملكة المتحدة واقتصاديات وحدة سليمة: موثوق**، ويتوافق مع ما حدث حين وصل أسرع المنافسين الحقيقيين نموًا في هذه الفئة إلى مكان ما في النهاية.
- **ربح £10M نتيجة واقعية خلال 4–6 سنوات**، وفقط إذا حدث إصلاحان هيكليان: (1) خفض المغادرة — عقود سنوية، تأهيل أفضل، أو بند عمولة متواضع يخلق تكلفة تحويل أيضًا؛ (2) تحقيق دخل من محرك العملاء المحتملين (انظر أدناه) بدلًا من الاعتماد على إيرادات الاشتراك وحدها.

### ربعًا بربع: كيف يتحقق مسار £1–3M فعليًا

خطة إيقاع توضيحية، محسوبة عكسيًا من النطاق الموثوق 5,000–8,000 عميل / £1–3M أعلاه عند ARPU مختلط £50–55/شهر ومغادرة أساسية 5%/شهر — وليست توقعًا جديدًا ولا حالة الـ15,000 عميل السخية. الأرقام الوحيدة في هذا التقرير *المقيسة لا المنمذجة* موجودة في «ابدأ يوم الإثنين» أعلاه؛ وكل ما يلي هدف تخطيطي يُنفَّذ ويُراجَع كل ربع مع وصول بيانات الأفواج الحقيقية.

| الربع | العملاء النشطون الصافون (تراكمي) | ARR الإجمالي (توضيحي) | ما يجب أن يكون صحيحًا |
|---|---|---|---|
| Q1 (الأشهر 1–3) | ~600 | ~£0.4M | أُرسل فعليًا أول فوج من 19,284 مسودة عميل محتمل وأُنجز حتى نتيجة حقيقية |
| Q2 (الأشهر 4–6) | ~1,400 | ~£0.9M | القمع مزوّد بأدوات القياس؛ توجد أول أرقام حقيقية لمعدل التحويل وCAC |
| Q3 (الأشهر 7–9) | ~2,300 | ~£1.5M | تحديد أفضل الشرائح أداءً والتركيز عليها؛ وإيقاف الأسوأ |
| Q4 (الأشهر 10–12) | ~3,300 | ~£2.2M | إغلاق السنة الأولى: LTV:CAC الفعلي مقارنةً بالحالة الأساسية 0.64:1، وتقرير لمجلس الإدارة |
| Q5 (الأشهر 13–15) | ~4,300 | ~£2.8M | أداة خفض المغادرة (عقود سنوية / تجربة عمولة) تعمل وتُقاس |
| Q6 (الأشهر 16–18) | ~5,200 | ~£3.4M | توسيع وظيفة الدعم/CS قبل نسبة ~1:300–400 في §3 حتى لا ترتفع المغادرة |
| Q7 (الأشهر 19–21) | ~6,000 | ~£4.0M | محرك رسوم النجاح يسهم بخط إيرادات قابل للقياس وليس الاشتراكات فقط |
| Q8 (الأشهر 22–24) | ~6,750 | ~£4.5M | تقرير كامل لنفقات التشغيل لعامين مقابل هيكل التكلفة في §3؛ صافي الربح يقع في نطاق £1–3M أو يُحدَّث التقرير بأسباب ذلك |

ماذا يحدث تحديدًا كل ربع — خطوات ملموسة، لا كلام استراتيجي:

**Q1 — أصلح القمع وأثبته.** أرسل أول 500 من المسودات الـ19,284 المنتظرة، ثم وسّع إلى كامل المتراكم على دفعات أسبوعية متى ثبتت معدلات الرد/العرض التوضيحي. شغّل \`uncertain_verify.mjs\` حتى الحسم على الـ6,640 عميلًا محتملًا من الفئة غير المؤكدة. كلّف شخصًا محددًا بالرد على العملاء المحتملين وحجز العروض التوضيحية في اليوم نفسه. أقم تتبع الحالة (جديد → تم التواصل → عرض توضيحي → مكسوب/مفقود) ليملك Q2 بيانات حقيقية. صُغ شروط رسوم النجاح وسعّرها.

**Q2 — نظّم ما نجح.** استخرج أرقام فوج Q1: معدل الرد الحقيقي، ومعدل العرض التوضيحي إلى الإغلاق الحقيقي، وCAC الحقيقي حسب مصدر العميل المحتمل وفئة النشاط. احذف الشرائح الأسوأ أداءً من الإرسالات المستقبلية؛ ووجّه الجهد الموفَّر إلى الأفضل. وظّف أول SDR متفرغ فقط إذا جعل CAC الناشئ حساب الاسترداد في §3 معقولًا — وليس قبل ذلك. اعرض محرك العملاء المحتملين برسوم النجاح على 10–20 مزوّدًا حقيقيًا واحصل على أول التجارب المدفوعة.

**Q3 — وسّع المملكة المتحدة وقيّد الدولي بشروط.** واصل توسيع الإرسال/العروض في المملكة المتحدة. افحص معايير البوابة في §4 على بيانات حقيقية: هل بقي التحويل في المملكة المتحدة عند 8–12%+ لشهرين متتاليين؟ إن كان نعم، فأعطِ الضوء الأخضر لاختبار أيرلندا المحدود بـ£15–25 ألفًا (صفحة هبوط + إنفاق إعلاني فقط، وفق §4) — ولا ينبغي أن يأخذ ساعة واحدة من القائمين على قمع المملكة المتحدة. وإن كان لا، فلا تبدأه بعد؛ أعلن ذلك صراحةً وواصل العمل على المملكة المتحدة.

**Q4 — أثبت أو أوقف، ثم أخبر مجلس الإدارة.** أغلق السنة الأولى بـLTV:CAC الفعلي والمغادرة الفعلية وCAC الفعلي — لا بافتراضات الحالة الأساسية في §3. إذا أُجري اختبار أيرلندا فطبّق بوابة الإيقاف/التوسيع المسجلة مسبقًا. اعرض أرقام السنة الأولى الحقيقية على مجلس الإدارة مقابل إطار £1–3M/£10M في هذا التقرير، بما في ذلك أين انحرف الواقع عن الخطة ولماذا.

**Q5–Q6 — ضاعف ما ينجح.** وجّه الميزانية إلى القناة (اشتراك المملكة المتحدة، أو محرك رسوم النجاح في المملكة المتحدة، أو أيرلندا) التي تُظهر أفضل LTV:CAC، لا إلى التي تبدو الأكثر إثارة. ابنِ الدعم/CS قبل ازدياد عدد العملاء حتى لا تتسلل المغادرة فوق الأساس 5%/شهر مع كبر القاعدة. أعد تقييم كل افتراض في §3 على سنة كاملة من بيانات الأفواج الحقيقية وحدّث أرقام هذا التقرير وفقًا لذلك.

**Q7–Q8 — حقّق الرقم، ولا تكتفِ بالأمل.** اندفع نحو نطاق 5,000–8,000 عميل في المملكة المتحدة (مع أيرلندا إن توسعت). شغّل تقرير نفقات التشغيل الكامل — الدعم والمبيعات والهندسة/G&A — مقابل هيكل التكلفة في §3 ليكون صافي الربح نتيجة مقيسة لا طموحًا. قدّم التقرير النهائي لمجلس الإدارة عن العامين: هل بلغ £1–3M كما توقع هذا التقرير، وإن لم يبلغ فلماذا بالضبط.`,

    // pt
    `## 3. Economia unitária, testada de forma honesta sob stress

### Pressupostos, construídos a partir do processo de vendas real (abordagem outbound + chamadas de demonstração, não self-serve)

| Indicador | Cenário base | Intervalo |
|---|---|---|
| ARPU misto | £50–55/mês | Inclina para o limite inferior porque a maioria dos leads são operadores individuais/pequenos |
| CAC | ~£1.200/cliente | £800 (eficiente) – £2.000 (pessimista) — determinado pelo custo de mão de obra de SDR (~£3.700/mês/comercial ÷ ~4,5 clientes/comercial/mês), não pelo gasto em anúncios |
| Churn mensal | 5%/mês (~46% anualizado) | 4–7%/mês — as PME são menos fiéis do que as grandes empresas: fluxo de caixa sazonal, encerramento de empresários em nome individual, baixo custo de mudança |
| Margem bruta | 70% | 65–75% — o apoio intensivo a PME puxa-a para baixo dos habituais 80%+ do SaaS self-serve |
| Duração média de vida do cliente | 20 meses (1 ÷ 5%) | |

**O problema estrutural que agrava o churn:** os concorrentes com comissão criam um custo real de mudança — trocar de fornecedor implica reconstruir os fluxos de pagamento. O modelo sem comissão do {brand} não tem esse bloqueio para além da fidelização normal ao produto, o que deverá empurrar o churn para o extremo *superior* do intervalo, não para o inferior.

### O número principal

| Cenário | LTV (lucro bruto) | CAC | LTV:CAC | Retorno |
|---|---|---|---|---|
| Otimista | £1.608 | £800 | 2,0:1 | 16 meses |
| **Cenário base** | **£770** | **£1.200** | **0,64:1** | **31 meses** |
| Pessimista | £386 | £2.000 | 0,19:1 | 74 meses |

Um SaaS saudável tem **3:1 LTV:CAC com retorno <12 meses.** O cenário base aqui é **inferior a 1:1, com retorno de 31 meses face a uma duração média de vida do cliente de 20 meses** — ou seja, em pressupostos medianos, **o {brand} pode não recuperar o CAC antes de o cliente médio já ter saído.** Esta é a conclusão mais importante deste relatório: antes de "quão grande pode isto ficar" ser sequer a pergunta certa, é preciso responder "a aquisição de novos clientes é rentável" — e hoje está por medir, não apenas por escalar.

### Cálculo inverso a partir de £10M de lucro

- Com uma margem líquida *generosa* de 25% (território de SaaS maduro que uma empresa com 2 anos não terá atingido): £10M de lucro exige **£40M ARR → ~60.600 clientes** — mais do que *todo o atual funil de leads* convertido a 100%, com zero churn.
- Com uma margem líquida mais realista de 10% para uma empresa ainda em crescimento: **£100M ARR → ~150.000 clientes.** Não plausível a partir de uma base de 50 mil leads em 24 meses.
- Calculando, em vez disso, para a frente e com generosidade: **15.000 clientes pagantes ao mês 24** (já ~30% de *toda* a base atual de leads, uma grande vitória face a um início com 0% contactados) dá **£9,9M ARR, £6,9M de lucro bruto**. Subtraia custos operacionais realistas a essa escala — apoio (~1 comercial de CS por 300–400 contas → 38–50 FTE, £1,6–2,2M/ano), vendas (15–20 FTE, £0,7–1,0M/ano), engenharia/G&A (15–20 FTE, £0,9–1,2M/ano), mais o custo de caixa contínuo do CAC — e **o lucro líquido fica em torno de £1–3M, plausivelmente no ponto de equilíbrio. Não £10M.**

### A reformulação honesta

- **£10M de lucro em 2 anos: não credível em nenhum comparável ou caminho de economia unitária encontrado.**
- **£1–3M de lucro em 2 anos, com 5.000–8.000 clientes no Reino Unido e economia unitária sensata: credível**, e coincide com o que aconteceu quando os comparáveis reais de crescimento mais rápido nesta categoria chegaram, por fim, a algum lado.
- **£10M de lucro é um resultado realista a 4–6 anos**, e só se ocorrerem duas correções estruturais: (1) reduzir o churn — contratos anuais, melhor onboarding, ou uma linha de comissão modesta que também crie custo de mudança; (2) monetizar o motor de leads (ver abaixo) em vez de depender apenas da receita de subscrições.

### Trimestre a trimestre: como o caminho de £1–3M acontece na prática

Um plano de ritmo ilustrativo, calculado de trás para a frente a partir do intervalo credível de 5.000–8.000 clientes / £1–3M acima, com ARPU misto de £50–55/mês e churn base de 5%/mês — não é uma nova previsão, nem o cenário generoso de 15.000 clientes. Os únicos números deste relatório que são *medidos, não modelados* estão em "Começar na segunda-feira" acima; tudo o que se segue é uma meta de planeamento a executar e rever trimestralmente à medida que chegam dados reais de coortes.

| Trimestre | Clientes ativos líquidos (acum.) | ARR bruto (ilustrativo) | O que tem de ser verdade |
|---|---|---|---|
| T1 (mês 1–3) | ~600 | ~£0,4M | Primeira coorte dos 19.284 leads redigidos efetivamente enviada e trabalhada até um resultado real |
| T2 (mês 4–6) | ~1.400 | ~£0,9M | O funil está instrumentado; existem os primeiros números reais de conversão e CAC |
| T3 (mês 7–9) | ~2.300 | ~£1,5M | Melhores segmentos identificados e reforçados; os piores eliminados |
| T4 (mês 10–12) | ~3.300 | ~£2,2M | Fecho do ano 1: LTV:CAC real comparado com o cenário base de 0,64:1, relatório ao conselho |
| T5 (mês 13–15) | ~4.300 | ~£2,8M | Alavanca de redução de churn (contratos anuais / piloto de comissão) ativa e medida |
| T6 (mês 16–18) | ~5.200 | ~£3,4M | Função de apoio/CS ampliada antes do rácio ~1:300–400 do §3, para que o churn não dispare |
| T7 (mês 19–21) | ~6.000 | ~£4,0M | Motor de taxas de sucesso a contribuir com uma linha de receita mensurável, não só subscrições |
| T8 (mês 22–24) | ~6.750 | ~£4,5M | Relatório completo de custos operacionais de 2 anos face à estrutura de custos do §3; o lucro líquido fica na faixa de £1–3M ou o relatório é atualizado com o porquê |

O que acontece concretamente em cada trimestre — ações concretas, não discurso estratégico:

**T1 — corrigir e provar o funil.** Enviar os primeiros 500 dos 19.284 rascunhos em fila, depois escalar para todo o atraso em lotes semanais quando as taxas de resposta/demonstração se mantiverem. Executar \`uncertain_verify.mjs\` até à resolução nos 6.640 leads de nível incerto. Colocar uma pessoa identificada responsável por responder aos leads e marcar demonstrações no mesmo dia. Montar o acompanhamento de estados (novo → contactado → demonstração → ganho/perdido) para que o T2 tenha dados reais. Redigir e precificar os termos da taxa de sucesso.

**T2 — sistematizar o que funcionou.** Extrair os números da coorte do T1: taxa real de resposta, taxa real de demonstração-para-fecho, CAC real por origem de lead e categoria de atividade. Cortar os segmentos de pior desempenho dos envios futuros; aplicar o esforço poupado nos melhores. Contratar o primeiro SDR dedicado apenas se o CAC emergente tornar plausível a conta de retorno do §3 — não antes. Apresentar o motor de leads com taxa de sucesso a 10–20 prestadores reais e obter os primeiros pilotos pagos.

**T3 — escalar o Reino Unido, condicionar o internacional.** Continuar a escalar o envio/demonstrações no Reino Unido. Verificar os critérios da porta do §4 com dados reais: a conversão no Reino Unido manteve-se em 8–12%+ durante dois meses consecutivos? Se sim, dar luz verde ao teste limitado na Irlanda de £15–25 mil (apenas página de destino + gasto em anúncios, conforme o §4) — não deve tirar uma única hora às pessoas que gerem o funil do Reino Unido. Se não, não o iniciar ainda; dizê-lo abertamente e continuar a trabalhar o Reino Unido.

**T4 — provar ou encerrar, depois informar o conselho.** Fechar o ano 1 com o LTV:CAC real, o churn real e o CAC real — não com os pressupostos do cenário base do §3. Se o teste da Irlanda decorreu, aplicar a sua porta de encerramento/escala pré-registada. Apresentar os números reais do ano 1 ao conselho face ao enquadramento de £1–3M/£10M deste relatório, incluindo onde a realidade divergiu do plano e porquê.

**T5–T6 — potenciar o que funciona.** Pôr o orçamento por trás do canal (subscrição no Reino Unido, motor de taxas de sucesso no Reino Unido ou Irlanda) que mostre o melhor LTV:CAC, não do que parece mais entusiasmante. Construir o CS/apoio antes do número de clientes, para que o churn não ultrapasse os 5%/mês do cenário base à medida que a carteira cresce. Reavaliar cada pressuposto do §3 com um ano completo de dados reais de coortes e atualizar em conformidade os números deste relatório.

**T7–T8 — atingir o número, não apenas esperá-lo.** Avançar para o intervalo de 5.000–8.000 clientes no Reino Unido (mais a Irlanda, se escalou). Executar o relatório completo de custos operacionais — apoio, vendas, eng/G&A — face à estrutura de custos do §3, para que o lucro líquido seja um resultado medido e não uma aspiração. Entregar o relatório final de 2 anos ao conselho: chegou aos £1–3M como este relatório previu e, se não, exatamente porquê.`,

    // es
    `## 3. Economía unitaria, sometida honestamente a pruebas de estrés

### Supuestos, construidos a partir del proceso de ventas real (prospección saliente + llamadas de demostración, no autoservicio)

| Indicador | Caso base | Rango |
|---|---|---|
| ARPU combinado | £50–55/mes | Se inclina hacia el extremo bajo porque la mayoría de los contactos son operadores individuales/pequeños |
| CAC | ~£1.200/cliente | £800 (eficiente) – £2.000 (pesimista) — determinado por el coste laboral de SDR (~£3.700/mes/comercial ÷ ~4,5 clientes/comercial/mes), no por el gasto publicitario |
| Churn mensual | 5%/mes (~46% anualizado) | 4–7%/mes — las pymes son menos fieles que las grandes empresas: flujo de caja estacional, cierres de autónomos, bajo coste de cambio |
| Margen bruto | 70% | 65–75% — el soporte intensivo a pymes lo arrastra por debajo del 80%+ habitual del SaaS de autoservicio |
| Vida media del cliente | 20 meses (1 ÷ 5%) | |

**El problema estructural que agrava el churn:** los competidores con comisión crean un coste de cambio real — cambiar de proveedor implica rehacer los flujos de pago. El modelo sin comisión de {brand} no tiene esa atadura más allá del apego normal al producto, lo que debería empujar el churn hacia el extremo *alto* del rango, no hacia el bajo.

### La cifra principal

| Escenario | LTV (beneficio bruto) | CAC | LTV:CAC | Recuperación |
|---|---|---|---|---|
| Optimista | £1.608 | £800 | 2,0:1 | 16 meses |
| **Caso base** | **£770** | **£1.200** | **0,64:1** | **31 meses** |
| Pesimista | £386 | £2.000 | 0,19:1 | 74 meses |

Un SaaS saludable tiene **3:1 LTV:CAC con recuperación <12 meses.** El caso base aquí es **inferior a 1:1, con una recuperación de 31 meses frente a una vida media del cliente de 20 meses** — es decir, con supuestos medios, **{brand} puede no recuperar su CAC antes de que el cliente medio ya se haya dado de baja.** Este es el hallazgo más importante de este informe: antes de que "hasta dónde puede crecer" sea la pregunta correcta, hace falta una respuesta a "¿es rentable siquiera captar clientes nuevos?", y hoy está sin medir, no solo sin escalar.

### Cálculo inverso desde £10M de beneficio

- Con un margen neto *generoso* del 25% (territorio de SaaS maduro que una empresa de 2 años no habrá alcanzado): £10M de beneficio requieren **£40M ARR → ~60.600 clientes** — más que *todo el embudo actual de contactos* convertido al 100%, con cero churn.
- Con un margen neto más realista del 10% para una empresa aún en expansión: **£100M ARR → ~150.000 clientes.** No es plausible con una base de 50 mil contactos en 24 meses.
- Calculando hacia delante, con generosidad: **15.000 clientes de pago al mes 24** (ya ~30% de *toda* la base actual de contactos, un gran logro partiendo de un 0% contactado) da **£9,9M ARR, £6,9M de beneficio bruto**. Reste gastos operativos realistas a esa escala — soporte (~1 comercial de CS por cada 300–400 cuentas → 38–50 FTE, £1,6–2,2M/año), ventas (15–20 FTE, £0,7–1,0M/año), ingeniería/G&A (15–20 FTE, £0,9–1,2M/año), más el coste de caja continuo del CAC — y **el beneficio neto queda en torno a £1–3M, posiblemente en el punto de equilibrio. No £10M.**

### El replanteamiento honesto

- **£10M de beneficio en 2 años: no es creíble con ningún comparable ni ruta de economía unitaria encontrada.**
- **£1–3M de beneficio en 2 años, con 5.000–8.000 clientes en el Reino Unido y una economía unitaria sensata: creíble**, y coincide con lo que ocurrió cuando los comparables reales de más rápido crecimiento en esta categoría acabaron llegando a alguna parte.
- **£10M de beneficio es un resultado realista a 4–6 años**, y solo si ocurren dos correcciones estructurales: (1) reducir el churn — contratos anuales, mejor incorporación o una modesta línea de comisión que además cree coste de cambio; (2) monetizar el motor de contactos (ver abajo) en lugar de depender solo de los ingresos por suscripción.

### Trimestre a trimestre: cómo se materializa realmente el camino de £1–3M

Un plan de ritmo ilustrativo, calculado hacia atrás a partir del rango creíble de 5.000–8.000 clientes / £1–3M anterior, con ARPU combinado de £50–55/mes y churn base del 5%/mes — no es una nueva previsión, ni el caso generoso de 15.000 clientes. Las únicas cifras de este informe que están *medidas, no modeladas* figuran en "Empezar el lunes" más arriba; todo lo que sigue es un objetivo de planificación para ejecutar y revisar cada trimestre a medida que lleguen datos reales de cohortes.

| Trimestre | Clientes activos netos (acum.) | ARR bruto (ilustrativo) | Qué tiene que ser cierto |
|---|---|---|---|
| T1 (mes 1–3) | ~600 | ~£0,4M | La primera cohorte de los 19.284 contactos redactados se envía realmente y se trabaja hasta un resultado real |
| T2 (mes 4–6) | ~1.400 | ~£0,9M | El embudo está instrumentado; existen las primeras cifras reales de conversión y CAC |
| T3 (mes 7–9) | ~2.300 | ~£1,5M | Se identifican y refuerzan los segmentos de mejor rendimiento; se descartan los peores |
| T4 (mes 10–12) | ~3.300 | ~£2,2M | Cierre del año 1: LTV:CAC real comparado con el caso base de 0,64:1, informe al consejo |
| T5 (mes 13–15) | ~4.300 | ~£2,8M | La palanca de reducción de churn (contratos anuales / piloto de comisión) está activa y medida |
| T6 (mes 16–18) | ~5.200 | ~£3,4M | Función de soporte/CS ampliada antes de la ratio ~1:300–400 del §3, para que el churn no se dispare |
| T7 (mes 19–21) | ~6.000 | ~£4,0M | El motor de tarifas por éxito aporta una línea de ingresos medible, no solo suscripciones |
| T8 (mes 22–24) | ~6.750 | ~£4,5M | Informe completo de gastos operativos de 2 años frente a la estructura de costes del §3; el beneficio neto cae en la banda de £1–3M o se actualiza el informe explicando por qué no |

Qué ocurre concretamente cada trimestre — acciones concretas, no jerga estratégica:

**T1 — arreglar y demostrar el embudo.** Enviar los primeros 500 de los 19.284 borradores en cola, y luego escalar a toda la cola pendiente en lotes semanales cuando se mantengan las tasas de respuesta/demo. Ejecutar \`uncertain_verify.mjs\` hasta su resolución sobre los 6.640 contactos de nivel incierto. Poner a una persona concreta a cargo de responder a los contactos y reservar demos el mismo día. Montar el seguimiento de estados (nuevo → contactado → demo → ganado/perdido) para que el T2 tenga datos reales. Redactar y poner precio a las condiciones de la tarifa por éxito.

**T2 — sistematizar lo que funcionó.** Sacar las cifras de la cohorte del T1: tasa real de respuesta, tasa real de demo a cierre, CAC real por origen de contacto y categoría de actividad. Recortar de los envíos futuros los segmentos de peor rendimiento; dedicar el esfuerzo ahorrado a los mejores. Contratar el primer SDR dedicado solo si el CAC emergente hace plausible la cuenta de recuperación del §3 — no antes. Presentar el motor de contactos con tarifa por éxito a 10–20 proveedores reales y conseguir los primeros pilotos de pago.

**T3 — escalar el Reino Unido, condicionar lo internacional.** Seguir escalando el envío/demos en el Reino Unido. Comprobar los criterios de la puerta del §4 con datos reales: ¿se ha mantenido la conversión del Reino Unido en 8–12%+ durante dos meses consecutivos? Si es así, dar luz verde a la prueba limitada en Irlanda de £15–25 mil (solo página de aterrizaje + gasto publicitario, según el §4) — no debe quitar ni una hora a quienes llevan el embudo del Reino Unido. Si no, no empezarla aún; decirlo abiertamente y seguir trabajando el Reino Unido.

**T4 — demostrar o cancelar, y luego informar al consejo.** Cerrar el año 1 con el LTV:CAC real, el churn real y el CAC real — no con los supuestos del caso base del §3. Si la prueba de Irlanda se ejecutó, aplicar su puerta de cierre/escala preregistrada. Presentar al consejo las cifras reales del año 1 frente al marco de £1–3M/£10M de este informe, incluyendo dónde y por qué la realidad se desvió del plan.

**T5–T6 — potenciar lo que funciona.** Poner el presupuesto detrás del canal (suscripción en el Reino Unido, motor de tarifas por éxito en el Reino Unido o Irlanda) que muestre el mejor LTV:CAC, no del que parezca más emocionante. Construir el CS/soporte antes que el número de clientes, para que el churn no supere el 5%/mes del caso base a medida que crece la cartera. Reevaluar cada supuesto del §3 con un año completo de datos reales de cohortes y actualizar en consecuencia las cifras de este informe.

**T7–T8 — alcanzar la cifra, no solo esperarla.** Avanzar hacia el rango de 5.000–8.000 clientes en el Reino Unido (más Irlanda si escaló). Ejecutar el informe completo de gastos operativos — soporte, ventas, ing/G&A — frente a la estructura de costes del §3, para que el beneficio neto sea un resultado medido y no una aspiración. Entregar el informe final de 2 años al consejo: ¿llegó a £1–3M como predijo este informe y, si no, exactamente por qué no?`,

    // fr
    `## 3. Économie unitaire, soumise honnêtement à des tests de résistance

### Hypothèses, construites à partir du processus de vente réel (prospection sortante + appels de démo, pas de libre-service)

| Indicateur | Scénario de base | Fourchette |
|---|---|---|
| ARPU mixte | £50–55/mois | Penche vers le bas car la plupart des prospects sont des opérateurs individuels/petits |
| CAC | ~£1 200/client | £800 (efficace) – £2 000 (pessimiste) — déterminé par le coût de main-d'œuvre des SDR (~£3 700/mois/commercial ÷ ~4,5 clients/commercial/mois), pas par les dépenses publicitaires |
| Churn mensuel | 5 %/mois (~46 % annualisé) | 4–7 %/mois — les PME sont moins fidèles que les grandes entreprises : trésorerie saisonnière, fermetures d'indépendants, faible coût de changement |
| Marge brute | 70 % | 65–75 % — le support intensif des PME la tire sous les 80 %+ habituels du SaaS en libre-service |
| Durée de vie moyenne du client | 20 mois (1 ÷ 5 %) | |

**Le problème structurel qui aggrave le churn :** les concurrents qui prélèvent une commission créent un réel coût de changement — changer de prestataire implique de refaire les flux de paiement. Le modèle sans commission de {brand} n'a pas ce verrouillage au-delà de l'attachement normal au produit, ce qui devrait pousser le churn vers l'extrémité *haute* de la fourchette, pas la basse.

### Le chiffre clé

| Scénario | LTV (marge brute) | CAC | LTV:CAC | Retour sur investissement |
|---|---|---|---|---|
| Optimiste | £1 608 | £800 | 2,0:1 | 16 mois |
| **Scénario de base** | **£770** | **£1 200** | **0,64:1** | **31 mois** |
| Pessimiste | £386 | £2 000 | 0,19:1 | 74 mois |

Un SaaS sain affiche **3:1 LTV:CAC avec un retour <12 mois.** Le scénario de base est ici **inférieur à 1:1, avec un retour de 31 mois contre une durée de vie moyenne du client de 20 mois** — c'est-à-dire que, sur des hypothèses médianes, **{brand} pourrait ne pas récupérer son CAC avant que le client moyen soit déjà parti.** C'est la conclusion la plus importante de ce rapport : avant que « jusqu'où cela peut-il aller » soit la bonne question, il faut répondre à « l'acquisition de nouveaux clients est-elle seulement rentable » — et aujourd'hui, elle n'est pas mesurée, pas seulement pas mise à l'échelle.

### Calcul à rebours à partir de £10M de bénéfice

- Avec une marge nette *généreuse* de 25 % (territoire de SaaS mature qu'une entreprise de 2 ans n'aura pas atteint) : £10M de bénéfice exigent **£40M d'ARR → ~60 600 clients** — plus que *tout le pipeline actuel de prospects* converti à 100 %, sans aucun churn.
- Avec une marge nette plus réaliste de 10 % pour une entreprise encore en croissance : **£100M d'ARR → ~150 000 clients.** Non plausible à partir d'une base de 50 000 prospects en 24 mois.
- En calculant plutôt vers l'avant, généreusement : **15 000 clients payants au mois 24** (déjà ~30 % de *toute* la base actuelle de prospects, une énorme victoire en partant de 0 % de contactés) donnent **£9,9M d'ARR, £6,9M de marge brute**. Déduisez des frais d'exploitation réalistes à cette échelle — support (~1 conseiller CS pour 300–400 comptes → 38–50 ETP, £1,6–2,2M/an), ventes (15–20 ETP, £0,7–1,0M/an), ingénierie/G&A (15–20 ETP, £0,9–1,2M/an), plus le coût de trésorerie continu du CAC — et **le bénéfice net tombe autour de £1–3M, plausiblement à l'équilibre. Pas £10M.**

### Le recadrage honnête

- **£10M de bénéfice en 2 ans : non crédible sur aucun comparable ni aucune trajectoire d'économie unitaire trouvée.**
- **£1–3M de bénéfice en 2 ans, avec 5 000–8 000 clients au Royaume-Uni et une économie unitaire saine : crédible**, et cohérent avec ce qui s'est produit quand les comparables réels à la croissance la plus rapide de cette catégorie ont fini par arriver quelque part.
- **£10M de bénéfice est un résultat réaliste à 4–6 ans**, et seulement si deux correctifs structurels se produisent : (1) réduire le churn — contrats annuels, meilleur accueil client, ou une modeste ligne de commission qui crée aussi un coût de changement ; (2) monétiser le moteur de prospects (voir ci-dessous) plutôt que de compter uniquement sur les revenus d'abonnement.

### Trimestre par trimestre : comment la trajectoire £1–3M se réalise concrètement

Un plan de rythme illustratif, calculé à rebours à partir de la fourchette crédible de 5 000–8 000 clients / £1–3M ci-dessus, avec un ARPU mixte de £50–55/mois et un churn de base de 5 %/mois — ni une nouvelle prévision, ni le scénario généreux de 15 000 clients. Les seuls chiffres de ce rapport qui sont *mesurés, non modélisés* figurent dans « Démarrer lundi » ci-dessus ; tout ce qui suit est un objectif de planification à exécuter et à réviser chaque trimestre à mesure que des données de cohortes réelles arrivent.

| Trimestre | Clients actifs nets (cumul) | ARR brut (illustratif) | Ce qui doit être vrai |
|---|---|---|---|
| T1 (mois 1–3) | ~600 | ~£0,4M | Première cohorte des 19 284 prospects rédigés réellement envoyée et traitée jusqu'à un résultat réel |
| T2 (mois 4–6) | ~1 400 | ~£0,9M | L'entonnoir est instrumenté ; les premiers chiffres réels de conversion et de CAC existent |
| T3 (mois 7–9) | ~2 300 | ~£1,5M | Meilleurs segments identifiés et renforcés ; pires abandonnés |
| T4 (mois 10–12) | ~3 300 | ~£2,2M | Clôture de l'année 1 : LTV:CAC réel comparé au scénario de base de 0,64:1, rapport au conseil |
| T5 (mois 13–15) | ~4 300 | ~£2,8M | Levier de réduction du churn (contrats annuels / pilote de commission) actif et mesuré |
| T6 (mois 16–18) | ~5 200 | ~£3,4M | Fonction support/CS dimensionnée en avance sur le ratio ~1:300–400 du §3, pour que le churn n'explose pas |
| T7 (mois 19–21) | ~6 000 | ~£4,0M | Le moteur de frais de réussite apporte une ligne de revenus mesurable, pas seulement des abonnements |
| T8 (mois 22–24) | ~6 750 | ~£4,5M | Bilan complet des frais d'exploitation sur 2 ans face à la structure de coûts du §3 ; le bénéfice net tombe dans la tranche £1–3M ou le rapport est mis à jour avec les raisons |

Ce qui se passe concrètement à chaque trimestre — des actions concrètes, pas du jargon stratégique :

**T1 — réparer et prouver l'entonnoir.** Envoyer les 500 premiers des 19 284 brouillons en file, puis passer à l'ensemble du retard par lots hebdomadaires une fois que les taux de réponse/démo tiennent. Exécuter \`uncertain_verify.mjs\` jusqu'à résolution sur les 6 640 prospects de niveau incertain. Désigner une personne nommément responsable de répondre aux prospects et de réserver des démos le jour même. Mettre en place le suivi des statuts (nouveau → contacté → démo → gagné/perdu) pour que le T2 dispose de données réelles. Rédiger et chiffrer les conditions des frais de réussite.

**T2 — systématiser ce qui a fonctionné.** Extraire les chiffres de la cohorte du T1 : taux de réponse réel, taux réel de démo à signature, CAC réel par source de prospect et catégorie d'activité. Retirer les segments les moins performants des envois futurs ; réinvestir l'effort économisé dans les meilleurs. Recruter le premier SDR dédié seulement si le CAC émergent rend plausible le calcul de retour du §3 — pas avant. Présenter le moteur de prospects à frais de réussite à 10–20 prestataires réels et obtenir les premiers pilotes payants.

**T3 — monter en puissance au Royaume-Uni, conditionner l'international.** Continuer à monter en puissance les envois/démos au Royaume-Uni. Vérifier les critères de la porte du §4 sur des données réelles : la conversion au Royaume-Uni s'est-elle maintenue à 8–12 %+ pendant deux mois consécutifs ? Si oui, donner le feu vert au test plafonné en Irlande de £15–25 k (page de destination + dépenses publicitaires uniquement, selon le §4) — il ne doit pas prendre une seule heure aux personnes qui pilotent l'entonnoir britannique. Sinon, ne pas le lancer ; le dire ouvertement et continuer à travailler le Royaume-Uni.

**T4 — prouver ou arrêter, puis informer le conseil.** Clôturer l'année 1 avec le LTV:CAC réel, le churn réel et le CAC réel — pas les hypothèses du scénario de base du §3. Si le test irlandais a eu lieu, appliquer sa porte d'arrêt/extension préenregistrée. Présenter au conseil les chiffres réels de l'année 1 face au cadrage £1–3M/£10M de ce rapport, y compris là où la réalité s'est écartée du plan et pourquoi.

**T5–T6 — amplifier ce qui marche.** Mettre le budget derrière le canal (abonnement au Royaume-Uni, moteur de frais de réussite au Royaume-Uni ou Irlande) qui affiche le meilleur LTV:CAC, pas celui qui paraît le plus excitant. Développer le CS/support avant le nombre de clients pour que le churn ne dépasse pas les 5 %/mois du scénario de base à mesure que le portefeuille grossit. Réévaluer chaque hypothèse du §3 sur une année complète de données de cohortes réelles et mettre à jour les chiffres de ce rapport en conséquence.

**T7–T8 — atteindre le chiffre, ne pas seulement l'espérer.** Tendre vers la fourchette de 5 000–8 000 clients au Royaume-Uni (plus l'Irlande si elle a pris). Exécuter le bilan complet des frais d'exploitation — support, ventes, ingénierie/G&A — face à la structure de coûts du §3 afin que le bénéfice net soit un résultat mesuré et non une aspiration. Livrer le bilan final de 2 ans au conseil : a-t-on atteint £1–3M comme ce rapport l'avait prédit et, sinon, exactement pourquoi.`,

    // cy
    `## 3. Economeg uned, wedi'i phrofi dan straen yn onest

### Rhagdybiaethau, wedi'u hadeiladu o'r broses werthu wirioneddol (estyn allan + galwadau arddangos, nid hunanwasanaeth)

| Mewnbwn | Achos sylfaenol | Amrediad |
|---|---|---|
| ARPU cymysg | £50–55/mis | Yn gogwyddo at y pen isel oherwydd bod y rhan fwyaf o'r lidiau'n weithredwyr unigol/bach |
| CAC | ~£1,200/cwsmer | £800 (effeithlon) – £2,000 (besimistaidd) — wedi'i yrru gan gost llafur SDR (~£3,700/mis/cynrychiolydd ÷ ~4.5 cwsmer/cynrychiolydd/mis), nid gwariant hysbysebu |
| Colli misol (churn) | 5%/mis (~46% blynyddol) | 4–7%/mis — mae busnesau bach yn llai gludiog na mentrau mawr: llif arian tymhorol, cau unig fasnachwyr, cost newid isel |
| Elw gros | 70% | 65–75% — mae cymorth dwys i fusnesau bach yn ei dynnu islaw'r 80%+ arferol ar gyfer SaaS hunanwasanaeth |
| Oes cwsmer gyfartalog | 20 mis (1 ÷ 5%) | |

**Y broblem strwythurol sy'n gwaethygu colli cwsmeriaid:** mae cystadleuwyr sydd â chyfradd cymryd yn creu cost newid go iawn — mae symud darparwyr yn golygu ailadeiladu llifoedd talu. Nid oes gan fodel dim cyfradd cymryd {brand} glo o'r fath y tu hwnt i lynu arferol wrth y cynnyrch, a ddylai wthio colli cwsmeriaid tuag at ben *uwch* yr amrediad, nid yr isaf.

### Y ffigur pennawd

| Senario | LTV (elw gros) | CAC | LTV:CAC | Ad-dalu |
|---|---|---|---|---|
| Optimistaidd | £1,608 | £800 | 2.0:1 | 16 mis |
| **Achos sylfaenol** | **£770** | **£1,200** | **0.64:1** | **31 mis** |
| Pesimistaidd | £386 | £2,000 | 0.19:1 | 74 mis |

Mae SaaS iach yn **3:1 LTV:CAC gydag ad-daliad <12 mis.** Mae'r achos sylfaenol yma **o dan 1:1, gydag ad-daliad 31 mis yn erbyn oes cwsmer gyfartalog o 20 mis** — sy'n golygu, ar ragdybiaethau canolrif, **efallai na fydd {brand} yn adennill ei CAC cyn i'r cwsmer cyfartalog adael eisoes.** Dyma'r canfyddiad pwysicaf yn yr adroddiad hwn: cyn i "pa mor fawr all hyn fynd" fod y cwestiwn cywir, mae angen ateb i "a yw caffael cwsmeriaid newydd yn broffidiol o gwbl" — a heddiw nid yw wedi'i fesur, nid yn unig heb ei raddio.

### Gweithio am yn ôl o elw £10M

- Ar ymyl net *hael* o 25% (tiriogaeth SaaS aeddfed na fydd cwmni dwy flwydd oed wedi'i chyrraedd): mae angen **£40M ARR → ~60,600 o gwsmeriaid** ar gyfer £10M o elw — mwy na'r *biblinell lidiau gyfan bresennol* wedi'i throsi 100%, heb golli neb.
- Ar ymyl net mwy realistig o 10% ar gyfer cwmni sy'n dal i ehangu: **£100M ARR → ~150,000 o gwsmeriaid.** Ddim yn gredadwy o gronfa ddata 50 mil o lidiau mewn 24 mis.
- Gan weithio ymlaen yn lle hynny, yn hael: mae **15,000 o gwsmeriaid sy'n talu erbyn mis 24** (eisoes ~30% o *holl* gronfa ddata lidiau heddiw, buddugoliaeth enfawr o gymharu â man cychwyn 0% wedi cysylltu) yn rhoi **£9.9M ARR, £6.9M o elw gros**. Tynnwch gostau gweithredu realistig ar y raddfa honno — cymorth (~1 cynrychiolydd CS fesul 300–400 o gyfrifon → 38–50 FTE, £1.6–2.2M/blwyddyn), gwerthiant (15–20 FTE, £0.7–1.0M/blwyddyn), peirianneg/G&A (15–20 FTE, £0.9–1.2M/blwyddyn), ynghyd â chost arian parod barhaus CAC — ac **mae elw net yn glanio tua £1–3M, yn gredadwy ar y pwynt adennill costau. Nid £10M.**

### Yr ailfframio gonest

- **£10M o elw mewn 2 flynedd: ddim yn gredadwy ar unrhyw gymar na llwybr economeg uned a ganfuwyd.**
- **£1–3M o elw mewn 2 flynedd, gyda 5,000–8,000 o gwsmeriaid yn y DU ac economeg uned synhwyrol: credadwy**, ac yn cyfateb i'r hyn a ddigwyddodd pan gyrhaeddodd y cymheiriaid go iawn a dyfodd gyflymaf yn y categori hwn rywle yn y pen draw.
- **Mae £10M o elw yn ganlyniad realistig 4–6 blynedd**, a dim ond os bydd dau ateb strwythurol yn digwydd: (1) lleihau colli cwsmeriaid — contractau blynyddol, ymsefydlu gwell, neu linell cyfradd cymryd gymedrol sydd hefyd yn creu cost newid; (2) ariannu'r injan lidiau (gweler isod) yn hytrach na dibynnu ar refeniw tanysgrifiad yn unig.

### Chwarter wrth chwarter: sut mae'r llwybr £1–3M yn digwydd mewn gwirionedd

Cynllun cyflymder darluniadol, wedi'i gyfrifo am yn ôl o'r amrediad credadwy 5,000–8,000 o gwsmeriaid / £1–3M uchod ar ARPU cymysg £50–55/mis a cholli sylfaenol 5%/mis — nid rhagolwg newydd, ac nid yr achos hael o 15,000 o gwsmeriaid. Yr unig rifau yn yr adroddiad hwn sydd wedi'u *mesur, nid eu modelu* yw'r rhai yn "Dechrau dydd Llun" uchod; mae popeth isod yn darged cynllunio i'w weithredu a'i ddiwygio'n chwarterol wrth i ddata cohort go iawn ddod i law.

| Chwarter | Cwsmeriaid gweithredol net (cyfun.) | ARR gros (darluniadol) | Beth sy'n rhaid bod yn wir |
|---|---|---|---|
| Q1 (mis 1–3) | ~600 | ~£0.4M | Cohort cyntaf o'r 19,284 lid drafft wedi'u hanfon a'u gweithio hyd at ganlyniad go iawn |
| Q2 (mis 4–6) | ~1,400 | ~£0.9M | Mae'r twndis wedi'i offeru; mae'r ffigurau cyfradd trosi a CAC go iawn cyntaf yn bodoli |
| Q3 (mis 7–9) | ~2,300 | ~£1.5M | Segmentau sy'n perfformio orau wedi'u nodi a'u cryfhau; y gwaethaf wedi'u dileu |
| Q4 (mis 10–12) | ~3,300 | ~£2.2M | Cau Blwyddyn 1: LTV:CAC gwirioneddol o'i gymharu â'r achos sylfaenol 0.64:1, adroddiad i'r bwrdd |
| Q5 (mis 13–15) | ~4,300 | ~£2.8M | Lifer lleihau colli cwsmeriaid (contractau blynyddol / peilot cyfradd cymryd) yn fyw ac wedi'i fesur |
| Q6 (mis 16–18) | ~5,200 | ~£3.4M | Swyddogaeth cymorth/CS wedi'i graddio o flaen y gymhareb ~1:300–400 yn §3, fel nad yw colli cwsmeriaid yn codi'n sydyn |
| Q7 (mis 19–21) | ~6,000 | ~£4.0M | Injan ffi llwyddiant yn cyfrannu llinell refeniw fesuradwy, nid tanysgrifiadau yn unig |
| Q8 (mis 22–24) | ~6,750 | ~£4.5M | Adroddiad llawn ar gostau gweithredu 2 flynedd yn erbyn strwythur costau §3; mae elw net yn glanio yn y band £1–3M neu caiff yr adroddiad ei ddiweddaru gyda'r rheswm pam lai |

Beth yn benodol sy'n digwydd bob chwarter — symudiadau concrid, nid siarad strategaeth:

**Q1 — trwsio a phrofi'r twndis.** Anfonwch y 500 cyntaf o'r 19,284 drafft yn y ciw, yna graddiwch i'r ôl-groniad llawn mewn sypiau wythnosol unwaith y bydd cyfraddau ateb/arddangos yn dal. Rhedwch \`uncertain_verify.mjs\` hyd at benderfyniad ar y 6,640 lid haen ansicr. Rhowch un person a enwir yng ngofal ateb lidiau a threfnu arddangosiadau ar yr un diwrnod. Sefydlwch olrhain statws (newydd → cysylltwyd → arddangosiad → enillwyd/collwyd) fel bod gan Q2 ddata go iawn. Drafftiwch a phrisiwch y daflen delerau ffi llwyddiant.

**Q2 — systemeiddio'r hyn a weithiodd.** Tynnwch ffigurau cohort Q1: cyfradd ateb go iawn, cyfradd arddangosiad-i-gau go iawn, CAC go iawn yn ôl ffynhonnell lid a chategori gweithgaredd. Torrwch y segmentau sy'n perfformio waethaf o anfoniadau yn y dyfodol; rhowch yr ymdrech a arbedwyd i'r rhai gorau. Llogwch yr SDR pwrpasol cyntaf dim ond os yw'r CAC sy'n dod i'r amlwg yn gwneud mathemateg ad-dalu §3 yn gredadwy — nid cyn hynny. Cyflwynwch yr injan lidiau ffi llwyddiant i 10–20 o ddarparwyr go iawn a chael y peilotiaid taledig cyntaf.

**Q3 — graddio'r DU, rhoi gât ar rywbeth rhyngwladol.** Daliwch ati i raddio'r anfon/arddangos yn y DU. Gwiriwch feini prawf gât §4 yn erbyn data go iawn: a yw trosi'r DU wedi dal ar 8–12%+ am ddau fis yn olynol? Os felly, rhowch olau gwyrdd i'r prawf Iwerddon cyfyngedig £15–25k (tudalen lanio + gwariant hysbysebu yn unig, yn ôl §4) — ni ddylai dynnu awr sengl oddi ar y bobl sy'n rhedeg twndis y DU. Os na, peidiwch â'i ddechrau eto; dywedwch hynny'n gyhoeddus a daliwch ati i weithio ar y DU.

**Q4 — profi neu ladd, yna dweud wrth y bwrdd.** Caewch Flwyddyn 1 gyda'r LTV:CAC gwirioneddol, y colli gwirioneddol a'r CAC gwirioneddol — nid rhagdybiaethau'r achos sylfaenol yn §3. Os rhedwyd y prawf Iwerddon, cymhwyswch ei gât lladd/graddio a gofrestrwyd ymlaen llaw. Cyflwynwch ffigurau go iawn Blwyddyn 1 yn erbyn fframio £1–3M/£10M yr adroddiad hwn ar lefel y bwrdd, gan gynnwys lle gwyrodd realiti oddi wrth y cynllun a pham.

**Q5–Q6 — cyfuno'r hyn sy'n gweithio.** Rhowch y gyllideb y tu ôl i ba bynnag sianel (tanysgrifiad y DU, injan ffi llwyddiant y DU, neu Iwerddon) sy'n dangos yr LTV:CAC gorau, nid yr un sy'n teimlo'n fwyaf cyffrous. Adeiladwch CS/cymorth o flaen nifer y cwsmeriaid fel nad yw colli cwsmeriaid yn ymgripio heibio'r 5%/mis sylfaenol wrth i'r llyfr dyfu. Ailwerthuswch bob rhagdybiaeth yn §3 yn erbyn blwyddyn lawn o ddata cohort go iawn a diweddarwch y rhifau yn yr adroddiad hwn yn unol â hynny.

**Q7–Q8 — glanio'r rhif, nid gobeithio amdano yn unig.** Gwthiwch tuag at amrediad 5,000–8,000 o gwsmeriaid y DU (ynghyd ag Iwerddon os graddiodd). Rhedwch yr adroddiad costau gweithredu llawn — cymorth, gwerthiant, peirianneg/G&A — yn erbyn strwythur costau §3 fel bod y rhif elw net yn ganlyniad wedi'i fesur, nid dyhead. Cyflwynwch adroddiad terfynol y bwrdd ar gyfer 2 flynedd: a laniodd ar £1–3M fel y rhagwelodd yr adroddiad hwn, ac os na, yn union pam lai.`,
  ],
};
