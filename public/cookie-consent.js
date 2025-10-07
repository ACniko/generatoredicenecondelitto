(function () {
  const CONSENT_KEY = 'cookieConsent';
  const PREF_BUTTON_ID = 'cookie-consent-manage';
  const existingManageButton = document.getElementById(PREF_BUTTON_ID);
  if (existingManageButton) {
    existingManageButton.remove();
  }

  const currentScript = document.currentScript;
  const clientId = currentScript && currentScript.dataset && currentScript.dataset.adsenseClient ? currentScript.dataset.adsenseClient : null;
  const adsenseSrc = clientId ? `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}` : null;

  const loadAdSense = () => {
    if (!adsenseSrc) {
      console.warn('AdSense client ID non configurato. Gli annunci non verranno caricati.');
      return;
    }
    if (document.querySelector('script[data-adsense-loaded="true"]')) {
      return;
    }
    const adsenseScript = document.createElement('script');
    adsenseScript.async = true;
    adsenseScript.crossOrigin = 'anonymous';
    adsenseScript.src = adsenseSrc;
    adsenseScript.dataset.adsenseLoaded = 'true';
    document.head.appendChild(adsenseScript);
    window.adsbygoogle = window.adsbygoogle || [];
  };

  const unloadAdSense = () => {
    document.querySelectorAll('script[data-adsense-loaded="true"]').forEach((script) => script.remove());
    if (window.adsbygoogle) {
      delete window.adsbygoogle;
    }
  };

  const persistConsent = (value) => {
    localStorage.setItem(CONSENT_KEY, value);
    if (value === 'granted') {
      loadAdSense();
    } else {
      unloadAdSense();
    }
  };

  const getConsent = () => localStorage.getItem(CONSENT_KEY);

  const focusTrap = (container) => {
    const focusable = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    container.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') {
        return;
      }
      if (event.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          event.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          event.preventDefault();
        }
      }
    });
  };

  const closeBanner = (banner) => {
    if (banner && banner.parentElement) {
      banner.parentElement.removeChild(banner);
    }
  };

  const createBanner = () => {
    if (document.getElementById('cookie-banner')) {
      return null;
    }

    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Informativa sui cookie');
    banner.style.position = 'fixed';
    banner.style.bottom = '1rem';
    banner.style.left = '50%';
    banner.style.transform = 'translateX(-50%)';
    banner.style.maxWidth = '600px';
    banner.style.width = 'calc(100% - 2rem)';
    banner.style.padding = '1.5rem';
    banner.style.backgroundColor = '#111827';
    banner.style.color = '#f9fafb';
    banner.style.borderRadius = '1rem';
    banner.style.boxShadow = '0 20px 45px rgba(15, 23, 42, 0.35)';
    banner.style.zIndex = '10000';

    const text = document.createElement('p');
    text.style.margin = '0 0 1rem 0';
    text.style.lineHeight = '1.5';
    text.innerHTML = 'Utilizziamo cookie propri e di terze parti (Google AdSense) per analisi e annunci contestuali. Puoi accettare tutti i cookie o rifiutare quelli non necessari. Maggiori informazioni nella <a href="/privacy-policy.html" style="color: #60a5fa; text-decoration: underline">Privacy Policy</a> e nei <a href="/termini-e-condizioni.html" style="color: #60a5fa; text-decoration: underline">Termini di Servizio</a>.';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.flexWrap = 'wrap';
    actions.style.gap = '0.75rem';

    const acceptButton = document.createElement('button');
    acceptButton.type = 'button';
    acceptButton.textContent = 'Accetta tutti';
    acceptButton.style.backgroundColor = '#22c55e';
    acceptButton.style.color = '#0f172a';
    acceptButton.style.border = 'none';
    acceptButton.style.padding = '0.75rem 1.5rem';
    acceptButton.style.borderRadius = '9999px';
    acceptButton.style.fontWeight = '600';
    acceptButton.style.cursor = 'pointer';

    const rejectButton = document.createElement('button');
    rejectButton.type = 'button';
    rejectButton.textContent = 'Rifiuta non necessari';
    rejectButton.style.backgroundColor = '#1f2937';
    rejectButton.style.color = '#f9fafb';
    rejectButton.style.border = '1px solid #374151';
    rejectButton.style.padding = '0.75rem 1.5rem';
    rejectButton.style.borderRadius = '9999px';
    rejectButton.style.fontWeight = '600';
    rejectButton.style.cursor = 'pointer';

    const preferencesButton = document.createElement('button');
    preferencesButton.type = 'button';
    preferencesButton.textContent = 'Gestione preferenze';
    preferencesButton.style.background = 'transparent';
    preferencesButton.style.color = '#93c5fd';
    preferencesButton.style.border = 'none';
    preferencesButton.style.padding = '0.75rem 0';
    preferencesButton.style.fontWeight = '600';
    preferencesButton.style.textDecoration = 'underline';
    preferencesButton.style.cursor = 'pointer';

    acceptButton.addEventListener('click', () => {
      persistConsent('granted');
      closeBanner(banner);
      ensureManageButton();
    });

    rejectButton.addEventListener('click', () => {
      persistConsent('denied');
      closeBanner(banner);
      ensureManageButton();
    });

    preferencesButton.addEventListener('click', () => {
      persistConsent('pending');
      closeBanner(banner);
      ensureManageButton(true);
    });

    actions.appendChild(acceptButton);
    actions.appendChild(rejectButton);
    actions.appendChild(preferencesButton);

    banner.appendChild(text);
    banner.appendChild(actions);
    document.body.appendChild(banner);

    focusTrap(banner);
    acceptButton.focus();
    return banner;
  };

  const ensureManageButton = (forceOpen) => {
    let manageButton = document.getElementById(PREF_BUTTON_ID);
    if (!manageButton) {
      manageButton = document.createElement('button');
      manageButton.id = PREF_BUTTON_ID;
      manageButton.type = 'button';
      manageButton.textContent = 'Preferenze cookie';
      manageButton.style.position = 'fixed';
      manageButton.style.bottom = '1.25rem';
      manageButton.style.right = '1.25rem';
      manageButton.style.padding = '0.65rem 1.1rem';
      manageButton.style.fontSize = '0.9rem';
      manageButton.style.borderRadius = '9999px';
      manageButton.style.border = '1px solid #60a5fa';
      manageButton.style.backgroundColor = '#0f172a';
      manageButton.style.color = '#bfdbfe';
      manageButton.style.cursor = 'pointer';
      manageButton.style.zIndex = '9999';
      manageButton.setAttribute('aria-haspopup', 'dialog');
      manageButton.setAttribute('aria-label', 'Riapri banner dei cookie');
      document.body.appendChild(manageButton);
      manageButton.addEventListener('click', () => {
        createBanner();
      });
    }

    if (forceOpen) {
      manageButton.click();
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const storedConsent = getConsent();

    if (storedConsent === 'granted') {
      loadAdSense();
      ensureManageButton();
      return;
    }

    if (storedConsent === 'denied') {
      unloadAdSense();
      ensureManageButton();
      return;
    }

    const banner = createBanner();
    if (!banner) {
      ensureManageButton();
    }
  });
})();