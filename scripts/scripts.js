import {
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';

/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to?.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Turns a text label into a URL-friendly anchor id.
 * @param {string} text the label text
 * @returns {string} a slug, e.g. "Signature Drinks" -> "signature-drinks"
 */
export function toAnchorId(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Gives bold category-label paragraphs (e.g. "Signature Drinks") an anchor id
 * so they can be linked to from the nav.
 * @param {Element} main The container element
 */
function decorateLabelAnchors(main) {
  main.querySelectorAll('p > strong, p > em > strong').forEach((strong) => {
    const p = strong.closest('p');
    if (p && !p.id && p.textContent.trim() === strong.textContent.trim()) {
      p.id = toAnchorId(strong.textContent);
    }
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateLabelAnchors(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Fades + rises elements in as they scroll into view, and fades them back out
 * once they leave, so only what the user is currently looking at is shown.
 * Honors prefers-reduced-motion by skipping the effect entirely.
 * @param {Element} main The main element
 */
function initScrollReveal(main) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Sections reveal as a whole; individual cards reveal (and stagger) within.
  const targets = [...main.querySelectorAll(':scope > .section')];
  main.querySelectorAll('.cards > ul > li').forEach((li) => targets.push(li));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const el = entry.target;
      if (entry.isIntersecting) {
        // Stagger sibling cards for a cascading effect on the way in.
        const siblings = el.parentElement && el.matches('.cards > ul > li')
          ? [...el.parentElement.children] : [];
        const index = siblings.indexOf(el);
        el.style.transitionDelay = index > 0 ? `${Math.min(index * 80, 400)}ms` : '';
        el.classList.add('revealed');
        // Clear the stagger delay once revealed so hover reacts instantly.
        if (el.style.transitionDelay) {
          el.addEventListener('transitionend', () => { el.style.transitionDelay = ''; }, { once: true });
        }
      } else {
        // Fade back out when scrolled past, no delay on the way out.
        el.style.transitionDelay = '';
        el.classList.remove('revealed');
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });

  targets.forEach((el) => {
    el.classList.add('reveal');
    observer.observe(el);
  });
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadSections(main);

  initScrollReveal(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

// How long the landing splash stays visible once the page is ready (ms).
const PRELOADER_MIN_MS = 1500;

/**
 * Injects the landing splash (brand + spinner) shown before the page loads.
 * @returns {Element} the preloader element
 */
function showPreloader() {
  const preloader = document.createElement('div');
  preloader.id = 'preloader';
  preloader.innerHTML = `
    <div class="preloader-brand">Urban Roast</div>
    <div class="preloader-spinner" role="status" aria-label="Loading"></div>`;
  // Attach to the root element so it shows before body.appear is set.
  document.documentElement.append(preloader);
  return preloader;
}

/**
 * Fades out and removes the preloader.
 * @param {Element} preloader the preloader element
 */
function hidePreloader(preloader) {
  if (!preloader) return;
  preloader.classList.add('preloader-hide');
  preloader.addEventListener('transitionend', () => preloader.remove(), { once: true });
}

async function loadPage() {
  const preloader = showPreloader();
  const startedAt = performance.now();

  await loadEager(document);
  await loadLazy(document);

  // Keep the splash up for at least PRELOADER_MIN_MS, then fade it out.
  const elapsed = performance.now() - startedAt;
  window.setTimeout(() => hidePreloader(preloader), Math.max(0, PRELOADER_MIN_MS - elapsed));

  loadDelayed();
}

loadPage();
