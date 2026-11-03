// Single-workspace navigation: no page loads when switching panels.
// The Builder stays mounted in an iframe, preserving the live form state.
(() => {
    const builder = document.getElementById('builder-view');
    const converter = document.getElementById('converter-view');
    const links = document.querySelectorAll('[data-view-link]');
    const update = () => {
        const isBuilder = location.hash.toLowerCase() === '#builder';
        builder.hidden = !isBuilder;
        converter.hidden = isBuilder;
        document.body.classList.toggle('cc-view-builder', isBuilder);
        links.forEach(link => {
            const selected = link.dataset.viewLink === (isBuilder ? 'builder' : 'pdf');
            link.classList.toggle('is-active', selected);
            if (selected) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
        document.title = (isBuilder ? 'Citizen Charter Builder' : 'PDF Converter') + ' | Citizen Charter';
    };
    window.addEventListener('hashchange', update);
    update();
})();
