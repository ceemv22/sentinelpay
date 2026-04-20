// Eye-Cursor Tracking — same logic as homepage app.js
(function() {
    var pupil = document.getElementById('eye-pupil');
    if (pupil) {
        document.addEventListener('mousemove', function(e) {
            var cx = window.innerWidth / 2;
            var cy = window.innerHeight / 2;
            var ox = (e.clientX - cx) / cx;
            var oy = (e.clientY - cy) / cy;
            var m = 3;
            pupil.style.transform = 'translate(' + (ox * m) + 'px, ' + (oy * m) + 'px)';
        });
    }
})();
