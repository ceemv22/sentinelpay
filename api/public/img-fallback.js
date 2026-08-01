/* image fallbacks.
   inline onerror="" attributes are blocked by our csp (script-src-attr 'none'),
   so fallbacks are wired here instead:
     data-fb="/path.png"  -> swap to that source once, then give up
     no data-fb           -> drop the img so a placeholder underneath shows through
   also handles images that already failed before this script ran. */
(function () {
    var SEL = 'img[data-fb], .article-avatar img, .lp-ins-avatar img, .lp-ins-cover-img, .bad-net-mark img, .lp-net-mark img';
    document.querySelectorAll(SEL).forEach(function (img) {
        function fail() {
            var fb = img.getAttribute('data-fb');
            if (fb) { img.removeAttribute('data-fb'); img.src = fb; }
            else { img.remove(); }
        }
        img.addEventListener('error', fail);
        if (img.complete && img.naturalWidth === 0) fail();
    });
})();
