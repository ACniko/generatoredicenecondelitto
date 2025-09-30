document.addEventListener('DOMContentLoaded', function() {
    // Verifica se l'utente ha già accettato i cookie
    if (!localStorage.getItem('cookieConsent')) {
        // Crea il banner del consenso ai cookie
        const cookieBanner = document.createElement('div');
        cookieBanner.id = 'cookie-banner';
        cookieBanner.style.position = 'fixed';
        cookieBanner.style.bottom = '0';
        cookieBanner.style.left = '0';
        cookieBanner.style.right = '0';
        cookieBanner.style.padding = '1rem';
        cookieBanner.style.backgroundColor = '#f3f4f6';
        cookieBanner.style.borderTop = '1px solid #e5e7eb';
        cookieBanner.style.zIndex = '9999';
        cookieBanner.style.display = 'flex';
        cookieBanner.style.justifyContent = 'space-between';
        cookieBanner.style.alignItems = 'center';
        cookieBanner.style.flexWrap = 'wrap';

        // Testo del banner
        const cookieText = document.createElement('p');
        cookieText.style.margin = '0.5rem 0';
        cookieText.style.flex = '1 1 300px';
        cookieText.innerHTML = 'Questo sito utilizza cookie per migliorare la tua esperienza. Continuando a navigare, accetti la nostra <a href="/privacy-policy.html" style="color: #3b82f6; text-decoration: underline;">Privacy Policy</a> e l\'uso dei cookie.';

        // Pulsanti
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '0.5rem';
        buttonContainer.style.flex = '0 0 auto';

        // Pulsante Accetta
        const acceptButton = document.createElement('button');
        acceptButton.textContent = 'Accetta';
        acceptButton.style.backgroundColor = '#3b82f6';
        acceptButton.style.color = 'white';
        acceptButton.style.border = 'none';
        acceptButton.style.padding = '0.5rem 1rem';
        acceptButton.style.borderRadius = '0.25rem';
        acceptButton.style.cursor = 'pointer';
        acceptButton.addEventListener('click', function() {
            localStorage.setItem('cookieConsent', 'true');
            document.body.removeChild(cookieBanner);
        });

        // Pulsante Rifiuta
        const rejectButton = document.createElement('button');
        rejectButton.textContent = 'Rifiuta';
        rejectButton.style.backgroundColor = '#e5e7eb';
        rejectButton.style.color = '#374151';
        rejectButton.style.border = 'none';
        rejectButton.style.padding = '0.5rem 1rem';
        rejectButton.style.borderRadius = '0.25rem';
        rejectButton.style.cursor = 'pointer';
        rejectButton.addEventListener('click', function() {
            localStorage.setItem('cookieConsent', 'false');
            document.body.removeChild(cookieBanner);
        });

        // Aggiungi elementi al DOM
        buttonContainer.appendChild(acceptButton);
        buttonContainer.appendChild(rejectButton);
        cookieBanner.appendChild(cookieText);
        cookieBanner.appendChild(buttonContainer);
        document.body.appendChild(cookieBanner);
    }
});