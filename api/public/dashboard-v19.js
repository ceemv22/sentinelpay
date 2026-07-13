window.onerror = (msg, url, line) => {
    const errorMsg = `[sentinel-critical] JS Error: ${msg} at ${url}:${line}`;
    console.error(errorMsg);
    if (window.showStatus) showStatus(errorMsg, 'error');
};
window.onunhandledrejection = (event) => {
    const errorMsg = `[sentinel-critical] Unhandled Promise Rejection: ${event.reason}`;
    console.error(errorMsg);
    if (window.showStatus) showStatus(errorMsg, 'error');
};

window.showStatus = (msg, type = 'info') => {
    if (type !== 'error') return;
    
    let overlay = document.getElementById('sentinel-status-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sentinel-status-overlay';
        overlay.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 20px;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);border:1px solid rgba(255,51,51,0.4);border-radius:12px;color:#ff3333;font-family:JetBrains Mono,monospace;font-size:0.75rem;z-index:99999;box-shadow:0 10px 30px rgba(0,0,0,0.5);pointer-events:none;transition:all 0.3s ease;';
        document.body.appendChild(overlay);
    }
    overlay.textContent = msg;
};

function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
let sentinelAuth = null;
let isInitialized = false;
let authStartTime = Date.now();
const API_URL = window.location.origin;

(function primeCachedProfile() {
    try {
        const raw = localStorage.getItem('sentinel-cached-profile');
        if (!raw) return;
        const cached = JSON.parse(raw);
        const prime = () => {
            try {
                applyProfileToForm(cached);
                applyIdentityDisplay(cached);
            } catch (e) {}
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', prime);
        } else {
            prime();
        }
    } catch (e) {}
})();

(function primeThemeCard() {
    try {
        const m = document.cookie.match(/(?:^|; )sentinel-theme=([^;]*)/);
        const pref = m ? decodeURIComponent(m[1]) : 'dark';
        const valid = ['light', 'dark', 'system'].includes(pref) ? pref : 'dark';
        const mark = () => {
            document.querySelectorAll('.theme-card[data-theme]').forEach(c => {
                c.classList.toggle('active', c.dataset.theme === valid);
            });
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', mark);
        } else {
            mark();
        }
    } catch (e) {}
})();

window.getDisplayTimezone = function() {
    try {
        const tz = localStorage.getItem('sentinel-timezone');
        if (tz && tz !== 'auto') return tz;
        const auto = localStorage.getItem('sentinel-tz-auto');
        if (auto) return auto;
    } catch (e) {}
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; }
};

window.applyThemePreference = function(pref, persistCookie) {
    if (!['light', 'dark', 'system'].includes(pref)) pref = 'dark';
    if (persistCookie) {
        document.cookie = 'sentinel-theme=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
        document.cookie = `sentinel-theme=${pref}; path=/; domain=.sentinelpay.org; SameSite=Lax`;
    }
    const light = pref === 'system'
        ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches)
        : pref === 'light';
    document.documentElement.classList.toggle('theme-light', light);
    document.querySelectorAll('.theme-card[data-theme]').forEach(c => c.classList.toggle('active', c.dataset.theme === pref));
};

async function saveProfilePrefs(patch) {
    const token = window.supabaseAuthToken;
    if (!token) return false;
    try {
        const r = await fetch('/v1/user/profile', {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(patch)
        });
        return r.ok;
    } catch (e) { return false; }
}

const TZ_COUNTRY = {"Africa/Abidjan":"CI","Africa/Accra":"GH","Africa/Addis_Ababa":"ET","Africa/Algiers":"DZ","Africa/Asmara":"ER","Africa/Bamako":"ML","Africa/Bangui":"CF","Africa/Banjul":"GM","Africa/Bissau":"GW","Africa/Blantyre":"MW","Africa/Brazzaville":"CG","Africa/Bujumbura":"BI","Africa/Cairo":"EG","Africa/Casablanca":"MA","Africa/Ceuta":"ES","Africa/Conakry":"GN","Africa/Dakar":"SN","Africa/Dar_es_Salaam":"TZ","Africa/Djibouti":"DJ","Africa/Douala":"CM","Africa/El_Aaiun":"EH","Africa/Freetown":"SL","Africa/Gaborone":"BW","Africa/Harare":"ZW","Africa/Johannesburg":"ZA","Africa/Juba":"SS","Africa/Kampala":"UG","Africa/Khartoum":"SD","Africa/Kigali":"RW","Africa/Kinshasa":"CD","Africa/Lagos":"NG","Africa/Libreville":"GA","Africa/Lome":"TG","Africa/Luanda":"AO","Africa/Lubumbashi":"CD","Africa/Lusaka":"ZM","Africa/Malabo":"GQ","Africa/Maputo":"MZ","Africa/Maseru":"LS","Africa/Mbabane":"SZ","Africa/Mogadishu":"SO","Africa/Monrovia":"LR","Africa/Nairobi":"KE","Africa/Ndjamena":"TD","Africa/Niamey":"NE","Africa/Nouakchott":"MR","Africa/Ouagadougou":"BF","Africa/Porto-Novo":"BJ","Africa/Sao_Tome":"ST","Africa/Tripoli":"LY","Africa/Tunis":"TN","Africa/Windhoek":"NA","America/Adak":"US","America/Anchorage":"US","America/Anguilla":"AI","America/Antigua":"AG","America/Araguaina":"BR","America/Argentina/Buenos_Aires":"AR","America/Argentina/Catamarca":"AR","America/Argentina/Cordoba":"AR","America/Argentina/Jujuy":"AR","America/Argentina/La_Rioja":"AR","America/Argentina/Mendoza":"AR","America/Argentina/Rio_Gallegos":"AR","America/Argentina/Salta":"AR","America/Argentina/San_Juan":"AR","America/Argentina/San_Luis":"AR","America/Argentina/Tucuman":"AR","America/Argentina/Ushuaia":"AR","America/Aruba":"AW","America/Asuncion":"PY","America/Bahia":"BR","America/Bahia_Banderas":"MX","America/Barbados":"BB","America/Belem":"BR","America/Belize":"BZ","America/Boa_Vista":"BR","America/Bogota":"CO","America/Boise":"US","America/Cambridge_Bay":"CA","America/Campo_Grande":"BR","America/Cancun":"MX","America/Caracas":"VE","America/Cayenne":"GF","America/Cayman":"KY","America/Chicago":"US","America/Chihuahua":"MX","America/Costa_Rica":"CR","America/Creston":"CA","America/Cuiaba":"BR","America/Curacao":"CW","America/Danmarkshavn":"GL","America/Dawson":"CA","America/Dawson_Creek":"CA","America/Denver":"US","America/Detroit":"US","America/Dominica":"DM","America/Edmonton":"CA","America/Eirunepe":"BR","America/El_Salvador":"SV","America/Fortaleza":"BR","America/Glace_Bay":"CA","America/Godthab":"GL","America/Nuuk":"GL","America/Goose_Bay":"CA","America/Grand_Turk":"TC","America/Grenada":"GD","America/Guadeloupe":"GP","America/Guatemala":"GT","America/Guayaquil":"EC","America/Guyana":"GY","America/Halifax":"CA","America/Havana":"CU","America/Hermosillo":"MX","America/Indiana/Indianapolis":"US","America/Indiana/Knox":"US","America/Indiana/Marengo":"US","America/Indiana/Petersburg":"US","America/Indiana/Tell_City":"US","America/Indiana/Vevay":"US","America/Indiana/Vincennes":"US","America/Indiana/Winamac":"US","America/Inuvik":"CA","America/Iqaluit":"CA","America/Jamaica":"JM","America/Juneau":"US","America/Kentucky/Louisville":"US","America/Kentucky/Monticello":"US","America/Kralendijk":"BQ","America/La_Paz":"BO","America/Lima":"PE","America/Los_Angeles":"US","America/Lower_Princes":"SX","America/Maceio":"BR","America/Managua":"NI","America/Manaus":"BR","America/Marigot":"MF","America/Martinique":"MQ","America/Matamoros":"MX","America/Mazatlan":"MX","America/Menominee":"US","America/Merida":"MX","America/Metlakatla":"US","America/Mexico_City":"MX","America/Miquelon":"PM","America/Moncton":"CA","America/Monterrey":"MX","America/Montevideo":"UY","America/Montserrat":"MS","America/Nassau":"BS","America/New_York":"US","America/Nome":"US","America/Noronha":"BR","America/North_Dakota/Beulah":"US","America/North_Dakota/Center":"US","America/North_Dakota/New_Salem":"US","America/Ojinaga":"MX","America/Panama":"PA","America/Paramaribo":"SR","America/Phoenix":"US","America/Port-au-Prince":"HT","America/Port_of_Spain":"TT","America/Porto_Velho":"BR","America/Puerto_Rico":"PR","America/Punta_Arenas":"CL","America/Rankin_Inlet":"CA","America/Recife":"BR","America/Regina":"CA","America/Resolute":"CA","America/Rio_Branco":"BR","America/Santarem":"BR","America/Santiago":"CL","America/Santo_Domingo":"DO","America/Sao_Paulo":"BR","America/Scoresbysund":"GL","America/Sitka":"US","America/St_Barthelemy":"BL","America/St_Johns":"CA","America/St_Kitts":"KN","America/St_Lucia":"LC","America/St_Thomas":"VI","America/St_Vincent":"VC","America/Swift_Current":"CA","America/Tegucigalpa":"HN","America/Thule":"GL","America/Tijuana":"MX","America/Toronto":"CA","America/Tortola":"VG","America/Vancouver":"CA","America/Whitehorse":"CA","America/Winnipeg":"CA","America/Yakutat":"US","Antarctica/Casey":"AQ","Antarctica/Davis":"AQ","Antarctica/DumontDUrville":"AQ","Antarctica/Macquarie":"AU","Antarctica/Mawson":"AQ","Antarctica/McMurdo":"AQ","Antarctica/Palmer":"AQ","Antarctica/Rothera":"AQ","Antarctica/Syowa":"AQ","Antarctica/Troll":"AQ","Antarctica/Vostok":"AQ","Arctic/Longyearbyen":"SJ","Asia/Aden":"YE","Asia/Almaty":"KZ","Asia/Amman":"JO","Asia/Anadyr":"RU","Asia/Aqtau":"KZ","Asia/Aqtobe":"KZ","Asia/Ashgabat":"TM","Asia/Atyrau":"KZ","Asia/Baghdad":"IQ","Asia/Bahrain":"BH","Asia/Baku":"AZ","Asia/Bangkok":"TH","Asia/Barnaul":"RU","Asia/Beirut":"LB","Asia/Bishkek":"KG","Asia/Brunei":"BN","Asia/Chita":"RU","Asia/Choibalsan":"MN","Asia/Colombo":"LK","Asia/Damascus":"SY","Asia/Dhaka":"BD","Asia/Dili":"TL","Asia/Dubai":"AE","Asia/Dushanbe":"TJ","Asia/Famagusta":"CY","Asia/Gaza":"PS","Asia/Hebron":"PS","Asia/Ho_Chi_Minh":"VN","Asia/Hong_Kong":"HK","Asia/Hovd":"MN","Asia/Irkutsk":"RU","Asia/Jakarta":"ID","Asia/Jayapura":"ID","Asia/Jerusalem":"IL","Asia/Kabul":"AF","Asia/Kamchatka":"RU","Asia/Karachi":"PK","Asia/Kathmandu":"NP","Asia/Khandyga":"RU","Asia/Kolkata":"IN","Asia/Krasnoyarsk":"RU","Asia/Kuala_Lumpur":"MY","Asia/Kuching":"MY","Asia/Kuwait":"KW","Asia/Macau":"MO","Asia/Magadan":"RU","Asia/Makassar":"ID","Asia/Manila":"PH","Asia/Muscat":"OM","Asia/Nicosia":"CY","Asia/Novokuznetsk":"RU","Asia/Novosibirsk":"RU","Asia/Omsk":"RU","Asia/Oral":"KZ","Asia/Phnom_Penh":"KH","Asia/Pontianak":"ID","Asia/Pyongyang":"KP","Asia/Qatar":"QA","Asia/Qostanay":"KZ","Asia/Qyzylorda":"KZ","Asia/Riyadh":"SA","Asia/Sakhalin":"RU","Asia/Samarkand":"UZ","Asia/Seoul":"KR","Asia/Shanghai":"CN","Asia/Singapore":"SG","Asia/Srednekolymsk":"RU","Asia/Taipei":"TW","Asia/Tashkent":"UZ","Asia/Tbilisi":"GE","Asia/Tehran":"IR","Asia/Thimphu":"BT","Asia/Tokyo":"JP","Asia/Tomsk":"RU","Asia/Ulaanbaatar":"MN","Asia/Urumqi":"CN","Asia/Ust-Nera":"RU","Asia/Vientiane":"LA","Asia/Vladivostok":"RU","Asia/Yakutsk":"RU","Asia/Yangon":"MM","Asia/Yekaterinburg":"RU","Asia/Yerevan":"AM","Atlantic/Azores":"PT","Atlantic/Bermuda":"BM","Atlantic/Canary":"ES","Atlantic/Cape_Verde":"CV","Atlantic/Faroe":"FO","Atlantic/Madeira":"PT","Atlantic/Reykjavik":"IS","Atlantic/South_Georgia":"GS","Atlantic/St_Helena":"SH","Atlantic/Stanley":"FK","Australia/Adelaide":"AU","Australia/Brisbane":"AU","Australia/Broken_Hill":"AU","Australia/Darwin":"AU","Australia/Eucla":"AU","Australia/Hobart":"AU","Australia/Lindeman":"AU","Australia/Lord_Howe":"AU","Australia/Melbourne":"AU","Australia/Perth":"AU","Australia/Sydney":"AU","Europe/Amsterdam":"NL","Europe/Andorra":"AD","Europe/Astrakhan":"RU","Europe/Athens":"GR","Europe/Belgrade":"RS","Europe/Berlin":"DE","Europe/Bratislava":"SK","Europe/Brussels":"BE","Europe/Bucharest":"RO","Europe/Budapest":"HU","Europe/Busingen":"DE","Europe/Chisinau":"MD","Europe/Copenhagen":"DK","Europe/Dublin":"IE","Europe/Gibraltar":"GI","Europe/Guernsey":"GG","Europe/Helsinki":"FI","Europe/Isle_of_Man":"IM","Europe/Istanbul":"TR","Europe/Jersey":"JE","Europe/Kaliningrad":"RU","Europe/Kiev":"UA","Europe/Kyiv":"UA","Europe/Kirov":"RU","Europe/Lisbon":"PT","Europe/Ljubljana":"SI","Europe/London":"GB","Europe/Luxembourg":"LU","Europe/Madrid":"ES","Europe/Malta":"MT","Europe/Mariehamn":"AX","Europe/Minsk":"BY","Europe/Monaco":"MC","Europe/Moscow":"RU","Europe/Oslo":"NO","Europe/Paris":"FR","Europe/Podgorica":"ME","Europe/Prague":"CZ","Europe/Riga":"LV","Europe/Rome":"IT","Europe/Samara":"RU","Europe/San_Marino":"SM","Europe/Sarajevo":"BA","Europe/Saratov":"RU","Europe/Simferopol":"UA","Europe/Skopje":"MK","Europe/Sofia":"BG","Europe/Stockholm":"SE","Europe/Tallinn":"EE","Europe/Tirane":"AL","Europe/Ulyanovsk":"RU","Europe/Vaduz":"LI","Europe/Vatican":"VA","Europe/Vienna":"AT","Europe/Vilnius":"LT","Europe/Volgograd":"RU","Europe/Warsaw":"PL","Europe/Zagreb":"HR","Europe/Zurich":"CH","Indian/Antananarivo":"MG","Indian/Chagos":"IO","Indian/Christmas":"CX","Indian/Cocos":"CC","Indian/Comoro":"KM","Indian/Kerguelen":"TF","Indian/Mahe":"SC","Indian/Maldives":"MV","Indian/Mauritius":"MU","Indian/Mayotte":"YT","Indian/Reunion":"RE","Pacific/Apia":"WS","Pacific/Auckland":"NZ","Pacific/Bougainville":"PG","Pacific/Chatham":"NZ","Pacific/Chuuk":"FM","Pacific/Easter":"CL","Pacific/Efate":"VU","Pacific/Fakaofo":"TK","Pacific/Fiji":"FJ","Pacific/Funafuti":"TV","Pacific/Galapagos":"EC","Pacific/Gambier":"PF","Pacific/Guadalcanal":"SB","Pacific/Guam":"GU","Pacific/Honolulu":"US","Pacific/Kanton":"KI","Pacific/Kiritimati":"KI","Pacific/Kosrae":"FM","Pacific/Kwajalein":"MH","Pacific/Majuro":"MH","Pacific/Marquesas":"PF","Pacific/Midway":"UM","Pacific/Nauru":"NR","Pacific/Niue":"NU","Pacific/Norfolk":"NF","Pacific/Noumea":"NC","Pacific/Pago_Pago":"AS","Pacific/Palau":"PW","Pacific/Pitcairn":"PN","Pacific/Pohnpei":"FM","Pacific/Port_Moresby":"PG","Pacific/Rarotonga":"CK","Pacific/Saipan":"MP","Pacific/Tahiti":"PF","Pacific/Tarawa":"KI","Pacific/Tongatapu":"TO","Pacific/Wake":"UM","Pacific/Wallis":"WF"};

Object.assign(TZ_COUNTRY, {"America/Atikokan":"CA","America/Blanc-Sablon":"CA","America/Coral_Harbour":"CA","America/Nipigon":"CA","America/Pangnirtung":"CA","America/Rainy_River":"CA","America/Thunder_Bay":"CA","America/Yellowknife":"CA","America/Fort_Nelson":"CA","America/Montreal":"CA","America/Ciudad_Juarez":"MX","America/Santa_Isabel":"MX","America/Ensenada":"MX","America/Rosario":"AR","America/Buenos_Aires":"AR","America/Catamarca":"AR","America/Cordoba":"AR","America/Jujuy":"AR","America/Mendoza":"AR","America/Argentina/ComodRivadavia":"AR","America/Indianapolis":"US","America/Louisville":"US","America/Knox_IN":"US","America/Shiprock":"US","America/Virgin":"VI","America/Argentina/Buenos_Aires":"AR","America/Kentucky/Louisville":"US","Asia/Calcutta":"IN","Asia/Katmandu":"NP","Asia/Rangoon":"MM","Asia/Saigon":"VN","Asia/Istanbul":"TR","Asia/Chungking":"CN","Asia/Chongqing":"CN","Asia/Harbin":"CN","Asia/Ashkhabad":"TM","Asia/Dacca":"BD","Asia/Macao":"MO","Asia/Ujung_Pandang":"ID","Asia/Ulan_Bator":"MN","Asia/Thimbu":"BT","Asia/Tel_Aviv":"IL","Africa/Asmera":"ER","Africa/Timbuktu":"ML","Atlantic/Faeroe":"FO","Atlantic/Jan_Mayen":"SJ","Arctic/Longyearbyen":"SJ","Europe/Uzhgorod":"UA","Europe/Zaporozhye":"UA","Europe/Tiraspol":"MD","Europe/Belfast":"GB","Europe/Nicosia":"CY","Pacific/Ponape":"FM","Pacific/Truk":"FM","Pacific/Yap":"FM","Pacific/Samoa":"AS","Pacific/Johnston":"UM","Pacific/Enderbury":"KI","Antarctica/South_Pole":"AQ"});

function flagImg(cc) {
    if (!cc) return '<span class="tz-dd-globe">🌐</span>';
    return `<img class="tz-dd-flag-img" loading="lazy" alt="" src="https://cdn.jsdelivr.net/gh/lipis/flag-icons/flags/4x3/${cc.toLowerCase()}.svg">`;
}

function tzFlagHtml(zone) {
    return flagImg(TZ_COUNTRY[zone]);
}

const TIMEZONES = [
    ['Africa/Abidjan','ci','yamoussoukro'],['Africa/Accra','gh','accra'],['Africa/Addis_Ababa','et','addis ababa'],['Africa/Algiers','dz','algiers'],['Africa/Asmara','er','asmara'],['Africa/Bamako','ml','bamako'],['Africa/Bangui','cf','bangui'],['Africa/Banjul','gm','banjul'],['Africa/Bissau','gw','bissau'],['Africa/Blantyre','mw','lilongwe'],['Africa/Brazzaville','cg','brazzaville'],['Africa/Bujumbura','bi','gitega'],['Africa/Cairo','eg','cairo'],['Africa/Casablanca','ma','rabat'],['Africa/Conakry','gn','conakry'],['Africa/Dakar','sn','dakar'],['Africa/Dar_es_Salaam','tz','dodoma'],['Africa/Djibouti','dj','djibouti'],['Africa/Douala','cm','yaounde'],['Africa/Freetown','sl','freetown'],['Africa/Gaborone','bw','gaborone'],['Africa/Harare','zw','harare'],['Africa/Johannesburg','za','pretoria'],['Africa/Juba','ss','juba'],['Africa/Kampala','ug','kampala'],['Africa/Khartoum','sd','khartoum'],['Africa/Kigali','rw','kigali'],['Africa/Kinshasa','cd','kinshasa'],['Africa/Lagos','ng','abuja'],['Africa/Libreville','ga','libreville'],['Africa/Lome','tg','lome'],['Africa/Luanda','ao','luanda'],['Africa/Lusaka','zm','lusaka'],['Africa/Malabo','gq','ciudad de la paz'],['Africa/Maputo','mz','maputo'],['Africa/Maseru','ls','maseru'],['Africa/Mbabane','sz','mbabane'],['Africa/Mogadishu','so','mogadishu'],['Africa/Monrovia','lr','monrovia'],['Africa/Nairobi','ke','nairobi'],['Africa/Ndjamena','td','ndjamena'],['Africa/Niamey','ne','niamey'],['Africa/Nouakchott','mr','nouakchott'],['Africa/Ouagadougou','bf','ouagadougou'],['Africa/Porto-Novo','bj','porto-novo'],['Africa/Sao_Tome','st','sao tome'],['Africa/Tripoli','ly','tripoli'],['Africa/Tunis','tn','tunis'],['Africa/Windhoek','na','windhoek'],
    ['America/New_York','us','new york'],['America/Chicago','us','chicago'],['America/Denver','us','denver'],['America/Phoenix','us','phoenix'],['America/Los_Angeles','us','los angeles'],['America/Anchorage','us','anchorage'],['Pacific/Honolulu','us','honolulu'],
    ['America/St_Johns','ca','st johns'],['America/Halifax','ca','halifax'],['America/Toronto','ca','toronto'],['America/Winnipeg','ca','winnipeg'],['America/Edmonton','ca','edmonton'],['America/Vancouver','ca','vancouver'],
    ['America/Mexico_City','mx','mexico city'],['America/Cancun','mx','cancun'],['America/Hermosillo','mx','hermosillo'],['America/Tijuana','mx','tijuana'],
    ['America/Sao_Paulo','br','sao paulo'],['America/Manaus','br','manaus'],['America/Rio_Branco','br','rio branco'],['America/Noronha','br','fernando de noronha'],
    ['America/Argentina/Buenos_Aires','ar','buenos aires'],['America/Barbados','bb','bridgetown'],['America/Belize','bz','belmopan'],['America/Bogota','co','bogota'],['America/Caracas','ve','caracas'],['America/Costa_Rica','cr','san jose'],['America/Dominica','dm','roseau'],['America/El_Salvador','sv','san salvador'],['America/Grenada','gd','st georges'],['America/Guatemala','gt','guatemala city'],['America/Guayaquil','ec','quito'],['America/Guyana','gy','georgetown'],['America/Havana','cu','havana'],['America/Jamaica','jm','kingston'],['America/La_Paz','bo','la paz'],['America/Lima','pe','lima'],['America/Managua','ni','managua'],['America/Montevideo','uy','montevideo'],['America/Nassau','bs','nassau'],['America/Panama','pa','panama city'],['America/Paramaribo','sr','paramaribo'],['America/Port-au-Prince','ht','port-au-prince'],['America/Port_of_Spain','tt','port of spain'],['America/Punta_Arenas','cl','punta arenas'],['America/Santiago','cl','santiago'],['America/Santo_Domingo','do','santo domingo'],['America/St_Kitts','kn','basseterre'],['America/St_Lucia','lc','castries'],['America/St_Vincent','vc','kingstown'],['America/Tegucigalpa','hn','tegucigalpa'],
    ['Asia/Aden','ye','sanaa'],['Asia/Almaty','kz','astana'],['Asia/Amman','jo','amman'],['Asia/Ashgabat','tm','ashgabat'],['Asia/Baghdad','iq','baghdad'],['Asia/Bahrain','bh','manama'],['Asia/Baku','az','baku'],['Asia/Bangkok','th','bangkok'],['Asia/Beirut','lb','beirut'],['Asia/Bishkek','kg','bishkek'],['Asia/Brunei','bn','bandar seri begawan'],['Asia/Kolkata','in','new delhi'],['Asia/Colombo','lk','colombo'],['Asia/Damascus','sy','damascus'],['Asia/Dhaka','bd','dhaka'],['Asia/Dili','tl','dili'],['Asia/Dubai','ae','abu dhabi'],['Asia/Dushanbe','tj','dushanbe'],['Asia/Hebron','ps','ramallah'],['Asia/Ho_Chi_Minh','vn','hanoi'],['Asia/Hovd','mn','khovd'],['Asia/Jakarta','id','jakarta'],['Asia/Makassar','id','makassar'],['Asia/Jayapura','id','jayapura'],['Asia/Jerusalem','il','jerusalem'],['Asia/Kabul','af','kabul'],['Asia/Karachi','pk','islamabad'],['Asia/Kathmandu','np','kathmandu'],['Asia/Kuala_Lumpur','my','kuala lumpur'],['Asia/Kuwait','kw','kuwait city'],['Asia/Manila','ph','manila'],['Asia/Muscat','om','muscat'],['Asia/Nicosia','cy','nicosia'],['Asia/Phnom_Penh','kh','phnom penh'],['Asia/Pyongyang','kp','pyongyang'],['Asia/Qatar','qa','doha'],['Asia/Riyadh','sa','riyadh'],['Asia/Yangon','mm','naypyidaw'],['Asia/Tashkent','uz','tashkent'],['Asia/Seoul','kr','seoul'],['Asia/Shanghai','cn','beijing'],['Asia/Singapore','sg','singapore'],['Asia/Taipei','tw','taipei'],['Asia/Tbilisi','ge','tbilisi'],['Asia/Tehran','ir','tehran'],['Asia/Thimphu','bt','thimphu'],['Asia/Tokyo','jp','tokyo'],['Asia/Ulaanbaatar','mn','ulaanbaatar'],['Asia/Vientiane','la','vientiane'],['Asia/Yerevan','am','yerevan'],
    ['Europe/Kaliningrad','ru','kaliningrad'],['Europe/Moscow','ru','moscow'],['Europe/Samara','ru','samara'],['Asia/Yekaterinburg','ru','yekaterinburg'],['Asia/Omsk','ru','omsk'],['Asia/Krasnoyarsk','ru','krasnoyarsk'],['Asia/Irkutsk','ru','irkutsk'],['Asia/Yakutsk','ru','yakutsk'],['Asia/Vladivostok','ru','vladivostok'],['Asia/Magadan','ru','magadan'],['Asia/Kamchatka','ru','kamchatka'],
    ['Europe/Amsterdam','nl','amsterdam'],['Europe/Andorra','ad','andorra la vella'],['Europe/Athens','gr','athens'],['Europe/Belgrade','rs','belgrade'],['Europe/Berlin','de','berlin'],['Europe/Bratislava','sk','bratislava'],['Europe/Brussels','be','brussels'],['Europe/Bucharest','ro','bucharest'],['Europe/Budapest','hu','budapest'],['Europe/Chisinau','md','chisinau'],['Europe/Copenhagen','dk','copenhagen'],['Europe/Dublin','ie','dublin'],['Europe/Helsinki','fi','helsinki'],['Europe/Istanbul','tr','ankara'],['Europe/Kyiv','ua','kyiv'],['Europe/Lisbon','pt','lisbon'],['Europe/Ljubljana','si','ljubljana'],['Europe/London','gb','london'],['Europe/Luxembourg','lu','luxembourg'],['Europe/Madrid','es','madrid'],['Europe/Malta','mt','valletta'],['Europe/Minsk','by','minsk'],['Europe/Monaco','mc','monaco'],['Europe/Oslo','no','oslo'],['Europe/Paris','fr','paris'],['Europe/Podgorica','me','podgorica'],['Europe/Prague','cz','prague'],['Europe/Riga','lv','riga'],['Europe/Rome','it','rome'],['Europe/San_Marino','sm','san marino'],['Europe/Sarajevo','ba','sarajevo'],['Europe/Skopje','mk','skopje'],['Europe/Sofia','bg','sofia'],['Europe/Stockholm','se','stockholm'],['Europe/Tallinn','ee','tallinn'],['Europe/Tirane','al','tirana'],['Europe/Vaduz','li','vaduz'],['Europe/Vatican','va','vatican city'],['Europe/Vienna','at','vienna'],['Europe/Vilnius','lt','vilnius'],['Europe/Warsaw','pl','warsaw'],['Europe/Zagreb','hr','zagreb'],['Europe/Zurich','ch','bern'],
    ['Atlantic/Reykjavik','is','reykjavik'],['Atlantic/Cape_Verde','cv','praia'],
    ['Indian/Antananarivo','mg','antananarivo'],['Indian/Comoro','km','moroni'],['Indian/Mahe','sc','victoria'],['Indian/Maldives','mv','male'],['Indian/Mauritius','mu','port louis'],
    ['Australia/Sydney','au','canberra'],['Australia/Adelaide','au','adelaide'],['Australia/Perth','au','perth'],
    ['Pacific/Apia','ws','apia'],['Pacific/Auckland','nz','wellington'],['Pacific/Efate','vu','port vila'],['Pacific/Tarawa','ki','tarawa'],['Pacific/Fiji','fj','suva'],['Pacific/Funafuti','tv','funafuti'],['Pacific/Pohnpei','fm','palikir'],['Pacific/Majuro','mh','majuro'],['Pacific/Nauru','nr','yaren'],['Pacific/Palau','pw','ngerulmud'],['Pacific/Port_Moresby','pg','port moresby'],['Pacific/Tongatapu','to','nukualofa'],['Pacific/Guadalcanal','sb','honiara']
];

function tzLabel(zone) {
    const parts = zone.split('/');
    const simplified = parts.length > 2 ? parts[0] + '/' + parts[parts.length - 1] : zone;
    return simplified.replace(/_/g, ' ').toLowerCase();
}

function tzSearchText(zone) {
    return zone.replace(/_/g, ' ').toLowerCase();
}

let _touchLockHandler = null;
let _touchLockStartY = 0;

function lockBodyScroll() {
    const ca = document.querySelector('.content-area');
    if (ca) {
        ca._lockedScrollTop = ca.scrollTop;
        ca.style.setProperty('overflow-y', 'hidden', 'important');
    }
    if (_touchLockHandler) return;
    const onStart = (e) => { _touchLockStartY = e.touches[0].clientY; };
    _touchLockHandler = (e) => {
        const mc = e.target.closest('.modal-content');
        if (!mc) { e.preventDefault(); return; }
        const dy = e.touches[0].clientY - _touchLockStartY;
        const atTop = mc.scrollTop <= 0 && dy > 0;
        const atBottom = mc.scrollTop >= mc.scrollHeight - mc.clientHeight && dy < 0;
        if (mc.scrollHeight <= mc.clientHeight || atTop || atBottom) e.preventDefault();
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', _touchLockHandler, { passive: false });
    _touchLockHandler._onStart = onStart;
}
function unlockBodyScroll() {
    const ca = document.querySelector('.content-area');
    if (ca) {
        ca.style.removeProperty('overflow-y');
        if (ca._lockedScrollTop !== undefined) ca.scrollTop = ca._lockedScrollTop;
    }
    if (!_touchLockHandler) return;
    document.removeEventListener('touchstart', _touchLockHandler._onStart);
    document.removeEventListener('touchmove', _touchLockHandler);
    _touchLockHandler = null;
}

const initialSearch = window.location.search;
const initialHash = window.location.hash;

const scrubHash = () => {
    try {
        const url = new URL(window.location.href);
        if (url.search || url.hash) {
            window.history.replaceState(null, document.title, url.pathname);
        }
    } catch (e) {}
};

const checkSession = async () => {
    if (!sentinelAuth) return false;
    try {
        const { data: { session }, error } = await sentinelAuth.auth.getSession();
        if (error) throw error;
        if (session && !isInitialized) {
            isInitialized = true;
            renderDashboard(session);
            setTimeout(scrubHash, 500);
            return true;
        }
        return !!session;
    } catch (err) {
        return false;
    }
};

const startHydration = async () => {
    let sdk = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
    if (!sdk) {
        setTimeout(startHydration, 100);
        return;
    }

    try {
        sentinelAuth = sdk.createClient(supabaseUrl, supabaseKey, {
            auth: {
                flowType: 'pkce',
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        });
    } catch (e) {
        return;
    }

    sentinelAuth.auth.onAuthStateChange(async (event, session) => {
        // Keep the cached bearer token fresh across auto-refreshes so authed
        // calls (e.g. active sessions) don't fail with a stale/expired token.
        if (session && session.access_token) window.supabaseAuthToken = session.access_token;
        if (session && !isInitialized) {
            isInitialized = true;
            renderDashboard(session);
            setTimeout(scrubHash, 500);
        }
        if (event === 'SIGNED_OUT' && (Date.now() - authStartTime > 30000)) {
            window.location.href = '/auth';
        }
    });

    const hasSession = await checkSession();
    if (hasSession) return;

    const urlParams = new URLSearchParams(initialSearch || initialHash.substring(1));
    const code = urlParams.get('code');
    const isAuthRedirect = !!code || initialHash.includes('access_token=');

    if (isAuthRedirect) {
        if (code) {
            try {
                const { data, error } = await sentinelAuth.auth.exchangeCodeForSession(code);
                if (error) throw error;
                if (data.session && !isInitialized) {
                    isInitialized = true;
                    renderDashboard(data.session);
                    setTimeout(scrubHash, 500);
                    return;
                }
            } catch (e) {
                showStatus(`Identity Error: ${e.message}`, 'error');
            }
        }
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 200));
            if (isInitialized || await checkSession()) return;
        }
        window.location.href = '/auth?error=timeout';
    } else {
        setTimeout(async () => {
            if (!isInitialized && !(await checkSession())) {
                window.location.href = '/auth';
            }
        }, 4000);
    }
};

startHydration();

const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.onclick = async (e) => {
        e.preventDefault();
        localStorage.removeItem('sentinel-cached-orgs');
        localStorage.removeItem('sentinel-cached-profile');
        localStorage.removeItem('sentinel-cached-sessions');
        document.cookie = 'sentinel-theme=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
        document.cookie = 'sentinel-theme=; path=/; domain=.sentinelpay.org; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
        if (sentinelAuth) await sentinelAuth.auth.signOut();
        window.location.href = 'https://sentinelpay.org';
    };
}

function hasConfirmedEmail(user) {
    return !!(user && user.email && (user.email_confirmed_at || user.confirmed_at));
}

function showEmailGate(session) {
    if (document.getElementById('sp-email-gate')) return;
    document.body.classList.remove('state-org-home');
    document.body.classList.add('modal-open');

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const redirectTo = window.location.origin + '/dashboard/organizations';

    const cardStyle = 'position: relative; z-index: 1000; display: flex; flex-direction: column; max-width: 440px; width: 100%;';
    const tabStyle = 'width: 100%; cursor: default; pointer-events: none;';
    const descStyle = "color: var(--text-muted); font-size: 0.85rem; font-family: 'JetBrains Mono', monospace; line-height: 1.6; width: 100%; text-align: center;";
    const pillStyle = "background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.6); border: 1px solid rgba(255,255,255,0.1); padding: 12px 24px; border-radius: 12px; font-size: 0.72rem; cursor: pointer; font-family: 'JetBrains Mono', monospace; transition: all 0.3s ease; min-width: 180px;";
    const textLinkStyle = "background: none; border: none; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; cursor: pointer; padding: 0.35rem;";

    let pendingEmail = '';

    const wrap = document.createElement('div');
    wrap.id = 'sp-email-gate';
    wrap.className = 'modal-overlay';
    wrap.innerHTML = `
        <div class="auth-card modal-content" style="${cardStyle}">
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; width: 100%;">
                <div class="sp-eg-form" style="display: flex; flex-direction: column; width: 100%;">
                    <div class="auth-tabs" style="margin-bottom: 2rem;">
                        <button class="auth-tab active" style="${tabStyle}">add your email</button>
                    </div>
                    <p style="${descStyle} margin-bottom: 1.75rem;">your account signed in without an email address. add and confirm one to secure your account and enable two-factor authentication.</p>
                    <input id="sp-eg-input" class="settings-input" type="email" placeholder="john.doe@example.com" autocomplete="email" spellcheck="false" inputmode="email" style="text-align: center; padding: 0.75rem 0.85rem; font-size: 0.85rem;" />
                    <p class="error-msg" id="sp-eg-error" style="display:none; margin-top: 1rem;"></p>
                    <button id="sp-eg-submit" class="submit-btn" style="margin-top: 1.5rem; width: 100%;">send code</button>
                </div>
                <div class="sp-eg-code" style="display:none; flex-direction: column; align-items: center; width: 100%;">
                    <div class="auth-tabs" style="margin-bottom: 2rem; width: 100%;">
                        <button class="auth-tab active" style="${tabStyle}">verify email</button>
                    </div>
                    <p style="${descStyle} margin-bottom: 2rem;">we sent a 6-digit code to <span id="sp-eg-target" style="color: #fff; font-weight: 700; word-break: break-all;"></span></p>
                    <div class="otp-boxes" id="sp-eg-otp"></div>
                    <p class="error-msg" id="sp-eg-code-error" style="display:none; margin-top: 1rem;"></p>
                    <div style="width: 100%; display: flex; flex-direction: column; align-items: center; padding-top: 1.5rem; gap: 0.75rem;">
                        <button id="sp-eg-resend" type="button" style="${pillStyle}">resend code</button>
                        <button id="sp-eg-change" type="button" style="${textLinkStyle}">use a different email</button>
                    </div>
                </div>
            </div>
            <button id="sp-eg-logout" class="btn-cancel" style="width: 100%; margin-top: 1.5rem;">log out</button>
        </div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('active'));

    const formView = wrap.querySelector('.sp-eg-form');
    const codeView = wrap.querySelector('.sp-eg-code');
    const input = wrap.querySelector('#sp-eg-input');
    const errEl = wrap.querySelector('#sp-eg-error');
    const submitBtn = wrap.querySelector('#sp-eg-submit');
    const codeErrEl = wrap.querySelector('#sp-eg-code-error');
    const resendBtn = wrap.querySelector('#sp-eg-resend');
    const changeBtn = wrap.querySelector('#sp-eg-change');
    const logoutBtn = wrap.querySelector('#sp-eg-logout');
    const targetEl = wrap.querySelector('#sp-eg-target');

    const OTP_LEN = 6;
    const otpWrap = wrap.querySelector('#sp-eg-otp');
    const cells = [];
    for (let i = 0; i < OTP_LEN; i++) {
        const c = document.createElement('input');
        c.type = 'text';
        c.className = 'otp-box';
        c.inputMode = 'numeric';
        c.autocomplete = i === 0 ? 'one-time-code' : 'off';
        c.maxLength = 1;
        c.setAttribute('aria-label', 'digit ' + (i + 1));
        cells.push(c);
        otpWrap.appendChild(c);
    }
    const otpValue = () => cells.map((c) => c.value).join('');
    const setFilled = () => cells.forEach((c) => c.classList.toggle('filled', !!c.value));
    const clearOtp = () => { cells.forEach((c) => { c.value = ''; }); setFilled(); };
    const focusFirstEmpty = () => { (cells.find((c) => !c.value) || cells[0]).focus(); };
    const maybeAutoConfirm = () => { if (otpValue().length === OTP_LEN) doConfirm(); };
    cells.forEach((c, idx) => {
        c.addEventListener('input', () => {
            c.value = c.value.replace(/[^0-9]/g, '').slice(0, 1);
            setFilled();
            if (c.value && idx < OTP_LEN - 1) cells[idx + 1].focus();
            maybeAutoConfirm();
        });
        c.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !c.value && idx > 0) { cells[idx - 1].focus(); cells[idx - 1].value = ''; setFilled(); e.preventDefault(); }
            else if (e.key === 'ArrowLeft' && idx > 0) { cells[idx - 1].focus(); e.preventDefault(); }
            else if (e.key === 'ArrowRight' && idx < OTP_LEN - 1) { cells[idx + 1].focus(); e.preventDefault(); }
            else if (e.key === 'Enter') doConfirm();
        });
        c.addEventListener('paste', (e) => {
            e.preventDefault();
            const src = (e.clipboardData || window.clipboardData);
            const digits = (src ? src.getData('text') : '').replace(/[^0-9]/g, '').slice(0, OTP_LEN);
            if (!digits) return;
            for (let j = 0; j < OTP_LEN; j++) cells[j].value = digits[j] || '';
            setFilled();
            cells[Math.min(digits.length, OTP_LEN - 1)].focus();
            maybeAutoConfirm();
        });
    });

    const showError = (msg) => {
        [errEl, codeErrEl].forEach((el) => {
            if (!msg) { el.style.display = 'none'; el.textContent = ''; }
            else { el.textContent = 'error: ' + msg.toLowerCase(); el.style.display = 'block'; }
        });
    };

    const getToken = async () => {
        try {
            const { data } = await sentinelAuth.auth.getSession();
            if (data && data.session && data.session.access_token) return data.session.access_token;
        } catch (e) {}
        return (session && session.access_token) || '';
    };

    const post = async (path, body) => {
        const token = await getToken();
        const r = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(body || {})
        });
        let data = {};
        try { data = await r.json(); } catch (e) {}
        return { ok: r.ok, status: r.status, data };
    };

    const sendCode = async (email) => {
        showError('');
        const { ok, status, data } = await post('/v1/user/email-change/send-code-new', { newEmail: email });
        if (!ok) {
            if (status === 429) throw new Error(data.retryAfter ? `wait ${data.retryAfter}s and try again` : 'too many attempts, wait a minute');
            throw new Error(data.error || 'could not send the code');
        }
    };

    const confirmCode = async (email, code) => {
        let r = await post('/v1/user/email-change/verify-code-new', { code });
        if (!r.ok) throw new Error(r.data.error || 'incorrect code');
        r = await post('/v1/user/email-change/finalize', { email });
        if (!r.ok) {
            if (r.status === 409) throw new Error('this email is already in use');
            throw new Error(r.data.error || 'could not confirm your email');
        }
    };

    const isEmailTaken = async (email) => {
        try {
            const { ok, data } = await post('/v1/user/check-email', { email });
            if (ok && data && data.available === false) return true;
        } catch (e) {}
        return false;
    };

    let resendTimer = null;
    const setResendDisabled = (off) => {
        resendBtn.disabled = off;
        resendBtn.style.opacity = off ? '0.4' : '';
        resendBtn.style.cursor = off ? 'not-allowed' : 'pointer';
        resendBtn.style.pointerEvents = off ? 'none' : '';
    };
    const startResendCooldown = (secs) => {
        let remaining = secs;
        setResendDisabled(true);
        resendBtn.textContent = `resend in ${remaining}s`;
        if (resendTimer) clearInterval(resendTimer);
        resendTimer = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                clearInterval(resendTimer);
                resendTimer = null;
                setResendDisabled(false);
                resendBtn.textContent = 'resend code';
            } else {
                resendBtn.textContent = `resend in ${remaining}s`;
            }
        }, 1000);
    };

    const goCodeStep = (email) => {
        pendingEmail = email;
        targetEl.textContent = email;
        formView.style.display = 'none';
        codeView.style.display = 'flex';
        showError('');
        clearOtp();
        startResendCooldown(60);
        setTimeout(() => cells[0].focus(), 50);
    };

    submitBtn.addEventListener('click', async () => {
        const email = (input.value || '').trim().toLowerCase();
        if (!EMAIL_RE.test(email)) { showError('enter a valid email address'); input.focus(); return; }
        submitBtn.disabled = true;
        submitBtn.textContent = 'checking...';
        try {
            if (await isEmailTaken(email)) { showError('that email is already registered'); input.focus(); return; }
            submitBtn.textContent = 'sending...';
            await sendCode(email);
            goCodeStep(email);
        } catch (e) {
            showError(e.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'send code';
        }
    });

    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitBtn.click(); });

    let busy = false;
    const doConfirm = async () => {
        if (busy) return;
        const code = otpValue();
        if (!/^[0-9]{6}$/.test(code)) { showError('enter the 6-digit code'); focusFirstEmpty(); return; }
        busy = true;
        showError('');
        cells.forEach((c) => { c.disabled = true; });
        try {
            await confirmCode(pendingEmail, code);
            if (resendTimer) { clearInterval(resendTimer); resendTimer = null; }
            try { await sentinelAuth.auth.refreshSession(); } catch (e) {}
            window.location.href = redirectTo;
        } catch (e) {
            busy = false;
            cells.forEach((c) => { c.disabled = false; });
            clearOtp();
            cells[0].focus();
            showError(e.message);
        }
    };

    resendBtn.addEventListener('click', async () => {
        if (resendBtn.disabled) return;
        resendBtn.disabled = true;
        resendBtn.textContent = 'sending...';
        try {
            await sendCode(pendingEmail);
            startResendCooldown(60);
        } catch (e) {
            showError(e.message);
            resendBtn.disabled = false;
            resendBtn.textContent = 'resend code';
        }
    });

    changeBtn.addEventListener('click', () => {
        if (resendTimer) { clearInterval(resendTimer); resendTimer = null; }
        codeView.style.display = 'none';
        formView.style.display = 'flex';
        showError('');
        input.focus();
    });

    logoutBtn.addEventListener('click', async () => {
        try { localStorage.removeItem('sentinel-cached-orgs'); localStorage.removeItem('sentinel-cached-profile'); } catch (e) {}
        if (sentinelAuth) { try { await sentinelAuth.auth.signOut(); } catch (e) {} }
        window.location.href = 'https://sentinelpay.org';
    });

    setTimeout(() => input.focus(), 60);
}

async function renderDashboard(session) {
    const pendingToken = sessionStorage.getItem('sentinel_join_token');
    const pendingSlug = sessionStorage.getItem('sentinel_join_slug');
    const pendingName = sessionStorage.getItem('sentinel_join_name');

    if (pendingToken && pendingSlug) {
        sessionStorage.removeItem('sentinel_join_token');
        sessionStorage.removeItem('sentinel_join_slug');
        sessionStorage.removeItem('sentinel_join_name');
        
        window.location.href = `/join?token=${pendingToken}&slug=${pendingSlug}&name=${encodeURIComponent(pendingName || '')}`;
        return;
    }

    if (!hasConfirmedEmail(session.user)) {
        showEmailGate(session);
        return;
    }

    if (renderDashboard.busy) return;
    renderDashboard.busy = true;

    // Strict MFA: a password-only (aal1) session for an MFA account must complete
    // the authenticator challenge before it can load any dashboard data. The
    // server blocks aal1 data access; here we bounce to a full re-login so the
    // user actually gets prompted (fail-open on a transient check error, since
    // the server still protects the data).
    try {
        if (sentinelAuth && sentinelAuth.auth.mfa && sentinelAuth.auth.mfa.getAuthenticatorAssuranceLevel) {
            const { data: aal } = await sentinelAuth.auth.mfa.getAuthenticatorAssuranceLevel();
            if (aal && aal.nextLevel === 'aal2' && aal.currentLevel === 'aal1') {
                try { await sentinelAuth.auth.signOut(); } catch (e) {}
                window.location.href = '/auth';
                return;
            }
        }
    } catch (e) {}

    try {
        const token = session.access_token;
        const user = session.user;
        window.supabaseAuthToken = token;
        
        document.body.classList.add('state-org-home');

        let rawUsername = user.email || 'user';
        let displayIdentifier = user.email || 'user';
        let avatarInitial = '?';
        if (user.user_metadata) {
            if (user.user_metadata.user_name) {
                rawUsername = user.user_metadata.user_name;
                displayIdentifier = `@${rawUsername}`;
                avatarInitial = rawUsername.charAt(0);
            } else if (user.user_metadata.full_name) {
                avatarInitial = user.user_metadata.full_name.charAt(0);
            }
        }
        if (avatarInitial === '?' && displayIdentifier) avatarInitial = displayIdentifier.charAt(0);

        try {
            const cachedRaw = localStorage.getItem('sentinel-cached-profile');
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw);
                if (cached && cached.email && cached.email === user.email) {
                    const cachedDisplayId = cached.username || cached.email;
                    if (cachedDisplayId) {
                        rawUsername = cachedDisplayId;
                        displayIdentifier = cached.username ? `@${cached.username}` : cached.email;
                        avatarInitial = cachedDisplayId.charAt(0);
                    }
                } else {
                    localStorage.removeItem('sentinel-cached-profile');
                }
            }
        } catch {}

        const avatarEl = document.getElementById('org-avatar-circle');
        if (avatarEl) avatarEl.textContent = avatarInitial.toUpperCase();
        
        const teamAvatarEl = document.getElementById('team-owner-avatar');
        if (teamAvatarEl) teamAvatarEl.textContent = avatarInitial.toUpperCase();
        
        const teamEmailEl = document.getElementById('current-user-email');
        if (teamEmailEl) teamEmailEl.textContent = rawUsername;

        const dropdownEmailEl = document.getElementById('dropdown-email');
        if (dropdownEmailEl) dropdownEmailEl.textContent = displayIdentifier;

        const menuTrigger = document.getElementById('user-menu-trigger');
        const dropdownMenu = document.getElementById('user-dropdown');
        if (menuTrigger && dropdownMenu && !menuTrigger.dataset.initialized) {
            menuTrigger.dataset.initialized = "true";
            menuTrigger.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                if (document.body.classList.contains('mobile-sidebar-open')) {
                    document.body.classList.remove('mobile-sidebar-open');
                }
                menuTrigger.classList.toggle('active');
                dropdownMenu.classList.toggle('active');
            };
        }

        const currentPath = window.location.pathname;
        const orgMatch = currentPath.match(/^\/dashboard\/org\/([a-z0-9]{20})(\/[a-z0-9-]+)?$/);
        const isValidHome = currentPath === '/dashboard' || currentPath === '/dashboard/organizations' || currentPath === '/dashboard/';
        const accountMatch = currentPath.match(/^\/dashboard\/account\/settings(?:\/(preferences|security|access-tokens))?$/);

        if (orgMatch) {
            switchToOrgView(orgMatch[1], orgMatch[2] ? orgMatch[2].substring(1) : 'projects');
        } else if (isValidHome) {
            switchToHomeView();
        } else if (accountMatch) {
            const tab = accountMatch[1] || 'preferences';
            document.title = 'sentinelpay | account settings';
            if (!accountMatch[1]) {
                history.replaceState({}, '', '/dashboard/account/settings/preferences');
            }
            switchToAccountSettings(tab);
        } else {
            window.location.replace('/dashboard/organizations');
            return;
        }

        const cachedOrgs = localStorage.getItem('sentinel-cached-orgs');
        const orgCardsGrid = document.querySelector('.org-cards-grid');
        if (orgCardsGrid) {
            if (cachedOrgs) {
                try {
                    const orgs = JSON.parse(cachedOrgs);
                    updateOrgGrid(orgs);
                } catch(e) {
                    orgCardsGrid.innerHTML = '<div class="sync-shimmer">syncing organizations...</div>';
                }
            } else {
                orgCardsGrid.innerHTML = '<div class="sync-shimmer">syncing organizations...</div>';
            }
        }

        fetchHeaderApiKey(token);
        fetchProfile(token);
        fetchPendingInvitations(token);

        setupCreateOrgModal(token);
        setupInviteMemberModal(token);
        setupSidebar();
        setupMobileNav();
        initOrgSearch();
        setupShortcuts();
        setupTelemetry();
        setupAccountDeletion();
        setupSecurity();
        setupRecoveryCodes();
        setupChangePassword();
        sessionHeartbeat(token).then(() => setupSessions());
    } catch (e) {
        console.error('[sentinel-render] Critical failure:', e);
        showStatus('Render Error', 'error');
    } finally {
        renderDashboard.busy = false;
    }
}

function setupMobileNav() {
    const toggle = document.getElementById('mobile-nav-toggle');
    const hamburger = document.getElementById('mobile-hamburger-btn');
    const overlay = document.getElementById('mobile-sidebar-overlay');
    const sidebar = document.querySelector('.sidebar');

    if (!overlay) return;
    if (overlay.dataset.mobileBound) return;
    overlay.dataset.mobileBound = 'true';

    const openMobileNav = () => {
        document.body.classList.add('mobile-sidebar-open');
    };

    const closeMobileNav = () => {
        document.body.classList.remove('mobile-sidebar-open');
    };

    if (toggle) {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = 'https://sentinelpay.org';
        });
    }

    if (hamburger) {
        hamburger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const trigger = document.getElementById('user-menu-trigger');
            const dropdown = document.getElementById('user-dropdown');
            if (dropdown && dropdown.classList.contains('active')) {
                trigger && trigger.classList.remove('active');
                dropdown.classList.remove('active');
                flipToMainPanel();
            }
            document.body.classList.toggle('mobile-sidebar-open');
        });
    }

    overlay.addEventListener('click', closeMobileNav);

    if (sidebar) {
        sidebar.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                setTimeout(closeMobileNav, 200);
            });
        });
    }

    const observer = new MutationObserver(() => {
        const desktopSuffix = document.getElementById('api-key-suffix');
        const mobileSuffix = document.getElementById('mobile-api-key-suffix');
        if (desktopSuffix && mobileSuffix) {
            mobileSuffix.textContent = desktopSuffix.textContent;
        }
    });
    const desktopSuffix = document.getElementById('api-key-suffix');
    if (desktopSuffix) {
        observer.observe(desktopSuffix, { childList: true, characterData: true, subtree: true });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMobileNav();
    });
}

function setupCreateOrgModal(token) {
    const modal = document.getElementById('create-org-modal-overlay');
    const openBtn = document.getElementById('mock-new-org-btn');
    const closeBtn = document.getElementById('btn-close-create-org');
    const form = document.getElementById('create-org-form');
    const errorEl = document.getElementById('create-org-error');
    const submitBtn = document.getElementById('btn-submit-org');

    if (!modal || !openBtn || !closeBtn || !form) return;
    if (openBtn.dataset.bound) return;
    openBtn.dataset.bound = "true";

    const PLANS = {
        starter: {
            label: 'starter',
            price: '$99',
            period: '/mo',
            features: ['1 rpc endpoint', 'up to 250 monitored addresses', 'real-time email alerts', 'on-demand api scan access', 'standard support'],
            featured: false
        },
        pro: {
            label: 'pro',
            price: '$399',
            period: '/mo',
            features: ['up to 5 rpc endpoints', 'up to 2,500 monitored addresses', 'email + webhook alerts', 'custom risk thresholds per endpoint', 'priority support'],
            featured: true
        },
        enterprise: {
            label: 'enterprise',
            price: 'custom',
            period: '',
            features: ['unlimited rpc endpoints', 'unlimited monitored addresses', 'dedicated infrastructure', 'custom alert integrations', 'sla + dedicated support'],
            contact: true
        }
    };

    let _cryptoIntervals = { poll: null, countdown: null };
    let _currentSessionGen = 0;
    let _batchSessions = null;
    let _stripeCheckout = null;

    const resetToStep1 = () => {
        clearInterval(_cryptoIntervals.poll);
        clearInterval(_cryptoIntervals.countdown);
        _cryptoIntervals = { poll: null, countdown: null };
        _currentSessionGen = 0;
        _batchSessions = null;
        if (_stripeCheckout) { _stripeCheckout.destroy(); _stripeCheckout = null; }
        const step1 = document.getElementById('create-org-step-1');
        const step2 = document.getElementById('create-org-step-2');
        const step3 = document.getElementById('create-org-step-3');
        if (step1) step1.style.display = 'flex';
        if (step2) { step2.style.display = 'none'; step2.innerHTML = ''; }
        if (step3) { step3.style.display = 'none'; step3.innerHTML = ''; }
    };

    const openModal = () => {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
        lockBodyScroll();
        form.reset();
        errorEl.style.display = 'none';

        const planDisplay = document.querySelector('#plan-select-trigger .selected-value');
        if (planDisplay) planDisplay.textContent = 'starter — $99/mo';
        const planInput = document.getElementById('org-plan');
        if (planInput) planInput.value = 'starter';
        document.querySelectorAll('#plan-select-dropdown .sentinel-select-option').forEach(o => {
            o.classList.toggle('selected', o.dataset.value === 'starter');
        });

        const recEl = document.getElementById('org-name-rec');
        const successIcon = document.getElementById('org-name-success');
        if (recEl) recEl.style.display = 'none';
        if (successIcon) successIcon.style.display = 'none';

        document.querySelectorAll('.sentinel-select-trigger').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sentinel-select-dropdown').forEach(d => d.classList.remove('active'));

        resetToStep1();
    };

    const closeModal = () => {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
        unlockBodyScroll();
        resetToStep1();
    };

    openBtn.onclick = (e) => { e.preventDefault(); openModal(); };
    closeBtn.onclick = (e) => { e.preventDefault(); closeModal(); };

    const dropdownCreateBtn = document.getElementById('dropdown-create-org');
    if (dropdownCreateBtn && !dropdownCreateBtn.dataset.bound) {
        dropdownCreateBtn.dataset.bound = 'true';
        dropdownCreateBtn.onclick = (e) => { e.preventDefault(); openModal(); };
    }

    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    const initSelect = (idPrefix) => {
        const trigger = document.getElementById(`${idPrefix}-select-trigger`);
        const dropdown = document.getElementById(`${idPrefix}-select-dropdown`);
        const hiddenInput = document.getElementById(`org-${idPrefix}`);
        const options = dropdown.querySelectorAll('.sentinel-select-option');
        const displayVal = trigger.querySelector('.selected-value');

        trigger.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.sentinel-select-trigger').forEach(t => { if (t !== trigger) t.classList.remove('active'); });
            document.querySelectorAll('.sentinel-select-dropdown').forEach(d => { if (d !== dropdown) d.classList.remove('active'); });
            trigger.classList.toggle('active');
            dropdown.classList.toggle('active');
        };

        options.forEach(opt => {
            opt.onclick = () => {
                options.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                hiddenInput.value = opt.dataset.value;
                displayVal.textContent = opt.textContent;
                trigger.classList.remove('active');
                dropdown.classList.remove('active');
            };
        });
    };

    initSelect('plan');

    const nameInput = document.getElementById('org-name');
    const recEl = document.getElementById('org-name-rec');
    const successIcon = document.getElementById('org-name-success');
    let checkTimeout;

    nameInput.oninput = () => {
        clearTimeout(checkTimeout);
        const val = nameInput.value.trim();
        if (val.length < 2) {
            recEl.style.display = 'none';
            if (successIcon) successIcon.style.display = 'none';
            return;
        }
        checkTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`/v1/organizations/check?name=${encodeURIComponent(val)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const { available } = await res.json();
                if (!available) {
                    const random = Math.floor(100000 + Math.random() * 900000);
                    const rec = `${val.toLowerCase().replace(/\s+/g, '-')}-${random}`;
                    recEl.innerHTML = `${val.toLowerCase()} is taken. try <span class="org-rec-link" id="btn-use-rec">${rec}</span> instead.`;
                    recEl.style.display = 'block';
                    const recLink = document.getElementById('btn-use-rec');
                    if (recLink) {
                        recLink.onclick = () => {
                            nameInput.value = rec;
                            nameInput.dispatchEvent(new Event('input'));
                        };
                    }
                    if (successIcon) successIcon.style.display = 'none';
                } else {
                    recEl.style.display = 'none';
                    if (successIcon) successIcon.style.display = 'block';
                }
            } catch (e) {}
        }, 400);
    };

    document.addEventListener('click', () => {
        document.querySelectorAll('.sentinel-select-trigger').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sentinel-select-dropdown').forEach(d => d.classList.remove('active'));
    });

    const transitionToStep3 = (name, plan) => {
        const step2 = document.getElementById('create-org-step-2');
        const step3 = document.getElementById('create-org-step-3');
        const p = PLANS[plan] || PLANS.starter;

        step3.innerHTML = `
            <button id="btn-step3-back" style="position:absolute;top:0.5rem;left:0.5rem;background:transparent;border:none;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:0.73rem;padding:0.5rem;border-radius:6px;transition:color 0.2s;z-index:1001;line-height:1;-webkit-tap-highlight-color:transparent;transform:none !important;box-shadow:none !important;">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>back
            </button>
            <div style="padding-top:2.25rem;width:100%;">
                <div class="auth-tabs" style="margin-bottom:1.25rem;display:flex;justify-content:flex-start;">
                    <button class="auth-tab active" id="tab-btn-card" style="width:auto;padding:0.4rem 1rem;font-size:0.7rem;border-radius:6px;">pay with card</button>
                    <button class="auth-tab" id="tab-btn-crypto" style="width:auto;padding:0.4rem 1rem;font-size:0.7rem;border-radius:6px;">pay with crypto</button>
                </div>
                <div id="tab-content-card">
                    <p id="create-org-pay-error" class="error-msg" style="display:none;margin-bottom:0.5rem;"></p>
                    <div id="stripe-checkout-container" style="min-height:180px;"></div>
                </div>
                <div id="tab-content-crypto" style="display:none;">
                    <div id="crypto-selector-view">
                        <div style="font-family:'JetBrains Mono',monospace;font-size:0.67rem;color:var(--text-muted);margin-bottom:0.5rem;letter-spacing:0.03em;">select currency</div>
                        <div id="crypto-dd-wrap" style="position:relative;">
                            <button id="crypto-dd-trigger" style="width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:0.6rem 0.8rem;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:0.6rem;box-sizing:border-box;-webkit-tap-highlight-color:transparent;box-shadow:none !important;transform:none !important;transition:border-color 0.18s ease;">
                                <div id="crypto-dd-selected" style="display:flex;align-items:center;gap:0.5rem;flex:1;min-width:0;">
                                    <span style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:var(--text-muted);">choose a currency...</span>
                                </div>
                                <svg id="crypto-dd-chevron" style="flex-shrink:0;transition:transform 0.18s;" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div id="crypto-dd-panel" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#090909;border:1px solid rgba(255,255,255,0.1);border-radius:8px;z-index:200;max-height:200px;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.7);"></div>
                        </div>
                        <div id="network-dd-wrap" style="display:none;position:relative;margin-top:0.5rem;">
                            <button id="network-dd-trigger" style="width:100%;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:0.6rem 0.8rem;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:0.6rem;box-sizing:border-box;-webkit-tap-highlight-color:transparent;box-shadow:none !important;transform:none !important;transition:border-color 0.18s ease;">
                                <span id="network-dd-selected" style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:var(--text-muted);">select network...</span>
                                <svg id="network-dd-chevron" style="flex-shrink:0;transition:transform 0.18s;" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div id="network-dd-panel" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#090909;border:1px solid rgba(255,255,255,0.1);border-radius:8px;z-index:200;max-height:160px;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.7);"></div>
                        </div>
                        <p id="crypto-sel-error" style="display:none;font-family:'JetBrains Mono',monospace;font-size:0.67rem;color:#ff3333;margin-top:0.45rem;margin-bottom:0;"></p>
                    </div>
                    <div id="crypto-status-area" style="margin-top:0.75rem;"></div>
                </div>
            </div>
        `;

        step2.style.display = 'none';
        step3.style.display = 'flex';
        step3.style.flexDirection = 'column';
        step3.style.width = '100%';

        const CRYPTO_CURRENCIES = [
            { currency: 'BNB',  name: 'bnb',      networks: [{ id: 'bsc',      label: 'bsc'      }], color: '#F3BA2F' },
            { currency: 'BTC',  name: 'bitcoin',  networks: [{ id: 'bitcoin',  label: 'bitcoin'  }], color: '#F7931A' },
            { currency: 'DAI',  name: 'dai',      networks: [{ id: 'ethereum', label: 'erc-20'   }, { id: 'polygon', label: 'polygon'  }], color: '#F5AC37' },
            { currency: 'ETH',  name: 'ethereum', networks: [{ id: 'ethereum', label: 'ethereum' }], color: '#627EEA' },
            { currency: 'POL',  name: 'polygon',  networks: [{ id: 'polygon',  label: 'polygon'  }], color: '#8247E5' },
            { currency: 'USDC', name: 'usd coin', networks: [{ id: 'ethereum', label: 'erc-20'   }, { id: 'bsc', label: 'bep-20'  }, { id: 'polygon', label: 'polygon'  }], color: '#2775CA' },
            { currency: 'USDT', name: 'tether',   networks: [{ id: 'ethereum', label: 'erc-20'   }, { id: 'bsc', label: 'bep-20'  }, { id: 'polygon', label: 'polygon'  }], color: '#26A17B' },
        ];

        const cryptoSelError = document.getElementById('crypto-sel-error');
        const ddTrigger = document.getElementById('crypto-dd-trigger');
        const ddPanel = document.getElementById('crypto-dd-panel');
        const ddSelected = document.getElementById('crypto-dd-selected');
        const ddChevron = document.getElementById('crypto-dd-chevron');
        const networkWrap = document.getElementById('network-dd-wrap');
        const netTrigger = document.getElementById('network-dd-trigger');
        const netPanel = document.getElementById('network-dd-panel');
        const netSelected = document.getElementById('network-dd-selected');
        const netChevron = document.getElementById('network-dd-chevron');
        let ddOpen = false;
        let netOpen = false;

        const _ddBorder = (open) => {
            const light = document.documentElement.classList.contains('theme-light');
            if (light) return open ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.12)';
            return open ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)';
        };

        const toggleDd = (force) => {
            ddOpen = typeof force === 'boolean' ? force : !ddOpen;
            ddPanel.style.display = ddOpen ? '' : 'none';
            ddChevron.style.transform = ddOpen ? 'rotate(180deg)' : '';
            ddTrigger.style.borderColor = _ddBorder(ddOpen);
        };

        const toggleNetDd = (force) => {
            netOpen = typeof force === 'boolean' ? force : !netOpen;
            netPanel.style.display = netOpen ? '' : 'none';
            netChevron.style.transform = netOpen ? 'rotate(180deg)' : '';
            netTrigger.style.borderColor = _ddBorder(netOpen);
        };

        ddTrigger.addEventListener('click', (e) => { e.stopPropagation(); if (netOpen) toggleNetDd(false); toggleDd(); });
        netTrigger.addEventListener('click', (e) => { e.stopPropagation(); if (ddOpen) toggleDd(false); toggleNetDd(); });
        document.addEventListener('click', () => { if (ddOpen) toggleDd(false); if (netOpen) toggleNetDd(false); });

        const showCryptoPayment = (session, coin) => {
            const statusArea = document.getElementById('crypto-status-area');
            if (!statusArea) return;

            const expiresAt = new Date(session.expiresAt);
            const getTimeLeft = () => {
                const diff = expiresAt - Date.now();
                if (diff <= 0) return '00:00';
                const m = Math.floor(diff / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
            };

            const _sm = window.innerWidth <= 600;
            const _qr = _sm ? '82' : '118';
            const _gap = _sm ? '0.38rem' : '0.575rem';
            const _pt = _sm ? '0.5rem' : '0.75rem';

            statusArea.innerHTML = `
                <div class="crypto-pay-wrap" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:${_pt};display:flex;flex-direction:column;gap:${_gap};">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
                        <div id="batch-id-copy" title="click to copy session id" style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;min-width:0;flex:1;overflow:hidden;-webkit-tap-highlight-color:transparent;">
                            <span id="batch-id-text" style="font-family:'JetBrains Mono',monospace;font-size:0.58rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;transition:color 0.2s;">${session.batchId}</span>
                            <span id="batch-id-icon" style="flex-shrink:0;color:var(--text-muted);opacity:0.5;display:flex;align-items:center;transition:opacity 0.2s,color 0.2s;"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></span>
                        </div>
                        <div id="crypto-countdown" style="font-family:'JetBrains Mono',monospace;font-size:0.67rem;color:#f5ac37;flex-shrink:0;">&#x23F1; ${getTimeLeft()}</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-family:'JetBrains Mono',monospace;font-size:0.63rem;color:var(--text-muted);margin-bottom:0.2rem;">send exactly</div>
                        <div class="crypto-amount" style="font-family:'JetBrains Mono',monospace;font-size:1.3rem;font-weight:700;color:#ffffff;letter-spacing:-0.025em;">${session.amountCrypto} <span class="crypto-amount-cur" style="font-size:0.68rem;color:rgba(255,255,255,0.45);">${coin.currency}</span></div>
                        <div style="font-family:'JetBrains Mono',monospace;font-size:0.6rem;color:var(--text-muted);margin-top:0.15rem;">&asymp; $${session.amountUsd.toLocaleString('en-US')}</div>
                    </div>
                    <div style="display:flex;justify-content:center;">
                        <img class="crypto-qr" src="${session.qrDataUrl}" alt="qr" style="width:${_qr}px;height:${_qr}px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);">
                    </div>
                    <div class="crypto-addr-box" style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:0.65rem 0.75rem;display:grid;grid-template-columns:1fr auto;align-items:center;gap:0.5rem;width:100%;box-sizing:border-box;">
                        <div class="crypto-addr-text" style="font-family:'JetBrains Mono',monospace;font-size:0.68rem;color:#ffffff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${session.address}</div>
                        <button id="btn-copy-address" style="background:transparent;border:none;cursor:pointer;color:var(--text-muted);padding:0.15rem;display:flex;align-items:center;transition:color 0.2s;-webkit-tap-highlight-color:transparent;transform:none !important;box-shadow:none !important;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                    </div>
                    <div style="font-family:'JetBrains Mono',monospace;font-size:0.6rem;color:var(--text-muted);text-align:center;opacity:0.6;padding:0.35rem 0;">credited after 2 confirmations</div>
                    <div id="crypto-pay-status" style="font-family:'JetBrains Mono',monospace;font-size:0.63rem;color:var(--text-muted);text-align:center;display:flex;align-items:center;justify-content:center;gap:0.375rem;min-height:0;"></div>
                </div>
            `;

            const copyBtn = document.getElementById('btn-copy-address');
            if (copyBtn) {
                const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                let copied = false;
                const showCopied = () => {
                    copied = true;
                    copyBtn.style.color = '#00ff88';
                    copyBtn.style.cursor = 'default';
                    copyBtn.innerHTML = CHECK_SVG;
                    setTimeout(() => {
                        if (!copyBtn) return;
                        copyBtn.style.color = 'var(--text-muted)';
                        copyBtn.style.cursor = 'pointer';
                        copyBtn.innerHTML = COPY_SVG;
                        copied = false;
                    }, 3000);
                };
                const fallbackCopy = (text) => {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();
                    try { document.execCommand('copy'); showCopied(); } catch {}
                    document.body.removeChild(ta);
                };
                copyBtn.onclick = () => {
                    if (copied) return;
                    if (navigator.clipboard && window.isSecureContext) {
                        navigator.clipboard.writeText(session.address).then(showCopied).catch(() => fallbackCopy(session.address));
                    } else {
                        fallbackCopy(session.address);
                    }
                };
            }

            const batchCopyEl = document.getElementById('batch-id-copy');
            if (batchCopyEl) {
                const batchText = document.getElementById('batch-id-text');
                const batchIcon = document.getElementById('batch-id-icon');
                const CHECK_SMALL = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                const COPY_SMALL = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                let batchCopied = false;
                const showBatchCopied = () => {
                    batchCopied = true;
                    if (batchText) { batchText.style.color = '#00ff88'; }
                    if (batchIcon) { batchIcon.style.color = '#00ff88'; batchIcon.style.opacity = '1'; batchIcon.innerHTML = CHECK_SMALL; }
                    setTimeout(() => {
                        if (batchText) batchText.style.color = 'var(--text-muted)';
                        if (batchIcon) { batchIcon.style.color = 'var(--text-muted)'; batchIcon.style.opacity = '0.5'; batchIcon.innerHTML = COPY_SMALL; }
                        batchCopied = false;
                    }, 2500);
                };
                const fallbackBatch = (text) => {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
                    document.body.appendChild(ta);
                    ta.focus();
                    ta.select();
                    try { document.execCommand('copy'); showBatchCopied(); } catch {}
                    document.body.removeChild(ta);
                };
                batchCopyEl.onmouseenter = () => { if (!batchCopied && batchIcon) batchIcon.style.opacity = '1'; };
                batchCopyEl.onmouseleave = () => { if (!batchCopied && batchIcon) batchIcon.style.opacity = '0.5'; };
                batchCopyEl.onclick = () => {
                    if (batchCopied) return;
                    const val = session.batchId;
                    if (navigator.clipboard && window.isSecureContext) {
                        navigator.clipboard.writeText(val).then(showBatchCopied).catch(() => fallbackBatch(val));
                    } else {
                        fallbackBatch(val);
                    }
                };
            }

            _cryptoIntervals.countdown = setInterval(() => {
                const el = document.getElementById('crypto-countdown');
                if (!el) { clearInterval(_cryptoIntervals.countdown); return; }
                const t = getTimeLeft();
                el.textContent = '⏱ ' + t;
                if (t === '00:00') {
                    clearInterval(_cryptoIntervals.countdown);
                    _cryptoIntervals.countdown = null;
                    const statusEl = document.getElementById('crypto-pay-status');
                    if (statusEl) statusEl.innerHTML = '<span style="color:#ff3333;">session expired. change currency to refresh.</span>';
                }
            }, 1000);

            _cryptoIntervals.poll = setInterval(async () => {
                try {
                    const r = await fetch('/v1/crypto/session/' + session.id, {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const data = await r.json();
                    if (data.status === 'confirmed') {
                        clearInterval(_cryptoIntervals.poll);
                        clearInterval(_cryptoIntervals.countdown);
                        _cryptoIntervals.poll = null;
                        _cryptoIntervals.countdown = null;
                        const statusEl = document.getElementById('crypto-pay-status');
                        if (statusEl) statusEl.innerHTML = '<span style="color:#00f0ff;">✓ payment confirmed!</span>';
                        setTimeout(() => { closeModal(); window.location.replace('/dashboard/organizations'); }, 2000);
                    }
                } catch (e) {}
            }, 10000);
        };

        const handleCryptoSelect = async (coin) => {
            const cacheKey = coin.currency + ':' + coin.network;

            if (_batchSessions && new Date(_batchSessions.expiresAt) > Date.now()) {
                const sess = _batchSessions.sessions[cacheKey];
                if (sess) {
                    clearInterval(_cryptoIntervals.poll);
                    clearInterval(_cryptoIntervals.countdown);
                    _cryptoIntervals = { poll: null, countdown: null };
                    showCryptoPayment(sess, coin);
                    return;
                }
            }

            const gen = ++_currentSessionGen;
            const statusArea = document.getElementById('crypto-status-area');
            if (statusArea) {
                statusArea.innerHTML = '<p style="font-family:\'JetBrains Mono\',monospace;font-size:0.67rem;color:var(--text-muted);margin:0.5rem 0 0 0;text-align:center;">generating deposit address...</p>';
            }
            try {
                const batchRes = await fetch('/v1/crypto/batch-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ plan, orgName: name })
                });
                const batchData = await batchRes.json();
                if (!batchRes.ok) throw new Error(batchData.error || 'failed to create payment session');
                if (gen !== _currentSessionGen) return;
                _batchSessions = batchData;
                const sess = _batchSessions.sessions[cacheKey];
                if (!sess) throw new Error('currency not available');
                showCryptoPayment(sess, coin);
            } catch (err) {
                if (gen !== _currentSessionGen) return;
                const area = document.getElementById('crypto-status-area');
                if (area) {
                    area.innerHTML = `<p style="font-family:'JetBrains Mono',monospace;font-size:0.67rem;color:#ff3333;margin:0.5rem 0 0 0;text-align:center;">error: ${err.message.toLowerCase()}</p>`;
                }
            }
        };

        const COIN_IMG = {
            ETH:  'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/eth.svg',
            BTC:  'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/btc.svg',
            BNB:  'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/bnb.svg',
            POL:  'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/matic.svg',
            USDT: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/usdt.svg',
            USDC: 'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/usdc.svg',
            DAI:  'https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/dai.svg',
        };

        let selectedCurrency = null;
        let selectedNetwork = null;

        const renderDdSelected = (cur) => {
            ddSelected.innerHTML = '';
            const sWrap = document.createElement('div');
            sWrap.style.cssText = 'width:18px;height:18px;border-radius:50%;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:' + cur.color + '1a;';
            const sImg = document.createElement('img');
            sImg.src = COIN_IMG[cur.currency] || '';
            sImg.alt = cur.currency;
            sImg.style.cssText = 'width:18px;height:18px;border-radius:50%;object-fit:cover;';
            sImg.onerror = () => { sImg.style.display = 'none'; };
            sWrap.appendChild(sImg);
            const sTxt = document.createElement('span');
            sTxt.className = 'crypto-dd-sel-txt';
            sTxt.textContent = cur.name;
            ddSelected.appendChild(sWrap);
            ddSelected.appendChild(sTxt);
        };

        const renderNetSelected = (net) => {
            netSelected.textContent = net.label;
            netSelected.style.color = '';
            netSelected.classList.add('crypto-dd-sel-txt');
        };

        const populateNetworkDd = (cur) => {
            netPanel.innerHTML = '';
            cur.networks.forEach((net) => {
                const item = document.createElement('div');
                item.className = 'crypto-dd-item';
                item.textContent = net.label;
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectedNetwork = net;
                    toggleNetDd(false);
                    renderNetSelected(net);
                    clearInterval(_cryptoIntervals.poll);
                    clearInterval(_cryptoIntervals.countdown);
                    _cryptoIntervals = { poll: null, countdown: null };
                    handleCryptoSelect({ currency: selectedCurrency.currency, network: selectedNetwork.id, net: selectedNetwork.label });
                });
                netPanel.appendChild(item);
            });
        };

        const onCurrencySelect = (cur) => {
            selectedCurrency = cur;
            selectedNetwork = cur.networks[0];
            toggleDd(false);
            renderDdSelected(cur);
            if (cur.networks.length > 1) {
                populateNetworkDd(cur);
                renderNetSelected(cur.networks[0]);
                networkWrap.style.display = '';
            } else {
                networkWrap.style.display = 'none';
            }
            const cryptoTab = document.getElementById('tab-content-crypto');
            if (cryptoTab && cryptoTab.style.display !== 'none') {
                clearInterval(_cryptoIntervals.poll);
                clearInterval(_cryptoIntervals.countdown);
                _cryptoIntervals = { poll: null, countdown: null };
                handleCryptoSelect({ currency: cur.currency, network: cur.networks[0].id, net: cur.networks[0].label });
            }
        };

        CRYPTO_CURRENCIES.forEach((cur) => {
            const item = document.createElement('div');
            item.className = 'crypto-dd-item';
            item.textContent = cur.name;
            item.addEventListener('click', (e) => { e.stopPropagation(); onCurrencySelect(cur); });
            ddPanel.appendChild(item);
        });

        onCurrencySelect(CRYPTO_CURRENCIES.find(c => c.currency === 'ETH'));

        document.getElementById('btn-step3-back').onclick = () => {
            clearInterval(_cryptoIntervals.poll);
            clearInterval(_cryptoIntervals.countdown);
            _cryptoIntervals = { poll: null, countdown: null };
            if (_stripeCheckout) { _stripeCheckout.destroy(); _stripeCheckout = null; }
            step3.style.display = 'none';
            step3.innerHTML = '';
            step2.style.display = 'flex';
            step2.style.flexDirection = 'column';
            step2.style.width = '100%';
        };

        document.getElementById('tab-btn-card').onclick = () => {
            document.getElementById('tab-btn-card').classList.add('active');
            document.getElementById('tab-btn-crypto').classList.remove('active');
            document.getElementById('tab-content-card').style.display = '';
            document.getElementById('tab-content-crypto').style.display = 'none';
        };

        document.getElementById('tab-btn-crypto').onclick = () => {
            document.getElementById('tab-btn-crypto').classList.add('active');
            document.getElementById('tab-btn-card').classList.remove('active');
            document.getElementById('tab-content-crypto').style.display = '';
            document.getElementById('tab-content-card').style.display = 'none';
            const statusArea = document.getElementById('crypto-status-area');
            if (selectedCurrency && selectedNetwork && statusArea && !statusArea.querySelector('#crypto-pay-status')) {
                clearInterval(_cryptoIntervals.poll);
                clearInterval(_cryptoIntervals.countdown);
                _cryptoIntervals = { poll: null, countdown: null };
                handleCryptoSelect({ currency: selectedCurrency.currency, network: selectedNetwork.id, net: selectedNetwork.label });
            }
        };

        const initStripeEmbedded = async () => {
            if (_stripeCheckout) return;
            const container = document.getElementById('stripe-checkout-container');
            const payErrEl = document.getElementById('create-org-pay-error');
            if (!container) return;

            container.innerHTML = '<p style="font-family:\'JetBrains Mono\',monospace;font-size:0.67rem;color:var(--text-muted);text-align:center;padding:1rem 0;">initializing secure checkout...</p>';

            try {
                if (!window.Stripe) throw new Error('payment system not ready, please refresh');

                const cfgRes = await fetch('/v1/stripe/config', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const cfgData = await cfgRes.json();
                if (!cfgRes.ok || !cfgData.publishableKey) throw new Error('payment configuration unavailable');

                const sessRes = await fetch('/v1/stripe/embedded-checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ plan, orgName: name })
                });
                const sessData = await sessRes.json();
                if (!sessRes.ok || !sessData.clientSecret) throw new Error(sessData.error || 'failed to initialize checkout');

                const stripeInst = window.Stripe(cfgData.publishableKey);
                _stripeCheckout = await stripeInst.initEmbeddedCheckout({
                    clientSecret: sessData.clientSecret,
                    onComplete: () => {
                        if (_stripeCheckout) { _stripeCheckout.destroy(); _stripeCheckout = null; }
                        window.location.replace('/dashboard/organizations?stripe=success');
                    }
                });

                container.innerHTML = '';
                container.style.maxHeight = '420px';
                container.style.overflowY = 'auto';
                container.style.overscrollBehavior = 'contain';
                _stripeCheckout.mount(container);
            } catch (err) {
                if (payErrEl) {
                    payErrEl.textContent = `error: ${err.message.toLowerCase()}`;
                    payErrEl.style.display = 'block';
                }
                if (container) container.innerHTML = '';
            }
        };

        initStripeEmbedded();
    };

    const transitionToStep2 = (name, plan) => {
        const step1 = document.getElementById('create-org-step-1');
        const step2 = document.getElementById('create-org-step-2');
        const p = PLANS[plan] || PLANS.starter;
        const isEnterprise = !!p.contact;

        step2.innerHTML = `
            <button id="btn-step2-back" style="position:absolute;top:0.5rem;left:0.5rem;background:transparent;border:none;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:0.73rem;padding:0.5rem;border-radius:6px;transition:color 0.2s;z-index:1001;-webkit-tap-highlight-color:transparent;line-height:1;transform:none !important;box-shadow:none !important;">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>back
            </button>
            <div style="padding-top:2.25rem;width:100%;">
                <div class="co-org-row" style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:0.6rem 0.875rem;margin-bottom:0.875rem;">
                    <div style="display:flex;align-items:center;gap:0.6rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                        <span style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:var(--text-muted);">organization</span>
                    </div>
                    <span class="co-org-name" style="font-family:'JetBrains Mono',monospace;font-size:0.74rem;color:#e0e0e0;font-weight:500;">${escHtml(name)}</span>
                </div>
                <div class="org-plan-card-summary${p.featured ? ' plan-featured' : ''}">
                    ${p.featured ? '<div class="plan-accent-bar"></div>' : ''}
                    <div class="plan-card-inner">
                        <div class="plan-card-top">
                            <span class="plan-card-label${p.featured ? ' plan-label-accent' : ''}">${p.label}</span>
                            ${p.featured ? '<span class="plan-card-popular">most popular</span>' : ''}
                        </div>
                        <div class="plan-price-row">
                            ${!isEnterprise ? `<span class="plan-price-currency">${p.price.charAt(0)}</span><span class="plan-price-amount">${p.price.slice(1)}</span><span class="plan-price-period">/mo</span>` : `<span class="plan-price-amount" style="font-size:1.5rem;letter-spacing:-1px;color:rgba(255,255,255,0.6);">custom pricing</span>`}
                        </div>
                        <div class="plan-card-divider"></div>
                        <ul class="plan-features-list">
                            ${p.features.map(f => `<li class="plan-feature-item"><svg class="plan-feat-check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>${f}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                ${isEnterprise ? `
                <div style="margin-top:1.1rem;padding:0.875rem 1rem;background:rgba(0,240,255,0.03);border:1px solid rgba(0,240,255,0.1);border-radius:10px;font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--text-muted);line-height:1.7;text-align:center;">
                    enterprise plans require custom configuration.<br>reach out and we'll get you set up.
                </div>
                <a href="mailto:support@sentinelpay.org" class="submit-btn" style="margin-top:1rem;display:flex;align-items:center;justify-content:center;text-decoration:none;">contact sales →</a>
                ` : `
                <p id="create-org-pay-error" class="error-msg" style="display:none;margin-top:0.75rem;"></p>
                <button class="submit-btn" id="btn-proceed-checkout" style="margin-top:1rem;display:flex;align-items:center;justify-content:center;gap:8px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                    proceed to checkout
                </button>
                `}
            </div>
        `;

        step1.style.display = 'none';
        step2.style.display = 'flex';
        step2.style.flexDirection = 'column';
        step2.style.width = '100%';

        document.getElementById('btn-step2-back').onclick = () => {
            step2.style.display = 'none';
            step2.innerHTML = '';
            step1.style.display = 'flex';
        };

        if (!isEnterprise) {
            const payBtn = document.getElementById('btn-proceed-checkout');
            const payErrEl = document.getElementById('create-org-pay-error');

            payBtn.onclick = () => transitionToStep3(name, plan);
        }
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('org-name').value.trim();
        const plan = document.getElementById('org-plan').value;

        if (name.length < 2) {
            errorEl.textContent = 'error: name must be at least 2 characters.';
            errorEl.style.display = 'block';
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'checking...';
            errorEl.style.display = 'none';

            const res = await fetch(`/v1/organizations/check?name=${encodeURIComponent(name)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const { available } = await res.json();

            if (!available) {
                errorEl.textContent = 'error: name already taken.';
                errorEl.style.display = 'block';
                return;
            }

            transitionToStep2(name, plan);
        } catch (err) {
            errorEl.textContent = `error: ${err.message.toLowerCase()}`;
            errorEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'continue';
        }
    };
}

let inviteTurnstileId = null;

function setupInviteMemberModal(token) {
    const modal = document.getElementById('invite-member-modal-overlay');
    const openBtn = document.getElementById('btn-invite-member');
    const closeBtn = document.getElementById('btn-close-invite-modal');
    const form = document.getElementById('invite-member-form');
    const submitBtn = document.getElementById('btn-submit-invite');

    if (!modal || !openBtn || !closeBtn || !form) return;
    if (openBtn.dataset.bound) return;
    openBtn.dataset.bound = "true";

    const getInviteCooldown = () => {
        const last = localStorage.getItem('sentinel-last-invite-sent');
        if (!last) return 0;
        const remaining = 60000 - (Date.now() - parseInt(last));
        return Math.max(0, Math.ceil(remaining / 1000));
    };

    const updateSubmitBtnState = () => {
        const remaining = getInviteCooldown();
        if (remaining > 0) {
            submitBtn.disabled = true;
            submitBtn.textContent = `wait ${remaining}s...`;
            setTimeout(updateSubmitBtnState, 1000);
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = 'send invitation';
        }
    };

    const openModal = () => {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
        lockBodyScroll();
        form.reset();

        if (window.turnstile) {
            const container = document.getElementById('turnstile-invite');
            if (container) {
                container.innerHTML = ''; 
                inviteTurnstileId = window.turnstile.render(container, {
                    sitekey: '0x4AAAAAADGpMozD1QOtWPkP',
                    theme: 'dark',
                    callback: (token) => {
                        submitBtn.setAttribute('data-captcha-token', token);
                    }
                });
            }
        }

        updateSubmitBtnState();
        document.querySelectorAll('.sentinel-select-trigger').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sentinel-select-dropdown').forEach(d => d.classList.remove('active'));
    };

    const closeModal = () => {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
        unlockBodyScroll();
        if (window.turnstile && inviteTurnstileId !== null) {
            window.turnstile.reset(inviteTurnstileId);
        }
        submitBtn.removeAttribute('data-captcha-token');
    };

    openBtn.onclick = (e) => { e.preventDefault(); openModal(); };
    closeBtn.onclick = (e) => { e.preventDefault(); closeModal(); };
    
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    const trigger = document.getElementById('invite-role-select-trigger');
    const dropdown = document.getElementById('invite-role-select-dropdown');
    const hiddenInput = document.getElementById('invite-role');
    const options = dropdown.querySelectorAll('.sentinel-select-option');
    const displayVal = trigger.querySelector('.selected-value');

    trigger.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll('.sentinel-select-trigger').forEach(t => { if(t!==trigger) t.classList.remove('active') });
        document.querySelectorAll('.sentinel-select-dropdown').forEach(d => { if(d!==dropdown) d.classList.remove('active') });
        trigger.classList.toggle('active');
        dropdown.classList.toggle('active');
    };

    options.forEach(opt => {
        opt.onclick = () => {
            options.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            hiddenInput.value = opt.dataset.value;
            displayVal.textContent = opt.textContent;
            trigger.classList.remove('active');
            dropdown.classList.remove('active');
        };
    });

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const remaining = getInviteCooldown();
        if (remaining > 0) {
            if (window.SentinelToast) window.SentinelToast.show(`please wait ${remaining}s before sending more invitations.`, "warning");
            return;
        }

        const captchaToken = submitBtn.getAttribute('data-captcha-token');
        if (!captchaToken && window.turnstile) {
            if (window.SentinelToast) window.SentinelToast.show("please verify the captcha.", "error");
            return;
        }

        const rawEmails = document.getElementById('invite-emails').value;
        const role = hiddenInput.value;

        const emailList = rawEmails.split(/[\s,]+/).filter(item => {
            return item.trim().length > 0 && /^([^\s@]+@[^\s@]+\.[^\s@]+|[a-zA-Z0-9_.-]+)$/.test(item);
        });

        if (emailList.length === 0) {
            if (window.SentinelToast) window.SentinelToast.show("please enter at least one valid email.", "error");
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'dispatching...';

            const path = window.location.pathname;
            const orgMatch = path.match(/\/dashboard\/org\/([a-z0-9]{20})/);
            const orgSlug = orgMatch ? orgMatch[1] : null;

            if (!orgSlug) throw new Error("organization context missing");

            const response = await mfaAwareFetch(`${API_URL}/v1/organizations/${orgSlug}/team/invite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    emailList,
                    role,
                    'cf-turnstile-response': captchaToken
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'failed to send invitations');
            }

            emailList.forEach(email => {
                const member = { email, role, status: 'invited', invitedAt: Date.now(), isYou: false };
                saveInvitedMember(orgSlug, member);
                teamMembersFullList.push(member);
            });

            renderTeamPage();

            localStorage.setItem('sentinel-last-invite-sent', Date.now().toString());

            if (window.SentinelToast) window.SentinelToast.show(`${emailList.length} invitation${emailList.length > 1 ? 's' : ''} dispatched successfully.`, "success");
            closeModal();
        } catch (err) {
            if (window.SentinelToast) window.SentinelToast.show(err.message, "error");
            submitBtn.disabled = false;
            submitBtn.textContent = 'send invitation';
        }
    };
}

function saveInvitedMember(orgSlug, member) {
    const key = `sentinel-invites-${orgSlug}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    if (!existing.some(m => m.email === member.email)) {
        existing.push(member);
        localStorage.setItem(key, JSON.stringify(existing));
    }
}

let currentTeamPage = 1;
const teamItemsPerPage = 6;
let teamMembersFullList = [];
let currentOrgSlug = null;

function loadInvitedMembers(orgSlug) {
    const key = `sentinel-invites-${orgSlug}`;
    const invited = JSON.parse(localStorage.getItem(key) || '[]');
    
    const ownerEmail = document.getElementById('current-user-email')?.textContent || 'owner@sentinelpay.org';
    
    teamMembersFullList = [
        { email: ownerEmail, role: 'owner', status: 'active', isYou: true },
        ...invited.map(m => ({ ...m, isYou: false }))
    ];

    currentTeamPage = 1;
    initTeamPagination();
    renderTeamPage();
}

function renderTeamPage() {
    const tableBody = document.getElementById('team-table-body');
    const pageInfo = document.getElementById('team-pagination-info');
    const btnPrev = document.getElementById('btn-team-prev');
    const btnNext = document.getElementById('btn-team-next');
    if (!tableBody) return;

    tableBody.innerHTML = '';
    
    const start = (currentTeamPage - 1) * teamItemsPerPage;
    const end = start + teamItemsPerPage;
    const pageItems = teamMembersFullList.slice(start, end);

    pageItems.forEach(m => {
        addTeamMemberToTable(m.email, m.role, m.status, m.isYou);
    });

    if (!pageInfo) return;

    const total = teamMembersFullList.length;
    const showingStart = total === 0 ? 0 : start + 1;
    const showingEnd = Math.min(end, total);
    
    pageInfo.textContent = `showing ${showingStart}-${showingEnd} of ${total}, ${total} member${total > 1 ? 's' : ''}`;
    
    if (btnPrev) {
        btnPrev.disabled = currentTeamPage === 1;
        btnPrev.style.opacity = btnPrev.disabled ? '0.3' : '1';
        btnPrev.style.cursor = btnPrev.disabled ? 'not-allowed' : 'pointer';
    }

    if (btnNext) {
        btnNext.disabled = end >= total;
        btnNext.style.opacity = btnNext.disabled ? 'not-allowed' : '1';
        btnNext.style.opacity = btnNext.disabled ? '0.3' : '1';
        btnNext.style.cursor = btnNext.disabled ? 'not-allowed' : 'pointer';
    }
}

function initTeamPagination() {
    const btnPrev = document.getElementById('btn-team-prev');
    const btnNext = document.getElementById('btn-team-next');
    if (btnPrev) {
        btnPrev.onclick = () => { if (currentTeamPage > 1) { currentTeamPage--; renderTeamPage(); } };
    }
    if (btnNext) {
        btnNext.onclick = () => { if (currentTeamPage * teamItemsPerPage < teamMembersFullList.length) { currentTeamPage++; renderTeamPage(); } };
    }
}

function addTeamMemberToTable(email, role, status = 'active', isYou = false) {
    const tableBody = document.getElementById('team-table-body');
    if (!tableBody) return;

    const row = document.createElement('tr');
    row.className = 'table-row-hover';
    row.style.cssText = 'border-bottom: 1px solid var(--border-glass); transition: background 0.2s ease;';

    const avatarInitial = email.charAt(0).toUpperCase();
    
    let statusBadge = '';
    let actionButtons = '';
    
    if (isYou) {
        statusBadge = `<span style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: var(--text-muted); font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; text-transform: lowercase; margin-left: 8px;">you</span>`;
        actionButtons = `
            <div class="tooltip-wrapper">
                <button class="btn-cancel" style="padding: 0.4rem 0.8rem; font-size: 0.7rem; border-radius: 6px; opacity: 0.5; cursor: not-allowed; pointer-events: none;" disabled>leave team</button>
                <div class="pw-tooltip team-tooltip">
                    an organization requires at least 1 owner
                </div>
            </div>
        `;
    } else if (status === 'invited') {
        statusBadge = `<span class="status-badge invited-badge">invited</span>`;
        actionButtons = `
            <div style="display: flex; align-items: center; gap: 0.75rem; justify-content: flex-end;">
                <div class="tooltip-wrapper">
                    <button class="btn-cancel" style="padding: 0.4rem 0.8rem; font-size: 0.7rem; border-radius: 6px; opacity: 0.5; cursor: not-allowed; pointer-events: none; font-family: 'JetBrains Mono', monospace;" disabled>manage access</button>
                    <div class="pw-tooltip team-tooltip">
                        access can be managed after the invite is accepted
                    </div>
                </div>
                <div class="dropdown-actions-wrapper" style="position: relative;">
                    <button class="btn-more-actions">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.6;"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                    </button>
                    <div class="dropdown-menu row-actions-dropdown" style="top: calc(100% + 8px); right: 0; width: 210px; padding: 8px; background: rgba(8, 10, 12, 0.96); border: 1px solid rgba(0, 240, 255, 0.15); border-radius: 12px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 240, 255, 0.05); z-index: 1000;">
                        <div class="dropdown-item js-resend-invite" style="font-size: 0.75rem; gap: 10px; padding: 10px; cursor: pointer; font-family: 'JetBrains Mono', monospace;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.7;"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                            resend invitation
                        </div>
                        <div class="dropdown-item text-red js-cancel-invite" style="font-size: 0.75rem; gap: 10px; padding: 10px; cursor: pointer; font-family: 'JetBrains Mono', monospace;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.7;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                            cancel invitation
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        actionButtons = `
            <div style="display: flex; justify-content: flex-end;">
                <button class="btn-cancel" style="padding: 0.4rem 0.8rem; font-size: 0.7rem; border-radius: 6px; font-family: 'JetBrains Mono', monospace;">remove</button>
            </div>
        `;
    }

    row.innerHTML = `
        <td style="padding: 1.25rem 1.5rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div class="org-avatar" style="border-radius: 8px; width: 34px; height: 34px; font-weight: 800; font-size: 0.9rem;">${escHtml(avatarInitial)}</div>
                <div style="display: flex; flex-direction: column;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; font-weight: 600; color: #fff;">${escHtml(email)}</span>
                        ${statusBadge}
                    </div>
                </div>
            </div>
        </td>
        <td style="padding: 1.25rem 1.5rem;">
            <div style="display: flex; align-items: center; gap: 6px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;">
                disabled
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>
        </td>
        <td style="padding: 1.25rem 1.5rem;">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: #fff; opacity: 0.9;">${escHtml(role)}</span>
        </td>
        <td style="padding: 1.25rem 1.5rem; text-align: right;">
            ${actionButtons}
        </td>
    `;

    tableBody.appendChild(row);

    const resendItem = row.querySelector('.js-resend-invite');
    if (resendItem) resendItem.addEventListener('click', () => resendInvite(email));
    const cancelItem = row.querySelector('.js-cancel-invite');
    if (cancelItem) cancelItem.addEventListener('click', () => cancelInvite(email, cancelItem));

    const moreBtn = row.querySelector('.btn-more-actions');
    const dropdown = row.querySelector('.row-actions-dropdown');
    if (moreBtn && dropdown) {
        moreBtn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.row-actions-dropdown.active').forEach(d => {
                if (d !== dropdown) d.classList.remove('active');
            });
            dropdown.classList.toggle('active');
        };
    }

    const countEl = document.querySelector('.team-member-count');
    if (countEl) {
        const total = tableBody.querySelectorAll('tr').length;
        countEl.textContent = `${total} member${total !== 1 ? 's' : ''}`;
    }
}

function flipToNotifPanel() {
    const dropdown = document.getElementById('user-dropdown');
    const mainPanel = document.getElementById('dropdown-main-panel');
    const notifPanel = document.getElementById('dropdown-notif-panel');
    const items = document.getElementById('notification-items');
    const panelBody = document.getElementById('notif-panel-body');
    if (!dropdown || !mainPanel || !notifPanel || !panelBody) return;
    dropdown.style.height = dropdown.offsetHeight + 'px';
    if (items) panelBody.appendChild(items);
    mainPanel.style.transition = 'opacity 0.18s ease';
    mainPanel.style.opacity = '0';
    setTimeout(() => {
        mainPanel.style.display = 'none';
        mainPanel.style.opacity = '';
        mainPanel.style.transition = '';
        notifPanel.style.opacity = '0';
        notifPanel.style.transition = 'opacity 0.18s ease';
        notifPanel.classList.add('active');
        requestAnimationFrame(() => {
            notifPanel.style.opacity = '1';
            setTimeout(() => { notifPanel.style.opacity = ''; notifPanel.style.transition = ''; }, 180);
        });
    }, 180);
}

function flipToMainPanel() {
    const dropdown = document.getElementById('user-dropdown');
    const mainPanel = document.getElementById('dropdown-main-panel');
    const notifPanel = document.getElementById('dropdown-notif-panel');
    const items = document.getElementById('notification-items');
    const itemsWrapper = document.getElementById('notification-items-wrapper');
    if (!dropdown || !mainPanel || !notifPanel) return;
    notifPanel.style.transition = 'opacity 0.18s ease';
    notifPanel.style.opacity = '0';
    setTimeout(() => {
        notifPanel.classList.remove('active');
        notifPanel.style.opacity = '';
        notifPanel.style.transition = '';
        if (items && itemsWrapper) itemsWrapper.appendChild(items);
        mainPanel.style.display = '';
        dropdown.style.height = '';
        mainPanel.style.opacity = '0';
        mainPanel.style.transition = 'opacity 0.18s ease';
        requestAnimationFrame(() => {
            mainPanel.style.opacity = '1';
            setTimeout(() => { mainPanel.style.opacity = ''; mainPanel.style.transition = ''; }, 180);
        });
    }, 180);
}

document.addEventListener('DOMContentLoaded', () => {
    const notifRow = document.getElementById('notification-row');
    const backBtn = document.getElementById('notif-panel-back');
    if (notifRow) {
        notifRow.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            flipToNotifPanel();
        });
    }
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            flipToMainPanel();
        });
    }
});

document.addEventListener('click', (e) => {
    document.querySelectorAll('.row-actions-dropdown.active').forEach(d => {
        d.classList.remove('active');
    });

    const trigger = document.getElementById('user-menu-trigger');
    const dropdown = document.getElementById('user-dropdown');
    if (trigger && dropdown && !trigger.contains(e.target) && !dropdown.contains(e.target)) {
        trigger.classList.remove('active');
        dropdown.classList.remove('active');
        flipToMainPanel();
    }
});

async function resendInvite(email) {
    const cooldownKey = `sentinel-resend-cooldown-${email}`;
    const last = localStorage.getItem(cooldownKey);
    if (last) {
        const remaining = 60000 - (Date.now() - parseInt(last));
        if (remaining > 0) {
            const secs = Math.ceil(remaining / 1000);
            if (window.SentinelToast) window.SentinelToast.show(`please wait ${secs}s before resending to this email.`, "warning");
            return;
        }
    }

    if (window.SentinelToast) window.SentinelToast.show(`resending invitation to ${email}...`, "info");
    
    try {
        const path = window.location.pathname;
        const orgMatch = path.match(/\/dashboard\/org\/([a-z0-9]{20})/);
        const orgSlug = orgMatch ? orgMatch[1] : null;

        if (!orgSlug) throw new Error("organization context missing");

        const token = window.supabaseAuthToken;

        const response = await mfaAwareFetch(`${API_URL}/v1/organizations/${orgSlug}/team/invite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                emailList: [email],
                role: 'developer'
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'failed to resend invitation');
        }

        localStorage.setItem(cooldownKey, Date.now().toString());
        
        if (window.SentinelToast) window.SentinelToast.show(`invitation resent to ${email}`, "success");
    } catch (err) {
        if (window.SentinelToast) window.SentinelToast.show(err.message, "error");
    }
}

function cancelInvite(email, btnEl) {
    const path = window.location.pathname;
    const orgMatch = path.match(/\/dashboard\/org\/([a-z0-9]{20})/);
    const orgSlug = orgMatch ? orgMatch[1] : null;

    if (orgSlug) {
        const key = `sentinel-invites-${orgSlug}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const updated = existing.filter(m => m.email !== email);
        localStorage.setItem(key, JSON.stringify(updated));
    }

    const row = btnEl.closest('tr');
    if (row) {
        row.style.opacity = '0';
        row.style.transform = 'translateX(20px)';
        setTimeout(() => {
            row.remove();
            const countEl = document.querySelector('.team-member-count');
            const tableBody = document.getElementById('team-table-body');
            if (countEl && tableBody) {
                const total = tableBody.querySelectorAll('tr').length;
                countEl.textContent = `${total} member${total !== 1 ? 's' : ''}`;
            }
        }, 300);
    }
    
    if (window.SentinelToast) window.SentinelToast.show(`invitation for ${email} cancelled`, "info");
}

function updateOrgGrid(orgs) {
    const orgCardsGrid = document.querySelector('.org-cards-grid');
    if (!orgCardsGrid) return;
    
    orgCardsGrid.innerHTML = '';
    if (orgs.length === 0) {
        orgCardsGrid.innerHTML = '<div class="empty-state">no organizations found.</div>';
    } else {
        orgs.forEach(org => {
            const card = document.createElement('div');
            card.className = 'org-card-item';
            
            const initial = org.name.charAt(0).toUpperCase();
            const planText = org.plan ? `${org.plan} plan` : 'standard plan';
            
            card.innerHTML = `
                <div class="org-card-avatar"></div>
                <div class="org-card-info">
                    <span class="org-card-name"></span>
                    <span class="org-card-meta"></span>
                </div>
                <svg style="margin-left: auto; opacity: 0.3; flex-shrink: 0;" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            `;
            card.querySelector('.org-card-avatar').textContent = initial;
            card.querySelector('.org-card-name').textContent = org.name;
            card.querySelector('.org-card-meta').textContent = planText;

            card.onclick = () => {
                const slug = org.slug;
                history.pushState({ slug }, '', `/dashboard/org/${slug}`);
                switchToOrgView(slug, 'projects');
            };

            orgCardsGrid.appendChild(card);
        });
    }
}

let _allOrgsCache = [];

function filterOrgGrid(q) {
    const grid = document.querySelector('.org-cards-grid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.org-card-item');
    const term = q.toLowerCase().trim();
    cards.forEach(card => {
        const name = (card.querySelector('.org-card-name') || {}).textContent || '';
        const matches = !term || name.toLowerCase().includes(term);
        card.style.display = matches ? '' : 'none';
        if (term && matches) {
            card.classList.add('org-card-match');
        } else {
            card.classList.remove('org-card-match');
        }
    });
}

function initOrgSearch() {
    const input = document.querySelector('.org-search-input');
    if (!input) return;
    const urlQ = new URLSearchParams(window.location.search).get('q') || '';
    if (urlQ) {
        input.value = urlQ;
        filterOrgGrid(urlQ);
    }
    input.addEventListener('input', function() {
        const q = this.value.trim();
        const url = q ? '/dashboard/organizations?q=' + encodeURIComponent(q) : '/dashboard/organizations';
        history.replaceState({}, '', url);
        filterOrgGrid(q);
    });
}

function hideAllViews() {
    ['org-home-view','org-dashboard-view','dashboard-view','org-team-view','org-settings-view','account-settings-view'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

function switchToHomeView() {
    currentOrgSlug = null;
    document.body.classList.remove('state-in-org');
    document.body.classList.add('state-org-home');
    hideAllViews();
    document.getElementById('org-home-view').classList.remove('hidden');

    const globalNav = document.getElementById('sidebar-global-nav');
    const orgNav = document.getElementById('sidebar-org-nav');
    const accountNav = document.getElementById('sidebar-account-nav');
    if (globalNav) globalNav.classList.remove('hidden');
    if (orgNav) orgNav.classList.add('hidden');
    if (accountNav) accountNav.classList.add('hidden');
}

function switchToAccountSettings(tab) {
    tab = tab || 'preferences';
    currentOrgSlug = null;
    document.body.classList.remove('state-in-org');
    document.body.classList.add('state-org-home');
    hideAllViews();
    document.getElementById('account-settings-view').classList.remove('hidden');
    document.title = 'sentinelpay | account settings';

    const globalNav = document.getElementById('sidebar-global-nav');
    const orgNav = document.getElementById('sidebar-org-nav');
    const accountNav = document.getElementById('sidebar-account-nav');
    if (globalNav) globalNav.classList.add('hidden');
    if (orgNav) orgNav.classList.add('hidden');
    if (accountNav) {
        accountNav.classList.remove('hidden');
        accountNav.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
        const tabToId = { 'preferences': 'sidebar-item-preferences', 'security': 'sidebar-item-security', 'access-tokens': 'sidebar-item-tokens' };
        const activeEl = document.getElementById(tabToId[tab]);
        if (activeEl) activeEl.classList.add('active');
    }

    const tabTitles = { 'preferences': 'preferences', 'security': 'security', 'access-tokens': 'access tokens' };
    const titleEl = document.getElementById('account-settings-tab-title');
    if (titleEl) titleEl.textContent = tabTitles[tab] || tab;

    ['preferences', 'security', 'access-tokens'].forEach(t => {
        const panel = document.getElementById('account-tab-' + t);
        if (panel) panel.style.display = t === tab ? '' : 'none';
    });

    if (tab === 'security' && typeof loadSessions === 'function') loadSessions();

    if (!accountNav || accountNav.dataset.accountNavBound) return;
    accountNav.dataset.accountNavBound = 'true';
    [
        { id: 'sidebar-item-preferences', tab: 'preferences' },
        { id: 'sidebar-item-security', tab: 'security' },
        { id: 'sidebar-item-tokens', tab: 'access-tokens' }
    ].forEach(({ id, tab: t }) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', e => {
            e.preventDefault();
            history.pushState({}, '', '/dashboard/account/settings/' + t);
            switchToAccountSettings(t);
        });
    });
}

function switchToOrgView(slug, view = 'projects') {
    currentOrgSlug = slug;
    document.body.classList.remove('state-org-home');
    document.body.classList.add('state-in-org');
    document.getElementById('org-home-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.add('hidden');
    
    const globalNav = document.getElementById('sidebar-global-nav');
    const orgNav = document.getElementById('sidebar-org-nav');
    const accountNav = document.getElementById('sidebar-account-nav');
    if (globalNav) globalNav.classList.add('hidden');
    if (orgNav) orgNav.classList.remove('hidden');
    if (accountNav) accountNav.classList.add('hidden');

    const subViews = ['org-dashboard-view', 'org-team-view', 'org-settings-view'];
    subViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    document.querySelectorAll('#sidebar-org-nav .sidebar-item').forEach(i => i.classList.remove('active'));

    if (view === 'team') {
        const teamView = document.getElementById('org-team-view');
        if (teamView) teamView.classList.remove('hidden');
        const teamItem = document.getElementById('sidebar-item-team');
        if (teamItem) teamItem.classList.add('active');
        loadTeamFromApi(slug);
    } else if (view === 'settings') {
        const settingsView = document.getElementById('org-settings-view');
        if (settingsView) settingsView.classList.remove('hidden');
        const settingsItem = document.getElementById('sidebar-item-settings');
        if (settingsItem) settingsItem.classList.add('active');
        renderOrgSettings(slug, window.supabaseAuthToken);
    } else {
        const dashView = document.getElementById('org-dashboard-view');
        if (dashView) dashView.classList.remove('hidden');
        const projItem = document.getElementById('sidebar-item-projects');
        if (projItem) projItem.classList.add('active');
        renderOrgDashboard(slug, window.supabaseAuthToken);
    }
}

async function renderOrgDashboard(slug, token) {
    const view = document.getElementById('org-dashboard-view');
    if (!view || !token) return;

    view.innerHTML = `<div style="color: var(--text-muted); font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; padding: 2rem;">loading...</div>`;

    try {
        const res = await fetch(`/v1/organizations/${slug}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('failed to load organization');
        const org = await res.json();

        const orgNameEl = document.getElementById('current-org-name');
        if (orgNameEl) orgNameEl.textContent = org.name;
        const orgAvatarEl = document.getElementById('org-avatar-circle');
        if (orgAvatarEl) orgAvatarEl.textContent = org.name.charAt(0).toUpperCase();
        const orgPlanEl = document.querySelector('.org-switcher-trigger .org-plan');
        if (orgPlanEl) orgPlanEl.textContent = `${org.plan || 'starter'} plan`;

        const cached = localStorage.getItem('sentinel-cached-orgs');
        if (cached) {
            try { updateDropdownOrgList(JSON.parse(cached), slug); } catch (e) {}
        }

        const planLabel = org.plan || 'starter';
        const regionLabel = org.region || 'americas';
        const createdLabel = new Date(org.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        const ownerBadge = org.isOwner
            ? `<span style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:var(--text-muted);font-size:0.65rem;padding:3px 8px;border-radius:4px;font-family:'JetBrains Mono',monospace;text-transform:lowercase;">owner</span>`
            : '';
        const inviteBtn = org.isOwner
            ? `<button class="btn-new-org" id="org-invite-quick-btn" style="white-space:nowrap;flex-shrink:0;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>invite members</button>`
            : '';

        view.innerHTML = `
<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
    <div>
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
            <h1 id="org-page-name" style="font-family:'JetBrains Mono',monospace;font-size:1.5rem;font-weight:800;letter-spacing:-1px;color:#fff;margin:0;"></h1>
            <span id="org-page-plan" style="background:rgba(0,240,255,0.1);border:1px solid rgba(0,240,255,0.2);color:var(--neon-blue);font-size:0.65rem;padding:3px 8px;border-radius:4px;font-family:'JetBrains Mono',monospace;text-transform:lowercase;"></span>
            ${ownerBadge}
        </div>
        <div style="color:var(--text-muted);font-family:'JetBrains Mono',monospace;font-size:0.75rem;" id="org-page-meta"></div>
    </div>
    ${inviteBtn}
</div>

<div class="summary-cards" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));">
    <div class="metric-card">
        <div class="metric-header"><span class="metric-label">total scans</span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></div>
        <div class="metric-value-container"><span class="metric-value" id="org-stat-scans">0</span></div>
        <span class="metric-trend neutral">all time</span>
    </div>
    <div class="metric-card">
        <div class="metric-header"><span class="metric-label">team members</span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>
        <div class="metric-value-container"><span class="metric-value" id="org-stat-members">0</span></div>
        <span class="metric-trend neutral">active</span>
    </div>
    <div class="metric-card">
        <div class="metric-header"><span class="metric-label">plan</span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--neon-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></div>
        <div class="metric-value-container"><span class="metric-value text-white" style="font-size:1.6rem;" id="org-stat-plan"></span></div>
        <span class="metric-trend neutral" id="org-stat-region"></span>
    </div>
    <div class="metric-card">
        <div class="metric-header"><span class="metric-label">system health</span><div class="pulse-dot-container"><div class="pulse-dot"></div></div></div>
        <div class="metric-value-container"><span class="metric-value text-white" style="font-size:2rem;">nominal</span></div>
        <span class="metric-trend neutral">all systems operational</span>
    </div>
</div>

<div class="glass-panel" style="padding:1.5rem;border-radius:12px;background:rgba(15,15,15,0.4);border:1px solid var(--border-glass);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;font-weight:700;color:#fff;text-transform:lowercase;letter-spacing:0.5px;">recent scans</div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:0.65rem;color:var(--text-muted);">last 30 days</span>
    </div>
    <div id="org-recent-scans" style="color:var(--text-muted);font-family:'JetBrains Mono',monospace;font-size:0.75rem;padding:1.5rem 0;text-align:center;opacity:0.6;">no scans yet. start scanning wallets via the api.</div>
</div>`;

        view.querySelector('#org-page-name').textContent = org.name;
        view.querySelector('#org-page-plan').textContent = org.plan || 'starter';
        view.querySelector('#org-page-meta').textContent = `${regionLabel} · created ${createdLabel}`;
        view.querySelector('#org-stat-scans').textContent = org.scanCount || 0;
        view.querySelector('#org-stat-members').textContent = org.memberCount || 0;
        view.querySelector('#org-stat-plan').textContent = org.plan || 'starter';
        view.querySelector('#org-stat-region').textContent = regionLabel;

        const quickInviteBtn = view.querySelector('#org-invite-quick-btn');
        if (quickInviteBtn) {
            quickInviteBtn.onclick = () => {
                const inviteBtn = document.getElementById('btn-invite-member');
                if (inviteBtn) inviteBtn.click();
            };
        }
    } catch (err) {
        const errDiv = document.createElement('div');
        errDiv.style.cssText = 'color:var(--color-red);font-family:\'JetBrains Mono\',monospace;font-size:0.8rem;padding:2rem;';
        errDiv.textContent = err.message;
        view.innerHTML = '';
        view.appendChild(errDiv);
    }
}

async function renderOrgSettings(slug, token) {
    const view = document.getElementById('org-settings-view');
    if (!view || !token) return;

    view.innerHTML = `<div style="color:var(--text-muted);font-family:'JetBrains Mono',monospace;font-size:0.8rem;padding:2rem;">loading...</div>`;

    try {
        const res = await fetch(`/v1/organizations/${slug}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('failed to load organization');
        const org = await res.json();

        if (!org.isOwner) {
            view.innerHTML = `<div style="color:var(--text-muted);font-family:'JetBrains Mono',monospace;font-size:0.8rem;padding:2rem;">only the owner can access settings.</div>`;
            return;
        }

        const createdLabel = new Date(org.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        view.innerHTML = `
<h1 style="font-family:'JetBrains Mono',monospace;font-size:1.5rem;font-weight:800;letter-spacing:-1px;color:#fff;margin:0 0 2rem;">settings</h1>

<div style="padding:1.5rem;border-radius:12px;background:rgba(15,15,15,0.4);border:1px solid var(--border-glass);margin-bottom:1.5rem;">
    <div style="font-family:'JetBrains Mono',monospace;font-size:0.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:1.25rem;">general</div>
    <div style="display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text-muted);">organization name</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:#e0e0e0;">${escHtml(org.name)}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text-muted);">plan</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:var(--neon-blue);">${org.plan || 'starter'}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text-muted);">region</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:#e0e0e0;">${org.region || 'americas'}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 0;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text-muted);">created</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.78rem;color:#e0e0e0;">${createdLabel}</span>
        </div>
    </div>
</div>

<div style="padding:1.5rem;border-radius:12px;background:rgba(12,4,4,0.7);border:1px solid rgba(255,51,51,0.12);">
    <div style="font-family:'JetBrains Mono',monospace;font-size:0.65rem;font-weight:700;color:rgba(255,51,51,0.5);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:1.25rem;">danger zone</div>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:2rem;flex-wrap:wrap;">
        <div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:0.82rem;color:#e0e0e0;font-weight:600;margin-bottom:0.4rem;">delete organization</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--text-muted);line-height:1.6;max-width:380px;">permanently removes this organization, all members, api keys, and scan history. this cannot be undone.</div>
        </div>
        <button id="btn-delete-org-init" style="flex-shrink:0;background:transparent;border:1px solid rgba(255,51,51,0.3);color:rgba(255,80,80,0.85);font-family:'JetBrains Mono',monospace;font-size:0.74rem;padding:0.5rem 1rem;border-radius:8px;cursor:pointer;white-space:nowrap;">delete organization</button>
    </div>
    <div id="delete-confirm-zone" style="display:none;margin-top:1.5rem;padding-top:1.25rem;border-top:1px solid rgba(255,51,51,0.1);">
        <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--text-muted);margin-bottom:0.75rem;">type <span style="color:#e0e0e0;">${escHtml(org.name)}</span> to confirm deletion:</div>
        <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;">
            <input id="delete-confirm-input" type="text" placeholder="${escHtml(org.name)}" style="flex:1;min-width:160px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,51,51,0.2);border-radius:8px;padding:0.55rem 0.875rem;font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:#e0e0e0;outline:none;box-sizing:border-box;">
            <button id="btn-delete-org-confirm" style="background:rgba(255,51,51,0.12);border:1px solid rgba(255,51,51,0.3);color:rgba(255,80,80,0.9);font-family:'JetBrains Mono',monospace;font-size:0.74rem;padding:0.55rem 1rem;border-radius:8px;cursor:pointer;white-space:nowrap;">confirm delete</button>
        </div>
        <p id="delete-org-error" class="error-msg" style="display:none;margin-top:0.75rem;"></p>
    </div>
</div>`;

        document.getElementById('btn-delete-org-init').onclick = () => {
            document.getElementById('delete-confirm-zone').style.display = 'block';
            document.getElementById('btn-delete-org-init').style.display = 'none';
        };

        document.getElementById('btn-delete-org-confirm').onclick = async () => {
            const confirmName = document.getElementById('delete-confirm-input').value.trim();
            const errEl = document.getElementById('delete-org-error');
            errEl.style.display = 'none';

            if (confirmName !== org.name) {
                errEl.textContent = 'error: name does not match.';
                errEl.style.display = 'block';
                return;
            }

            const btn = document.getElementById('btn-delete-org-confirm');
            btn.disabled = true;
            btn.textContent = 'deleting...';

            try {
                const delRes = await mfaAwareFetch(`/v1/organizations/${slug}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!delRes.ok) {
                    const d = await delRes.json();
                    throw new Error(d.error || 'failed to delete');
                }
                localStorage.removeItem('sentinel-cached-orgs');
                switchToHomeView();
                fetchProfile(token);
            } catch (err) {
                errEl.textContent = `error: ${err.message.toLowerCase()}`;
                errEl.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'confirm delete';
            }
        };

    } catch (err) {
        view.innerHTML = `<div style="color:var(--text-muted);font-family:'JetBrains Mono',monospace;font-size:0.8rem;padding:2rem;">error: ${err.message}</div>`;
    }
}

async function loadTeamFromApi(slug) {
    try {
        const res = await fetch(`/v1/organizations/${slug}/members`, {
            headers: { 'Authorization': `Bearer ${window.supabaseAuthToken}` }
        });
        if (!res.ok) { loadInvitedMembers(slug); return; }
        const data = await res.json();
        teamMembersFullList = [
            ...data.members.map(m => ({
                email: m.username || m.email,
                role: m.role, status: m.status, isYou: m.isYou
            })),
            ...data.pendingInvites.map(inv => ({
                email: inv.email,
                role: inv.role, status: 'invited', isYou: false
            }))
        ];
        currentTeamPage = 1;
        initTeamPagination();
        renderTeamPage();
    } catch (err) {
        loadInvitedMembers(slug);
    }
}

async function fetchPendingInvitations(token) {
    try {
        const res = await fetch('/v1/user/pending-invitations', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const invites = await res.json();
        renderNotifications(invites, token);
    } catch (err) {}
}

function renderNotifications(invites, token) {
    const section = document.getElementById('notification-section');
    const container = document.getElementById('notification-items');
    const wrapper = document.getElementById('notification-items-wrapper');
    const badge = document.getElementById('notification-badge');
    if (!section || !container) return;

    const notifRow = document.getElementById('notification-row');
    if (!invites || invites.length === 0) {
        if (wrapper) wrapper.style.display = 'none';
        if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
        if (notifRow) notifRow.classList.remove('has-notifications');
        return;
    }

    const count = invites.length;
    if (badge) {
        badge.textContent = count >= 100 ? '99+' : count;
        badge.style.display = '';
    }
    if (wrapper) wrapper.style.display = 'block';
    if (notifRow) notifRow.classList.add('has-notifications');

    container.innerHTML = '';
    invites.forEach(inv => {
        const item = document.createElement('div');
        item.style.cssText = 'padding: 10px 16px; display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid rgba(255,255,255,0.04);';

        const orgNameSpan = document.createElement('strong');
        orgNameSpan.textContent = inv.orgName;

        const titleDiv = document.createElement('div');
        titleDiv.style.cssText = 'font-size:0.72rem;color:#fff;font-family:\'JetBrains Mono\',monospace;';
        titleDiv.append('invited to ', orgNameSpan);

        const metaSpan = document.createElement('span');
        metaSpan.style.cssText = 'font-size:0.65rem;color:var(--text-muted);font-family:\'JetBrains Mono\',monospace;';
        metaSpan.textContent = `by ${inv.invitedBy} · ${inv.role}`;

        const acceptBtn = document.createElement('button');
        acceptBtn.textContent = 'accept';
        acceptBtn.style.cssText = 'padding:3px 10px;font-size:0.65rem;border-radius:4px;background:rgba(0,240,255,0.1);border:1px solid rgba(0,240,255,0.3);color:var(--neon-blue);cursor:pointer;font-family:\'JetBrains Mono\',monospace;';

        const dismissBtn = document.createElement('button');
        dismissBtn.textContent = 'dismiss';
        dismissBtn.style.cssText = 'padding:3px 10px;font-size:0.65rem;border-radius:4px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:var(--text-muted);cursor:pointer;font-family:\'JetBrains Mono\',monospace;';

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:6px;margin-top:2px;';
        btnRow.append(acceptBtn, dismissBtn);

        item.append(titleDiv, metaSpan, btnRow);

        acceptBtn.onclick = async (e) => {
            e.stopPropagation();
            acceptBtn.disabled = true;
            acceptBtn.textContent = '...';
            try {
                const r = await fetch(`/v1/user/pending-invitations/${inv.id}/accept`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const result = await r.json();
                if (!r.ok) throw new Error(result.error || 'failed');
                if (window.SentinelToast) window.SentinelToast.show(`joined ${inv.orgName} successfully.`, 'success');
                item.remove();
                fetchProfile(token);
                const remaining = container.children.length;
                const w = document.getElementById('notification-items-wrapper');
                if (!remaining && w) w.style.display = 'none';
                if (badge) { badge.textContent = remaining >= 100 ? '99+' : (remaining || ''); badge.style.display = remaining ? '' : 'none'; }
                if (!remaining) { const nr = document.getElementById('notification-row'); if (nr) nr.classList.remove('has-notifications'); }
            } catch (err) {
                if (window.SentinelToast) window.SentinelToast.show(err.message, 'error');
                acceptBtn.disabled = false;
                acceptBtn.textContent = 'accept';
            }
        };

        dismissBtn.onclick = (e) => {
            e.stopPropagation();
            item.remove();
            const remaining = container.children.length;
            const w = document.getElementById('notification-items-wrapper');
            if (!remaining && w) w.style.display = 'none';
            if (badge) { badge.textContent = remaining >= 100 ? '99+' : (remaining || ''); badge.style.display = remaining ? '' : 'none'; }
            if (!remaining) { const nr = document.getElementById('notification-row'); if (nr) nr.classList.remove('has-notifications'); }
        };

        container.appendChild(item);
    });
}

window.onpopstate = (e) => {
    const currentPath = window.location.pathname;
    const orgMatch = currentPath.match(/^\/dashboard\/org\/([a-z0-9]{20})(\/[a-z0-9-]+)?$/);
    if (orgMatch) {
        switchToOrgView(orgMatch[1], orgMatch[2] ? orgMatch[2].substring(1) : 'projects');
    } else if (currentPath === '/dashboard' || currentPath === '/dashboard/organizations' || currentPath === '/dashboard/') {
        switchToHomeView();
    } else {
        window.location.replace('/dashboard/organizations');
    }
};

async function fetchHeaderApiKey(token) {
    try {
        const res = await fetch('/v1/user/api-key/suffix', { headers: { 'Authorization': `Bearer ${token}` } });
        const result = await res.json();
        const suffixEl = document.getElementById('api-key-suffix');
        if (res.ok && result.suffix && suffixEl) {
            suffixEl.textContent = result.suffix;
        }
    } catch (err) {}
}

function setUsernamePrefixVisible(visible) {
    const prefUsernamePrefix = document.getElementById('pref-username-prefix');
    if (!prefUsernamePrefix) return;
    prefUsernamePrefix.classList.toggle('prefix-hidden', !visible);
    const wrap = prefUsernamePrefix.closest('.settings-input-prefix-wrap');
    if (wrap) wrap.classList.toggle('no-prefix', !visible);
}

function applyProfileToForm(profile) {
    if (!profile) return;
    const prefEmail = document.getElementById('pref-email');
    const prefUsername = document.getElementById('pref-username');
    const prefFirstName = document.getElementById('pref-first-name');
    const prefLastName = document.getElementById('pref-last-name');
    const hasUsername = Boolean(profile.username);
    if (prefEmail) prefEmail.value = profile.email || '';
    if (prefUsername) {
        prefUsername.value = hasUsername ? profile.username : (profile.email || '');
        prefUsername.dataset.isFallback = hasUsername ? 'false' : 'true';
    }
    setUsernamePrefixVisible(hasUsername);
    if (prefFirstName) prefFirstName.value = profile.firstName || '';
    if (prefLastName) prefLastName.value = profile.lastName || '';
}

function applyIdentityDisplay(profile) {
    if (!profile) return;
    const teamEmailEl = document.getElementById('current-user-email');
    const displayId = profile.username || profile.email;
    if (teamEmailEl && displayId) {
        teamEmailEl.textContent = displayId;
        const teamAvatarEl = document.getElementById('team-owner-avatar');
        if (teamAvatarEl) teamAvatarEl.textContent = displayId.charAt(0).toUpperCase();
    }

    const dropdownEl = document.getElementById('dropdown-email');
    if (dropdownEl) {
        dropdownEl.textContent = profile.username ? `@${profile.username}` : (profile.email || '');
    }
    const topAvatarEl = document.getElementById('org-avatar-circle');
    if (topAvatarEl && displayId) topAvatarEl.textContent = displayId.charAt(0).toUpperCase();
}

async function fetchProfile(token) {
    try {
        const cachedRaw = localStorage.getItem('sentinel-cached-profile');
        if (cachedRaw) {
            try {
                const cached = JSON.parse(cachedRaw);
                applyProfileToForm(cached);
                applyIdentityDisplay(cached);
            } catch {}
        }

        const response = await fetch('/v1/user/profile', { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.ok) {
            const profile = await response.json();
            localStorage.setItem('sentinel-cached-profile', JSON.stringify({
                email: profile.email || '',
                username: profile.username || '',
                firstName: profile.firstName || '',
                lastName: profile.lastName || '',
                authProvider: profile.authProvider || 'email',
                theme: profile.theme || 'dark',
                timezone: profile.timezone || 'auto',
                telemetry: profile.telemetry === true,
                deletionRequestedAt: profile.deletionRequestedAt || null
            }));

            try {
                if (profile.theme) {
                    window.applyThemePreference(profile.theme, true);
                }
                if (profile.timezone) {
                    localStorage.setItem('sentinel-timezone', profile.timezone);
                    if (window.__tzSetSelected) window.__tzSetSelected(profile.timezone);
                }
            } catch (e) {}
            if (profile.shortcuts && typeof profile.shortcuts === 'object') {
                try { localStorage.setItem('sentinel-shortcuts', JSON.stringify(profile.shortcuts)); } catch (e) {}
                if (window.__applyShortcutPrefs) window.__applyShortcutPrefs(profile.shortcuts);
            }
            if (window.__applyTelemetryPref) window.__applyTelemetryPref(profile.telemetry === true, Boolean(profile.email));

            applyIdentityDisplay(profile);
            applyProfileToForm(profile);
        }

        const prefUsernameInput = document.getElementById('pref-username');
        if (prefUsernameInput && !prefUsernameInput.dataset.prefixBound) {
            prefUsernameInput.dataset.prefixBound = 'true';
            const refreshPrefix = () => setUsernamePrefixVisible(prefUsernameInput.dataset.isFallback !== 'true');
            prefUsernameInput.addEventListener('input', () => {
                prefUsernameInput.dataset.isFallback = 'false';
                refreshPrefix();
            });
            prefUsernameInput.addEventListener('focus', refreshPrefix);
            prefUsernameInput.addEventListener('blur', refreshPrefix);
        }

        document.querySelectorAll('.pw-eye-toggle').forEach(btn => {
            if (btn.dataset.wired) return;
            btn.dataset.wired = 'true';
            btn.onclick = () => {
                const input = document.getElementById(btn.getAttribute('data-target'));
                if (!input) return;
                const eyeOn = btn.querySelector('.eye-on');
                const eyeOff = btn.querySelector('.eye-off');
                if (input.type === 'password') {
                    input.type = 'text';
                    eyeOn.style.display = 'inline';
                    eyeOff.style.display = 'none';
                } else {
                    input.type = 'password';
                    eyeOn.style.display = 'none';
                    eyeOff.style.display = 'inline';
                }
            };
        });

        const dashForgotTrigger = document.getElementById('email-verify-forgot-pw-trigger');
        const dashForgotStep = document.getElementById('email-verify-step-forgot-pw');
        const dashForgotBackBtn = document.getElementById('dash-forgot-pw-back-btn');
        if (dashForgotTrigger && dashForgotStep && !dashForgotTrigger.dataset.wired) {
            dashForgotTrigger.dataset.wired = 'true';
            let dashForgotEmail = '';

            const fadeInStep = (el) => {
                el.classList.remove('ev-step-enter');
                void el.offsetWidth;
                el.classList.add('ev-step-enter');
            };

            const resetDashForgotCaptcha = () => {
                const btn = document.getElementById('dash-forgot-pw-submit-btn');
                const container = document.getElementById('turnstile-dash-forgot');
                btn.removeAttribute('data-captcha-token');
                if (window.turnstile && container) {
                    container.innerHTML = '';
                    window.turnstile.render(container, {
                        sitekey: '0x4AAAAAADGpMozD1QOtWPkP',
                        theme: 'dark',
                        callback: (token) => btn.setAttribute('data-captcha-token', token)
                    });
                }
            };

            let forgotStandalone = false;
            const openDashForgot = (e, standalone) => {
                if (e) e.preventDefault();
                forgotStandalone = Boolean(standalone);
                const overlay = document.getElementById('email-verify-modal-overlay');
                overlay.classList.add('active');
                document.body.classList.add('modal-open');
                const stateForm = document.getElementById('dash-forgot-pw-state-form');
                const stateSuccess = document.getElementById('dash-forgot-pw-state-success');
                stateForm.style.display = 'flex';
                stateSuccess.style.display = 'none';
                document.getElementById('dash-forgot-pw-error-msg').style.display = 'none';
                document.getElementById('dash-forgot-pw-submit-btn').disabled = false;
                document.getElementById('dash-forgot-pw-submit-btn').textContent = 'send reset link';
                document.getElementById('email-verify-step-password').style.display = 'none';
                document.getElementById('email-verify-step-code').style.display = 'none';
                dashForgotStep.style.display = 'flex';
                dashForgotBackBtn.style.display = 'flex';
                fadeInStep(dashForgotStep);
                resetDashForgotCaptcha();
                setTimeout(() => document.getElementById('dash-forgot-pw-email').focus(), 100);
            };
            window._sentinelOpenForgotPw = openDashForgot;

            const closeDashForgot = () => {
                dashForgotStep.style.display = 'none';
                dashForgotBackBtn.style.display = 'none';
                if (forgotStandalone) {
                    const overlay = document.getElementById('email-verify-modal-overlay');
                    overlay.classList.remove('active');
                    document.body.classList.remove('modal-open');
                    return;
                }
                const pwStep = document.getElementById('email-verify-step-password');
                pwStep.style.display = 'flex';
                fadeInStep(pwStep);
            };

            dashForgotTrigger.addEventListener('click', openDashForgot);
            if (dashForgotBackBtn) dashForgotBackBtn.addEventListener('click', closeDashForgot);

            document.getElementById('dash-forgot-pw-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('dash-forgot-pw-submit-btn');
                const errorMsg = document.getElementById('dash-forgot-pw-error-msg');
                const email = document.getElementById('dash-forgot-pw-email').value.trim();
                if (!email) return;
                const captchaToken = btn.getAttribute('data-captcha-token');
                if (!captchaToken) {
                    errorMsg.textContent = 'error: please complete the captcha';
                    errorMsg.style.display = 'block';
                    return;
                }
                btn.disabled = true;
                btn.textContent = 'sending link...';
                errorMsg.style.display = 'none';
                try {
                    const { error } = await sentinelAuth.auth.resetPasswordForEmail(email, {
                        redirectTo: window.location.origin + '/reset',
                        captchaToken
                    });
                    if (error) {
                        errorMsg.textContent = 'error: ' + error.message.toLowerCase();
                        errorMsg.style.display = 'block';
                        btn.disabled = false;
                        btn.textContent = 'send reset link';
                        resetDashForgotCaptcha();
                        return;
                    }
                    dashForgotEmail = email;
                    document.getElementById('dash-forgot-pw-state-form').style.display = 'none';
                    document.getElementById('dash-forgot-pw-state-success').style.display = 'flex';
                } catch {
                    errorMsg.textContent = 'error: something went wrong. try again.';
                    errorMsg.style.display = 'block';
                    btn.disabled = false;
                    btn.textContent = 'send reset link';
                    resetDashForgotCaptcha();
                }
            });

            document.getElementById('dash-forgot-resend-btn').addEventListener('click', async () => {
                if (!dashForgotEmail) return;
                await sentinelAuth.auth.resetPasswordForEmail(dashForgotEmail, {
                    redirectTo: window.location.origin + '/reset'
                });
                if (window.SentinelToast) window.SentinelToast.show('reset link resent', 'info');
            });
        }

        const prefEmailInput = document.getElementById('pref-email');
        if (prefEmailInput && !prefEmailInput.dataset.availabilityWired) {
            prefEmailInput.dataset.availabilityWired = 'true';
            const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;
            prefEmailInput._checkSeq = 0;

            prefEmailInput.addEventListener('blur', async () => {
                const emailRaw = prefEmailInput.value.trim();
                delete prefEmailInput.dataset.taken;
                if (!emailRaw || !EMAIL_RE.test(emailRaw)) return;

                const cachedRaw = localStorage.getItem('sentinel-cached-profile');
                const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
                const currentEmail = cached.email || '';
                if (emailRaw.toLowerCase() === currentEmail.toLowerCase()) return;

                const seq = ++prefEmailInput._checkSeq;
                try {
                    const res = await fetch('/v1/user/check-email', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: emailRaw })
                    });
                    const data = await res.json();
                    if (seq !== prefEmailInput._checkSeq) return;
                    if (!data.available) {
                        prefEmailInput.dataset.taken = 'true';
                        if (window.SentinelToast) window.SentinelToast.show('error: this email is already registered to another account', 'error');
                    }
                } catch {
                    if (seq !== prefEmailInput._checkSeq) return;
                }
            });

            prefEmailInput.addEventListener('input', () => { delete prefEmailInput.dataset.taken; });
        }

        document.querySelectorAll('.theme-card.disabled').forEach(card => {
            if (card.dataset.wired) return;
            card.dataset.wired = 'true';
            card.addEventListener('click', () => {
                if (window.SentinelToast) window.SentinelToast.show('this theme is coming soon', 'info');
            });
        });

        const getThemeCookie = () => {
            const m = document.cookie.match(/(?:^|; )sentinel-theme=([^;]*)/);
            return m ? decodeURIComponent(m[1]) : 'dark';
        };
        const setThemeCookie = (theme) => {
            document.cookie = 'sentinel-theme=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
            document.cookie = `sentinel-theme=${theme}; path=/; domain=.sentinelpay.org; SameSite=Lax`;
        };
        const systemPrefersLight = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
        const resolveTheme = (pref) => pref === 'system' ? (systemPrefersLight() ? 'light' : 'dark') : pref;
        const themeCards = document.querySelectorAll('.theme-card[data-theme]');
        const applyTheme = (pref) => {
            document.documentElement.classList.toggle('theme-light', resolveTheme(pref) === 'light');
            themeCards.forEach(c => c.classList.toggle('active', c.dataset.theme === pref));
        };
        themeCards.forEach(card => {
            if (card.dataset.wired) return;
            card.dataset.wired = 'true';
            card.addEventListener('click', () => {
                const theme = card.dataset.theme;
                const html = document.documentElement;
                html.classList.add('theme-fade-transition');
                applyTheme(theme);
                setTimeout(() => html.classList.remove('theme-fade-transition'), 450);
            });
        });
        const initialPref = getThemeCookie();
        applyTheme(['light', 'dark', 'system'].includes(initialPref) ? initialPref : 'dark');

        if (window.matchMedia && !window.__sentinelSystemThemeWired) {
            window.__sentinelSystemThemeWired = true;
            window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
                if (getThemeCookie() === 'system') applyTheme('system');
            });
        }

        const saveAppearanceBtn = document.getElementById('btn-save-appearance');
        if (saveAppearanceBtn && !saveAppearanceBtn.dataset.bound) {
            saveAppearanceBtn.dataset.bound = 'true';
            saveAppearanceBtn.addEventListener('click', async () => {
                const activeCard = document.querySelector('.theme-card.active[data-theme]');
                const theme = activeCard ? activeCard.dataset.theme : 'dark';
                setThemeCookie(theme);
                const ok = await saveProfilePrefs({ theme });
                if (window.SentinelToast) window.SentinelToast.show(ok ? 'appearance saved' : 'appearance saved locally', ok ? 'success' : 'info');
            });
        }

        const tzDd = document.getElementById('tz-dd');
        if (tzDd && !tzDd.dataset.bound) {
            tzDd.dataset.bound = 'true';
            const tzHidden = document.getElementById('pref-timezone');
            const tzSelLabel = document.getElementById('tz-dd-sel');
            const tzTriggerFlag = document.getElementById('tz-dd-trigger-flag');
            const tzTrigger = document.getElementById('tz-dd-trigger');
            const tzPanel = document.getElementById('tz-dd-panel');
            const tzList = document.getElementById('tz-dd-list');
            const tzSearch = document.getElementById('tz-dd-search');
            const tzEmpty = document.getElementById('tz-dd-empty');

            let detectedZone = 'UTC';
            try { detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) {}

            const note = document.getElementById('tz-detected-note');

            const tzEntries = TIMEZONES
                .map(([z, cc, city]) => {
                    const label = z.split('/')[0].toLowerCase() + '/' + city;
                    return { value: z, cc, label, search: (label + ' ' + z.replace(/_/g, ' ')).toLowerCase() };
                })
                .sort((a, b) => a.label.localeCompare(b.label));
            const items = [{ value: 'auto', cc: TZ_COUNTRY[detectedZone], label: `auto detect (${tzLabel(detectedZone)})`, search: ('auto detect ' + tzSearchText(detectedZone)) }, ...tzEntries];

            const applyDetected = (zone, fromLocation) => {
                detectedZone = zone;
                items[0].cc = TZ_COUNTRY[zone];
                items[0].label = `auto detect (${tzLabel(zone)})`;
                items[0].search = ('auto detect ' + tzSearchText(zone));
                if (note) note.textContent = `auto detected from your ${fromLocation ? 'location' : 'browser'} (${tzLabel(zone)}).`;
                if (tzHidden.value === 'auto') setSelected('auto');
            };

            const setSelected = (value) => {
                const item = items.find(i => i.value === value) || items[0];
                tzHidden.value = item.value;
                tzSelLabel.textContent = item.label;
                if (tzTriggerFlag) tzTriggerFlag.innerHTML = flagImg(item.cc);
            };
            window.__tzSetSelected = (v) => setSelected(items.some(i => i.value === v) ? v : 'auto');

            const renderList = (filter) => {
                const f = (filter || '').trim().toLowerCase();
                const matched = f ? items.filter(i => i.search.includes(f)) : items;
                tzList.innerHTML = '';
                if (!matched.length) { tzEmpty.style.display = 'block'; return; }
                tzEmpty.style.display = 'none';
                const frag = document.createDocumentFragment();
                matched.forEach(i => {
                    const el = document.createElement('div');
                    el.className = 'tz-dd-item' + (i.value === tzHidden.value ? ' tz-selected' : '');
                    el.dataset.value = i.value;
                    el.innerHTML = `<span class="tz-dd-flag">${flagImg(i.cc)}</span><span class="tz-dd-name"></span>`;
                    el.querySelector('.tz-dd-name').textContent = i.label;
                    el.addEventListener('click', () => {
                        setSelected(i.value);
                        closeDd();
                    });
                    frag.appendChild(el);
                });
                tzList.appendChild(frag);
            };

            const positionPanel = () => {
                const r = tzTrigger.getBoundingClientRect();
                tzPanel.style.left = r.left + 'px';
                tzPanel.style.width = r.width + 'px';
                const panelH = tzPanel.offsetHeight || 300;
                const spaceBelow = window.innerHeight - r.bottom;
                if (r.top > panelH + 12 || r.top > spaceBelow) {
                    tzPanel.style.top = 'auto';
                    tzPanel.style.bottom = (window.innerHeight - r.top + 6) + 'px';
                } else {
                    tzPanel.style.bottom = 'auto';
                    tzPanel.style.top = (r.bottom + 6) + 'px';
                }
            };
            const openDd = () => {
                tzDd.classList.add('open');
                renderList('');
                tzSearch.value = '';
                positionPanel();
                setTimeout(() => { positionPanel(); tzSearch.focus(); }, 0);
            };
            const closeDd = () => tzDd.classList.remove('open');

            tzTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                tzDd.classList.contains('open') ? closeDd() : openDd();
            });
            tzSearch.addEventListener('input', () => { renderList(tzSearch.value); positionPanel(); });
            tzSearch.addEventListener('click', (e) => e.stopPropagation());
            tzPanel.addEventListener('click', (e) => e.stopPropagation());
            document.addEventListener('click', (e) => {
                if (tzDd.classList.contains('open') && !tzDd.contains(e.target) && !tzPanel.contains(e.target)) closeDd();
            });
            window.addEventListener('scroll', () => { if (tzDd.classList.contains('open')) positionPanel(); }, true);
            window.addEventListener('resize', () => { if (tzDd.classList.contains('open')) positionPanel(); });

            const savedTz = localStorage.getItem('sentinel-timezone') || 'auto';
            setSelected(items.some(i => i.value === savedTz) ? savedTz : 'auto');

            const cachedAuto = localStorage.getItem('sentinel-tz-auto');
            applyDetected(cachedAuto || detectedZone, Boolean(cachedAuto));

            (async () => {
                try {
                    let token = window.supabaseAuthToken;
                    for (let i = 0; i < 30 && !token; i++) {
                        await new Promise(r => setTimeout(r, 200));
                        token = window.supabaseAuthToken;
                    }
                    if (!token) return;
                    const r = await fetch('/v1/geo/timezone', { headers: { 'Authorization': `Bearer ${token}` } });
                    if (!r.ok) return;
                    const d = await r.json();
                    if (d && d.timezone) {
                        localStorage.setItem('sentinel-tz-auto', d.timezone);
                        applyDetected(d.timezone, true);
                    }
                } catch (e) {}
            })();

            const saveTzBtn = document.getElementById('btn-save-timezone');
            if (saveTzBtn && !saveTzBtn.dataset.bound) {
                saveTzBtn.dataset.bound = 'true';
                saveTzBtn.addEventListener('click', async () => {
                    const value = tzHidden.value;
                    localStorage.setItem('sentinel-timezone', value);
                    const ok = await saveProfilePrefs({ timezone: value });
                    if (window.SentinelToast) window.SentinelToast.show(ok ? 'timezone saved' : 'timezone saved locally', ok ? 'success' : 'info');
                });
            }
        }

        const saveBtn = document.getElementById('btn-save-preferences');
        if (saveBtn && !saveBtn.dataset.bound) {
            saveBtn.dataset.bound = 'true';
            const notify = (text, kind) => {
                if (window.SentinelToast) window.SentinelToast.show(text, kind);
            };
            const playPulse = (el, cls) => {
                if (!el) return;
                el.classList.remove(cls);
                void el.offsetWidth;
                el.classList.add(cls);
                setTimeout(() => el.classList.remove(cls), 700);
            };
            const resetSaveBtn = () => {
                saveBtn.disabled = false;
                saveBtn.removeAttribute('data-busy');
                saveBtn.textContent = 'save';
            };
            const setSaveBtnBusy = () => {
                saveBtn.disabled = true;
                saveBtn.setAttribute('data-busy', '1');
                saveBtn.textContent = 'saving...';
            };

            const otpSentAt = { old: 0, new: 0 };

            const maskEmail = (email) => {
                const [local, domain] = email.split('@');
                if (!domain) return email;
                const visible = local.slice(0, Math.min(2, local.length));
                return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
            };

            const makeOtpGroup = (containerSelector, formId) => {
                const boxes = Array.from(document.querySelectorAll(`${containerSelector} .otp-box`));
                const form = document.getElementById(formId);
                const getValue = () => boxes.map(b => b.value).join('');
                const clear = () => boxes.forEach(b => { b.value = ''; b.classList.remove('filled'); });
                boxes.forEach((box, i) => {
                    box.addEventListener('input', () => {
                        const val = box.value.replace(/[^0-9]/g, '');
                        box.value = val.slice(-1);
                        box.classList.toggle('filled', Boolean(box.value));
                        if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
                        if (getValue().length === 6) form.requestSubmit();
                    });
                    box.addEventListener('keydown', (e) => {
                        if (e.key === 'Backspace' && !box.value && i > 0) {
                            boxes[i - 1].value = '';
                            boxes[i - 1].classList.remove('filled');
                            boxes[i - 1].focus();
                        }
                        if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
                        if (e.key === 'ArrowRight' && i < boxes.length - 1) boxes[i + 1].focus();
                    });
                    box.addEventListener('paste', (e) => {
                        e.preventDefault();
                        const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
                        pasted.split('').slice(0, 6).forEach((ch, j) => {
                            if (boxes[j]) { boxes[j].value = ch; boxes[j].classList.add('filled'); }
                        });
                        const next = boxes[Math.min(pasted.length, 5)];
                        if (next) next.focus();
                        if (pasted.length >= 6) form.requestSubmit();
                    });
                    box.addEventListener('focus', () => box.select());
                });
                return { boxes, getValue, clear };
            };

            const otpOld = makeOtpGroup('#otp-boxes', 'email-verify-code-form');
            const otpNew = makeOtpGroup('#otp-boxes-new', 'email-verify-new-code-form');

            function verifyEmailChangeFlow(currentEmail, mode, newEmail) {
                return new Promise((resolve) => {
                    const overlay = document.getElementById('email-verify-modal-overlay');
                    const stepPassword = document.getElementById('email-verify-step-password');
                    const stepCode = document.getElementById('email-verify-step-code');
                    const stepNewCode = document.getElementById('email-verify-step-new-code');
                    const closeBtn = document.getElementById('btn-close-email-verify');
                    const passwordForm = document.getElementById('email-verify-password-form');
                    const passwordInput = document.getElementById('email-verify-password');
                    const passwordError = document.getElementById('email-verify-password-error');
                    const passwordBtn = document.getElementById('email-verify-password-btn');
                    const codeForm = document.getElementById('email-verify-code-form');
                    const codeError = document.getElementById('email-verify-code-error');
                    const codeBtn = document.getElementById('email-verify-code-btn');
                    const resendBtn = document.getElementById('email-verify-resend-btn');
                    const newCodeForm = document.getElementById('email-verify-new-code-form');
                    const newCodeError = document.getElementById('email-verify-new-code-error');
                    const newCodeBtn = document.getElementById('email-verify-new-code-btn');
                    const resendNewBtn = document.getElementById('email-verify-resend-new-btn');

                    if (!overlay || !stepPassword || !stepCode || !stepNewCode) { resolve(false); return; }

                    const showError = (el, msg) => { el.textContent = msg; el.style.display = 'block'; };
                    const hideError = (el) => { el.style.display = 'none'; el.textContent = ''; };

                    let settled = false;
                    const finish = (result) => {
                        if (settled) return;
                        settled = true;
                        cleanup();
                        overlay.classList.remove('active');
                        document.body.classList.remove('modal-open');
                        resolve(result);
                    };

                    const onClose = () => finish(false);
                    const onOverlayClick = (e) => { if (e.target === overlay) finish(false); };

                    let cooldownIntervalOld = null;
                    let cooldownIntervalNew = null;

                    const setResendDisabled = (btn, off) => {
                        btn.disabled = off;
                        btn.style.opacity = off ? '0.4' : '';
                        btn.style.cursor = off ? 'not-allowed' : 'pointer';
                        btn.style.pointerEvents = off ? 'none' : '';
                    };

                    const applyCooldown = (btn, secs, intervalRef) => {
                        if (intervalRef.id) { clearInterval(intervalRef.id); intervalRef.id = null; }
                        if (secs <= 0) { setResendDisabled(btn, false); btn.textContent = 'resend code'; return; }
                        setResendDisabled(btn, true);
                        btn.textContent = `resend in ${secs}s`;
                        intervalRef.id = setInterval(() => {
                            secs -= 1;
                            if (secs <= 0) {
                                clearInterval(intervalRef.id); intervalRef.id = null;
                                setResendDisabled(btn, false); btn.textContent = 'resend code';
                            } else { btn.textContent = `resend in ${secs}s`; }
                        }, 1000);
                    };

                    const oldIntervalRef = { id: cooldownIntervalOld };
                    const newIntervalRef = { id: cooldownIntervalNew };

                    const sendOldCode = async (btn) => {
                        try {
                            const r = await fetch('/v1/user/email-change/send-code', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                            });
                            if (r.ok) {
                                otpSentAt.old = Date.now();
                                if (btn) applyCooldown(btn, 60, oldIntervalRef);
                                return 'sent';
                            }
                            if (r.status === 429) {
                                const data = await r.json().catch(() => ({}));
                                const remaining = data.retryAfter || 60;
                                otpSentAt.old = Date.now() - (60 - remaining) * 1000;
                                if (btn) applyCooldown(btn, remaining, oldIntervalRef);
                                return 'sent';
                            }
                            return 'error';
                        } catch { return 'error'; }
                    };

                    const sendNewCode = async (btn) => {
                        try {
                            const r = await fetch('/v1/user/email-change/send-code-new', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ newEmail })
                            });
                            if (r.ok) {
                                otpSentAt.new = Date.now();
                                if (btn) applyCooldown(btn, 60, newIntervalRef);
                                return 'sent';
                            }
                            if (r.status === 429) {
                                const data = await r.json().catch(() => ({}));
                                const remaining = data.retryAfter || 60;
                                otpSentAt.new = Date.now() - (60 - remaining) * 1000;
                                if (btn) applyCooldown(btn, remaining, newIntervalRef);
                                return 'sent';
                            }
                            return 'error';
                        } catch { return 'error'; }
                    };

                    const showCodeStep = () => {
                        stepPassword.style.display = 'none';
                        stepCode.style.display = 'flex';
                        stepNewCode.style.display = 'none';
                        otpOld.clear();
                        hideError(codeError);
                        codeBtn.disabled = false;
                        codeBtn.textContent = 'verify';
                        const remaining = otpSentAt.old ? Math.ceil((60000 - (Date.now() - otpSentAt.old)) / 1000) : 0;
                        if (remaining > 0) {
                            applyCooldown(resendBtn, remaining, oldIntervalRef);
                        } else {
                            resendBtn.disabled = true;
                            resendBtn.textContent = 'sending...';
                            sendOldCode(resendBtn).then(s => {
                                if (s === 'error') { resendBtn.disabled = false; resendBtn.textContent = 'resend code'; }
                            });
                        }
                        const targetEl = document.getElementById('email-verify-code-target');
                        if (targetEl) targetEl.textContent = currentEmail ? maskEmail(currentEmail) : 'your email';
                        otpOld.boxes[0].focus();
                    };

                    const showNewCodeStep = () => {
                        stepPassword.style.display = 'none';
                        stepCode.style.display = 'none';
                        stepNewCode.style.display = 'flex';
                        otpNew.clear();
                        hideError(newCodeError);
                        newCodeBtn.disabled = false;
                        newCodeBtn.textContent = 'verify';
                        const remainingNew = otpSentAt.new ? Math.ceil((60000 - (Date.now() - otpSentAt.new)) / 1000) : 0;
                        if (remainingNew > 0) {
                            applyCooldown(resendNewBtn, remainingNew, newIntervalRef);
                        } else {
                            resendNewBtn.disabled = true;
                            resendNewBtn.textContent = 'sending...';
                            sendNewCode(resendNewBtn).then(s => {
                                if (s === 'error') { resendNewBtn.disabled = false; resendNewBtn.textContent = 'resend code'; }
                            });
                        }
                        const targetEl = document.getElementById('email-verify-new-target');
                        if (targetEl) targetEl.textContent = maskEmail(newEmail);
                        otpNew.boxes[0].focus();
                    };

                    const onPasswordSubmit = async (e) => {
                        e.preventDefault();
                        const pwd = passwordInput.value;
                        if (!pwd) return;
                        hideError(passwordError);
                        passwordBtn.disabled = true;
                        passwordBtn.textContent = 'verifying...';
                        try {
                            const captchaToken = passwordBtn.getAttribute('data-captcha-token');
                            if (!captchaToken) {
                                passwordBtn.disabled = false;
                                passwordBtn.textContent = 'continue';
                                showError(passwordError, 'error: please complete the captcha');
                                return;
                            }
                            const { data: sessionData } = await sentinelAuth.auth.getSession();
                            const liveEmail = sessionData?.session?.user?.email || currentEmail;
                            const { error } = await sentinelAuth.auth.signInWithPassword({ email: liveEmail, password: pwd, options: { captchaToken } });
                            passwordBtn.disabled = false;
                            passwordBtn.textContent = 'continue';
                            if (error) {
                                if (window.turnstile) {
                                    const tContainer = document.getElementById('turnstile-confirm-identity');
                                    if (tContainer) { tContainer.innerHTML = ''; passwordBtn.removeAttribute('data-captcha-token'); window.turnstile.render(tContainer, { sitekey: '0x4AAAAAADGpMozD1QOtWPkP', theme: 'dark', callback: (t) => passwordBtn.setAttribute('data-captcha-token', t) }); }
                                }
                                showError(passwordError, 'error: incorrect password');
                                return;
                            }
                            passwordInput.value = '';
                            showCodeStep();
                        } catch {
                            passwordBtn.disabled = false;
                            passwordBtn.textContent = 'continue';
                            showError(passwordError, 'error: verification failed. try again');
                        }
                    };

                    const onResend = async (e) => {
                        e.preventDefault();
                        if (resendBtn.disabled) return;
                        resendBtn.disabled = true;
                        resendBtn.textContent = 'sending...';
                        const s = await sendOldCode(resendBtn);
                        if (s === 'sent') notify('a new code has been sent', 'info');
                        else { resendBtn.disabled = false; resendBtn.textContent = 'resend code'; }
                    };

                    const onResendNew = async (e) => {
                        e.preventDefault();
                        if (resendNewBtn.disabled) return;
                        resendNewBtn.disabled = true;
                        resendNewBtn.textContent = 'sending...';
                        const s = await sendNewCode(resendNewBtn);
                        if (s === 'sent') notify('a new code has been sent', 'info');
                        else { resendNewBtn.disabled = false; resendNewBtn.textContent = 'resend code'; }
                    };

                    const onCodeSubmit = async (e) => {
                        e.preventDefault();
                        const code = otpOld.getValue();
                        if (!/^[0-9]{6}$/.test(code)) { showError(codeError, 'error: enter all 6 digits'); return; }
                        hideError(codeError);
                        codeBtn.disabled = true;
                        codeBtn.textContent = 'verifying...';
                        try {
                            const r = await fetch('/v1/user/email-change/verify-code', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ code })
                            });
                            const data = await r.json();
                            codeBtn.disabled = false;
                            codeBtn.textContent = 'verify';
                            if (!r.ok) { showError(codeError, `error: ${data.error || 'incorrect code'}`); return; }
                            showNewCodeStep();
                        } catch {
                            codeBtn.disabled = false;
                            codeBtn.textContent = 'verify';
                            showError(codeError, 'error: verification failed. try again');
                        }
                    };

                    const onNewCodeSubmit = async (e) => {
                        e.preventDefault();
                        const code = otpNew.getValue();
                        if (!/^[0-9]{6}$/.test(code)) { showError(newCodeError, 'error: enter all 6 digits'); return; }
                        hideError(newCodeError);
                        newCodeBtn.disabled = true;
                        newCodeBtn.textContent = 'verifying...';
                        try {
                            const r = await fetch('/v1/user/email-change/verify-code-new', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ code })
                            });
                            const data = await r.json();
                            newCodeBtn.disabled = false;
                            newCodeBtn.textContent = 'verify';
                            if (!r.ok) { showError(newCodeError, `error: ${data.error || 'incorrect code'}`); return; }
                            finish(true);
                        } catch {
                            newCodeBtn.disabled = false;
                            newCodeBtn.textContent = 'verify';
                            showError(newCodeError, 'error: verification failed. try again');
                        }
                    };

                    function cleanup() {
                        closeBtn.removeEventListener('click', onClose);
                        overlay.removeEventListener('click', onOverlayClick);
                        passwordForm.removeEventListener('submit', onPasswordSubmit);
                        codeForm.removeEventListener('submit', onCodeSubmit);
                        newCodeForm.removeEventListener('submit', onNewCodeSubmit);
                        resendBtn.removeEventListener('click', onResend);
                        resendNewBtn.removeEventListener('click', onResendNew);
                    }

                    closeBtn.addEventListener('click', onClose);
                    overlay.addEventListener('click', onOverlayClick);
                    passwordForm.addEventListener('submit', onPasswordSubmit);
                    codeForm.addEventListener('submit', onCodeSubmit);
                    newCodeForm.addEventListener('submit', onNewCodeSubmit);
                    resendBtn.addEventListener('click', onResend);
                    resendNewBtn.addEventListener('click', onResendNew);

                    hideError(passwordError);
                    hideError(codeError);
                    hideError(newCodeError);
                    passwordInput.value = '';
                    otpOld.clear();
                    otpNew.clear();
                    resendBtn.textContent = 'resend code';
                    resendNewBtn.textContent = 'resend code';
                    passwordBtn.disabled = false;
                    passwordBtn.textContent = 'continue';
                    stepNewCode.style.display = 'none';

                    const stepForgotPw = document.getElementById('email-verify-step-forgot-pw');
                    if (stepForgotPw) stepForgotPw.style.display = 'none';
                    const backBtn = document.getElementById('dash-forgot-pw-back-btn');
                    if (backBtn) backBtn.style.display = 'none';

                    overlay.classList.add('active');
                    document.body.classList.add('modal-open');
                    if (mode === 'password') {
                        stepPassword.style.display = 'flex';
                        stepCode.style.display = 'none';
                        setTimeout(() => passwordInput.focus(), 100);
                        if (window.turnstile) {
                            const tContainer = document.getElementById('turnstile-confirm-identity');
                            if (tContainer) {
                                tContainer.innerHTML = '';
                                passwordBtn.removeAttribute('data-captcha-token');
                                window.turnstile.render(tContainer, {
                                    sitekey: '0x4AAAAAADGpMozD1QOtWPkP',
                                    theme: 'dark',
                                    callback: (token) => passwordBtn.setAttribute('data-captcha-token', token)
                                });
                            }
                        }
                    } else if (mode === 'new-only') {
                        stepPassword.style.display = 'none';
                        stepCode.style.display = 'none';
                        showNewCodeStep();
                    } else {
                        stepPassword.style.display = 'none';
                        showCodeStep();
                    }
                });
            }

            const otpUsername = makeOtpGroup('#otp-boxes-username', 'username-verify-code-form');

            function verifyUsernameChangeFlow(authProvider, currentEmail) {
                return new Promise((resolve) => {
                    if (authProvider === 'twitter') { resolve(true); return; }

                    const overlay = document.getElementById('username-verify-modal-overlay');
                    const stepPassword = document.getElementById('username-verify-step-password');
                    const stepCode = document.getElementById('username-verify-step-code');
                    const closeBtn = document.getElementById('btn-close-username-verify');
                    const passwordForm = document.getElementById('username-verify-password-form');
                    const passwordInput = document.getElementById('username-verify-password');
                    const passwordError = document.getElementById('username-verify-password-error');
                    const passwordBtn = document.getElementById('username-verify-password-btn');
                    const codeForm = document.getElementById('username-verify-code-form');
                    const codeError = document.getElementById('username-verify-code-error');
                    const codeBtn = document.getElementById('username-verify-code-btn');
                    const resendBtn = document.getElementById('username-verify-resend-btn');
                    const forgotTrigger = document.getElementById('username-verify-forgot-pw-trigger');

                    if (!overlay || !stepPassword || !stepCode) { resolve(false); return; }

                    const showError = (el, msg) => { el.textContent = msg; el.style.display = 'block'; };
                    const hideError = (el) => { el.style.display = 'none'; el.textContent = ''; };

                    let settled = false;
                    const finish = (result) => {
                        if (settled) return;
                        settled = true;
                        cleanup();
                        overlay.classList.remove('active');
                        document.body.classList.remove('modal-open');
                        resolve(result);
                    };

                    const onClose = () => finish(false);
                    const onOverlayClick = (e) => { if (e.target === overlay) finish(false); };
                    const onForgot = (e) => {
                        e.preventDefault();
                        finish(false);
                        if (window._sentinelOpenForgotPw) window._sentinelOpenForgotPw(null, true);
                    };

                    let cooldownInterval = null;
                    const setResendDisabled = (btn, off) => {
                        btn.disabled = off;
                        btn.style.opacity = off ? '0.4' : '';
                        btn.style.cursor = off ? 'not-allowed' : 'pointer';
                        btn.style.pointerEvents = off ? 'none' : '';
                    };
                    const applyCooldown = (btn, secs) => {
                        if (cooldownInterval) { clearInterval(cooldownInterval); cooldownInterval = null; }
                        if (secs <= 0) { setResendDisabled(btn, false); btn.textContent = 'resend code'; return; }
                        setResendDisabled(btn, true);
                        btn.textContent = `resend in ${secs}s`;
                        cooldownInterval = setInterval(() => {
                            secs -= 1;
                            if (secs <= 0) {
                                clearInterval(cooldownInterval); cooldownInterval = null;
                                setResendDisabled(btn, false); btn.textContent = 'resend code';
                            } else { btn.textContent = `resend in ${secs}s`; }
                        }, 1000);
                    };

                    let lastSentAt = 0;
                    const sendCode = async (btn) => {
                        try {
                            const r = await fetch('/v1/user/username-change/send-code', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                            });
                            if (r.ok) {
                                lastSentAt = Date.now();
                                if (btn) applyCooldown(btn, 60);
                                return 'sent';
                            }
                            if (r.status === 429) {
                                const data = await r.json().catch(() => ({}));
                                const remaining = data.retryAfter || 60;
                                lastSentAt = Date.now() - (60 - remaining) * 1000;
                                if (btn) applyCooldown(btn, remaining);
                                return 'sent';
                            }
                            return 'error';
                        } catch { return 'error'; }
                    };

                    const showCodeStep = async () => {
                        stepPassword.style.display = 'none';
                        stepCode.style.display = 'flex';
                        otpUsername.clear();
                        hideError(codeError);
                        codeBtn.disabled = false;
                        codeBtn.textContent = 'verify';
                        const targetEl = document.getElementById('username-verify-code-target');
                        if (targetEl) targetEl.textContent = currentEmail ? maskEmail(currentEmail) : 'your email';
                        const status = await sendCode(resendBtn);
                        if (status === 'error') notify('error: failed to send verification code', 'error');
                        otpUsername.boxes[0].focus();
                    };

                    const renderUsernameCaptcha = () => {
                        if (!window.turnstile) return;
                        const container = document.getElementById('turnstile-username-verify');
                        if (!container) return;
                        container.innerHTML = '';
                        passwordBtn.removeAttribute('data-captcha-token');
                        window.turnstile.render(container, {
                            sitekey: '0x4AAAAAADGpMozD1QOtWPkP',
                            theme: 'dark',
                            callback: (t) => passwordBtn.setAttribute('data-captcha-token', t)
                        });
                    };

                    const onPasswordSubmit = async (e) => {
                        e.preventDefault();
                        const pwd = passwordInput.value;
                        if (!pwd) return;
                        hideError(passwordError);
                        const captchaToken = passwordBtn.getAttribute('data-captcha-token');
                        if (!captchaToken) {
                            showError(passwordError, 'error: please complete the captcha');
                            return;
                        }
                        passwordBtn.disabled = true;
                        passwordBtn.textContent = 'verifying...';
                        try {
                            const r = await fetch('/v1/user/username-change/verify-password', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ password: pwd, captchaToken })
                            });
                            passwordBtn.disabled = false;
                            passwordBtn.textContent = 'continue';
                            if (!r.ok) {
                                renderUsernameCaptcha();
                                showError(passwordError, 'error: incorrect password');
                                return;
                            }
                            passwordInput.value = '';
                            finish(true);
                        } catch {
                            passwordBtn.disabled = false;
                            passwordBtn.textContent = 'continue';
                            showError(passwordError, 'error: verification failed. try again');
                        }
                    };

                    const onCodeSubmit = async (e) => {
                        e.preventDefault();
                        const code = otpUsername.getValue();
                        if (code.length !== 6) return;
                        hideError(codeError);
                        codeBtn.disabled = true;
                        codeBtn.textContent = 'verifying...';
                        try {
                            const r = await fetch('/v1/user/username-change/verify-code', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ code })
                            });
                            const data = await r.json().catch(() => ({}));
                            codeBtn.disabled = false;
                            codeBtn.textContent = 'verify';
                            if (!r.ok) {
                                otpUsername.clear();
                                otpUsername.boxes[0].focus();
                                showError(codeError, 'error: ' + (data.error || 'incorrect code'));
                                return;
                            }
                            finish(true);
                        } catch {
                            codeBtn.disabled = false;
                            codeBtn.textContent = 'verify';
                            showError(codeError, 'error: verification failed. try again');
                        }
                    };

                    const onResend = async (e) => {
                        e.preventDefault();
                        if (resendBtn.disabled) return;
                        resendBtn.disabled = true;
                        resendBtn.textContent = 'sending...';
                        const s = await sendCode(resendBtn);
                        if (s === 'sent') notify('a new code has been sent', 'info');
                        else { resendBtn.disabled = false; resendBtn.textContent = 'resend code'; }
                    };

                    function cleanup() {
                        closeBtn.removeEventListener('click', onClose);
                        overlay.removeEventListener('click', onOverlayClick);
                        passwordForm.removeEventListener('submit', onPasswordSubmit);
                        codeForm.removeEventListener('submit', onCodeSubmit);
                        resendBtn.removeEventListener('click', onResend);
                        if (forgotTrigger) forgotTrigger.removeEventListener('click', onForgot);
                        if (cooldownInterval) { clearInterval(cooldownInterval); cooldownInterval = null; }
                        passwordInput.value = '';
                        hideError(passwordError);
                        hideError(codeError);
                        passwordBtn.disabled = false;
                        passwordBtn.textContent = 'continue';
                    }

                    closeBtn.addEventListener('click', onClose);
                    overlay.addEventListener('click', onOverlayClick);
                    passwordForm.addEventListener('submit', onPasswordSubmit);
                    codeForm.addEventListener('submit', onCodeSubmit);
                    resendBtn.addEventListener('click', onResend);
                    if (forgotTrigger) forgotTrigger.addEventListener('click', onForgot);

                    overlay.classList.add('active');
                    document.body.classList.add('modal-open');

                    if (authProvider === 'email') {
                        stepPassword.style.display = 'flex';
                        stepCode.style.display = 'none';
                        hideError(passwordError);
                        setTimeout(() => passwordInput.focus(), 100);
                        renderUsernameCaptcha();
                    } else {
                        stepPassword.style.display = 'none';
                        showCodeStep();
                    }
                });
            }

            saveBtn.addEventListener('click', async () => {
                let tok = token;
                if (!tok) return;

                const usernameInput = document.getElementById('pref-username');
                const usernameRaw = usernameInput ? usernameInput.value.trim() : '';
                const usernameProvided = Boolean(usernameInput && usernameInput.dataset.isFallback !== 'true');

                if (usernameProvided && usernameRaw.length > 0) {
                    if (/\s/.test(usernameRaw)) {
                        notify('error: username cannot contain spaces', 'error');
                        return;
                    }
                    if (!/^[a-zA-Z0-9]+$/.test(usernameRaw)) {
                        notify('error: username cannot contain symbols', 'error');
                        return;
                    }
                    if (usernameRaw.length < 2 || usernameRaw.length > 16) {
                        notify('error: username must be between 2 and 16 characters', 'error');
                        return;
                    }
                }

                const firstNameRaw = document.getElementById('pref-first-name')?.value.trim() || '';
                const lastNameRaw = document.getElementById('pref-last-name')?.value.trim() || '';
                const NAME_RE = /^[a-zA-Z ]*$/;

                if (!NAME_RE.test(firstNameRaw)) {
                    notify('error: first name cannot contain symbols or numbers', 'error');
                    return;
                }
                if (firstNameRaw.length > 32) {
                    notify('error: first name must be at most 32 characters', 'error');
                    return;
                }
                if (!NAME_RE.test(lastNameRaw)) {
                    notify('error: last name cannot contain symbols or numbers', 'error');
                    return;
                }
                if (lastNameRaw.length > 32) {
                    notify('error: last name must be at most 32 characters', 'error');
                    return;
                }

                const emailInput = document.getElementById('pref-email');
                const emailRaw = emailInput ? emailInput.value.trim() : '';
                const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

                if (emailRaw.length === 0) {
                    notify('error: email cannot be empty', 'error');
                    return;
                }
                if (/[^a-zA-Z0-9._%+@-]/.test(emailRaw)) {
                    notify('error: email contains invalid characters', 'error');
                    return;
                }
                if (!EMAIL_RE.test(emailRaw)) {
                    notify('error: invalid email format', 'error');
                    return;
                }
                if (prefEmailInput && prefEmailInput.dataset.taken === 'true') {
                    return;
                }
                if (prefEmailInput) prefEmailInput._checkSeq = (prefEmailInput._checkSeq || 0) + 1;

                try {
                    const cachedRawForEmail = localStorage.getItem('sentinel-cached-profile');
                    const cachedForEmail = cachedRawForEmail ? JSON.parse(cachedRawForEmail) : {};
                    const currentEmail = cachedForEmail.email || '';
                    const currentUsername = cachedForEmail.username || '';
                    let emailChangeRequested = false;

                    if (usernameProvided && usernameRaw.toLowerCase() !== currentUsername.toLowerCase()) {
                        const authProvider = cachedForEmail.authProvider || 'email';
                        const usernameVerified = await verifyUsernameChangeFlow(authProvider, currentEmail);
                        if (!usernameVerified) return;
                    }

                    if (emailRaw.toLowerCase() !== currentEmail.toLowerCase() && sentinelAuth) {
                        if (otpSentAt._lastNewEmail && otpSentAt._lastNewEmail !== emailRaw.toLowerCase()) {
                            otpSentAt.new = 0;
                        }
                        otpSentAt._lastNewEmail = emailRaw.toLowerCase();

                        try {
                            const checkRes = await fetch('/v1/user/check-email', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${tok}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: emailRaw })
                            });
                            const checkData = await checkRes.json();
                            if (!checkData.available) {
                                if (emailInput) emailInput.value = currentEmail;
                                notify('error: this email is already registered to another account', 'error');
                                return;
                            }
                        } catch {
                            notify('error: could not verify email availability', 'error');
                            return;
                        }

                        const authProvider = cachedForEmail.authProvider || 'email';
                        let verificationMode;
                        if (authProvider === 'email') {
                            verificationMode = 'password';
                        } else if (authProvider === 'google' || currentEmail) {
                            verificationMode = 'code';
                        } else {
                            verificationMode = 'new-only';
                        }

                        const verified = await verifyEmailChangeFlow(currentEmail, verificationMode, emailRaw);
                        if (!verified) return;
                    }

                    const _mfaSensitive = (usernameProvided && usernameRaw.toLowerCase() !== currentUsername.toLowerCase())
                        || (emailRaw.toLowerCase() !== currentEmail.toLowerCase() && sentinelAuth);
                    if (_mfaSensitive) {
                        const okMfa = await ensureMfaForAction();
                        if (!okMfa) return;
                        tok = window.supabaseAuthToken || tok;
                    }

                    setSaveBtnBusy();

                    if (emailRaw.toLowerCase() !== currentEmail.toLowerCase() && sentinelAuth) {
                        const finalizeRes = await mfaAwareFetch('/v1/user/email-change/finalize', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${tok}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: emailRaw })
                        });
                        const finalizeData = await finalizeRes.json().catch(() => ({}));
                        if (!finalizeRes.ok) {
                            resetSaveBtn();
                            notify('error: ' + (finalizeData.error || 'failed to update email'), 'error');
                            return;
                        }
                        emailChangeRequested = true;
                    }

                    const payload = {
                        firstName: firstNameRaw,
                        lastName: lastNameRaw
                    };
                    if (usernameProvided) {
                        payload.username = usernameRaw;
                    }
                    const r = await mfaAwareFetch('/v1/user/profile', {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${tok}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await r.json();
                    if (r.ok) {
                        resetSaveBtn();
                        if (emailChangeRequested) {
                            notify('changes saved. your email address has been updated', 'success');
                        } else {
                            notify('all changes saved successfully', 'success');
                        }

                        const cachedRaw = localStorage.getItem('sentinel-cached-profile');
                        const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
                        const newUsername = data.username || '';
                        const fallbackEmail = data.email || cached.email || '';
                        const displayId = newUsername || fallbackEmail;
                        const identityChanged = (cached.username || '') !== newUsername;

                        cached.email = fallbackEmail;
                        cached.username = newUsername;
                        cached.firstName = data.firstName || '';
                        cached.lastName = data.lastName || '';
                        localStorage.setItem('sentinel-cached-profile', JSON.stringify(cached));

                        const el = document.getElementById('current-user-email');
                        if (el && displayId) el.textContent = displayId;
                        const av = document.getElementById('team-owner-avatar');
                        if (av && displayId) av.textContent = displayId.charAt(0).toUpperCase();
                        const topAvatar = document.getElementById('org-avatar-circle');
                        if (topAvatar && displayId) topAvatar.textContent = displayId.charAt(0).toUpperCase();
                        const dropdownEmailEl = document.getElementById('dropdown-email');
                        if (dropdownEmailEl) dropdownEmailEl.textContent = newUsername ? `@${newUsername}` : fallbackEmail;

                        if (identityChanged) {
                            playPulse(av, 'identity-flash');
                            playPulse(topAvatar, 'identity-flash');
                            playPulse(el, 'identity-swap');
                            playPulse(dropdownEmailEl, 'identity-swap');
                        }

                        if (usernameInput) {
                            usernameInput.value = newUsername || fallbackEmail;
                            usernameInput.dataset.isFallback = newUsername ? 'false' : 'true';
                        }
                        setUsernamePrefixVisible(Boolean(newUsername));

                        try {
                            localStorage.setItem('sentinel-cached-profile', JSON.stringify({
                                ...cached,
                                username: newUsername,
                                firstName: data.firstName ?? cached.firstName ?? '',
                                lastName: data.lastName ?? cached.lastName ?? ''
                            }));
                        } catch {}
                    } else {
                        resetSaveBtn();
                        notify(`error: ${data.error || 'failed to save changes'}`, 'error');
                    }
                } catch {
                    resetSaveBtn();
                    notify('error: failed to save changes', 'error');
                }
            });
        }

        const orgsRes = await fetch('/v1/organizations', { headers: { 'Authorization': `Bearer ${token}` } });
        const orgs = await orgsRes.json();

        localStorage.setItem('sentinel-cached-orgs', JSON.stringify(orgs));
        updateOrgGrid(orgs);
        updateDropdownOrgList(orgs, currentOrgSlug);
        if (window.__applyAccountDeletionState) {
            let phrase = 'delete my account';
            let requestedAt = null;
            try {
                const c = JSON.parse(localStorage.getItem('sentinel-cached-profile') || '{}');
                phrase = c.email || c.username || phrase;
                requestedAt = c.deletionRequestedAt || null;
            } catch (e) {}
            const owned = Array.isArray(orgs) ? orgs.filter(o => o.role === 'Owner').length : 0;
            window.__applyAccountDeletionState(owned, requestedAt, phrase);
        }
        const _sq = new URLSearchParams(window.location.search).get('q') || '';
        if (_sq) filterOrgGrid(_sq);
    } catch (err) {}
}

function updateDropdownOrgList(orgs, activeSlug) {
    const orgList = document.querySelector('.org-list.org-only');
    if (!orgList) return;
    orgList.innerHTML = '';

    orgs.forEach(org => {
        const isActive = org.slug === activeSlug;
        const item = document.createElement('a');
        item.href = '#';
        item.className = `dropdown-item org-item${isActive ? ' active' : ''}`;

        const avatar = document.createElement('div');
        avatar.className = 'org-avatar small';
        avatar.textContent = org.name.charAt(0).toUpperCase();

        const nameSpan = document.createElement('span');
        nameSpan.className = 'org-name-text';
        nameSpan.textContent = org.name;

        item.append(avatar, nameSpan);

        if (isActive) {
            const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            checkSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            checkSvg.setAttribute('width', '14');
            checkSvg.setAttribute('height', '14');
            checkSvg.setAttribute('viewBox', '0 0 24 24');
            checkSvg.setAttribute('fill', 'none');
            checkSvg.setAttribute('stroke', 'var(--neon-blue)');
            checkSvg.setAttribute('stroke-width', '2');
            checkSvg.setAttribute('stroke-linecap', 'round');
            checkSvg.setAttribute('stroke-linejoin', 'round');
            checkSvg.style.marginLeft = 'auto';
            const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            poly.setAttribute('points', '20 6 9 17 4 12');
            checkSvg.appendChild(poly);
            item.appendChild(checkSvg);
        }

        item.onclick = (e) => {
            e.preventDefault();
            history.pushState({ slug: org.slug }, '', `/dashboard/org/${org.slug}`);
            switchToOrgView(org.slug, 'projects');
            const trigger = document.getElementById('user-menu-trigger');
            const menu = document.getElementById('user-dropdown');
            trigger?.classList.remove('active');
            menu?.classList.remove('active');
        };

        orgList.appendChild(item);
    });
}

async function copyApiKeyToClipboard() {
    const token = window.supabaseAuthToken;
    if (!token) return;
    try {
        const res = await mfaAwareFetch('/v1/user/api-key/reveal', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok || !data.apiKey) throw new Error('no key');
        const done = () => { if (window.SentinelToast) window.SentinelToast.show('api key copied to clipboard', 'success'); };
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(data.apiKey);
            done();
        } else {
            const ta = document.createElement('textarea');
            ta.value = data.apiKey;
            ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            try { document.execCommand('copy'); done(); } catch (e) {}
            document.body.removeChild(ta);
        }
    } catch (e) {
        if (window.SentinelToast) window.SentinelToast.show('could not copy api key', 'error');
    }
}

function toggleThemeQuick() {
    const m = document.cookie.match(/(?:^|; )sentinel-theme=([^;]*)/);
    const cur = m ? decodeURIComponent(m[1]) : 'dark';
    const resolved = cur === 'system'
        ? ((window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark')
        : cur;
    const next = resolved === 'light' ? 'dark' : 'light';
    window.applyThemePreference(next, true);
    saveProfilePrefs({ theme: next });
    if (window.SentinelToast) window.SentinelToast.show(`${next} theme enabled`, 'info');
}

function setupShortcuts() {
    const table = document.getElementById('shortcuts-table');
    if (!table || table.dataset.bound) return;
    table.dataset.bound = 'true';

    const clickIf = (id) => { const el = document.getElementById(id); if (el) { el.click(); return true; } return false; };
    const navigate = (path, fn) => { history.pushState({}, '', path); fn(); };

    const SHORTCUTS = [
        { id: 'new-org', label: 'new organization', keys: ['⇧', 'n'], match: (e) => e.key.toLowerCase() === 'n', run: () => { if (!clickIf('mock-new-org-btn')) clickIf('dropdown-create-org'); } },
        { id: 'invite', label: 'invite members', keys: ['⇧', 'i'], match: (e) => e.key.toLowerCase() === 'i', run: () => clickIf('btn-invite-member') },
        { id: 'goto-orgs', label: 'go to organizations', keys: ['⇧', 'h'], match: (e) => e.key.toLowerCase() === 'h', run: () => navigate('/dashboard/organizations', switchToHomeView) },
        { id: 'goto-prefs', label: 'account preferences', keys: ['⇧', 'p'], match: (e) => e.key.toLowerCase() === 'p', run: () => navigate('/dashboard/account/settings/preferences', () => switchToAccountSettings('preferences')) },
        { id: 'copy-key', label: 'copy api key', keys: ['⇧', 'k'], match: (e) => e.key.toLowerCase() === 'k', run: copyApiKeyToClipboard },
        { id: 'toggle-theme', label: 'toggle light / dark theme', keys: ['⇧', 't'], match: (e) => e.key.toLowerCase() === 't', run: toggleThemeQuick },
        { id: 'search-orgs', label: 'search organizations', keys: ['⇧', 'f'], match: (e) => e.key.toLowerCase() === 'f', run: () => { const s = document.querySelector('.org-search-input'); navigate('/dashboard/organizations', switchToHomeView); if (s) setTimeout(() => s.focus(), 0); } },
        { id: 'live-chat', label: 'open live chat', keys: ['⇧', 'c'], match: (e) => e.key.toLowerCase() === 'c', run: () => { if (window.Intercom) window.Intercom('show'); } },
        { id: 'help', label: 'open help center', keys: ['⇧', '/'], match: (e) => e.key === '?', run: () => window.open('https://help.sentinelpay.org', '_blank', 'noopener') },
    ];

    let enabled = {};
    try { enabled = JSON.parse(localStorage.getItem('sentinel-shortcuts') || '{}'); } catch (e) { enabled = {}; }

    SHORTCUTS.forEach((sc) => {
        const row = document.createElement('div');
        row.className = 'settings-table-row sp-shortcut-row';

        const label = document.createElement('div');
        label.className = 'settings-table-label';
        const span = document.createElement('span');
        span.textContent = sc.label;
        label.appendChild(span);

        const value = document.createElement('div');
        value.className = 'settings-table-value';

        const keys = document.createElement('div');
        keys.className = 'sp-shortcut-keys';
        sc.keys.forEach((k) => {
            const kb = document.createElement('span');
            kb.className = 'sp-kbd';
            kb.textContent = k;
            keys.appendChild(kb);
        });

        const sw = document.createElement('label');
        sw.className = 'sp-switch';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.scId = sc.id;
        input.checked = enabled[sc.id] !== false;
        input.setAttribute('aria-label', sc.label);
        const track = document.createElement('span');
        track.className = 'sp-switch-track';
        sw.appendChild(input);
        sw.appendChild(track);

        input.addEventListener('change', () => {
            enabled[sc.id] = input.checked;
            try { localStorage.setItem('sentinel-shortcuts', JSON.stringify(enabled)); } catch (e) {}
            saveProfilePrefs({ shortcuts: enabled });
        });

        value.appendChild(keys);
        value.appendChild(sw);
        row.appendChild(label);
        row.appendChild(value);
        table.appendChild(row);
    });

    window.__applyShortcutPrefs = (map) => {
        if (!map || typeof map !== 'object') return;
        enabled = map;
        try { localStorage.setItem('sentinel-shortcuts', JSON.stringify(enabled)); } catch (e) {}
        table.querySelectorAll('input[data-sc-id]').forEach((inp) => {
            inp.checked = enabled[inp.dataset.scId] !== false;
        });
    };

    if (window.__sentinelShortcutsBound) return;
    window.__sentinelShortcutsBound = true;
    document.addEventListener('keydown', (e) => {
        if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target;
        const tag = t && t.tagName ? t.tagName.toUpperCase() : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
        if (document.body.classList.contains('modal-open')) return;
        let map = {};
        try { map = JSON.parse(localStorage.getItem('sentinel-shortcuts') || '{}'); } catch (e2) { map = {}; }
        for (const sc of SHORTCUTS) {
            if (map[sc.id] === false) continue;
            if (sc.match(e)) {
                e.preventDefault();
                sc.run();
                break;
            }
        }
    });
}

function setupTelemetry() {
    const sw = document.getElementById('telemetry-switch');
    const input = document.getElementById('telemetry-toggle');
    if (!sw || !input) return;

    const applyDisabled = (hasEmail) => {
        input.disabled = !hasEmail;
        sw.classList.toggle('is-disabled', !hasEmail);
    };

    if (!input.dataset.bound) {
        input.dataset.bound = 'true';
        try {
            const cachedRaw = localStorage.getItem('sentinel-cached-profile');
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw);
                input.checked = cached.telemetry === true;
                applyDisabled(Boolean(cached.email));
            }
        } catch (e) {}

        input.addEventListener('change', () => {
            try {
                const cachedRaw = localStorage.getItem('sentinel-cached-profile');
                const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
                cached.telemetry = input.checked;
                localStorage.setItem('sentinel-cached-profile', JSON.stringify(cached));
            } catch (e) {}
            saveProfilePrefs({ telemetry: input.checked });
            if (window.SentinelToast) window.SentinelToast.show(input.checked ? 'telemetry sharing enabled' : 'telemetry sharing disabled', 'info');
        });
    }

    window.__applyTelemetryPref = (telemetry, hasEmail) => {
        input.checked = telemetry === true;
        applyDisabled(hasEmail);
    };
}

function setupAccountDeletion() {
    const initBtn = document.getElementById('btn-account-delete-init');
    const confirmZone = document.getElementById('account-delete-confirm');
    const confirmInput = document.getElementById('account-delete-input');
    const confirmBtn = document.getElementById('btn-account-delete-confirm');
    const phraseEl = document.getElementById('account-delete-phrase');
    const noteEl = document.getElementById('account-delete-note');
    const pendingEl = document.getElementById('account-delete-pending');
    const errEl = document.getElementById('account-delete-error');
    if (!initBtn || !confirmZone || !confirmBtn) return;

    let expectedPhrase = 'delete my account';
    let ownedCount = 0;
    let requested = null;

    const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return ''; } };

    const renderState = () => {
        if (phraseEl) phraseEl.textContent = expectedPhrase;
        if (confirmInput) confirmInput.placeholder = expectedPhrase;
        if (requested) {
            initBtn.style.display = 'none';
            confirmZone.style.display = 'none';
            if (noteEl) noteEl.style.display = 'none';
            pendingEl.style.display = 'block';
            pendingEl.textContent = `account deletion requested on ${fmtDate(requested)}. your data will be removed within 30 days. contact support@sentinelpay.org to cancel.`;
            return;
        }
        pendingEl.style.display = 'none';
        if (ownedCount > 0) {
            initBtn.disabled = true;
            confirmZone.style.display = 'none';
            initBtn.style.display = '';
            noteEl.style.display = 'block';
            noteEl.textContent = `you still own ${ownedCount} organization${ownedCount > 1 ? 's' : ''}. transfer ownership or delete ${ownedCount > 1 ? 'them' : 'it'} before you can delete your account.`;
        } else {
            initBtn.disabled = false;
            noteEl.style.display = 'none';
        }
    };

    window.__applyAccountDeletionState = (owned, requestedAt, phrase) => {
        ownedCount = owned || 0;
        requested = requestedAt || null;
        if (phrase) expectedPhrase = phrase;
        renderState();
    };

    try {
        const co = JSON.parse(localStorage.getItem('sentinel-cached-orgs') || '[]');
        ownedCount = Array.isArray(co) ? co.filter(o => o.role === 'Owner').length : 0;
        const cp = JSON.parse(localStorage.getItem('sentinel-cached-profile') || '{}');
        requested = cp.deletionRequestedAt || null;
        expectedPhrase = cp.email || cp.username || expectedPhrase;
    } catch (e) {}
    renderState();

    if (initBtn.dataset.bound) return;
    initBtn.dataset.bound = 'true';

    initBtn.addEventListener('click', () => {
        if (ownedCount > 0) { renderState(); return; }
        confirmZone.style.display = 'block';
        initBtn.style.display = 'none';
        if (errEl) errEl.style.display = 'none';
        if (confirmInput) { confirmInput.value = ''; setTimeout(() => confirmInput.focus(), 0); }
    });

    confirmBtn.addEventListener('click', async () => {
        if (errEl) errEl.style.display = 'none';
        const val = (confirmInput.value || '').trim();
        if (val.toLowerCase() !== expectedPhrase.toLowerCase()) {
            errEl.textContent = 'error: confirmation text does not match.';
            errEl.style.display = 'block';
            return;
        }
        const okMfa = await ensureMfaForAction();
        if (!okMfa) return;
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'submitting...';
        try {
            const token = window.supabaseAuthToken;
            const r = await mfaAwareFetch('/v1/user/account/deletion-request', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await r.json();
            if (!r.ok) {
                if (r.status === 409) {
                    ownedCount = data.ownedCount || 1;
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'confirm deletion request';
                    renderState();
                    return;
                }
                throw new Error(data.error || 'failed to submit request');
            }
            requested = data.requestedAt || new Date().toISOString();
            try {
                const cachedRaw = localStorage.getItem('sentinel-cached-profile');
                const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
                cached.deletionRequestedAt = requested;
                localStorage.setItem('sentinel-cached-profile', JSON.stringify(cached));
            } catch (e) {}
            renderState();
            if (window.SentinelToast) window.SentinelToast.show('account deletion requested.', 'success');
        } catch (err) {
            errEl.textContent = `error: ${err.message.toLowerCase()}`;
            errEl.style.display = 'block';
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'confirm deletion request';
        }
    });
}

async function ensureMfaForAction() {
    if (!window.__mfaOn) return true;
    if (!window.__mfaStepUp) return true;
    return await window.__mfaStepUp();
}

async function mfaAwareFetch(url, options) {
    let res = await fetch(url, options);
    if (res.status === 403 && window.__mfaStepUp) {
        let body = {};
        try { body = await res.clone().json(); } catch (e) {}
        if (body && body.code === 'mfa_required') {
            const ok = await window.__mfaStepUp();
            if (ok) {
                const headers = Object.assign({}, (options && options.headers) || {});
                headers['Authorization'] = `Bearer ${window.supabaseAuthToken}`;
                res = await fetch(url, Object.assign({}, options, { headers }));
            }
        }
    }
    return res;
}

function mfaFriendlyError(msg) {
    const m = (msg || '').toLowerCase();
    if (m.includes('rate') || m.includes('too many') || m.includes('limit')) return 'too many attempts. wait a moment and try again.';
    if (m.includes('expired')) return 'the code expired. enter a fresh one from your authenticator app.';
    if (m.includes('invalid') || m.includes('incorrect') || m.includes('totp') || m.includes('code') || m.includes('verif')) return 'incorrect code. check your authenticator app and try again.';
    if (m.includes('network') || m.includes('fetch') || m.includes('failed to')) return 'network error. check your connection and try again.';
    return 'could not verify the code. try again.';
}

const SEC_CACHE_KEY = 'sp_sec_state';
function readSecCache() { try { return JSON.parse(localStorage.getItem(SEC_CACHE_KEY)) || {}; } catch (e) { return {}; } }
function writeSecCache(patch) { try { localStorage.setItem(SEC_CACHE_KEY, JSON.stringify(Object.assign(readSecCache(), patch))); } catch (e) {} }

function setupRecoveryCodes() {
    const genBtn = document.getElementById('btn-generate-recovery');
    if (!genBtn || genBtn.dataset.bound) return;
    genBtn.dataset.bound = 'true';

    const statusEl = document.getElementById('recovery-status');
    const modal = document.getElementById('recovery-codes-modal-overlay');
    const closeBtn = document.getElementById('btn-close-recovery');
    const doneBtn = document.getElementById('btn-recovery-done');
    const listEl = document.getElementById('recovery-codes-list');
    const copyBtn = document.getElementById('btn-recovery-copy');
    const dlBtn = document.getElementById('btn-recovery-download');
    const descEl = document.getElementById('recovery-modal-desc');
    const confirmRow = document.getElementById('recovery-confirm-row');
    const confirmCheck = document.getElementById('recovery-confirm-check');
    if (!modal || !listEl) return;

    let currentSeed = '';
    let hasSeed = false;
    let confirmMode = false;
    let confirmCallback = null;

    const paintStatus = (on, seedSet) => {
        genBtn.disabled = !on;
        genBtn.style.opacity = on ? '' : '0.45';
        genBtn.style.cursor = on ? '' : 'not-allowed';
        if (!on) {
            if (statusEl) statusEl.textContent = 'enable two-factor authentication first to create a recovery seed.';
            genBtn.textContent = 'view seed';
            return;
        }
        if (statusEl) statusEl.textContent = seedSet
            ? 'your recovery seed is set. view it any time — you\'ll be asked for a two-factor code first.'
            : 'no recovery seed yet — create one so you can never be locked out.';
        genBtn.textContent = seedSet ? 'view seed' : 'create seed';
    };

    const loadStatus = async () => {
        const mfaOn = !!window.__mfaOn;
        const cached = readSecCache();
        hasSeed = cached.hasSeed === true;
        paintStatus(mfaOn, hasSeed);
        if (!mfaOn) return;
        try {
            const r = await fetch('/v1/user/mfa/recovery-codes/status', { headers: { 'Authorization': `Bearer ${window.supabaseAuthToken}` } });
            const d = await r.json().catch(() => ({}));
            hasSeed = !!(r.ok && d.hasSeed);
            writeSecCache({ hasSeed });
            paintStatus(mfaOn, hasSeed);
        } catch (e) {}
    };
    window.__recoveryRefresh = loadStatus;

    const closeModal = () => { modal.classList.remove('active'); document.body.classList.remove('modal-open'); unlockBodyScroll(); currentSeed = ''; };

    const showSeed = (seed, requireConfirm) => {
        currentSeed = seed || '';
        confirmMode = !!requireConfirm;
        if (!requireConfirm) confirmCallback = null;
        listEl.innerHTML = '';
        const d = document.createElement('div');
        d.textContent = currentSeed;
        d.style.cssText = "font-family:'JetBrains Mono',monospace;font-size:0.9rem;color:var(--text-main);letter-spacing:0.06em;line-height:1.7;text-align:center;word-break:break-all;";
        listEl.appendChild(d);
        if (descEl) descEl.textContent = requireConfirm
            ? "write this down and keep it offline. it's the master key to recovering your account if you lose your authenticator — treat it like a wallet seed. you can view it again later after verifying with two-factor."
            : "your master recovery seed. keep it offline and private — anyone with it can disable two-factor on your account.";
        if (confirmRow) confirmRow.style.display = requireConfirm ? 'flex' : 'none';
        if (confirmCheck) confirmCheck.checked = false;
        if (closeBtn) closeBtn.style.display = requireConfirm ? 'none' : '';
        if (doneBtn) {
            doneBtn.textContent = requireConfirm ? 'done' : 'close';
            doneBtn.disabled = !!requireConfirm;
        }
        modal.classList.add('active');
        document.body.classList.add('modal-open');
        lockBodyScroll();
    };
    window.__recoveryShowNew = (seed, onConfirm) => { confirmCallback = onConfirm || null; showSeed(seed, true); };

    genBtn.addEventListener('click', async () => {
        if (genBtn.disabled) return;
        if (!window.__mfaOn) { if (window.SentinelToast) window.SentinelToast.show('enable mfa first', 'error'); return; }
        confirmCallback = null;
        if (typeof window.__mfaStepUp === 'function') {
            const ok = await window.__mfaStepUp();
            if (!ok) return;
        }
        const orig = genBtn.textContent;
        genBtn.disabled = true;
        genBtn.textContent = hasSeed ? 'opening...' : 'creating...';
        try {
            const endpoint = hasSeed ? '/v1/user/mfa/recovery-codes/reveal' : '/v1/user/mfa/recovery-codes/generate';
            const r = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${window.supabaseAuthToken}`, 'Content-Type': 'application/json' }
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || 'could not open recovery seed');
            showSeed(d.seed || '', !hasSeed);
            loadStatus();
        } catch (e) {
            if (window.SentinelToast) window.SentinelToast.show((e.message || 'could not open recovery seed').toLowerCase(), 'error');
        } finally {
            genBtn.disabled = false;
            genBtn.textContent = orig;
        }
    });

    if (confirmCheck) confirmCheck.addEventListener('change', () => {
        if (doneBtn && confirmRow && confirmRow.style.display !== 'none') doneBtn.disabled = !confirmCheck.checked;
    });

    if (closeBtn) closeBtn.addEventListener('click', () => { if (!confirmMode) closeModal(); });
    if (doneBtn) doneBtn.addEventListener('click', async () => {
        if (doneBtn.disabled) return;
        if (confirmCallback) {
            const label = doneBtn.textContent;
            doneBtn.disabled = true;
            doneBtn.textContent = 'enabling...';
            let ok = false;
            try { ok = await confirmCallback(); } catch (e) { ok = false; }
            if (!ok) {
                doneBtn.disabled = false;
                doneBtn.textContent = label;
                if (window.SentinelToast) window.SentinelToast.show('could not enable mfa right now. please try again.', 'error');
                return;
            }
            confirmCallback = null;
        }
        closeModal();
    });
    modal.addEventListener('click', (e) => { if (e.target === modal && !confirmMode) closeModal(); });
    if (copyBtn) copyBtn.addEventListener('click', () => {
        const done = () => { copyBtn.textContent = 'copied'; setTimeout(() => { copyBtn.textContent = 'copy'; }, 2000); };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(currentSeed).then(done).catch(done);
        else done();
    });
    if (dlBtn) dlBtn.addEventListener('click', () => {
        const blob = new Blob(['sentinelpay master recovery seed\n\n' + currentSeed + '\n\nkeep this offline and private. anyone with it can disable two-factor on your account. use it at sign-in if you ever lose your authenticator.\n'], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sentinelpay-recovery-seed.txt';
        a.click();
        URL.revokeObjectURL(url);
    });

    loadStatus();
}

function setupChangePassword() {
    const btn = document.getElementById('btn-change-password');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = 'true';

    const modal = document.getElementById('change-password-modal-overlay');
    const closeBtn = document.getElementById('btn-close-change-password');
    const currentEl = document.getElementById('cp-current');
    const newEl = document.getElementById('cp-new');
    const confirmEl = document.getElementById('cp-confirm');
    const errEl = document.getElementById('cp-error');
    const submitBtn = document.getElementById('btn-cp-submit');
    const tContainer = document.getElementById('turnstile-change-password');
    const oauthNote = document.getElementById('password-oauth-note');
    if (!modal || !submitBtn) return;

    let authProvider = 'email';
    let accountEmail = '';
    try {
        const cached = JSON.parse(localStorage.getItem('sentinel-cached-profile') || '{}');
        authProvider = cached.authProvider || 'email';
        accountEmail = cached.email || '';
    } catch (e) {}

    const isSetInitial = authProvider !== 'email';
    if (isSetInitial) {
        btn.textContent = 'set password';
        if (oauthNote) oauthNote.style.display = 'none';
    }

    if (newEl && !newEl.dataset.rulesWired) {
        newEl.dataset.rulesWired = 'true';
        newEl.addEventListener('input', () => {
            const val = newEl.value;
            const setRule = (id, ok) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.classList.toggle('met', ok);
                el.textContent = ok ? '✓' : '✕';
            };
            setRule('cp-rule-len', val.length >= 8);
            setRule('cp-rule-upper', /[A-Z]/.test(val));
            setRule('cp-rule-num', /[0-9]/.test(val));
        });
    }

    let turnstileId = null;
    const renderCaptcha = () => {
        submitBtn.removeAttribute('data-captcha-token');
        if (!window.turnstile || !tContainer) return;
        tContainer.innerHTML = '';
        try {
            turnstileId = window.turnstile.render(tContainer, {
                sitekey: '0x4AAAAAADGpMozD1QOtWPkP',
                theme: document.documentElement.classList.contains('theme-light') ? 'light' : 'dark',
                callback: (t) => submitBtn.setAttribute('data-captcha-token', t)
            });
        } catch (e) {}
    };

    const closeModal = () => {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
        unlockBodyScroll();
    };

    const openModal = () => {
        currentEl.value = ''; newEl.value = ''; confirmEl.value = '';
        ['cp-rule-len', 'cp-rule-upper', 'cp-rule-num'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) { el.classList.remove('met'); el.textContent = '✕'; }
        });
        errEl.style.display = 'none';
        const curGroup = document.getElementById('cp-current-group');
        const titleEl = document.getElementById('cp-title');
        const descEl = document.getElementById('cp-desc');
        if (isSetInitial) {
            if (curGroup) curGroup.style.display = 'none';
            if (titleEl) titleEl.textContent = 'set password';
            if (descEl) descEl.textContent = 'set a password so you can also sign in with your email or username.';
            if (tContainer) tContainer.style.display = 'none';
            submitBtn.textContent = 'set password';
        } else {
            if (curGroup) curGroup.style.display = '';
            if (titleEl) titleEl.textContent = 'change password';
            if (descEl) descEl.textContent = 'confirm your current password, then set a new one.';
            if (tContainer) tContainer.style.display = 'flex';
            submitBtn.textContent = 'update password';
        }
        submitBtn.disabled = false;
        modal.classList.add('active');
        document.body.classList.add('modal-open');
        lockBodyScroll();
        if (!isSetInitial) renderCaptcha();
        setTimeout(() => (isSetInitial ? newEl : currentEl).focus(), 50);
    };

    const fail = (msg) => {
        errEl.textContent = `error: ${msg}`;
        errEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = isSetInitial ? 'set password' : 'update password';
    };

    const submit = async () => {
        errEl.style.display = 'none';
        const cur = currentEl.value;
        const nw = newEl.value;
        const cf = confirmEl.value;
        if (!isSetInitial && !cur) return fail('enter your current password');
        if (nw.length < 8 || !/[A-Z]/.test(nw) || !/[0-9]/.test(nw)) return fail('password must be at least 8 characters and include an uppercase letter and a number');
        if (nw !== cf) return fail('passwords do not match');
        if (!isSetInitial && nw === cur) return fail('new password must be different from your current one');
        if (!isSetInitial) {
            const captchaToken = submitBtn.getAttribute('data-captcha-token');
            if (!captchaToken) return fail('please complete the captcha');
        }

        submitBtn.disabled = true;
        submitBtn.textContent = isSetInitial ? 'setting...' : 'verifying...';
        try {
            if (!isSetInitial) {
                let email = accountEmail;
                try { const { data } = await sentinelAuth.auth.getUser(); if (data && data.user && data.user.email) email = data.user.email; } catch (e) {}
                if (!email) return fail('could not confirm your account. reload and try again');

                const captchaToken = submitBtn.getAttribute('data-captcha-token');
                const { error: verr } = await sentinelAuth.auth.signInWithPassword({ email, password: cur, options: { captchaToken } });
                if (verr) {
                    renderCaptcha();
                    const m = (verr.message || '').toLowerCase();
                    if (m.includes('captcha')) return fail('captcha failed. try again');
                    return fail('current password is incorrect');
                }
                try { const { data } = await sentinelAuth.auth.getSession(); if (data && data.session && data.session.access_token) window.supabaseAuthToken = data.session.access_token; } catch (e) {}
            }

            submitBtn.textContent = isSetInitial ? 'setting...' : 'updating...';
            const { error: uerr } = await sentinelAuth.auth.updateUser({ password: nw });
            if (uerr) {
                if (!isSetInitial) renderCaptcha();
                const m = (uerr.message || '').toLowerCase();
                if (m.includes('different') || m.includes('should be')) return fail('new password must be different from your current one');
                return fail(isSetInitial ? 'could not set password. try again' : 'could not update password. try again');
            }
            closeModal();
            if (window.SentinelToast) window.SentinelToast.show(isSetInitial ? 'password set — you can now sign in with your email or username' : 'password updated', 'success');
        } catch (e) {
            console.error('[change password]', e.message || e);
            if (!isSetInitial) renderCaptcha();
            fail(isSetInitial ? 'could not set password. try again' : 'could not update password. try again');
        }
    };

    btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        // If MFA is on, require the authenticator challenge FIRST, before the
        // password form even opens.
        if (window.__mfaOn && typeof window.__mfaStepUp === 'function') {
            btn.disabled = true;
            let ok = false;
            try { ok = await window.__mfaStepUp(); } catch (e) { ok = false; }
            btn.disabled = false;
            if (!ok) return;
        }
        openModal();
    });
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    submitBtn.addEventListener('click', submit);
    [currentEl, newEl, confirmEl].forEach((el) => { if (el) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }); });
}

function getDeviceId() {
    try {
        let id = localStorage.getItem('sentinel-device-id');
        if (!id || !/^[a-zA-Z0-9_-]{8,64}$/.test(id)) {
            const raw = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
            id = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
            if (id.length < 8) id = ('dev' + id + Math.random().toString(36).slice(2)).slice(0, 40);
            localStorage.setItem('sentinel-device-id', id);
        }
        return id;
    } catch (e) {
        return 'web' + Math.random().toString(36).slice(2, 14);
    }
}

function parseUserAgentStr(ua) {
    ua = ua || '';
    let browser = 'browser';
    if (/edg/i.test(ua)) browser = 'edge';
    else if (/opr|opera/i.test(ua)) browser = 'opera';
    else if (/chrome|crios/i.test(ua)) browser = 'chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'firefox';
    else if (/safari/i.test(ua)) browser = 'safari';
    let os = 'unknown device';
    if (/windows/i.test(ua)) os = 'windows';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'ios';
    else if (/mac os x|macintosh/i.test(ua)) os = 'macos';
    else if (/android/i.test(ua)) os = 'android';
    else if (/linux/i.test(ua)) os = 'linux';
    return { browser, os };
}

function sessionTimeAgo(dateStr) {
    const d = new Date(dateStr).getTime();
    if (!d) return '';
    const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hr ago`;
    const days = Math.floor(h / 24);
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
}

async function getFreshAuthToken() {
    try {
        const { data } = await sentinelAuth.auth.getSession();
        if (data && data.session && data.session.access_token) {
            window.supabaseAuthToken = data.session.access_token;
            return data.session.access_token;
        }
    } catch (e) {}
    return window.supabaseAuthToken || null;
}

async function sessionHeartbeat(token) {
    try {
        await fetch('/v1/user/sessions/heartbeat', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token || window.supabaseAuthToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: getDeviceId() })
        });
    } catch (e) {}
}

const SESSION_DEVICE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>';

function renderSessionsList(sessions) {
    const list = document.getElementById('sessions-list');
    if (!list) return;
    const currentId = getDeviceId();
    if (!sessions || !sessions.length) {
        list.innerHTML = '<div class="sp-sessions-empty">no active sessions found.</div>';
        return;
    }
    list.innerHTML = '';
    sessions.forEach(sn => {
        const { browser, os } = parseUserAgentStr(sn.userAgent);
        const loc = [sn.city, sn.country].filter(Boolean).join(', ');
        const meta = [];
        if (loc) meta.push(loc);
        if (sn.ip) meta.push(sn.ip);
        meta.push('active ' + sessionTimeAgo(sn.lastSeenAt));
        const isCurrent = sn.deviceId === currentId;
        const row = document.createElement('div');
        row.className = 'sp-session-row';
        row.innerHTML = `<span class="sp-session-icon">${SESSION_DEVICE_SVG}</span>` +
            `<div class="sp-session-info">` +
            `<span class="sp-session-title">${escHtml(browser)} · ${escHtml(os)}${isCurrent ? '<span class="sp-session-badge">this device</span>' : ''}</span>` +
            `<span class="sp-session-meta">${escHtml(meta.join(' · '))}</span>` +
            `</div>`;
        list.appendChild(row);
    });
}

async function loadSessions() {
    const list = document.getElementById('sessions-list');
    if (!list) return;

    // 1) paint cached sessions instantly — no "loading…" flash
    let hasPainted = false;
    try {
        const cached = JSON.parse(localStorage.getItem('sentinel-cached-sessions') || 'null');
        if (Array.isArray(cached) && cached.length) { renderSessionsList(cached); hasPainted = true; }
    } catch (e) {}

    const softFail = () => { if (!hasPainted) list.innerHTML = '<div class="sp-sessions-empty">could not load sessions.</div>'; };

    // 2) refresh from server in the background
    const token = await getFreshAuthToken();
    if (!token) return softFail();
    try { await sessionHeartbeat(token); } catch (e) {}
    try {
        const r = await fetch('/v1/user/sessions', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!r.ok) return softFail();
        const data = await r.json();
        const sessions = (data && data.sessions) || [];
        try { localStorage.setItem('sentinel-cached-sessions', JSON.stringify(sessions)); } catch (e) {}
        renderSessionsList(sessions);
    } catch (e) {
        softFail();
    }
}

function setupSessions() {
    const btn = document.getElementById('btn-signout-others');
    if (btn && !btn.dataset.bound) {
        btn.dataset.bound = 'true';
        btn.addEventListener('click', async () => {
            const orig = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'signing out…';
            try {
                if (sentinelAuth && sentinelAuth.auth && sentinelAuth.auth.signOut) {
                    try { await sentinelAuth.auth.signOut({ scope: 'others' }); } catch (e) {}
                }
                const token = await getFreshAuthToken();
                if (token) {
                    await fetch('/v1/user/sessions/revoke-others', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ deviceId: getDeviceId() })
                    });
                }
                if (window.SentinelToast) window.SentinelToast.show('signed out of all other devices', 'success');
                await loadSessions();
            } catch (e) {
                if (window.SentinelToast) window.SentinelToast.show('could not sign out other devices', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = orig;
            }
        });
    }
    loadSessions();
}

function setupSecurity() {
    const toggle = document.getElementById('mfa-toggle');
    const sw = document.getElementById('mfa-switch');
    const statusEl = document.getElementById('mfa-status');
    if (!toggle || !sw) return;

    const mfa = (sentinelAuth && sentinelAuth.auth && sentinelAuth.auth.mfa) ? sentinelAuth.auth.mfa : null;
    if (!mfa) {
        sw.classList.add('is-disabled');
        if (statusEl) statusEl.textContent = 'not available in this browser.';
        return;
    }

    const enrollModal = document.getElementById('mfa-enroll-modal-overlay');
    const closeEnroll = document.getElementById('btn-close-mfa');
    const qrWrap = document.getElementById('mfa-qr-wrap');
    const secretRow = document.getElementById('mfa-secret-row');
    const secretEl = document.getElementById('mfa-secret');
    const secretCopyBtn = document.getElementById('mfa-secret-copy');
    const codeSection = document.getElementById('mfa-code-section');
    const otpWrap = document.getElementById('mfa-otp');
    const verifyError = document.getElementById('mfa-verify-error');

    const disableModal = document.getElementById('mfa-disable-modal-overlay');
    const closeDisable = document.getElementById('btn-close-mfa-disable');
    const disableOtpWrap = document.getElementById('mfa-disable-otp');
    const disableError = document.getElementById('mfa-disable-error');
    const disableBtn = document.getElementById('btn-mfa-disable-confirm');

    if (!enrollModal || !disableModal) return;

    let enabled = readSecCache().mfaOn === true;
    let pendingFactorId = null;
    let enrollDone = false;
    let awaitingSeedConfirm = false;

    window.__mfaOn = enabled;
    sw.classList.remove('is-disabled');
    toggle.checked = enabled;

    const setStatus = () => {
        window.__mfaOn = enabled;
        writeSecCache({ mfaOn: enabled });
        sw.classList.remove('is-disabled');
        toggle.checked = enabled;
        if (statusEl) {
            statusEl.classList.toggle('is-on', enabled);
            statusEl.textContent = enabled
                ? 'enabled — an authenticator code is required to sign in and to approve sensitive actions.'
                : 'disabled — your account is protected by password only.';
        }
        if (typeof window.__recoveryRefresh === 'function') window.__recoveryRefresh();
    };

    const getFreshToken = async () => {
        try {
            const { data } = await sentinelAuth.auth.getSession();
            return (data && data.session && data.session.access_token) || window.supabaseAuthToken;
        } catch (e) { return window.supabaseAuthToken; }
    };

    const setServerState = async (val, providedToken) => {
        const token = providedToken || await getFreshToken();
        if (token) window.supabaseAuthToken = token;
        try {
            const r = await fetch('/v1/user/mfa/state', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: val })
            });
            return r.ok;
        } catch (e) { return false; }
    };

    const getVerifiedFactor = async () => {
        try {
            const { data } = await mfa.listFactors();
            const totp = (data && (data.totp || data.all)) || [];
            return totp.find(f => f.status === 'verified') || null;
        } catch (e) { return null; }
    };

    const refresh = async () => {
        try {
            const token = await getFreshToken();
            if (token) window.supabaseAuthToken = token;
            const r = await fetch('/v1/user/mfa/reconcile', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            const d = await r.json().catch(() => ({}));
            enabled = !!(r.ok && d.mfaEnabled);
        } catch (e) {
            enabled = !!(await getVerifiedFactor());
        }
        setStatus();
    };

    const closeEnrollModal = () => {
        enrollModal.classList.remove('active');
        document.body.classList.remove('modal-open');
        unlockBodyScroll();
        if (pendingFactorId && !enrollDone && !awaitingSeedConfirm) {
            mfa.unenroll({ factorId: pendingFactorId }).catch(() => {});
        }
        if (!awaitingSeedConfirm) pendingFactorId = null;
    };

    const cancelEnroll = () => { closeEnrollModal(); toggle.checked = enabled; };

    let otpCells = [];
    let verifyBusy = false;
    const otpValue = () => otpCells.map((c) => c.value).join('');
    const setOtpFilled = () => otpCells.forEach((c) => c.classList.toggle('filled', !!c.value));
    const clearOtp = () => { otpCells.forEach((c) => { c.value = ''; c.disabled = false; }); setOtpFilled(); };
    const focusFirstOtp = () => { const t = otpCells.find((c) => !c.value) || otpCells[0]; if (t) t.focus(); };

    const doVerify = async () => {
        if (verifyBusy) return;
        const code = otpValue();
        if (!/^[0-9]{6}$/.test(code)) { verifyError.textContent = 'error: enter the 6-digit code'; verifyError.style.display = 'block'; focusFirstOtp(); return; }
        if (!pendingFactorId) return;
        verifyBusy = true;
        verifyError.style.display = 'none';
        otpCells.forEach((c) => { c.disabled = true; });
        try {
            const { data: vdata, error } = await mfa.challengeAndVerify({ factorId: pendingFactorId, code });
            if (error) throw new Error(error.message);
            if (vdata && vdata.access_token) window.supabaseAuthToken = vdata.access_token;

            let seed = '';
            try {
                const rr = await fetch('/v1/user/mfa/recovery-codes/generate', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${window.supabaseAuthToken}`, 'Content-Type': 'application/json' }
                });
                const rd = await rr.json().catch(() => ({}));
                if (!rr.ok || !rd.seed) throw new Error(rd.error || 'seed');
                seed = rd.seed;
            } catch (seedErr) {
                const fid = pendingFactorId;
                pendingFactorId = null;
                enrollDone = false;
                awaitingSeedConfirm = false;
                try { await mfa.unenroll({ factorId: fid }); } catch (e2) {}
                enabled = false;
                setStatus();
                verifyBusy = false;
                clearOtp();
                focusFirstOtp();
                verifyError.textContent = 'error: could not prepare your recovery seed. please try again.';
                verifyError.style.display = 'block';
                return;
            }

            awaitingSeedConfirm = true;
            closeEnrollModal();
            window.__recoveryShowNew(seed, async () => {
                const ok = await setServerState(true);
                if (!ok) return false;
                enrollDone = true;
                awaitingSeedConfirm = false;
                pendingFactorId = null;
                enabled = true;
                setStatus();
                if (window.SentinelToast) window.SentinelToast.show('mfa enabled', 'success');
                return true;
            });
        } catch (e) {
            console.error('[mfa enable verify]', e.message || e);
            verifyBusy = false;
            clearOtp();
            focusFirstOtp();
            verifyError.textContent = `error: ${mfaFriendlyError(e.message)}`;
            verifyError.style.display = 'block';
        }
    };

    const buildOtp = () => {
        otpWrap.innerHTML = '';
        otpCells = [];
        for (let i = 0; i < 6; i++) {
            const c = document.createElement('input');
            c.type = 'text';
            c.className = 'otp-box';
            c.inputMode = 'numeric';
            c.autocomplete = i === 0 ? 'one-time-code' : 'off';
            c.maxLength = 1;
            c.setAttribute('aria-label', 'digit ' + (i + 1));
            otpCells.push(c);
            otpWrap.appendChild(c);
        }
        otpCells.forEach((c, idx) => {
            c.addEventListener('input', () => {
                c.value = c.value.replace(/[^0-9]/g, '').slice(0, 1);
                setOtpFilled();
                if (c.value && idx < 5) otpCells[idx + 1].focus();
                if (otpValue().length === 6) doVerify();
            });
            c.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !c.value && idx > 0) { otpCells[idx - 1].focus(); otpCells[idx - 1].value = ''; setOtpFilled(); e.preventDefault(); }
                else if (e.key === 'ArrowLeft' && idx > 0) { otpCells[idx - 1].focus(); e.preventDefault(); }
                else if (e.key === 'ArrowRight' && idx < 5) { otpCells[idx + 1].focus(); e.preventDefault(); }
                else if (e.key === 'Enter') doVerify();
            });
            c.addEventListener('paste', (e) => {
                e.preventDefault();
                const src = (e.clipboardData || window.clipboardData);
                const digits = (src ? src.getData('text') : '').replace(/[^0-9]/g, '').slice(0, 6);
                if (!digits) return;
                for (let j = 0; j < 6; j++) otpCells[j].value = digits[j] || '';
                setOtpFilled();
                otpCells[Math.min(digits.length, 5)].focus();
                if (otpValue().length === 6) doVerify();
            });
        });
    };

    const openEnroll = async () => {
        enrollDone = false;
        pendingFactorId = null;
        qrWrap.innerHTML = '<p style="font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;color:var(--text-muted);text-align:center;margin:1rem 0;">generating...</p>';
        secretRow.style.display = 'none';
        codeSection.style.display = 'none';
        verifyBusy = false;
        verifyError.style.display = 'none';
        enrollModal.classList.add('active');
        document.body.classList.add('modal-open');
        lockBodyScroll();
        try {
            let accountEmail = '';
            try {
                const { data: uData } = await sentinelAuth.auth.getUser();
                accountEmail = (uData && uData.user && uData.user.email) ? uData.user.email : '';
                console.log('[mfa enroll] account email present:', Boolean(accountEmail), accountEmail ? `(${accountEmail})` : '(none)');
            } catch (eu) {}
            if (!accountEmail) {
                pendingFactorId = null;
                codeSection.style.display = 'none';
                secretRow.style.display = 'none';
                qrWrap.innerHTML = `<p style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:#ff6b6b;text-align:center;line-height:1.6;margin:1rem 0;">this account has no email address.<br>authenticator setup needs one — add an email under account settings first.</p>`;
                return;
            }

            try {
                const { data: existing } = await mfa.listFactors();
                const all = (existing && (existing.all || existing.totp)) || [];
                for (const f of all) {
                    if (f && f.status !== 'verified') {
                        try { await mfa.unenroll({ factorId: f.id }); } catch (e2) {}
                    }
                }
            } catch (e3) {}

            let res = await mfa.enroll({ factorType: 'totp', issuer: 'sentinelpay', friendlyName: `sentinelpay ${Date.now().toString(36).slice(-4)}` });
            if (res.error && /already exists|friendly|name/i.test(res.error.message || '')) {
                res = await mfa.enroll({ factorType: 'totp', issuer: 'sentinelpay', friendlyName: `sentinelpay ${Date.now().toString(36)}` });
            }
            if (res.error) {
                const st = res.error && res.error.status ? ` (${res.error.status})` : '';
                console.error('[mfa enroll] supabase error:', res.error, 'status:', res.error && res.error.status, 'name:', res.error && res.error.name);
                throw new Error(`${res.error.message || 'enrollment failed'}${st}`);
            }
            pendingFactorId = res.data.id;
            const totp = res.data.totp || {};
            qrWrap.innerHTML = '';
            let qrSrc = totp.qr_code || '';
            const svgMarker = 'data:image/svg+xml;utf-8,';
            if (qrSrc.startsWith(svgMarker)) {
                qrSrc = 'data:image/svg+xml,' + encodeURIComponent(qrSrc.slice(svgMarker.length));
            } else if (/^<svg/i.test(qrSrc)) {
                qrSrc = 'data:image/svg+xml,' + encodeURIComponent(qrSrc);
            }
            if (qrSrc) {
                const img = document.createElement('img');
                img.src = qrSrc;
                img.alt = 'mfa qr code';
                img.className = 'sp-mfa-qr';
                img.onerror = () => {
                    qrWrap.innerHTML = '<p style="font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;color:var(--text-muted);text-align:center;margin:1rem 0;">scan unavailable — enter the key below in your app</p>';
                };
                qrWrap.appendChild(img);
            } else {
                qrWrap.innerHTML = '<p style="font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;color:var(--text-muted);text-align:center;margin:1rem 0;">enter the key below in your authenticator app</p>';
            }
            if (totp.secret) { secretEl.textContent = totp.secret; secretRow.style.display = 'flex'; }
            buildOtp();
            clearOtp();
            codeSection.style.display = 'flex';
            setTimeout(() => focusFirstOtp(), 50);
        } catch (e) {
            console.error('[mfa enroll]', e.message || e);
            pendingFactorId = null;
            codeSection.style.display = 'none';
            secretRow.style.display = 'none';
            qrWrap.innerHTML = `<p style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:#ff6b6b;text-align:center;line-height:1.6;margin:1rem 0;">could not start mfa setup:<br>${(e.message || 'please try again').toLowerCase()}</p>`;
        }
    };

    const closeDisableModal = () => {
        disableModal.classList.remove('active');
        document.body.classList.remove('modal-open');
        unlockBodyScroll();
    };

    const cancelDisable = () => { closeDisableModal(); toggle.checked = enabled; };

    let disableCells = [];
    let disableBusy = false;
    const disableValue = () => disableCells.map((c) => c.value).join('');
    const setDisableFilled = () => disableCells.forEach((c) => c.classList.toggle('filled', !!c.value));
    const clearDisableOtp = () => { disableCells.forEach((c) => { c.value = ''; c.disabled = false; }); setDisableFilled(); };
    const focusFirstDisable = () => { const t = disableCells.find((c) => !c.value) || disableCells[0]; if (t) t.focus(); };

    const doDisable = async () => {
        if (disableBusy) return;
        const code = disableValue();
        if (!/^[0-9]{6}$/.test(code)) { disableError.textContent = 'error: enter the 6-digit code'; disableError.style.display = 'block'; focusFirstDisable(); return; }
        disableBusy = true;
        disableError.style.display = 'none';
        disableCells.forEach((c) => { c.disabled = true; });
        disableBtn.disabled = true;
        disableBtn.textContent = 'verifying...';
        try {
            const f = await getVerifiedFactor();
            if (!f) throw new Error('no authenticator found');
            const { data: vdata, error } = await mfa.challengeAndVerify({ factorId: f.id, code });
            if (error) throw new Error(error.message);
            const stateOk = await setServerState(false, vdata && vdata.access_token);
            if (!stateOk) {
                disableBusy = false;
                disableBtn.disabled = false;
                disableBtn.textContent = 'verify & disable';
                clearDisableOtp();
                focusFirstDisable();
                disableError.textContent = 'error: could not disable mfa right now. please try again.';
                disableError.style.display = 'block';
                return;
            }
            try { await mfa.unenroll({ factorId: f.id }); } catch (e) {}
            const rest = await getVerifiedFactor();
            if (rest) { try { await mfa.unenroll({ factorId: rest.id }); } catch (e) {} }
            enabled = false;
            setStatus();
            closeDisableModal();
            if (window.SentinelToast) window.SentinelToast.show('mfa disabled', 'success');
        } catch (e) {
            console.error('[mfa disable verify]', e.message || e);
            disableBusy = false;
            disableBtn.disabled = false;
            disableBtn.textContent = 'verify & disable';
            clearDisableOtp();
            focusFirstDisable();
            disableError.textContent = `error: ${mfaFriendlyError(e.message)}`;
            disableError.style.display = 'block';
        }
    };

    const buildDisableOtp = () => {
        disableOtpWrap.innerHTML = '';
        disableCells = [];
        for (let i = 0; i < 6; i++) {
            const c = document.createElement('input');
            c.type = 'text';
            c.className = 'otp-box';
            c.inputMode = 'numeric';
            c.autocomplete = i === 0 ? 'one-time-code' : 'off';
            c.maxLength = 1;
            c.setAttribute('aria-label', 'digit ' + (i + 1));
            disableCells.push(c);
            disableOtpWrap.appendChild(c);
        }
        disableCells.forEach((c, idx) => {
            c.addEventListener('input', () => {
                c.value = c.value.replace(/[^0-9]/g, '').slice(0, 1);
                setDisableFilled();
                if (c.value && idx < 5) disableCells[idx + 1].focus();
                if (disableValue().length === 6) doDisable();
            });
            c.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !c.value && idx > 0) { disableCells[idx - 1].focus(); disableCells[idx - 1].value = ''; setDisableFilled(); e.preventDefault(); }
                else if (e.key === 'ArrowLeft' && idx > 0) { disableCells[idx - 1].focus(); e.preventDefault(); }
                else if (e.key === 'ArrowRight' && idx < 5) { disableCells[idx + 1].focus(); e.preventDefault(); }
                else if (e.key === 'Enter') doDisable();
            });
            c.addEventListener('paste', (e) => {
                e.preventDefault();
                const src = (e.clipboardData || window.clipboardData);
                const digits = (src ? src.getData('text') : '').replace(/[^0-9]/g, '').slice(0, 6);
                if (!digits) return;
                for (let j = 0; j < 6; j++) disableCells[j].value = digits[j] || '';
                setDisableFilled();
                disableCells[Math.min(digits.length, 5)].focus();
                if (disableValue().length === 6) doDisable();
            });
        });
    };

    const openDisable = () => {
        disableBusy = false;
        disableError.style.display = 'none';
        disableBtn.disabled = false;
        disableBtn.textContent = 'verify & disable';
        buildDisableOtp();
        clearDisableOtp();
        disableModal.classList.add('active');
        document.body.classList.add('modal-open');
        lockBodyScroll();
        setTimeout(() => focusFirstDisable(), 50);
    };

    window.__mfaStepUp = () => new Promise((resolve) => {
        const modalEl = document.getElementById('mfa-stepup-modal-overlay');
        const otpWrapEl = document.getElementById('mfa-stepup-otp');
        const errEl = document.getElementById('mfa-stepup-error');
        const vBtn = document.getElementById('btn-mfa-stepup-verify');
        const cBtn = document.getElementById('btn-close-mfa-stepup');
        if (!modalEl || !otpWrapEl || !vBtn) { resolve(false); return; }

        let settled = false;
        let busy = false;
        let cells = [];
        const close = () => {
            modalEl.classList.remove('active');
            document.body.classList.remove('modal-open');
            unlockBodyScroll();
        };
        const finish = (val) => { if (settled) return; settled = true; close(); resolve(val); };

        const value = () => cells.map((c) => c.value).join('');
        const setFilled = () => cells.forEach((c) => c.classList.toggle('filled', !!c.value));
        const clear = () => { cells.forEach((c) => { c.value = ''; c.disabled = false; }); setFilled(); };
        const focusFirst = () => { const t = cells.find((c) => !c.value) || cells[0]; if (t) t.focus(); };

        const submit = async () => {
            if (busy) return;
            const code = value();
            if (!/^[0-9]{6}$/.test(code)) { errEl.textContent = 'error: enter the 6-digit code'; errEl.style.display = 'block'; focusFirst(); return; }
            busy = true;
            errEl.style.display = 'none';
            cells.forEach((c) => { c.disabled = true; });
            vBtn.disabled = true;
            vBtn.textContent = 'verifying...';
            try {
                const f = await getVerifiedFactor();
                if (!f) throw new Error('no authenticator found');
                const { data: vdata, error } = await mfa.challengeAndVerify({ factorId: f.id, code });
                if (error) throw new Error(error.message);
                if (vdata && vdata.access_token) window.supabaseAuthToken = vdata.access_token;
                finish(true);
            } catch (e) {
                console.error('[mfa stepup]', e.message || e);
                busy = false;
                vBtn.disabled = false;
                vBtn.textContent = 'verify';
                clear();
                focusFirst();
                errEl.textContent = `error: ${mfaFriendlyError(e.message)}`;
                errEl.style.display = 'block';
            }
        };

        otpWrapEl.innerHTML = '';
        cells = [];
        for (let i = 0; i < 6; i++) {
            const c = document.createElement('input');
            c.type = 'text';
            c.className = 'otp-box';
            c.inputMode = 'numeric';
            c.autocomplete = i === 0 ? 'one-time-code' : 'off';
            c.maxLength = 1;
            c.setAttribute('aria-label', 'digit ' + (i + 1));
            cells.push(c);
            otpWrapEl.appendChild(c);
        }
        cells.forEach((c, idx) => {
            c.addEventListener('input', () => {
                c.value = c.value.replace(/[^0-9]/g, '').slice(0, 1);
                setFilled();
                if (c.value && idx < 5) cells[idx + 1].focus();
                if (value().length === 6) submit();
            });
            c.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !c.value && idx > 0) { cells[idx - 1].focus(); cells[idx - 1].value = ''; setFilled(); e.preventDefault(); }
                else if (e.key === 'ArrowLeft' && idx > 0) { cells[idx - 1].focus(); e.preventDefault(); }
                else if (e.key === 'ArrowRight' && idx < 5) { cells[idx + 1].focus(); e.preventDefault(); }
                else if (e.key === 'Enter') submit();
            });
            c.addEventListener('paste', (e) => {
                e.preventDefault();
                const src = (e.clipboardData || window.clipboardData);
                const digits = (src ? src.getData('text') : '').replace(/[^0-9]/g, '').slice(0, 6);
                if (!digits) return;
                for (let j = 0; j < 6; j++) cells[j].value = digits[j] || '';
                setFilled();
                cells[Math.min(digits.length, 5)].focus();
                if (value().length === 6) submit();
            });
        });

        errEl.style.display = 'none';
        busy = false;
        vBtn.disabled = false;
        vBtn.textContent = 'verify';
        modalEl.classList.add('active');
        document.body.classList.add('modal-open');
        lockBodyScroll();
        setTimeout(() => focusFirst(), 50);

        vBtn.onclick = submit;
        cBtn.onclick = () => finish(false);
        modalEl.onclick = (e) => { if (e.target === modalEl) finish(false); };
    });

    if (!toggle.dataset.bound) {
        toggle.dataset.bound = 'true';

        toggle.addEventListener('change', () => {
            if (toggle.checked && !enabled) openEnroll();
            else if (!toggle.checked && enabled) openDisable();
        });

        closeEnroll.addEventListener('click', cancelEnroll);
        enrollModal.addEventListener('click', (e) => { if (e.target === enrollModal) cancelEnroll(); });
        closeDisable.addEventListener('click', cancelDisable);
        disableModal.addEventListener('click', (e) => { if (e.target === disableModal) cancelDisable(); });


        if (secretCopyBtn) {
            const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
            const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            let secretCopied = false;
            const showSecretCopied = () => {
                secretCopied = true;
                secretCopyBtn.style.color = '#00ff88';
                secretCopyBtn.innerHTML = CHECK_SVG;
                setTimeout(() => {
                    secretCopyBtn.style.color = '';
                    secretCopyBtn.innerHTML = COPY_SVG;
                    secretCopied = false;
                }, 3000);
            };
            const fallbackCopySecret = (text) => {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                try { document.execCommand('copy'); showSecretCopied(); } catch (e) {}
                document.body.removeChild(ta);
            };
            secretCopyBtn.addEventListener('click', () => {
                if (secretCopied) return;
                const text = (secretEl.textContent || '').trim();
                if (!text) return;
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(text).then(showSecretCopied).catch(() => fallbackCopySecret(text));
                } else {
                    fallbackCopySecret(text);
                }
            });
        }

        disableBtn.addEventListener('click', () => { doDisable(); });
    }

    refresh();
}

function setupSidebar() {
    const toggle = document.getElementById('sidebar-toggle');
    const popup = document.getElementById('sidebar-popup');
    const helpBtn = document.getElementById('sidebar-help');
    const options = document.querySelectorAll('.state-option');

    if (!toggle || !popup) return;
    if (toggle.dataset.bound) return;
    toggle.dataset.bound = "true";

    toggle.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        popup.classList.toggle('active');
    };

    if (helpBtn) {
        helpBtn.onclick = (e) => {
            e.preventDefault();
            window.open('https://help.sentinelpay.org', '_blank');
        };
    }

    options.forEach(opt => {
        opt.onclick = (e) => {
            e.preventDefault();
            const state = opt.dataset.state;
            
            document.body.classList.remove('sidebar-expanded', 'sidebar-collapsed', 'sidebar-hover');
            if (state === 'expanded') document.body.classList.add('sidebar-expanded');
            else if (state === 'collapsed') document.body.classList.add('sidebar-collapsed');
            else document.body.classList.add('sidebar-hover');

            options.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            
            popup.classList.remove('active');
            localStorage.setItem('sentinel-sidebar-state', state);
        };
    });

    const savedState = localStorage.getItem('sentinel-sidebar-state') || 'hover';
    document.body.classList.remove('sidebar-expanded', 'sidebar-collapsed', 'sidebar-hover');
    if (savedState === 'expanded') document.body.classList.add('sidebar-expanded');
    else if (savedState === 'collapsed') document.body.classList.add('sidebar-collapsed');
    else document.body.classList.add('sidebar-hover');

    options.forEach(o => {
        if (o.dataset.state === savedState) o.classList.add('active');
        else o.classList.remove('active');
    });

    document.addEventListener('click', () => popup.classList.remove('active'));

    const bindOrgNav = (id, subPath, viewName) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.onclick = (e) => {
            e.preventDefault();
            const path = window.location.pathname;
            const orgMatch = path.match(/\/dashboard\/org\/([a-z0-9]{20})/);
            if (orgMatch) {
                const slug = orgMatch[1];
                const newPath = subPath === '' ? `/dashboard/org/${slug}` : `/dashboard/org/${slug}/${subPath}`;
                history.pushState({ slug }, '', newPath);
                switchToOrgView(slug, viewName);
            }
        };
    };

    bindOrgNav('sidebar-item-projects', '', 'projects');
    bindOrgNav('sidebar-item-team', 'team', 'team');
    ['integrations', 'usage', 'billing', 'settings'].forEach(sub => {
        bindOrgNav(`sidebar-item-${sub}`, sub, sub);
    });
}
