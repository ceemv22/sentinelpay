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
                menuTrigger.classList.toggle('active');
                dropdownMenu.classList.toggle('active');
            };
        }

        // 2.5 ROUTING LOGIC
        const path = window.location.pathname;
        const orgMatch = path.match(/\/dashboard\/org\/([a-z0-9]{20})(\/[a-z0-9-]+)?/);
        
        if (orgMatch) {
            const slug = orgMatch[1];
            const subView = orgMatch[2] ? orgMatch[2].substring(1) : 'projects';
            switchToOrgView(slug, subView);
        } else {
            switchToHomeView();
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

        // 5. MODAL & SIDEBAR INITIALIZATION
        setupCreateOrgModal(token);
        setupInviteMemberModal(token);
        setupSidebar();
    } catch (e) {
        console.error('[sentinel-render] Critical failure:', e);
        showStatus('Render Error', 'error');
    } finally {
        renderDashboard.busy = false;
    }
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
    
    // Close on overlay click
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    // Custom Select Logic
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

        const emailList = rawEmails.split(/[\s,]+/).filter(email => {
            return email.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
                        <span style="font-family: 'Inter', sans-serif; font-size: 0.85rem; font-weight: 600; color: #fff;">${email}</span>
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

// Global click handler to close dropdowns
document.addEventListener('click', () => {
    document.querySelectorAll('.row-actions-dropdown.active').forEach(d => {
        d.classList.remove('active');
    });
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
                <div class="org-card-avatar">
                    <svg viewBox="0 0 120 120" width="20" height="20" style="opacity: 0.9;">
                        <path d="M60 15 L25 30 V55 C25 80 50 100 60 105 C70 100 95 80 95 55 V30 Z" fill="white" />
                    </svg>
                </div>
                <div class="org-card-info">
                    <span class="org-card-name"></span>
                    <span class="org-card-meta">${planText}</span>
                </div>
                <svg style="margin-left: auto; opacity: 0.3;" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            `;
            // Safe assignment
            card.querySelector('.org-card-name').textContent = org.name;
            
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
    document.body.classList.add('state-org-home');
    document.getElementById('org-home-view').classList.remove('hidden');
    document.getElementById('org-dashboard-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.add('hidden');
    
    // Toggle Sidebar Nav
    const globalNav = document.getElementById('sidebar-global-nav');
    const orgNav = document.getElementById('sidebar-org-nav');
    if (globalNav) globalNav.classList.remove('hidden');
    if (orgNav) orgNav.classList.add('hidden');
}

function switchToOrgView(slug, view = 'projects') {
    document.body.classList.add('state-org-home');
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
        
        // Load persistent invites
        loadInvitedMembers(slug);
    } else {
        // Default to projects/dashboard
        const dashView = document.getElementById('org-dashboard-view');
        if (dashView) dashView.classList.remove('hidden');
        const projItem = document.getElementById('sidebar-item-projects');
        if (projItem) projItem.classList.add('active');
    }
    
    // In the future, we fetch org data by slug here
    console.log(`[sentinel-router] navigated to organization: ${slug} (view: ${view})`);
}

window.onpopstate = (e) => {
    const path = window.location.pathname;
    const orgMatch = path.match(/\/dashboard\/org\/([a-z0-9]{20})(\/[a-z0-9-]+)?/);
    if (orgMatch) {
        const slug = orgMatch[1];
        const subView = orgMatch[2] ? orgMatch[2].substring(1) : 'projects';
        switchToOrgView(slug, subView);
    } else {
        switchToHomeView();
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
        // 1. Update Team View (Dynamic Email/Username)
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
    } catch (err) {}
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
