window.SentinelToast = {
    container: null,
    queue: [],
    active: null,

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'sentinel-toast-container';
            document.body.appendChild(this.container);
        }
    },

    show(message, type = 'info') {
        this.init();
        this.queue.push({ message, type });
        if (!this.active) this._next();
    },

    _dismiss(toast, then) {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
            then();
        }, 350);
    },

    _next() {
        if (!this.queue.length) { this.active = null; return; }

        const { message, type } = this.queue.shift();

        if (this.active) {
            this._dismiss(this.active, () => this._render(message, type));
            return;
        }
        this._render(message, type);
    },

    _render(message, type) {
        let iconSvg = '';
        if (type === 'success') {
            iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        } else if (type === 'error' || type === 'warning') {
            iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12" y2="16"></line></svg>';
        } else {
            iconSvg = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="8"></line></svg>';
        }

        const toast = document.createElement('div');
        toast.className = `sentinel-toast ${type}`;
        toast.innerHTML = iconSvg;
        const msgSpan = document.createElement('span');
        msgSpan.className = 'toast-message';
        msgSpan.textContent = message;
        toast.appendChild(msgSpan);

        this.container.appendChild(toast);
        void toast.offsetWidth;
        toast.classList.add('show');
        this.active = toast;

        setTimeout(() => {
            if (this.active !== toast) return;
            this._dismiss(toast, () => {
                this.active = null;
                this._next();
            });
        }, 4000);
    }
};
