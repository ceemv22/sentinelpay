/* sentinelpay | tab-title i18n

   loaded synchronously in <head> so the translated title is set before the
   browser ever paints the tab. i18n.js sits at the end of <body>, which left
   the english title on screen for half a second before it swapped.

   i18n.js reads window.__SP_TITLES from here rather than keeping its own copy.
   the same strings still exist in the main dictionary as a fallback for the
   case where this file fails to load. */
(function () {
    'use strict';
    var LANGS = { en: 1, hr: 1, de: 1 };
    var TITLES = {
        "sentinelpay | blog | you don't have an aml problem, you have a speed problem": {"hr":"sentinelpay | blog | nemate aml problem, imate problem s brzinom","de":"sentinelpay | blog | sie haben kein aml-problem, sie haben ein tempo-problem"},
        "sentinelpay | blog | you shouldn't have to become a bank to stay compliant": {"hr":"sentinelpay | blog | ne biste trebali postati banka da biste bili usklađeni","de":"sentinelpay | blog | sie sollten keine bank werden müssen, um compliant zu bleiben"},
        "sentinelpay | blog | we'll take almost any crypto business. gambling is where we draw the line": {"hr":"sentinelpay | blog | primamo gotovo svaku kripto tvrtku. kockanje je granica","de":"sentinelpay | blog | wir nehmen fast jedes krypto-unternehmen. bei glücksspiel ist schluss"},
        "sentinelpay | blog | why criminals target small businesses (and exactly how they do it)": {"hr":"sentinelpay | blog | zašto kriminalci ciljaju male tvrtke (i kako to točno rade)","de":"sentinelpay | blog | warum kriminelle es auf kleine unternehmen abgesehen haben (und wie genau)"},
        "sentinelpay | book a demo": {"hr":"sentinelpay | dogovorite demo","de":"sentinelpay | demo vereinbaren"},
        "sentinelpay | privacy policy": {"hr":"sentinelpay | pravila privatnosti","de":"sentinelpay | datenschutzerklärung"},
        "sentinelpay | terms of service": {"hr":"sentinelpay | uvjeti korištenja","de":"sentinelpay | nutzungsbedingungen"}
    };
    window.__SP_TITLES = TITLES;

    var m = document.cookie.match(/(?:^|; )sp-lang=([^;]*)/);
    var lang = m ? decodeURIComponent(m[1]) : null;
    if (!lang) { try { lang = localStorage.getItem('sp-lang'); } catch (e) {} }
    if (!LANGS[lang] || lang === 'en') return;

    var src = (document.title || '').replace(/\s+/g, ' ').trim();
    window.__SP_TITLE_SRC = src;
    var hit = TITLES[src];
    if (hit && hit[lang]) document.title = hit[lang];
    document.documentElement.lang = lang;
})();
