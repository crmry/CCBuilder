// Both Builder and PDF Converter are first-class same-tab pages with identical navigation.
// Avoid an iframe: LibreOffice's cross-origin isolation prevented the Builder frame from loading.
(() => {
    const links=document.querySelectorAll('[data-view-link]');
    const sync=()=>{
        if(location.hash.toLowerCase()==='#builder'){
            location.replace(new URL('../main.html',location.href));
            return;
        }
        links.forEach(link=>{
            const isPDF=link.dataset.viewLink==='pdf';
            link.classList.toggle('is-active',isPDF);
            if(isPDF) link.setAttribute('aria-current','page');
            else link.removeAttribute('aria-current');
        });
        document.title='PDF Converter | Citizen Charter';
    };
    window.addEventListener('hashchange',sync);
    sync();
})();
