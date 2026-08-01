/* sentinelpay i18n.
   the site is static html, so instead of templating every page we key translations
   off the english source text and swap matching text nodes / placeholders at load.
   adding a string later means one dictionary entry, no markup changes.
   choice is stored in a cookie scoped to .sentinelpay.org so it follows the visitor
   onto blog.sentinelpay.org too, with localStorage as a same-origin fallback. */
(function () {
    var LANGS = { en: 'english', hr: 'hrvatski', de: 'deutsch' };
    var COOKIE = 'sp-lang';

    var T = {
        hr: {
            /* nav: solutions */
            "solutions": "rješenja",
            "everything you need to screen crypto risk": "sve što vam treba za procjenu kripto rizika",
            "real-time risk analytics across the full compliance lifecycle.": "analitika rizika u stvarnom vremenu kroz cijeli ciklus usklađenosti.",
            "explore all solutions": "istraži sva rješenja",
            "crypto compliance": "kripto usklađenost",
            "risk management for every stage of the lifecycle": "upravljanje rizikom u svakoj fazi ciklusa",
            "transaction screening": "provjera transakcija",
            "every transaction scored before funds settle": "svaka transakcija ocijenjena prije nego sredstva sjednu",
            "wallet investigations": "istrage novčanika",
            "from suspicion to attribution with on-demand scans": "od sumnje do identifikacije uz skeniranje na zahtjev",
            "threat intelligence": "obavještajni podaci o prijetnjama",
            "emerging typologies with flag-level context": "nove tipologije s kontekstom po oznaci",
            "real-time alerting": "upozorenja u stvarnom vremenu",
            "instant email alerts with score and flags": "trenutna e-mail upozorenja sa ocjenom i oznakama",
            "pricing": "cijene",
            "talk to us. plans shaped around your volume": "javite nam se. planovi prilagođeni vašem volumenu",
            "try a live wallet scan": "isprobaj skeniranje novčanika uživo",
            "score any wallet against known threats in seconds.": "ocijenite bilo koji novčanik prema poznatim prijetnjama u sekundi.",
            "learn more": "saznaj više",
            /* nav: industries */
            "industries": "industrije",
            "built for every team moving digital assets": "izgrađeno za svaki tim koji pomiče digitalnu imovinu",
            "from banks to exchanges to law enforcement. one platform.": "od banaka i mjenjačnica do tijela progona. jedna platforma.",
            "see who it's for": "vidi za koga je",
            "financial institutions": "financijske institucije",
            "onboard and monitor without new exposure": "onboarding i nadzor bez nove izloženosti",
            "centralized exchanges": "centralizirane mjenjačnice",
            "compliance at scale with fewer false positives": "usklađenost u velikom obimu uz manje lažnih uzbuna",
            "payment services": "platne usluge",
            "crypto acceptance with real-time screening": "prihvat kriptovaluta uz provjeru u stvarnom vremenu",
            "stablecoin & token issuers": "izdavatelji stablecoina i tokena",
            "protect your brand and ecosystem trust": "zaštitite svoj brend i povjerenje u ekosustav",
            "network operators": "operateri mreža",
            "a safer network for every participant": "sigurnija mreža za svakog sudionika",
            "law enforcement & regulators": "tijela progona i regulatori",
            "faster investigations, defensible decisions": "brže istrage, obranjive odluke",
            "not sure where you fit?": "niste sigurni gdje spadate?",
            "talk to our team and we'll map it to your workflow.": "javite se našem timu i prilagodit ćemo to vašem tijeku rada.",
            /* nav: platform */
            "platform": "platforma",
            "one integration, total coverage": "jedna integracija, potpuna pokrivenost",
            "connect an rpc endpoint and monitor 10+ chains instantly.": "spojite rpc endpoint i odmah nadzirite 10+ lanaca.",
            "read the docs": "pročitaj dokumentaciju",
            "documentation": "dokumentacija",
            "everything you need to integrate and operate": "sve što vam treba za integraciju i rad",
            "api reference": "api referenca",
            "endpoints, payloads and examples": "endpointi, payloadi i primjeri",
            "quickstart": "brzi početak",
            "up and running in minutes": "spremni za rad u nekoliko minuta",
            "risk scoring": "ocjenjivanje rizika",
            "explainable scores built from named heuristics": "objašnjive ocjene građene na imenovanim heuristikama",
            "network coverage": "pokrivenost mreža",
            "10+ chains from a single integration": "10+ lanaca iz jedne integracije",
            "configurable thresholds": "podesivi pragovi",
            "tune risk rules to your appetite": "podesite pravila rizika prema svom apetitu",
            "build in minutes": "izgradite u nekoliko minuta",
            "clean json api. no sdk, no infrastructure to run.": "čist json api. bez sdk-a, bez infrastrukture za održavanje.",
            /* nav: resources */
            "resources": "resursi",
            "learn the language of crypto risk": "naučite jezik kripto rizika",
            "analysis, guides and updates from the frontline of blockchain risk.": "analize, vodiči i novosti s prve linije blockchain rizika.",
            "visit the blog": "posjeti blog",
            "blog": "blog",
            "expert analysis and regulatory updates": "stručne analize i regulatorne novosti",
            "reports & guides": "izvještaji i vodiči",
            "practical guidance for compliance teams": "praktične smjernice za compliance timove",
            "product docs and how-tos": "dokumentacija proizvoda i upute",
            "newsletter": "newsletter",
            "the latest insights in your inbox": "najnovije spoznaje u vašem inboxu",
            "crypto glossary": "kripto rječnik",
            "the language of digital asset risk": "jezik rizika digitalne imovine",
            "help center": "centar za pomoć",
            "answers and troubleshooting": "odgovori i rješavanje problema",
            "the latest insights": "najnovije spoznaje",
            "regulatory updates and new typologies in your inbox.": "regulatorne novosti i nove tipologije u vašem inboxu.",
            /* nav: company */
            "company": "tvrtka",
            "the team securing crypto payments": "tim koji osigurava kripto plaćanja",
            "who we are, how we protect you, and how to reach us.": "tko smo, kako vas štitimo i kako do nas.",
            "get in touch": "javite nam se",
            "who we are": "tko smo",
            "the team behind sentinelpay": "tim iza sentinelpaya",
            "security": "sigurnost",
            "how we protect your data": "kako štitimo vaše podatke",
            "careers": "poslovi",
            "help build safer digital asset rails": "pomozite izgraditi sigurnije tračnice za digitalnu imovinu",
            "contact us": "kontaktirajte nas",
            "talk to our team": "razgovarajte s našim timom",
            "partner program": "partnerski program",
            "grow with us": "rastite s nama",
            "join the team": "pridruži se timu",
            "help build safer rails for digital asset payments.": "pomozite izgraditi sigurnije tračnice za plaćanja digitalnom imovinom.",
            /* nav buttons + chat */
            "log in": "prijava",
            "get started": "kreni",
            "live chat": "live chat",
            "chat now": "otvori chat",
            /* hero */
            "see risk coming.": "vidi rizik na vrijeme.",
            "stop it before it settles.": "zaustavi ga prije nego sjedne.",
            "sentinelpay screens every transaction on 10+ blockchains in real time. dirty money gets flagged, your team gets alerted, and bad funds never touch your business.": "sentinelpay provjerava svaku transakciju na 10+ blockchaina u stvarnom vremenu. prljav novac se označi, vaš tim dobije upozorenje, a loša sredstva nikad ne dotaknu vaše poslovanje.",
            "book a demo": "dogovori demo",
            "start free trial": "započni besplatno",
            /* roles */
            "built for you": "izgrađeno za vas",
            "one platform": "jedna platforma",
            "for every team": "za svaki tim",
            "that touches crypto risk": "koji dotiče kripto rizik",
            "sentinelpay for": "sentinelpay za",
            "decentralized finance": "decentralizirane financije",
            "law enforcement": "tijela progona",
            "regulators": "regulatori",
            "payment services & fintechs": "platne usluge i fintechovi",
            /* stats */
            "dirty money never sleeps.": "prljav novac nikad ne spava.",
            "neither do we. we watch every chain, every second, so nothing slips past you.": "ni mi. pratimo svaki lanac, svake sekunde, da vam ništa ne promakne.",
            "blockchain networks covered": "pokrivenih blockchain mreža",
            "from detection to alert": "od detekcije do upozorenja",
            "monitoring that never clocks out": "nadzor koji nikad ne odlazi s posla",
            "uptime, measured not promised": "dostupnost, mjerena a ne obećana",
            /* guides */
            "guides & playbooks": "vodiči i priručnici",
            "move faster": "budite brži",
            "when the": "kad se",
            "rules change": "pravila mijenjaju",
            "regulators rewrite the playbook every quarter. our guides tell you what changed, what it costs you, and what to do about it before your next audit asks.": "regulatori prepisuju pravila svako tromjesečje. naši vodiči govore što se promijenilo, koliko vas to košta i što učiniti prije nego što idući audit pita.",
            "stay one step ahead of crypto crime. every playbook and guide, in one hub.": "budite korak ispred kripto kriminala. svi priručnici i vodiči na jednom mjestu.",
            "explore the hub": "istraži centar",
            "free compliance guide": "besplatan vodič za usklađenost",
            "the crypto risk playbook": "priručnik za kripto rizik",
            "48 pages": "48 stranica",
            "read now": "čitaj odmah",
            /* solutions grid */
            "nine tools, one platform": "devet alata, jedna platforma",
            "everything you need": "sve što vam treba",
            "to see,": "da vidite,",
            "score and stop crypto risk": "ocijenite i zaustavite kripto rizik",
            "data & apis": "podaci i api-ji",
            "network integrations": "integracije mreža",
            "education & training": "edukacija i obuka",
            /* blog section */
            "from the blog": "s bloga",
            "the latest": "najnovije",
            "typologies, takedowns": "tipologije, akcije",
            "and rule changes": "i promjene pravila",
            /* demo form */
            "ready to take a": "spremni za",
            "closer look?": "pobliži pogled?",
            "tell us about yourself": "recite nam nešto o sebi",
            "first name": "ime",
            "last name": "prezime",
            "job title": "radno mjesto",
            "work email": "poslovni e-mail",
            "registered company name": "registrirani naziv tvrtke",
            "company website": "web stranica tvrtke",
            "only domains that match your work email will be contacted.": "kontaktiramo samo domene koje odgovaraju vašem poslovnom e-mailu.",
            "which industry": "koja industrija",
            "select industry…": "odaberite industriju…",
            "where are you based": "gdje se nalazite",
            "select country…": "odaberite državu…",
            "company size": "veličina tvrtke",
            "employees…": "zaposlenika…",
            "wallets": "novčanici",
            "expected volume…": "očekivani volumen…",
            "which solutions interest you": "koja vas rješenja zanimaju",
            "(select all that apply)": "(odaberite sve što vrijedi)",
            "risk scoring & kyt": "ocjenjivanje rizika i kyt",
            "travel rule / vasp": "travel rule / vasp",
            "stablecoin monitoring": "nadzor stablecoina",
            "api & data feeds": "api i podatkovni feedovi",
            "reporting & audit": "izvještavanje i revizija",
            "not sure yet": "još nisam siguran",
            "anything specific you want to solve?": "želite li riješiti nešto konkretno?",
            "i agree to be contacted about sentinelpay.": "pristajem da me kontaktirate u vezi sentinelpaya.",
            "back": "natrag",
            "next": "dalje",
            "request a demo": "zatraži demo",
            "request received": "zahtjev zaprimljen",
            "your request just landed on our": "vaš zahtjev upravo je sletio na stol našeg",
            "chief compliance officer's": "glavnog compliance direktora",
            "Other": "ostalo",
            /* footer */
            "real-time blockchain monitoring for crypto payment operators.": "nadzor blockchaina u stvarnom vremenu za kripto platne operatere.",
            "api documentation": "api dokumentacija",
            "coverage": "pokrivenost",
            "scalability": "skalabilnost",
            "configurability": "podesivost",
            "privacy policy": "pravila privatnosti",
            "terms of service": "uvjeti korištenja",
            "© 2026 sentinelpay. all rights reserved.": "© 2026 sentinelpay. sva prava pridržana.",
            "how we handle your data": "kako postupamo s vašim podacima",
            /* book a demo */
            "with an expert": "sa stručnjakom",
            "see how sentinelpay screens every wallet and transaction that touches your business. in your demo, we'll walk you through how to:": "pogledajte kako sentinelpay provjerava svaki novčanik i transakciju koji dotaknu vaše poslovanje. na demu ćemo vam pokazati kako:",
            "monitor crypto wallets and transactions in real time": "nadzirati kripto novčanike i transakcije u stvarnom vremenu",
            "investigate complex, multi-chain movements in one view": "istražiti složena kretanja kroz više lanaca na jednom mjestu",
            "stop financial crime before funds settle, not after": "zaustaviti financijski kriminal prije nego sredstva sjednu, a ne poslije",
            "resolve cases faster with clear, explainable risk scores": "brže rješavati slučajeve uz jasne, objašnjive ocjene rizika",
            "fill out the form and our team will be in touch shortly to walk you through the platform and how it fits your workflow.": "ispunite obrazac i naš tim javit će vam se ubrzo da vas provede kroz platformu i kako se uklapa u vaš tijek rada.",
            "javascript required": "potreban javascript",
            "sentinelpay requires javascript to initialize secure sessions.": "sentinelpayu je potreban javascript za pokretanje sigurnih sesija."
        },
        de: {
            "solutions": "lösungen",
            "everything you need to screen crypto risk": "alles, was sie zur prüfung von krypto-risiken brauchen",
            "real-time risk analytics across the full compliance lifecycle.": "echtzeit-risikoanalyse über den gesamten compliance-lebenszyklus.",
            "explore all solutions": "alle lösungen ansehen",
            "crypto compliance": "krypto-compliance",
            "risk management for every stage of the lifecycle": "risikomanagement in jeder phase des lebenszyklus",
            "transaction screening": "transaktionsprüfung",
            "every transaction scored before funds settle": "jede transaktion bewertet, bevor gelder gutgeschrieben werden",
            "wallet investigations": "wallet-untersuchungen",
            "from suspicion to attribution with on-demand scans": "vom verdacht zur zuordnung mit scans auf abruf",
            "threat intelligence": "threat intelligence",
            "emerging typologies with flag-level context": "neue typologien mit kontext auf flag-ebene",
            "real-time alerting": "echtzeit-benachrichtigungen",
            "instant email alerts with score and flags": "sofortige e-mail-warnungen mit score und flags",
            "pricing": "preise",
            "talk to us. plans shaped around your volume": "sprechen sie uns an. tarife nach ihrem volumen",
            "try a live wallet scan": "live-wallet-scan testen",
            "score any wallet against known threats in seconds.": "bewerten sie jede wallet in sekunden gegen bekannte bedrohungen.",
            "learn more": "mehr erfahren",
            "industries": "branchen",
            "built for every team moving digital assets": "gebaut für jedes team, das digitale werte bewegt",
            "from banks to exchanges to law enforcement. one platform.": "von banken über börsen bis zu strafverfolgung. eine plattform.",
            "see who it's for": "für wen es ist",
            "financial institutions": "finanzinstitute",
            "onboard and monitor without new exposure": "onboarding und überwachung ohne neues risiko",
            "centralized exchanges": "zentralisierte börsen",
            "compliance at scale with fewer false positives": "compliance im großen maßstab mit weniger fehlalarmen",
            "payment services": "zahlungsdienste",
            "crypto acceptance with real-time screening": "krypto-akzeptanz mit echtzeitprüfung",
            "stablecoin & token issuers": "stablecoin- und token-emittenten",
            "protect your brand and ecosystem trust": "schützen sie ihre marke und das vertrauen im ökosystem",
            "network operators": "netzwerkbetreiber",
            "a safer network for every participant": "ein sichereres netzwerk für alle teilnehmer",
            "law enforcement & regulators": "strafverfolgung und regulierungsbehörden",
            "faster investigations, defensible decisions": "schnellere ermittlungen, belastbare entscheidungen",
            "not sure where you fit?": "nicht sicher, wo sie hingehören?",
            "talk to our team and we'll map it to your workflow.": "sprechen sie mit unserem team, wir passen es an ihren workflow an.",
            "platform": "plattform",
            "one integration, total coverage": "eine integration, volle abdeckung",
            "connect an rpc endpoint and monitor 10+ chains instantly.": "rpc-endpunkt verbinden und sofort 10+ chains überwachen.",
            "read the docs": "dokumentation lesen",
            "documentation": "dokumentation",
            "everything you need to integrate and operate": "alles für integration und betrieb",
            "api reference": "api-referenz",
            "endpoints, payloads and examples": "endpunkte, payloads und beispiele",
            "quickstart": "schnellstart",
            "up and running in minutes": "in minuten einsatzbereit",
            "risk scoring": "risikobewertung",
            "explainable scores built from named heuristics": "nachvollziehbare scores aus benannten heuristiken",
            "network coverage": "netzwerkabdeckung",
            "10+ chains from a single integration": "10+ chains aus einer einzigen integration",
            "configurable thresholds": "konfigurierbare schwellenwerte",
            "tune risk rules to your appetite": "risikoregeln nach ihrer risikobereitschaft einstellen",
            "build in minutes": "in minuten gebaut",
            "clean json api. no sdk, no infrastructure to run.": "saubere json-api. kein sdk, keine infrastruktur.",
            "resources": "ressourcen",
            "learn the language of crypto risk": "lernen sie die sprache des krypto-risikos",
            "analysis, guides and updates from the frontline of blockchain risk.": "analysen, leitfäden und neuigkeiten von der front des blockchain-risikos.",
            "visit the blog": "zum blog",
            "blog": "blog",
            "expert analysis and regulatory updates": "expertenanalysen und regulatorische neuigkeiten",
            "reports & guides": "berichte und leitfäden",
            "practical guidance for compliance teams": "praktische orientierung für compliance-teams",
            "product docs and how-tos": "produktdokumentation und anleitungen",
            "newsletter": "newsletter",
            "the latest insights in your inbox": "die neuesten erkenntnisse in ihrem postfach",
            "crypto glossary": "krypto-glossar",
            "the language of digital asset risk": "die sprache des risikos digitaler werte",
            "help center": "hilfebereich",
            "answers and troubleshooting": "antworten und fehlerbehebung",
            "the latest insights": "die neuesten erkenntnisse",
            "regulatory updates and new typologies in your inbox.": "regulatorische neuigkeiten und neue typologien in ihrem postfach.",
            "company": "unternehmen",
            "the team securing crypto payments": "das team, das krypto-zahlungen absichert",
            "who we are, how we protect you, and how to reach us.": "wer wir sind, wie wir sie schützen und wie sie uns erreichen.",
            "get in touch": "kontakt aufnehmen",
            "who we are": "wer wir sind",
            "the team behind sentinelpay": "das team hinter sentinelpay",
            "security": "sicherheit",
            "how we protect your data": "wie wir ihre daten schützen",
            "careers": "karriere",
            "help build safer digital asset rails": "helfen sie, sicherere wege für digitale werte zu bauen",
            "contact us": "kontakt",
            "talk to our team": "sprechen sie mit unserem team",
            "partner program": "partnerprogramm",
            "grow with us": "wachsen sie mit uns",
            "join the team": "werde teil des teams",
            "help build safer rails for digital asset payments.": "helfen sie, sicherere wege für zahlungen mit digitalen werten zu bauen.",
            "log in": "anmelden",
            "get started": "loslegen",
            "live chat": "live-chat",
            "chat now": "chat öffnen",
            "see risk coming.": "erkennen sie das risiko früh.",
            "stop it before it settles.": "stoppen sie es, bevor es ankommt.",
            "sentinelpay screens every transaction on 10+ blockchains in real time. dirty money gets flagged, your team gets alerted, and bad funds never touch your business.": "sentinelpay prüft jede transaktion auf 10+ blockchains in echtzeit. schmutziges geld wird markiert, ihr team wird alarmiert, und belastete gelder erreichen ihr geschäft nie.",
            "book a demo": "demo buchen",
            "start free trial": "kostenlos testen",
            "built for you": "für sie gebaut",
            "one platform": "eine plattform",
            "for every team": "für jedes team",
            "that touches crypto risk": "das mit krypto-risiko zu tun hat",
            "sentinelpay for": "sentinelpay für",
            "decentralized finance": "dezentrale finanzen",
            "law enforcement": "strafverfolgung",
            "regulators": "regulierungsbehörden",
            "payment services & fintechs": "zahlungsdienste und fintechs",
            "dirty money never sleeps.": "schmutziges geld schläft nie.",
            "neither do we. we watch every chain, every second, so nothing slips past you.": "wir auch nicht. wir beobachten jede chain, jede sekunde, damit ihnen nichts entgeht.",
            "blockchain networks covered": "abgedeckte blockchain-netzwerke",
            "from detection to alert": "von erkennung bis warnung",
            "monitoring that never clocks out": "überwachung, die nie feierabend macht",
            "uptime, measured not promised": "verfügbarkeit, gemessen statt versprochen",
            "guides & playbooks": "leitfäden und playbooks",
            "move faster": "schneller handeln",
            "when the": "wenn sich die",
            "rules change": "regeln ändern",
            "regulators rewrite the playbook every quarter. our guides tell you what changed, what it costs you, and what to do about it before your next audit asks.": "regulierungsbehörden schreiben die regeln jedes quartal neu. unsere leitfäden zeigen, was sich geändert hat, was es kostet und was zu tun ist, bevor das nächste audit fragt.",
            "stay one step ahead of crypto crime. every playbook and guide, in one hub.": "bleiben sie der krypto-kriminalität einen schritt voraus. alle playbooks und leitfäden an einem ort.",
            "explore the hub": "zum hub",
            "free compliance guide": "kostenloser compliance-leitfaden",
            "the crypto risk playbook": "das krypto-risiko-playbook",
            "48 pages": "48 seiten",
            "read now": "jetzt lesen",
            "nine tools, one platform": "neun werkzeuge, eine plattform",
            "everything you need": "alles, was sie brauchen",
            "to see,": "um krypto-risiko zu sehen,",
            "score and stop crypto risk": "zu bewerten und zu stoppen",
            "data & apis": "daten und apis",
            "network integrations": "netzwerk-integrationen",
            "education & training": "schulung und training",
            "from the blog": "aus dem blog",
            "the latest": "die neuesten",
            "typologies, takedowns": "typologien, festnahmen",
            "and rule changes": "und regeländerungen",
            "ready to take a": "bereit für einen",
            "closer look?": "genaueren blick?",
            "tell us about yourself": "erzählen sie uns von sich",
            "first name": "vorname",
            "last name": "nachname",
            "job title": "position",
            "work email": "geschäftliche e-mail",
            "registered company name": "eingetragener firmenname",
            "company website": "firmenwebsite",
            "only domains that match your work email will be contacted.": "wir kontaktieren nur domains, die zu ihrer geschäftlichen e-mail passen.",
            "which industry": "welche branche",
            "select industry…": "branche wählen…",
            "where are you based": "wo sind sie ansässig",
            "select country…": "land wählen…",
            "company size": "unternehmensgröße",
            "employees…": "mitarbeiter…",
            "wallets": "wallets",
            "expected volume…": "erwartetes volumen…",
            "which solutions interest you": "welche lösungen interessieren sie",
            "(select all that apply)": "(mehrfachauswahl möglich)",
            "risk scoring & kyt": "risikobewertung und kyt",
            "travel rule / vasp": "travel rule / vasp",
            "stablecoin monitoring": "stablecoin-überwachung",
            "api & data feeds": "api- und daten-feeds",
            "reporting & audit": "berichte und revision",
            "not sure yet": "noch unsicher",
            "anything specific you want to solve?": "möchten sie etwas konkretes lösen?",
            "i agree to be contacted about sentinelpay.": "ich stimme zu, zu sentinelpay kontaktiert zu werden.",
            "back": "zurück",
            "next": "weiter",
            "request a demo": "demo anfragen",
            "request received": "anfrage erhalten",
            "your request just landed on our": "ihre anfrage liegt jetzt auf dem schreibtisch unseres",
            "chief compliance officer's": "chief compliance officers",
            "Other": "sonstiges",
            "real-time blockchain monitoring for crypto payment operators.": "echtzeit-blockchain-überwachung für krypto-zahlungsdienstleister.",
            "api documentation": "api-dokumentation",
            "coverage": "abdeckung",
            "scalability": "skalierbarkeit",
            "configurability": "konfigurierbarkeit",
            "privacy policy": "datenschutzerklärung",
            "terms of service": "nutzungsbedingungen",
            "© 2026 sentinelpay. all rights reserved.": "© 2026 sentinelpay. alle rechte vorbehalten.",
            "how we handle your data": "wie wir mit ihren daten umgehen",
            "with an expert": "mit einem experten",
            "see how sentinelpay screens every wallet and transaction that touches your business. in your demo, we'll walk you through how to:": "sehen sie, wie sentinelpay jede wallet und transaktion prüft, die ihr geschäft berührt. in der demo zeigen wir ihnen, wie sie:",
            "monitor crypto wallets and transactions in real time": "krypto-wallets und transaktionen in echtzeit überwachen",
            "investigate complex, multi-chain movements in one view": "komplexe bewegungen über mehrere chains in einer ansicht untersuchen",
            "stop financial crime before funds settle, not after": "finanzkriminalität stoppen, bevor gelder ankommen, nicht danach",
            "resolve cases faster with clear, explainable risk scores": "fälle schneller lösen mit klaren, nachvollziehbaren risiko-scores",
            "fill out the form and our team will be in touch shortly to walk you through the platform and how it fits your workflow.": "füllen sie das formular aus, unser team meldet sich in kürze und führt sie durch die plattform und wie sie in ihren workflow passt.",
            "javascript required": "javascript erforderlich",
            "sentinelpay requires javascript to initialize secure sessions.": "sentinelpay benötigt javascript, um sichere sitzungen zu starten."
        }
    };

    function readCookie(n) {
        var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)'));
        return m ? decodeURIComponent(m[1]) : null;
    }
    function writeCookie(n, v) {
        var host = location.hostname;
        // share the choice across sentinelpay.org and its subdomains (blog, help)
        var domain = /(^|\.)sentinelpay\.org$/.test(host) ? '; domain=.sentinelpay.org' : '';
        var secure = location.protocol === 'https:' ? '; secure' : '';
        document.cookie = n + '=' + encodeURIComponent(v) + '; path=/; max-age=31536000; samesite=lax' + domain + secure;
    }
    function current() {
        var v = readCookie(COOKIE);
        if (!v) { try { v = localStorage.getItem(COOKIE); } catch (e) {} }
        return LANGS[v] ? v : 'en';
    }
    function persist(v) {
        writeCookie(COOKIE, v);
        try { localStorage.setItem(COOKIE, v); } catch (e) {}
    }

    var norm = function (s) { return s.replace(/\s+/g, ' ').trim(); };

    function translate(lang) {
        var dict = T[lang];
        document.documentElement.lang = lang;
        if (!dict) return;
        // text nodes
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: function (n) {
                var p = n.parentNode;
                if (!p) return NodeFilter.FILTER_REJECT;
                var tag = p.nodeName;
                if (tag === 'SCRIPT' || tag === 'STYLE' || p.closest('[data-i18n-skip]')) return NodeFilter.FILTER_REJECT;
                return norm(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });
        var nodes = [], n;
        while ((n = walker.nextNode())) nodes.push(n);
        nodes.forEach(function (node) {
            var hit = dict[norm(node.nodeValue)];
            if (hit) node.nodeValue = node.nodeValue.replace(/\S[\s\S]*\S|\S/, hit);
        });
        // placeholders + aria labels
        document.querySelectorAll('[placeholder]').forEach(function (el) {
            var hit = dict[norm(el.getAttribute('placeholder'))];
            if (hit) el.setAttribute('placeholder', hit);
        });
    }

    function buildSwitcher(lang) {
        if (document.querySelector('.sp-lang')) return;
        var footer = document.querySelector('.lp-footer');
        if (!footer) return;
        // sit under the brand blurb so the footer keeps its original shape; the
        // simpler blog/article footer has no brand column, so fall back to it.
        var host = footer.querySelector('.lp-footer-brand') || footer.querySelector('.lp-section-inner');
        if (!host) return;

        var wrap = document.createElement('div');
        wrap.className = 'sp-lang';
        wrap.setAttribute('data-i18n-skip', '');

        var label = document.createElement('span');
        label.className = 'sp-lang-label';
        label.textContent = { en: 'language', hr: 'jezik', de: 'sprache' }[lang] || 'language';

        // a native <select> renders its option list with os chrome we cannot style,
        // so the control is our own button + menu that mirrors the field styling.
        var dd = document.createElement('div');
        dd.className = 'sp-lang-dd';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sp-lang-btn';
        btn.setAttribute('aria-haspopup', 'listbox');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '<span class="sp-lang-value"></span>'
            + '<svg class="sp-lang-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
        btn.querySelector('.sp-lang-value').textContent = LANGS[lang];

        var menu = document.createElement('div');
        menu.className = 'sp-lang-menu';
        menu.setAttribute('role', 'listbox');

        function close() { dd.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }

        Object.keys(LANGS).forEach(function (code) {
            var opt = document.createElement('button');
            opt.type = 'button';
            opt.className = 'sp-lang-opt' + (code === lang ? ' active' : '');
            opt.setAttribute('role', 'option');
            opt.setAttribute('aria-selected', code === lang ? 'true' : 'false');
            opt.textContent = LANGS[code];
            opt.addEventListener('click', function () {
                if (code === lang) { close(); return; }
                persist(code);
                location.reload();
            });
            menu.appendChild(opt);
        });

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = dd.classList.toggle('open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        document.addEventListener('click', function (e) { if (!dd.contains(e.target)) close(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

        dd.appendChild(btn); dd.appendChild(menu);
        wrap.appendChild(label); wrap.appendChild(dd);
        host.appendChild(wrap);
    }

    function init() {
        var lang = current();
        if (lang !== 'en') translate(lang);
        buildSwitcher(lang);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
