        (function() {
            var form = document.getElementById('lp-demo-form');
            if (!form) return;
            var steps = form.querySelectorAll('.lp-demo-step');
            var total = steps.length;
            var cur = 0;
            var fill = document.getElementById('lp-demo-fill');
            var pct = document.getElementById('lp-demo-pct');
            var backBtn = document.getElementById('lp-demo-back');
            var nextBtn = document.getElementById('lp-demo-next');
            var submitBtn = document.getElementById('lp-demo-submit');
            var successBox = document.getElementById('lp-demo-success');
            var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            var nameRe = /^[a-zA-ZÀ-ɏ'’.\- ]+$/;
            var letterRe = /[a-zA-ZÀ-ɏ]/;
            var alnumRe = /[a-zA-Z0-9À-ɏ]/;
            // two pages share this form engine. the markup, validation and custom
            // selects are identical; only the step contents and destination differ.
            var CONFIG = {
                demo: {
                    endpoint: '/v1/demo-request',
                    submitLabel: 'request a demo',
                    heads: { 1: 'tell us about yourself', 2: 'help us understand your business', 3: 'your crypto exposure & needs', 4: 'one last thing' },
                    required: { 1: ['firstName','lastName','jobTitle','email'], 2: ['company','website','industry','country'], 3: ['size','volume'], 4: [] }
                },
                trial: {
                    endpoint: '/v1/trial-request',
                    submitLabel: 'start free trial',
                    heads: { 1: 'who is signing up', 2: 'confirm and start' },
                    required: { 1: ['firstName','lastName','email','website'], 2: [] }
                }
            };
            var cfg = CONFIG[form.getAttribute('data-form')] || CONFIG.demo;
            var heads = cfg.heads;
            // i18n translates the page once on load, so anything this script writes
            // afterwards (validation messages, button labels, toasts) has to look the
            // string up itself or it comes back in english on a translated page.
            var t = function (x) { return window.SentinelI18n ? window.SentinelI18n.t(x) : x; };
            // we publicly refuse gambling operators, so the form says so the moment it
            // is picked rather than letting someone fill four steps and be rejected by
            // the server. the server checks it too; this is the courteous half.
            var gamblingRe = /gambling|igaming|casino|betting|sportsbook|wager/i;
            var domainRe = /^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;
            var headEl = document.getElementById('lp-demo-formhead');
            function setError(input, msg) {
                var field = input.closest('.lp-demo-field');
                if (!field) return;
                field.classList.toggle('lp-demo-invalid', !!msg);
                var err = field.querySelector('.lp-demo-error');
                if (msg) {
                    if (!err) { err = document.createElement('span'); err.className = 'lp-demo-error'; field.appendChild(err); }
                    err.textContent = msg;
                } else if (err) { err.remove(); }
            }
            function fieldError(inp) {
                var v = inp.value.trim();
                switch (inp.name) {
                    case 'firstName':
                    case 'lastName':
                        if (!v) return t('this field is required');
                        if (v.length < 2) return t('that looks too short');
                        if (!nameRe.test(v)) return t('letters only, no numbers or symbols');
                        return '';
                    case 'jobTitle':
                        if (!v) return t('this field is required');
                        if (v.length < 2) return t('that looks too short');
                        if (!letterRe.test(v)) return t('enter a real job title');
                        return '';
                    case 'company':
                        if (!v) return t('this field is required');
                        if (v.length < 2) return t('that looks too short');
                        if (!alnumRe.test(v)) return t('enter a real company name');
                        return '';
                    case 'website':
                        if (!v) return t('this field is required');
                        var host = v.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./i, '').trim().toLowerCase();
                        if (!domainRe.test(host)) return t('enter a valid domain, e.g. company.com');
                        var emailInp = form.querySelector('input[name="email"]');
                        var emailDomain = emailInp && emailInp.value.indexOf('@') !== -1 ? emailInp.value.trim().split('@').pop().toLowerCase() : '';
                        if (emailDomain && host !== emailDomain && host.slice(-(emailDomain.length + 1)) !== '.' + emailDomain && emailDomain.slice(-(host.length + 1)) !== '.' + host) {
                            return t('must match your work email domain') + ' (@' + emailDomain + ')';
                        }
                        return '';
                    case 'size':
                        if (!v) return t('please select company size');
                        return '';
                    case 'industry':
                        if (!v) return t('please pick an industry');
                        if (gamblingRe.test(v)) return t('we do not work with gambling operators. this is a policy, not a limit we can lift.');
                        return '';
                    case 'country':
                        if (!v) return t('please pick your country');
                        return '';
                    case 'volume':
                        if (!v) return t('please pick an expected volume');
                        return '';
                    case 'message':
                        // optional: skip it entirely, or write as little as you like
                        if (!v) return '';
                        if (v.length > 250) return t('keep it under 250 characters');
                        return '';
                    case 'email':
                        if (!v) return t('this field is required');
                        if (/\s/.test(v)) return t('email cannot contain spaces');
                        if (!emailRe.test(v)) return t('enter a valid email address');
                        if (/\.\./.test(v) || /@\./.test(v) || /\.$/.test(v)) return t('enter a valid email address');
                        return '';
                }
                return '';
            }
            function validateStep(i) {
                var ok = true;
                var required = cfg.required;
                var stepEl = steps[i];
                var stepNo = parseInt(stepEl.getAttribute('data-step'), 10);
                var names = required[stepNo] || [];
                names.forEach(function(nm) {
                    var inp = stepEl.querySelector('[name="' + nm + '"]');
                    if (!inp) return;
                    var msg = fieldError(inp);
                    setError(inp, msg);
                    if (msg) ok = false;
                });
                var checks = stepEl.querySelectorAll('input[name="solutions"]');
                if (checks.length) {
                    var anyChecked = Array.prototype.some.call(checks, function(c) { return c.checked; });
                    var checkField = checks[0].closest('.lp-demo-field');
                    if (checkField) {
                        checkField.classList.toggle('lp-demo-invalid', !anyChecked);
                        var cerr = checkField.querySelector('.lp-demo-error');
                        if (!anyChecked) {
                            if (!cerr) { cerr = document.createElement('span'); cerr.className = 'lp-demo-error'; checkField.appendChild(cerr); }
                            cerr.textContent = t('pick at least one');
                            ok = false;
                        } else if (cerr) { cerr.remove(); }
                    }
                }
                if (i === total - 1) {
                    // every tickbox in the final step is a declaration we rely on, so
                    // all of them must be ticked, not just the contact consent
                    stepEl.querySelectorAll('.lp-demo-consent input[type="checkbox"]').forEach(function(cb) {
                        var wrap = cb.closest('.lp-demo-consent');
                        if (!cb.checked) { ok = false; wrap.classList.add('lp-demo-consent-err'); }
                        else { wrap.classList.remove('lp-demo-consent-err'); }
                    });
                }
                return ok;
            }
            function render() {
                // any open dropdown belongs to the outgoing step, so close them all
                form.querySelectorAll('.lp-demo-select-menu:not([hidden])').forEach(function(m) {
                    m.hidden = true;
                    var w = m.closest('.lp-demo-select');
                    if (w) { w.classList.remove('is-open'); w.querySelector('.lp-demo-select-btn').setAttribute('aria-expanded', 'false'); }
                });
                steps.forEach(function(s, i) { s.hidden = i !== cur; });
                var active = steps[cur];
                active.style.animation = 'none'; void active.offsetWidth; active.style.animation = '';
                var p = Math.round(((cur + 1) / total) * 100);
                if (fill) fill.style.width = p + '%';
                if (pct) pct.textContent = p + '%';
                backBtn.hidden = cur === 0;
                nextBtn.hidden = cur === total - 1;
                submitBtn.hidden = cur !== total - 1;
                if (headEl) { var no = parseInt(active.getAttribute('data-step'), 10); if (heads[no]) headEl.textContent = t(heads[no]); }
            }
            render();

            var COUNTRIES = ["Afghanistan","Albania","Algeria","Andorra","Angola","Antigua & Barbuda","Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia & Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cambodia","Cameroon","Canada","Cape Verde","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo (Brazzaville)","Congo (Kinshasa)","Costa Rica","Côte d’Ivoire","Croatia","Cuba","Cyprus","Czechia","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti","Honduras","Hong Kong","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kosovo","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Macau","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts & Nevis","Saint Lucia","Saint Vincent & the Grenadines","Samoa","San Marino","São Tomé & Príncipe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad & Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"];
            (function() {
                var cList = form.querySelector('.lp-demo-select[data-select="country"] .lp-demo-select-list');
                if (cList) {
                    var frag = document.createDocumentFragment();
                    COUNTRIES.forEach(function(c) {
                        var li = document.createElement('li');
                        li.className = 'lp-demo-select-opt';
                        li.setAttribute('role', 'option');
                        li.setAttribute('data-value', c);
                        li.textContent = c;
                        frag.appendChild(li);
                    });
                    cList.appendChild(frag);
                }
            })();

            var allSelects = form.querySelectorAll('.lp-demo-select');
            var closeAllSelects = function(except) {
                allSelects.forEach(function(w) {
                    if (w === except) return;
                    var m = w.querySelector('.lp-demo-select-menu');
                    if (m && !m.hidden) { m.hidden = true; w.classList.remove('is-open'); w.querySelector('.lp-demo-select-btn').setAttribute('aria-expanded', 'false'); }
                });
            };
            allSelects.forEach(function(wrap) {
                var input = wrap.querySelector('input[type="hidden"]');
                var btn = wrap.querySelector('.lp-demo-select-btn');
                var menu = wrap.querySelector('.lp-demo-select-menu');
                var val = wrap.querySelector('.lp-demo-select-val');
                var place = function() {
                    var r = btn.getBoundingClientRect();
                    menu.style.left = r.left + 'px';
                    menu.style.width = r.width + 'px';
                    // cap to the CSS max-height (which may be a vh value on mobile)
                    var capPx = parseFloat(getComputedStyle(menu).maxHeight) || 200;
                    var mh = Math.min(menu.scrollHeight, capPx);
                    var below = window.innerHeight - r.bottom - 12;
                    // open upward when it would poke past the bottom and there's room above
                    if (below < mh && r.top - 12 > mh) {
                        menu.style.top = (r.top - 6 - mh) + 'px';
                    } else {
                        menu.style.top = (r.bottom + 6) + 'px';
                    }
                };
                var search = wrap.querySelector('.lp-demo-select-search');
                var emptyMsg = wrap.querySelector('.lp-demo-select-empty');
                var runFilter = function() {
                    if (!search) return;
                    var q = search.value.trim().toLowerCase();
                    var shown = 0;
                    wrap.querySelectorAll('.lp-demo-select-opt').forEach(function(o) {
                        var match = o.textContent.toLowerCase().indexOf(q) !== -1;
                        o.hidden = !match;
                        if (match) shown++;
                    });
                    if (emptyMsg) emptyMsg.hidden = shown !== 0;
                };
                var open = function(o) {
                    menu.hidden = !o;
                    wrap.classList.toggle('is-open', o);
                    btn.setAttribute('aria-expanded', o ? 'true' : 'false');
                    if (o) {
                        place();
                        if (search) { search.value = ''; runFilter(); setTimeout(function() { search.focus({ preventScroll: true }); }, 0); }
                    }
                };
                if (search) {
                    search.addEventListener('input', runFilter);
                    search.addEventListener('click', function(e) { e.stopPropagation(); });
                }
                window.addEventListener('resize', function() { if (!menu.hidden) place(); });
                window.addEventListener('scroll', function(e) {
                    // page scrolls: keep the fixed-position menu glued to its button
                    if (!menu.hidden && !(e.target instanceof Node && menu.contains(e.target))) place();
                }, true);
                btn.addEventListener('click', function(e) { e.stopPropagation(); var willOpen = menu.hidden; closeAllSelects(wrap); open(willOpen); });
                btn.addEventListener('keydown', function(e) { if (e.key === 'Escape') open(false); });
                menu.addEventListener('keydown', function(e) { if (e.key === 'Escape') { open(false); btn.focus(); } });
                wrap.querySelectorAll('.lp-demo-select-opt').forEach(function(opt) {
                    opt.addEventListener('click', function() {
                        wrap.querySelectorAll('.lp-demo-select-opt').forEach(function(o) { o.classList.remove('is-active'); });
                        opt.classList.add('is-active');
                        input.value = opt.getAttribute('data-value');
                        val.textContent = opt.textContent;
                        val.classList.remove('is-placeholder');
                        setError(input, fieldError(input));
                        open(false);
                    });
                });
                document.addEventListener('click', function(e) { if (!wrap.contains(e.target)) open(false); });
            });

            form.querySelectorAll('input[name="solutions"]').forEach(function(cb) {
                cb.addEventListener('change', function() {
                    if (cb.checked) {
                        var isNotSure = cb.value === 'not sure yet';
                        form.querySelectorAll('input[name="solutions"]').forEach(function(other) {
                            if (other === cb) return;
                            var otherIsNotSure = other.value === 'not sure yet';
                            // checking "not sure yet" clears all others; checking any other clears "not sure yet"
                            if ((isNotSure && !otherIsNotSure) || (!isNotSure && otherIsNotSure)) other.checked = false;
                        });
                    }
                    var field = cb.closest('.lp-demo-field');
                    if (field && field.classList.contains('lp-demo-invalid') && form.querySelector('input[name="solutions"]:checked')) {
                        field.classList.remove('lp-demo-invalid');
                        var e = field.querySelector('.lp-demo-error');
                        if (e) e.remove();
                    }
                });
            });

            var msgArea = form.querySelector('textarea[name="message"]');
            var msgCount = document.getElementById('lp-demo-msg-count');
            if (msgArea) {
                var autoGrow = function() {
                    msgArea.style.height = 'auto';
                    msgArea.style.height = Math.min(msgArea.scrollHeight, 116) + 'px';
                };
                msgArea.addEventListener('input', function() {
                    autoGrow();
                    if (msgCount) msgCount.textContent = msgArea.value.length;
                });
                autoGrow();
            }

            var validatedNames = ['firstName','lastName','jobTitle','company','website','email','message'];
            form.querySelectorAll('input[name], select[name], textarea[name]').forEach(function(inp) {
                if (validatedNames.indexOf(inp.name) === -1) return;
                inp.addEventListener('blur', function() { setError(inp, fieldError(inp)); });
                inp.addEventListener('input', function() {
                    var field = inp.closest('.lp-demo-field');
                    if (field && field.classList.contains('lp-demo-invalid')) setError(inp, fieldError(inp));
                });
            });
            var consentInp = form.querySelector('input[name="consent"]');
            if (consentInp) consentInp.addEventListener('change', function() {
                if (consentInp.checked) consentInp.closest('.lp-demo-consent').classList.remove('lp-demo-consent-err');
            });

            nextBtn.addEventListener('click', function() {
                if (!validateStep(cur)) return;
                if (cur < total - 1) { cur++; render(); }
            });
            backBtn.addEventListener('click', function() {
                if (cur > 0) { cur--; render(); }
            });

            // A single-input form submits on enter, and this form has one <form> across
            // four steps, so enter on step 1 fired the real submit: it validated only the
            // step you were on and posted a half-empty request, once per press. Enter now
            // means "next" until the last step, where it means submit.
            form.addEventListener('keydown', function(e) {
                if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
                var el = e.target;
                var tag = el && el.tagName;
                if (tag === 'TEXTAREA') return;                 // enter is a newline there
                if (tag === 'BUTTON' || tag === 'A') return;     // let the control do its job
                if (cur < total - 1) {
                    e.preventDefault();
                    if (validateStep(cur)) { cur++; render(); }
                    return;
                }
                // last step: only let it through once the declarations are ticked, and
                // never while a send is already in flight
                if (submitBtn.disabled) { e.preventDefault(); }
            });

            // Cloudflare Turnstile — activates only when window.__TURNSTILE_SITEKEY is set.
            var turnstileToken = '';
            var turnstileEnabled = false;
            (function initTurnstile() {
                var siteKey = window.__TURNSTILE_SITEKEY;
                var holder = document.getElementById('lp-demo-turnstile');
                if (!siteKey || !holder) return;
                turnstileEnabled = true;
                function renderWidget() {
                    if (!window.turnstile) return;
                    window.turnstile.render(holder, {
                        sitekey: siteKey,
                        theme: 'dark',
                        callback: function(t) { turnstileToken = t; },
                        'expired-callback': function() { turnstileToken = ''; },
                        'error-callback': function() { turnstileToken = ''; }
                    });
                }
                if (window.turnstile) { renderWidget(); }
                else {
                    var s = document.createElement('script');
                    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
                    s.async = true; s.defer = true;
                    s.onload = renderWidget;
                    document.head.appendChild(s);
                }
            })();

            form.addEventListener('submit', function(e) {
                e.preventDefault();
                if (!validateStep(cur)) return;
                if (turnstileEnabled && !turnstileToken) {
                    if (window.SentinelToast) window.SentinelToast.show(t('please complete the verification below.'), 'warning');
                    return;
                }
                var data = {};
                new FormData(form).forEach(function(v, k) { if (k !== 'solutions') data[k] = typeof v === 'string' ? v.trim() : v; });
                data.solutions = Array.prototype.map.call(form.querySelectorAll('input[name="solutions"]:checked'), function(c) { return c.value; });
                form.querySelectorAll('.lp-demo-consent input[type="checkbox"]').forEach(function(cb) { data[cb.name] = !!cb.checked; });
                if (turnstileToken) data['cf-turnstile-response'] = turnstileToken;
                submitBtn.disabled = true;
                submitBtn.textContent = t('sending…');
                fetch(cfg.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                }).then(function(r) {
                    return r.ok ? r.json().catch(function(){ return {}; }) : Promise.reject(r);
                }).then(function() {
                    // clear the way for the success panel. on the fold pages the card
                    // must not change size, so the form keeps its space and the panel
                    // is laid over it. elsewhere the card is free to collapse.
                    var fold = form.closest('.bad-form-card');
                    if (fold) {
                        // the pane stays in the layout, only invisible, so the card
                        // keeps its height and nothing below it shifts
                        form.classList.add('is-sent');
                    } else {
                        form.style.display = 'none';
                        var card = form.closest('.lp-demo-card');
                        if (card) {
                            var left = card.querySelector('.lp-demo-left');
                            var right = card.querySelector('.lp-demo-right');
                            if (left) left.style.display = 'none';
                            if (right) right.style.display = 'none';
                        }
                    }
                    var host = form.parentElement;
                    if (host) host.querySelectorAll('[data-on-success="hide"]').forEach(function(el) { el.style.display = 'none'; });
                    if (successBox) successBox.hidden = false;
                }).catch(function() {
                    submitBtn.disabled = false;
                    submitBtn.textContent = t(cfg.submitLabel);
                    turnstileToken = '';
                    if (turnstileEnabled && window.turnstile) { try { window.turnstile.reset(); } catch (e) {} }
                    if (window.SentinelToast) window.SentinelToast.show(t('could not send. email us at support@sentinelpay.org'), 'error');
                    else alert(t('could not send right now. please email support@sentinelpay.org'));
                });
            });
        })();
