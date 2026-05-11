// Eye-Cursor Tracking — same logic as homepage app.js
(function() {
    var pupils = document.querySelectorAll('.eye-pupil');
    if (pupils.length > 0) {
        document.addEventListener('mousemove', function(e) {
            var cx = window.innerWidth / 2;
            var cy = window.innerHeight / 2;
            var ox = (e.clientX - cx) / cx;
            var oy = (e.clientY - cy) / cy;
            var m = 3;
            pupils.forEach(function(pupil) {
                pupil.style.transform = 'translate(' + (ox * m) + 'px, ' + (oy * m) + 'px)';
            });
        });
    }
})();
