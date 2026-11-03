// Accessible responsive sidebar: desktop hover-to-peek, click-to-pin,
// and a mobile open/close button. View navigation is handled by workspace.js.
(() => {
    if (document.documentElement.classList.contains('cc-embedded')) return;
    const nav = document.getElementById('cc-primary-navigation');
    const toggle = document.querySelector('.cc-sidebar-toggle');
    const mobileToggle = document.querySelector('.cc-mobile-menu-toggle');
    const scrim = document.querySelector('.cc-sidebar-scrim');
    if (!nav || !toggle || !mobileToggle || !scrim) return;

    const mobile = window.matchMedia('(max-width: 780px)');
    let pinned = false;
    let mobileOpen = false;
    try { pinned = sessionStorage.getItem('cc-sidebar-pinned') === 'true'; } catch {}

    function sync() {
        const isMobile = mobile.matches;
        document.body.classList.toggle('cc-sidebar-pinned', pinned && !isMobile);
        document.body.classList.toggle('cc-sidebar-mobile-open', mobileOpen && isMobile);
        scrim.hidden = !isMobile || !mobileOpen;
        const visible = isMobile ? mobileOpen :
            pinned || nav.matches(':hover') || nav.contains(document.activeElement);
        toggle.setAttribute('aria-expanded', String(visible));
        toggle.setAttribute('aria-pressed', String(!isMobile && pinned));
        toggle.setAttribute('aria-label', isMobile ? 'Close sidebar navigation' :
            pinned ? 'Unpin sidebar' : 'Pin sidebar open');
        mobileToggle.setAttribute('aria-expanded', String(isMobile && mobileOpen));
        mobileToggle.setAttribute('aria-label', mobileOpen ? 'Close sidebar navigation' : 'Open sidebar navigation');
    }

    toggle.addEventListener('click', () => {
        if (mobile.matches) {
            mobileOpen = false;
            mobileToggle.focus();
        } else {
            pinned = !pinned;
            try { sessionStorage.setItem('cc-sidebar-pinned', String(pinned)); } catch {}
        }
        sync();
    });
    mobileToggle.addEventListener('click', () => {
        mobileOpen = !mobileOpen;
        sync();
        if (mobileOpen) toggle.focus();
    });
    scrim.addEventListener('click', () => {
        mobileOpen = false;
        sync();
        mobileToggle.focus();
    });
    nav.addEventListener('click', (event) => {
        if (mobile.matches && event.target.closest('a')) {
            mobileOpen = false;
            sync();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && mobile.matches && mobileOpen) {
            mobileOpen = false;
            sync();
            mobileToggle.focus();
        }
    });
    nav.addEventListener('mouseenter', sync);
    nav.addEventListener('mouseleave', sync);
    nav.addEventListener('focusin', sync);
    nav.addEventListener('focusout', () => queueMicrotask(sync));
    mobile.addEventListener('change', () => {
        mobileOpen = false;
        sync();
    });
    sync();
})();
