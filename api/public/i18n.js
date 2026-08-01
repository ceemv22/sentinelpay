/* sentinelpay i18n.
   the site is static html, so instead of templating every page we key translations
   off the english source text and swap matching text nodes / placeholders at load.
   adding a string later means one dictionary entry, no markup changes.
   choice is stored in a cookie scoped to .sentinelpay.org so it follows the visitor
   onto blog.sentinelpay.org too, with localStorage as a same-origin fallback. */
(function () {
    var LANGS = { en: 'english', hr: 'hrvatski', de: 'deutsch' };
    var COOKIE = 'sp-lang';

    /* localised, not transliterated: industry terms croatians and germans actually
       use stay in english (compliance, blockchain, wallet, threat intelligence),
       and marketing lines are rewritten for the language rather than word-for-word. */
    var T = {
        hr: {
            "solutions": "rješenja",
            "everything you need to screen crypto risk": "sve što vam treba za provjeru kripto rizika",
            "real-time risk analytics across the full compliance lifecycle.": "analitika rizika u stvarnom vremenu, kroz cijeli compliance proces.",
            "explore all solutions": "pogledaj sva rješenja",
            "crypto compliance": "kripto compliance",
            "risk management for every stage of the lifecycle": "upravljanje rizikom u svakoj fazi",
            "transaction screening": "provjera transakcija",
            "every transaction scored before funds settle": "svaka transakcija ocijenjena prije nego novac sjedne",
            "wallet investigations": "istrage novčanika",
            "from suspicion to attribution with on-demand scans": "od sumnje do imena, uz provjeru na zahtjev",
            "threat intelligence": "threat intelligence",
            "emerging typologies with flag-level context": "nove sheme pranja novca, s objašnjenjem svake oznake",
            "real-time alerting": "upozorenja u stvarnom vremenu",
            "instant email alerts with score and flags": "e-mail odmah, s ocjenom i oznakama rizika",
            "pricing": "cijene",
            "talk to us. plans shaped around your volume": "javite se. plan slažemo prema vašem volumenu",
            "try a live wallet scan": "isprobajte provjeru novčanika",
            "score any wallet against known threats in seconds.": "provjerite bilo koji novčanik protiv poznatih prijetnji u par sekundi.",
            "learn more": "saznaj više",
            "industries": "industrije",
            "built for every team moving digital assets": "za svaki tim koji radi s digitalnom imovinom",
            "from banks to exchanges to law enforcement. one platform.": "od banaka i mjenjačnica do tijela progona. jedna platforma.",
            "see who it's for": "vidi kome je namijenjeno",
            "financial institutions": "financijske institucije",
            "onboard and monitor without new exposure": "primajte klijente i nadzirite ih bez nove izloženosti",
            "centralized exchanges": "centralizirane mjenjačnice",
            "compliance at scale with fewer false positives": "compliance u velikom obimu, uz manje lažnih uzbuna",
            "payment services": "platne usluge",
            "crypto acceptance with real-time screening": "primajte kripto uz provjeru u stvarnom vremenu",
            "stablecoin & token issuers": "izdavatelji stablecoina i tokena",
            "protect your brand and ecosystem trust": "zaštitite svoj brend i povjerenje korisnika",
            "network operators": "operateri mreža",
            "a safer network for every participant": "sigurnija mreža za sve sudionike",
            "law enforcement & regulators": "tijela progona i regulatori",
            "faster investigations, defensible decisions": "brže istrage i odluke koje možete obraniti",
            "not sure where you fit?": "niste sigurni gdje se uklapate?",
            "talk to our team and we'll map it to your workflow.": "javite se, pa ćemo to prilagoditi vašem načinu rada.",
            "platform": "platforma",
            "one integration, total coverage": "jedna integracija, potpuna pokrivenost",
            "connect an rpc endpoint and monitor 10+ chains instantly.": "spojite rpc i odmah nadzirete više od 10 mreža.",
            "read the docs": "otvori dokumentaciju",
            "documentation": "dokumentacija",
            "everything you need to integrate and operate": "sve za integraciju i svakodnevni rad",
            "api reference": "api referenca",
            "endpoints, payloads and examples": "endpointi, payloadi i primjeri",
            "quickstart": "brzi početak",
            "up and running in minutes": "radi za nekoliko minuta",
            "risk scoring": "procjena rizika",
            "explainable scores built from named heuristics": "ocjene koje možete objasniti, a ne pogađati",
            "network coverage": "pokrivenost mreža",
            "10+ chains from a single integration": "više od 10 mreža iz jedne integracije",
            "configurable thresholds": "podesivi pragovi",
            "tune risk rules to your appetite": "pravila rizika podesite po svojoj mjeri",
            "build in minutes": "gotovo za nekoliko minuta",
            "clean json api. no sdk, no infrastructure to run.": "čist json api. bez sdk-a i bez infrastrukture.",
            "resources": "resursi",
            "learn the language of crypto risk": "naučite jezik kripto rizika",
            "analysis, guides and updates from the frontline of blockchain risk.": "analize, vodiči i novosti iz prve ruke.",
            "visit the blog": "posjeti blog",
            "blog": "blog",
            "expert analysis and regulatory updates": "stručne analize i regulatorne novosti",
            "reports & guides": "izvještaji i vodiči",
            "practical guidance for compliance teams": "praktične upute za compliance timove",
            "product docs and how-tos": "dokumentacija i upute",
            "newsletter": "newsletter",
            "the latest insights in your inbox": "novosti izravno u inbox",
            "crypto glossary": "kripto rječnik",
            "the language of digital asset risk": "pojmovi iz svijeta kripto rizika",
            "help center": "centar za pomoć",
            "answers and troubleshooting": "odgovori i rješavanje problema",
            "the latest insights": "najnovije analize",
            "regulatory updates and new typologies in your inbox.": "regulatorne novosti i nove sheme pranja novca u vašem inboxu.",
            "company": "o nama",
            "the team securing crypto payments": "tim koji čuva kripto plaćanja",
            "who we are, how we protect you, and how to reach us.": "tko smo, kako vas štitimo i kako do nas.",
            "get in touch": "javite nam se",
            "who we are": "tko smo",
            "security": "sigurnost",
            "how we protect your data": "kako čuvamo vaše podatke",
            "careers": "karijere",
            "help build safer digital asset rails": "gradite s nama sigurniju kripto infrastrukturu",
            "contact us": "kontakt",
            "talk to our team": "javite se našem timu",
            "partner program": "partnerski program",
            "grow with us": "rastite s nama",
            "join the team": "pridruži nam se",
            "help build safer rails for digital asset payments.": "gradite s nama sigurniju infrastrukturu za kripto plaćanja.",
            "log in": "prijava",
            "get started": "kreni",
            "live chat": "live chat",
            "chat now": "otvori chat",
            "see risk coming.": "uoči rizik na vrijeme.",
            "stop it before it settles.": "zaustavi ga prije nego novac sjedne.",
            "sentinelpay screens every transaction on 10+ blockchains in real time. dirty money gets flagged, your team gets alerted, and bad funds never touch your business.": "sentinelpay u stvarnom vremenu provjerava svaku transakciju na više od 10 blockchaina. sumnjiv novac odmah se označi, vaš tim dobije upozorenje, a prljava sredstva nikad ne dođu do vas.",
            "book a demo": "dogovori demo",
            "start free trial": "probaj besplatno",
            "built for you": "za vas",
            "one platform": "jedna platforma",
            "for every team": "za svaki tim",
            "that touches crypto risk": "koji se susreće s kripto rizikom",
            "sentinelpay for": "sentinelpay za",
            "decentralized finance": "decentralizirane financije",
            "law enforcement": "tijela progona",
            "regulators": "regulatori",
            "payment services & fintechs": "platne usluge i fintech",
            "dirty money never sleeps.": "prljav novac ne spava.",
            "neither do we. we watch every chain, every second, so nothing slips past you.": "ni mi. pratimo svaku mrežu, svake sekunde, da vam ništa ne promakne.",
            "blockchain networks covered": "nadziranih blockchain mreža",
            "from detection to alert": "od detekcije do upozorenja",
            "monitoring that never clocks out": "nadzor bez pauze",
            "uptime, measured not promised": "dostupnost koju mjerimo, ne obećavamo",
            "guides & playbooks": "vodiči i priručnici",
            "move faster": "budite brži",
            "when the": "kad se",
            "rules change": "pravila promijene",
            "regulators rewrite the playbook every quarter. our guides tell you what changed, what it costs you, and what to do about it before your next audit asks.": "regulatori mijenjaju pravila svako tromjesečje. naši vodiči vam kažu što se promijenilo, koliko vas to košta i što napraviti prije nego što vas pita revizija.",
            "stay one step ahead of crypto crime. every playbook and guide, in one hub.": "budite korak ispred kripto kriminala. svi vodiči i priručnici na jednom mjestu.",
            "explore the hub": "otvori centar",
            "free compliance guide": "besplatan compliance vodič",
            "the crypto risk playbook": "priručnik za kripto rizik",
            "48 pages": "48 stranica",
            "read now": "čitaj sada",
            "nine tools, one platform": "devet alata, jedna platforma",
            "everything you need": "sve što vam treba",
            "to see,": "da uočite,",
            "score and stop crypto risk": "ocijenite i zaustavite kripto rizik",
            "data & apis": "podaci i api",
            "network integrations": "integracije mreža",
            "education & training": "edukacija i obuka",
            "from the blog": "s bloga",
            "the latest": "najnovije",
            "typologies, takedowns": "sheme, uhićenja",
            "and rule changes": "i promjene pravila",
            "ready to take a": "želite li",
            "closer look?": "vidjeti izbliza?",
            "tell us about yourself": "recite nam nešto o sebi",
            "first name": "ime",
            "last name": "prezime",
            "job title": "radno mjesto",
            "work email": "poslovni e-mail",
            "registered company name": "registrirani naziv tvrtke",
            "company website": "web stranica tvrtke",
            "only domains that match your work email will be contacted.": "kontaktiramo samo domene koje se poklapaju s vašim poslovnim e-mailom.",
            "which industry": "industrija",
            "select industry…": "odaberite industriju…",
            "where are you based": "gdje se nalazite",
            "select country…": "odaberite državu…",
            "company size": "broj zaposlenih",
            "employees…": "zaposlenih…",
            "wallets": "novčanici",
            "expected volume…": "očekivani broj…",
            "which solutions interest you": "što vas zanima",
            "(select all that apply)": "(označite sve što vrijedi)",
            "risk scoring & kyt": "procjena rizika i kyt",
            "travel rule / vasp": "travel rule / vasp",
            "stablecoin monitoring": "nadzor stablecoina",
            "api & data feeds": "api i podatkovni feedovi",
            "reporting & audit": "izvještaji i revizija",
            "not sure yet": "još ne znam",
            "anything specific you want to solve?": "imate li konkretan problem?",
            "i agree to be contacted about sentinelpay.": "pristajem da me kontaktirate o sentinelpayu.",
            "back": "natrag",
            "next": "dalje",
            "request a demo": "pošalji zahtjev",
            "request received": "zahtjev zaprimljen",
            "your request just landed on our": "vaš zahtjev upravo je stigao na stol našeg",
            "chief compliance officer's": "voditelja compliancea",
            "Other": "ostalo",
            "real-time blockchain monitoring for crypto payment operators.": "nadzor blockchaina u stvarnom vremenu za tvrtke koje primaju kripto.",
            "api documentation": "api dokumentacija",
            "coverage": "pokrivenost",
            "scalability": "skalabilnost",
            "configurability": "prilagodljivost",
            "privacy policy": "pravila privatnosti",
            "terms of service": "uvjeti korištenja",
            "© 2026 sentinelpay. all rights reserved.": "© 2026 sentinelpay. sva prava pridržana.",
            "how we handle your data": "kako postupamo s vašim podacima",
            "with an expert": "sa stručnjakom",
            "see how sentinelpay screens every wallet and transaction that touches your business. in your demo, we'll walk you through how to:": "pogledajte kako sentinelpay provjerava svaki novčanik i transakciju koji dođu do vas. na demu vam pokazujemo kako:",
            "monitor crypto wallets and transactions in real time": "nadzirati novčanike i transakcije u stvarnom vremenu",
            "investigate complex, multi-chain movements in one view": "pratiti složena kretanja kroz više mreža na jednom mjestu",
            "stop financial crime before funds settle, not after": "zaustaviti prijevaru prije nego novac sjedne, a ne poslije",
            "resolve cases faster with clear, explainable risk scores": "brže zaključiti slučaj uz jasne ocjene rizika",
            "fill out the form and our team will be in touch shortly to walk you through the platform and how it fits your workflow.": "ispunite obrazac i javljamo vam se ubrzo da vas provedemo kroz platformu i pokažemo kako se uklapa u vaš posao.",
            "javascript required": "potreban je javascript",
            "sentinelpay requires javascript to initialize secure sessions.": "sentinelpayu treba javascript za pokretanje sigurne sesije."
        },
        de: {
            "solutions": "lösungen",
            "everything you need to screen crypto risk": "alles, was sie zur prüfung von krypto-risiken brauchen",
            "real-time risk analytics across the full compliance lifecycle.": "risikoanalyse in echtzeit, über den gesamten compliance-prozess.",
            "explore all solutions": "alle lösungen ansehen",
            "crypto compliance": "krypto-compliance",
            "risk management for every stage of the lifecycle": "risikomanagement in jeder phase",
            "transaction screening": "transaktionsprüfung",
            "every transaction scored before funds settle": "jede transaktion bewertet, bevor das geld ankommt",
            "wallet investigations": "wallet-analysen",
            "from suspicion to attribution with on-demand scans": "vom verdacht zum namen, mit prüfung auf abruf",
            "threat intelligence": "threat intelligence",
            "emerging typologies with flag-level context": "neue geldwäsche-muster, mit erklärung zu jedem flag",
            "real-time alerting": "warnungen in echtzeit",
            "instant email alerts with score and flags": "sofort eine e-mail, mit score und risiko-flags",
            "pricing": "preise",
            "talk to us. plans shaped around your volume": "sprechen sie uns an. der tarif richtet sich nach ihrem volumen",
            "try a live wallet scan": "wallet-prüfung ausprobieren",
            "score any wallet against known threats in seconds.": "prüfen sie jede wallet in sekunden gegen bekannte bedrohungen.",
            "learn more": "mehr erfahren",
            "industries": "branchen",
            "built for every team moving digital assets": "für jedes team, das mit digitalen werten arbeitet",
            "from banks to exchanges to law enforcement. one platform.": "von banken über börsen bis zu behörden. eine plattform.",
            "see who it's for": "für wen es gemacht ist",
            "financial institutions": "finanzinstitute",
            "onboard and monitor without new exposure": "kunden aufnehmen und überwachen, ohne neues risiko",
            "centralized exchanges": "zentrale börsen",
            "compliance at scale with fewer false positives": "compliance im großen maßstab, mit weniger fehlalarmen",
            "payment services": "zahlungsdienste",
            "crypto acceptance with real-time screening": "krypto annehmen, mit prüfung in echtzeit",
            "stablecoin & token issuers": "stablecoin- und token-emittenten",
            "protect your brand and ecosystem trust": "schützen sie ihre marke und das vertrauen ihrer nutzer",
            "network operators": "netzwerkbetreiber",
            "a safer network for every participant": "ein sichereres netzwerk für alle beteiligten",
            "law enforcement & regulators": "behörden und aufsicht",
            "faster investigations, defensible decisions": "schnellere ermittlungen, entscheidungen die standhalten",
            "not sure where you fit?": "nicht sicher, wo sie hineinpassen?",
            "talk to our team and we'll map it to your workflow.": "melden sie sich, wir passen es an ihre arbeitsweise an.",
            "platform": "plattform",
            "one integration, total coverage": "eine integration, volle abdeckung",
            "connect an rpc endpoint and monitor 10+ chains instantly.": "rpc verbinden und sofort mehr als 10 netzwerke überwachen.",
            "read the docs": "dokumentation öffnen",
            "documentation": "dokumentation",
            "everything you need to integrate and operate": "alles für integration und täglichen betrieb",
            "api reference": "api-referenz",
            "endpoints, payloads and examples": "endpunkte, payloads und beispiele",
            "quickstart": "schnellstart",
            "up and running in minutes": "läuft in wenigen minuten",
            "risk scoring": "risikobewertung",
            "explainable scores built from named heuristics": "scores, die sie erklären können statt zu raten",
            "network coverage": "netzwerkabdeckung",
            "10+ chains from a single integration": "über 10 netzwerke aus einer integration",
            "configurable thresholds": "einstellbare schwellenwerte",
            "tune risk rules to your appetite": "risikoregeln nach ihrem maß einstellen",
            "build in minutes": "in wenigen minuten fertig",
            "clean json api. no sdk, no infrastructure to run.": "saubere json-api. kein sdk, keine infrastruktur.",
            "resources": "ressourcen",
            "learn the language of crypto risk": "lernen sie die sprache des krypto-risikos",
            "analysis, guides and updates from the frontline of blockchain risk.": "analysen, leitfäden und neuigkeiten aus erster hand.",
            "visit the blog": "zum blog",
            "blog": "blog",
            "expert analysis and regulatory updates": "expertenanalysen und neues aus der regulierung",
            "reports & guides": "berichte und leitfäden",
            "practical guidance for compliance teams": "praktische anleitung für compliance-teams",
            "product docs and how-tos": "dokumentation und anleitungen",
            "newsletter": "newsletter",
            "the latest insights in your inbox": "neuigkeiten direkt ins postfach",
            "crypto glossary": "krypto-glossar",
            "the language of digital asset risk": "begriffe aus der welt des krypto-risikos",
            "help center": "hilfebereich",
            "answers and troubleshooting": "antworten und fehlerbehebung",
            "the latest insights": "die neuesten analysen",
            "regulatory updates and new typologies in your inbox.": "neues aus der regulierung und neue geldwäsche-muster in ihrem postfach.",
            "company": "über uns",
            "the team securing crypto payments": "das team, das krypto-zahlungen absichert",
            "who we are, how we protect you, and how to reach us.": "wer wir sind, wie wir sie schützen und wie sie uns erreichen.",
            "get in touch": "kontakt aufnehmen",
            "who we are": "wer wir sind",
            "security": "sicherheit",
            "how we protect your data": "wie wir ihre daten schützen",
            "careers": "karriere",
            "help build safer digital asset rails": "bauen sie mit uns eine sicherere krypto-infrastruktur",
            "contact us": "kontakt",
            "talk to our team": "sprechen sie mit unserem team",
            "partner program": "partnerprogramm",
            "grow with us": "wachsen sie mit uns",
            "join the team": "kommen sie ins team",
            "help build safer rails for digital asset payments.": "bauen sie mit uns eine sicherere infrastruktur für krypto-zahlungen.",
            "log in": "anmelden",
            "get started": "loslegen",
            "live chat": "live-chat",
            "chat now": "chat öffnen",
            "see risk coming.": "erkennen sie das risiko früh.",
            "stop it before it settles.": "stoppen sie es, bevor das geld ankommt.",
            "sentinelpay screens every transaction on 10+ blockchains in real time. dirty money gets flagged, your team gets alerted, and bad funds never touch your business.": "sentinelpay prüft jede transaktion auf über 10 blockchains in echtzeit. verdächtiges geld wird sofort markiert, ihr team wird gewarnt, und belastete gelder erreichen sie nie.",
            "book a demo": "demo buchen",
            "start free trial": "kostenlos testen",
            "built for you": "für sie",
            "one platform": "eine plattform",
            "for every team": "für jedes team",
            "that touches crypto risk": "das mit krypto-risiko zu tun hat",
            "sentinelpay for": "sentinelpay für",
            "decentralized finance": "dezentrale finanzen",
            "law enforcement": "behörden",
            "regulators": "aufsichtsbehörden",
            "payment services & fintechs": "zahlungsdienste und fintechs",
            "dirty money never sleeps.": "schmutziges geld schläft nie.",
            "neither do we. we watch every chain, every second, so nothing slips past you.": "wir auch nicht. wir beobachten jedes netzwerk, jede sekunde, damit ihnen nichts entgeht.",
            "blockchain networks covered": "überwachte blockchain-netzwerke",
            "from detection to alert": "von erkennung bis warnung",
            "monitoring that never clocks out": "überwachung ohne pause",
            "uptime, measured not promised": "verfügbarkeit, die wir messen statt versprechen",
            "guides & playbooks": "leitfäden und playbooks",
            "move faster": "schneller handeln",
            "when the": "wenn sich die",
            "rules change": "regeln ändern",
            "regulators rewrite the playbook every quarter. our guides tell you what changed, what it costs you, and what to do about it before your next audit asks.": "die aufsicht ändert die regeln jedes quartal. unsere leitfäden sagen ihnen, was sich geändert hat, was es kostet und was zu tun ist, bevor die nächste prüfung fragt.",
            "stay one step ahead of crypto crime. every playbook and guide, in one hub.": "bleiben sie der krypto-kriminalität einen schritt voraus. alle leitfäden an einem ort.",
            "explore the hub": "zum hub",
            "free compliance guide": "kostenloser compliance-leitfaden",
            "the crypto risk playbook": "das krypto-risiko-playbook",
            "48 pages": "48 seiten",
            "read now": "jetzt lesen",
            "nine tools, one platform": "neun werkzeuge, eine plattform",
            "everything you need": "alles, was sie brauchen",
            "to see,": "um krypto-risiko zu erkennen,",
            "score and stop crypto risk": "zu bewerten und zu stoppen",
            "data & apis": "daten und apis",
            "network integrations": "netzwerk-integrationen",
            "education & training": "schulung und training",
            "from the blog": "aus dem blog",
            "the latest": "die neuesten",
            "typologies, takedowns": "muster, festnahmen",
            "and rule changes": "und regeländerungen",
            "ready to take a": "wollen sie es",
            "closer look?": "genauer sehen?",
            "tell us about yourself": "erzählen sie uns von sich",
            "first name": "vorname",
            "last name": "nachname",
            "job title": "position",
            "work email": "geschäftliche e-mail",
            "registered company name": "eingetragener firmenname",
            "company website": "firmenwebsite",
            "only domains that match your work email will be contacted.": "wir kontaktieren nur domains, die zu ihrer geschäftlichen e-mail passen.",
            "which industry": "branche",
            "select industry…": "branche wählen…",
            "where are you based": "wo sind sie ansässig",
            "select country…": "land wählen…",
            "company size": "mitarbeiterzahl",
            "employees…": "mitarbeiter…",
            "wallets": "wallets",
            "expected volume…": "erwartete anzahl…",
            "which solutions interest you": "was interessiert sie",
            "(select all that apply)": "(mehrfachauswahl möglich)",
            "risk scoring & kyt": "risikobewertung und kyt",
            "travel rule / vasp": "travel rule / vasp",
            "stablecoin monitoring": "stablecoin-überwachung",
            "api & data feeds": "api und daten-feeds",
            "reporting & audit": "berichte und revision",
            "not sure yet": "weiß ich noch nicht",
            "anything specific you want to solve?": "haben sie ein konkretes problem?",
            "i agree to be contacted about sentinelpay.": "ich bin einverstanden, zu sentinelpay kontaktiert zu werden.",
            "back": "zurück",
            "next": "weiter",
            "request a demo": "anfrage senden",
            "request received": "anfrage erhalten",
            "your request just landed on our": "ihre anfrage liegt gerade auf dem tisch unseres",
            "chief compliance officer's": "compliance-leiters",
            "Other": "sonstiges",
            "real-time blockchain monitoring for crypto payment operators.": "blockchain-überwachung in echtzeit für unternehmen, die krypto annehmen.",
            "api documentation": "api-dokumentation",
            "coverage": "abdeckung",
            "scalability": "skalierbarkeit",
            "configurability": "anpassbarkeit",
            "privacy policy": "datenschutzerklärung",
            "terms of service": "nutzungsbedingungen",
            "© 2026 sentinelpay. all rights reserved.": "© 2026 sentinelpay. alle rechte vorbehalten.",
            "how we handle your data": "wie wir mit ihren daten umgehen",
            "with an expert": "mit einem experten",
            "see how sentinelpay screens every wallet and transaction that touches your business. in your demo, we'll walk you through how to:": "sehen sie, wie sentinelpay jede wallet und transaktion prüft, die bei ihnen ankommt. in der demo zeigen wir ihnen, wie sie:",
            "monitor crypto wallets and transactions in real time": "wallets und transaktionen in echtzeit überwachen",
            "investigate complex, multi-chain movements in one view": "komplexe bewegungen über mehrere netzwerke an einem ort verfolgen",
            "stop financial crime before funds settle, not after": "betrug stoppen, bevor das geld ankommt, nicht danach",
            "resolve cases faster with clear, explainable risk scores": "fälle schneller abschließen, mit klaren risiko-scores",
            "fill out the form and our team will be in touch shortly to walk you through the platform and how it fits your workflow.": "füllen sie das formular aus, wir melden uns in kürze und zeigen ihnen die plattform und wie sie in ihren alltag passt.",
            "javascript required": "javascript erforderlich",
            "sentinelpay requires javascript to initialize secure sessions.": "sentinelpay braucht javascript, um eine sichere sitzung zu starten."
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
            if (open) {
                // open downward by default, flip up only when the viewport would clip it
                var space = window.innerHeight - btn.getBoundingClientRect().bottom;
                dd.classList.toggle('up', space < menu.scrollHeight + 16);
            }
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
