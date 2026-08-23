/* 
 * CineNova Smart TV Spatial Navigation
 * Maps Downloader App / FireStick D-Pad to HTML Focus and Action.
 */

let currentlyFocused = null;

function getFocusableElements() {
    // Collect elements that should be navigable via remote
    const selectors = [
        '.nav-btn',
        '.movie-card',
        '.ps-btn',
        '.player-close-btn',
        '.player-server-toggle',
        '.close-history-btn',
        '.clear-history-btn',
        '.modal-close',
        '.modal-watch-btn',
        '.search-btn-trigger',
        '.tv-key', // Virtual keyboard keys
        '.reel-btn'
    ].join(',');
    const elements = Array.from(document.querySelectorAll(selectors));
    // Filter visible elements only
    return elements.filter(el => {
        if (!el.offsetParent) return false; // display:none check

        // Performance: skip elements way off screen vertically
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -1000 || rect.top > window.innerHeight + 1000) return false;

        return true;
    });
}

function getCenter(el) {
    const rect = el.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right
    };
}

function moveFocus(direction) {
    const elements = getFocusableElements();
    if (elements.length === 0) return;

    if (!currentlyFocused || !elements.includes(currentlyFocused)) {
        // Fallback: pick the top-left-most element (or the first search button) to start
        const fallback = document.querySelector('.nav-btn.active') || elements[0];
        setFocus(fallback);
        return;
    }

    const currentCenter = getCenter(currentlyFocused);
    let bestMatch = null;
    let minDistance = Infinity;

    elements.forEach(el => {
        if (el === currentlyFocused) return;
        const center = getCenter(el);

        let isValid = false;
        let distance = 0;

        // Weights: heavily penalize moving in the non-intended axis to prevent jumping wildly
        let dx = center.x - currentCenter.x;
        let dy = center.y - currentCenter.y;

        switch (direction) {
            case 'UP':
                if (center.top < currentCenter.top) { // strictly above
                    isValid = true;
                    // penalize horizontal distance heavily
                    distance = Math.abs(dy) + Math.abs(dx) * 2;
                }
                break;
            case 'DOWN':
                if (center.bottom > currentCenter.bottom) { // strictly below
                    isValid = true;
                    distance = Math.abs(dy) + Math.abs(dx) * 2;
                }
                break;
            case 'LEFT':
                if (center.left < currentCenter.left) { // strictly left
                    isValid = true;
                    // penalize vertical distance heavily
                    distance = Math.abs(dx) + Math.abs(dy) * 4;
                }
                break;
            case 'RIGHT':
                if (center.right > currentCenter.right) { // strictly right
                    isValid = true;
                    distance = Math.abs(dx) + Math.abs(dy) * 4;
                }
                break;
        }

        if (isValid && distance < minDistance) {
            minDistance = distance;
            bestMatch = el;
        }
    });

    if (bestMatch) {
        setFocus(bestMatch);
    } else {
        // If we hit an edge in sliders, try scrolling the slider
        if (direction === 'LEFT' || direction === 'RIGHT') {
            const row = currentlyFocused.closest('.slider');
            if (row) {
                const dirVal = direction === 'RIGHT' ? 1 : -1;
                window.slideRow(row.id, dirVal); // Reuse existing sliding func
                // Re-calculate after short delay
                setTimeout(() => moveFocus(direction), 300);
            }
        }
    }
}

function setFocus(el) {
    if (currentlyFocused) {
        currentlyFocused.classList.remove('tv-focus');
    }
    currentlyFocused = el;
    currentlyFocused.classList.add('tv-focus');

    // Smooth scroll into view if needed
    const rect = currentlyFocused.getBoundingClientRect();
    const padding = 100;

    if (rect.top < padding) {
        window.scrollBy({ top: rect.top - padding, behavior: 'smooth' });
    } else if (rect.bottom > window.innerHeight - padding) {
        window.scrollBy({ top: rect.bottom - (window.innerHeight - padding), behavior: 'smooth' });
    }
}

// Intercept Key Events
document.addEventListener('keydown', (e) => {
    // Don't intercept if user is typing in a real physical keyboard input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    let handled = true;

    switch (e.key) {
        case 'ArrowUp': moveFocus('UP'); break;
        case 'ArrowDown': moveFocus('DOWN'); break;
        case 'ArrowLeft': moveFocus('LEFT'); break;
        case 'ArrowRight': moveFocus('RIGHT'); break;
        case 'Enter':
            if (currentlyFocused) currentlyFocused.click();
            break;
        case 'Escape':
        case 'Backspace':
            // "Back" button on Firestick / Downloader
            if (document.getElementById('player-wrap')?.style.display === 'flex') {
                document.getElementById('close-player')?.click();
            } else if (document.getElementById('detail-modal')?.classList.contains('active')) {
                document.getElementById('close-modal')?.click();
            } else if (document.getElementById('tv-keyboard')?.classList.contains('active')) {
                document.getElementById('close-keyboard')?.click();
            } else {
                handled = false; // Let browser go back natively
            }
            break;
        default:
            handled = false;
    }

    if (handled) {
        e.preventDefault();
        e.stopPropagation();
    }
});

// Setup initial focus after short delay to allow DOM render
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const firstBtn = document.querySelector('.nav-btn.active');
        if (firstBtn) setFocus(firstBtn);
    }, 1000);
});
