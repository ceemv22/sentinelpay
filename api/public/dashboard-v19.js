// 0. S-Tier Global Error Monitor
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

// 0. S-Tier UI Status Overlay (Only for Errors now)
window.showStatus = (msg, type = 'info') => {
    if (type !== 'error') return; // Silent mode for everything except critical failures
    
    let overlay = document.getElementById('sentinel-status-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sentinel-status-overlay';
        overlay.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 20px;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);border:1px solid rgba(255,51,51,0.4);border-radius:12px;color:#ff3333;font-family:JetBrains Mono,monospace;font-size:0.75rem;z-index:99999;box-shadow:0 10px 30px rgba(0,0,0,0.5);pointer-events:none;transition:all 0.3s ease;';
        document.body.appendChild(overlay);
    }
    overlay.textContent = msg;
};

// 1. GLOBAL STATE
const supabaseUrl = 'https://aivqwkgjdpklxxuvkxpy.supabase.co';
const supabaseKey = 'sb_publishable_bRfAssaGT6D8oFDQtPARbw_5fyYGWM6';
let sentinelAuth = null;
let isInitialized = false;
let authStartTime = Date.now();
const API_URL = window.location.origin;

const initialSearch = window.location.search;
const initialHash = window.location.hash;

// 2. CORE LOGIC
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

// UI HELPERS
const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.onclick = async (e) => {
        e.preventDefault();
        localStorage.removeItem('sentinel-cached-orgs');
        if (sentinelAuth) await sentinelAuth.auth.signOut();
        window.location.href = 'https://sentinelpay.org';
    };
}

function renderDashboard(session) {
    // S-Tier Redirect: If we have a pending invitation from join.html, go back there
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

    if (renderDashboard.busy) return;
    renderDashboard.busy = true;

    try {
        const token = session.access_token;
        const user = session.user;
        window.supabaseAuthToken = token;
        
        // 1. INSTANT UI STATE
        document.body.classList.add('state-org-home');

        // 2. Immediate Identifiers
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
        
        const avatarEl = document.getElementById('org-avatar-circle');
        if (avatarEl) avatarEl.textContent = avatarInitial.toUpperCase();
        
        // Sync Team View Avatar and Email Instantly
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

        // 2.5 ROUTING LOGIC
        const currentPath = window.location.pathname;
        const orgMatch = currentPath.match(/^\/dashboard\/org\/([a-z0-9]{20})(\/[a-z0-9-]+)?$/);
        const isValidHome = currentPath === '/dashboard' || currentPath === '/dashboard/organizations' || currentPath === '/dashboard/';

        if (orgMatch) {
            switchToOrgView(orgMatch[1], orgMatch[2] ? orgMatch[2].substring(1) : 'projects');
        } else if (isValidHome) {
            switchToHomeView();
        } else {
            window.location.replace('/dashboard/organizations');
            return;
        }

        // 3. CACHE LOOKUP
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

        // 4. BACKGROUND FETCH
        fetchHeaderApiKey(token);
        fetchProfile(token);
        fetchPendingInvitations(token);

        // 5. MODAL & SIDEBAR INITIALIZATION
        setupCreateOrgModal(token);
        setupInviteMemberModal(token);
        setupSidebar();
        setupMobileNav();
    } catch (e) {
        console.error('[sentinel-render] Critical failure:', e);
        showStatus('Render Error', 'error');
    } finally {
        renderDashboard.busy = false;
    }
}

// --- Mobile Navigation Setup ---
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

    // Backdrop click closes drawer
    overlay.addEventListener('click', closeMobileNav);

    // Any sidebar nav item click closes drawer (after a short delay for UX)
    if (sidebar) {
        sidebar.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                setTimeout(closeMobileNav, 200);
            });
        });
    }

    // Sync mobile API key suffix from desktop element
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

    // Close on Escape key
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

    const openModal = () => {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
        form.reset();
        errorEl.style.display = 'none';
        
        // Reset dynamic UI elements
        const recEl = document.getElementById('org-name-rec');
        const successIcon = document.getElementById('org-name-success');
        if (recEl) recEl.style.display = 'none';
        if (successIcon) successIcon.style.display = 'none';
        
        // Reset custom selects
        document.querySelectorAll('.sentinel-select-trigger').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sentinel-select-dropdown').forEach(d => d.classList.remove('active'));
    };

    const closeModal = () => {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
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
            // Close other selects
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
    };

    initSelect('plan');

    // Live Name Check & Recommendation
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
                            nameInput.dispatchEvent(new Event('input')); // Trigger re-check
                        };
                    }
                    if (successIcon) successIcon.style.display = 'none';
                } else {
                    recEl.style.display = 'none';
                    if (successIcon) successIcon.style.display = 'block';
                }
            } catch (e) {}
        }, 400); // 400ms debounce
    };

    // Global click to close selects
    document.addEventListener('click', () => {
        document.querySelectorAll('.sentinel-select-trigger').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sentinel-select-dropdown').forEach(d => d.classList.remove('active'));
    });

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('org-name').value.trim();
        const plan = document.getElementById('org-plan').value;

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'initializing...';
            errorEl.style.display = 'none';

            const response = await fetch('/v1/organizations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, plan })
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.code === 'name_taken') {
                    throw new Error(`name already taken.`);
                }
                throw new Error(data.error || 'failed to create organization');
            }

            // Success
            if (window.SentinelToast) window.SentinelToast.show("organization created successfully.", "success");
            closeModal();
            
            // Refresh grid
            fetchProfile(token);
            
        } catch (err) {
            errorEl.textContent = `error: ${err.message.toLowerCase()}`;
            errorEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'create organization';
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
        form.reset();
        
        // Render Turnstile
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
        if (window.turnstile && inviteTurnstileId !== null) {
            window.turnstile.reset(inviteTurnstileId);
        }
        submitBtn.removeAttribute('data-captcha-token');
    };

    openBtn.onclick = (e) => { e.preventDefault(); openModal(); };
    closeBtn.onclick = (e) => { e.preventDefault(); closeModal(); };
    
    // Close on overlay click
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    // Custom Select Logic
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

            const response = await fetch(`${API_URL}/v1/organizations/${orgSlug}/team/invite`, {
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
    // Avoid duplicates
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
    
    // Aggregate members: Owner (mock for now as first row) + Invited
    // In a real app, we'd fetch all from DB
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

    // Update pagination UI
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
        btnNext.style.opacity = btnNext.disabled ? 'not-allowed' : '1'; // Fix: corrected logic
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
                        <div class="dropdown-item" onclick="resendInvite('${email}')" style="font-size: 0.75rem; gap: 10px; padding: 10px; cursor: pointer; font-family: 'JetBrains Mono', monospace;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.7;"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                            resend invitation
                        </div>
                        <div class="dropdown-item text-red" onclick="cancelInvite('${email}', this)" style="font-size: 0.75rem; gap: 10px; padding: 10px; cursor: pointer; font-family: 'JetBrains Mono', monospace;">
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
                <div class="org-avatar" style="border-radius: 8px; width: 34px; height: 34px; font-weight: 800; font-size: 0.9rem;">${avatarInitial}</div>
                <div style="display: flex; flex-direction: column;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; font-weight: 600; color: #fff;">${email}</span>
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
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: #fff; opacity: 0.9;">${role}</span>
        </td>
        <td style="padding: 1.25rem 1.5rem; text-align: right;">
            ${actionButtons}
        </td>
    `;

    tableBody.appendChild(row);
    
    // Setup dropdown toggle for this row
    const moreBtn = row.querySelector('.btn-more-actions');
    const dropdown = row.querySelector('.row-actions-dropdown');
    if (moreBtn && dropdown) {
        moreBtn.onclick = (e) => {
            e.stopPropagation();
            // Close other open dropdowns first
            document.querySelectorAll('.row-actions-dropdown.active').forEach(d => {
                if (d !== dropdown) d.classList.remove('active');
            });
            dropdown.classList.toggle('active');
        };
    }

    // Update count
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
    mainPanel.style.display = 'none';
    notifPanel.classList.add('active');
}

function flipToMainPanel() {
    const dropdown = document.getElementById('user-dropdown');
    const mainPanel = document.getElementById('dropdown-main-panel');
    const notifPanel = document.getElementById('dropdown-notif-panel');
    const items = document.getElementById('notification-items');
    const itemsWrapper = document.getElementById('notification-items-wrapper');
    if (!dropdown || !mainPanel || !notifPanel) return;
    notifPanel.classList.remove('active');
    mainPanel.style.display = '';
    dropdown.style.height = '';
    if (items && itemsWrapper) itemsWrapper.appendChild(items);
}

document.addEventListener('DOMContentLoaded', () => {
    const notifRow = document.getElementById('notification-row');
    const backBtn = document.getElementById('notif-panel-back');
    if (notifRow) {
        notifRow.addEventListener('click', (e) => {
            if (window.innerWidth > 900) return;
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

// Global click handler to close dropdowns
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
        // Current org slug from URL
        const path = window.location.pathname;
        const orgMatch = path.match(/\/dashboard\/org\/([a-z0-9]{20})/);
        const orgSlug = orgMatch ? orgMatch[1] : null;

        if (!orgSlug) throw new Error("organization context missing");

        // Get auth token (from global context)
        const token = window.supabaseAuthToken; 

        const response = await fetch(`${API_URL}/v1/organizations/${orgSlug}/team/invite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                emailList: [email],
                role: 'developer' // Default for resend for now
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'failed to resend invitation');
        }

        // Set cooldown
        localStorage.setItem(cooldownKey, Date.now().toString());
        
        if (window.SentinelToast) window.SentinelToast.show(`invitation resent to ${email}`, "success");
    } catch (err) {
        if (window.SentinelToast) window.SentinelToast.show(err.message, "error");
    }
}

function cancelInvite(email, btnEl) {
    // Current org slug from URL
    const path = window.location.pathname;
    const orgMatch = path.match(/\/dashboard\/org\/([a-z0-9]{20})/);
    const orgSlug = orgMatch ? orgMatch[1] : null;

    if (orgSlug) {
        const key = `sentinel-invites-${orgSlug}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const updated = existing.filter(m => m.email !== email);
        localStorage.setItem(key, JSON.stringify(updated));
    }

    // Remove from UI
    const row = btnEl.closest('tr');
    if (row) {
        row.style.opacity = '0';
        row.style.transform = 'translateX(20px)';
        setTimeout(() => {
            row.remove();
            // Update count
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
            
            // Re-creating the professional org card structure
            const initial = org.name.charAt(0).toUpperCase();
            const planText = org.plan ? `${org.plan.charAt(0).toUpperCase() + org.plan.slice(1)} Plan` : 'Standard Plan';
            
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
            
            // Handle Navigation
            card.onclick = () => {
                const slug = org.slug;
                history.pushState({ slug }, '', `/dashboard/org/${slug}`);
                switchToOrgView(slug, 'projects');
            };

            orgCardsGrid.appendChild(card);
        });
    }
}

function switchToHomeView() {
    currentOrgSlug = null;
    document.body.classList.remove('state-in-org');
    document.body.classList.add('state-org-home');
    document.getElementById('org-home-view').classList.remove('hidden');
    document.getElementById('org-dashboard-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.add('hidden');

    const globalNav = document.getElementById('sidebar-global-nav');
    const orgNav = document.getElementById('sidebar-org-nav');
    if (globalNav) globalNav.classList.remove('hidden');
    if (orgNav) orgNav.classList.add('hidden');
}

function switchToOrgView(slug, view = 'projects') {
    currentOrgSlug = slug;
    document.body.classList.remove('state-org-home');
    document.body.classList.add('state-in-org');
    document.getElementById('org-home-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.add('hidden');
    
    // Toggle Sidebar Nav
    const globalNav = document.getElementById('sidebar-global-nav');
    const orgNav = document.getElementById('sidebar-org-nav');
    if (globalNav) globalNav.classList.add('hidden');
    if (orgNav) orgNav.classList.remove('hidden');

    // Hide all sub-views
    const subViews = ['org-dashboard-view', 'org-team-view'];
    subViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // Sidebar Active State Sync
    document.querySelectorAll('#sidebar-org-nav .sidebar-item').forEach(i => i.classList.remove('active'));

    if (view === 'team') {
        const teamView = document.getElementById('org-team-view');
        if (teamView) teamView.classList.remove('hidden');
        const teamItem = document.getElementById('sidebar-item-team');
        if (teamItem) teamItem.classList.add('active');
        loadTeamFromApi(slug);
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

        const planLabel = org.plan ? org.plan.charAt(0).toUpperCase() + org.plan.slice(1) : 'Starter';
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
        const res = await fetch('/v1/user/api-key/reveal', { headers: { 'Authorization': `Bearer ${token}` } });
        const result = await res.json();
        const suffixEl = document.getElementById('api-key-suffix');
        if (res.ok && result.apiKey && suffixEl) {
            suffixEl.textContent = result.apiKey.slice(-4);
        }
    } catch (err) {}
}

async function fetchProfile(token) {
    try {
        const response = await fetch('/v1/user/profile', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) return;
        const profile = await response.json();

        const teamEmailEl = document.getElementById('current-user-email');
        const displayId = profile.username || profile.email;
        if (teamEmailEl && displayId) {
            teamEmailEl.textContent = displayId;
            const teamAvatarEl = document.getElementById('team-owner-avatar');
            if (teamAvatarEl) teamAvatarEl.textContent = displayId.charAt(0).toUpperCase();
        }

        const orgsRes = await fetch('/v1/organizations', { headers: { 'Authorization': `Bearer ${token}` } });
        const orgs = await orgsRes.json();

        localStorage.setItem('sentinel-cached-orgs', JSON.stringify(orgs));
        updateOrgGrid(orgs);
        updateDropdownOrgList(orgs, currentOrgSlug);
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

    // --- Organization Navigation SPA Logic ---
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
    // Placeholders for other items
    ['integrations', 'usage', 'billing', 'settings'].forEach(sub => {
        bindOrgNav(`sidebar-item-${sub}`, sub, sub);
    });
}
