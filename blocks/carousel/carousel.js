import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const AUTO_ROTATE_MS = 4000;

// Matches links that point directly at an image so an author can paste an
// image URL and still get a rendered picture (e.g. AEM asset delivery links).
const IMAGE_HREF = /\.(avif|webp|png|jpe?g|gif|svg)(\?.*)?$/i;

function isImageLink(a) {
  return a && (IMAGE_HREF.test(a.getAttribute('href') || '') || a.href.includes('/adobe/assets/'));
}

// AEM asset delivery URLs serve the full-resolution original by default,
// which can be many MB. Request an optimized rendition via delivery params.
function optimizeAemUrl(url) {
  if (!url.includes('/adobe/assets/') || /[?&]width=/.test(url)) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=1200&format=webply&optimize=medium`;
}

// Convert a link-to-an-image into an actual <picture><img> so it displays.
function linkToPicture(a) {
  const picture = document.createElement('picture');
  const img = document.createElement('img');
  img.src = optimizeAemUrl(a.getAttribute('href'));
  img.loading = 'lazy';
  img.alt = a.textContent.trim().startsWith('http') ? '' : a.textContent.trim();
  picture.append(img);
  return picture;
}

export default function decorate(block) {
  const slides = [...block.children];
  const track = document.createElement('div');
  track.className = 'carousel-track';

  slides.forEach((row, i) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    moveInstrumentation(row, slide);
    while (row.firstElementChild) slide.append(row.firstElementChild);
    // Convert a pasted image-URL link into a real picture.
    const link = slide.querySelector('a');
    if (link && isImageLink(link)) {
      (link.closest('p') || link).replaceWith(linkToPicture(link));
    }
    if (i === 0) slide.classList.add('active');
    track.append(slide);
  });

  const items = [...track.children];

  // Optimize local images (skip absolute/external delivery URLs).
  track.querySelectorAll('picture > img').forEach((img) => {
    const raw = img.getAttribute('src') || '';
    if (/^https?:\/\//i.test(raw)) return;
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });

  // Dot indicators.
  const dots = document.createElement('div');
  dots.className = 'carousel-dots';
  items.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot';
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    if (i === 0) dot.classList.add('active');
    dots.append(dot);
  });

  block.textContent = '';
  block.append(track, dots);

  let current = 0;
  const goTo = (index) => {
    items[current].classList.remove('active');
    dots.children[current].classList.remove('active');
    current = (index + items.length) % items.length;
    items[current].classList.add('active');
    dots.children[current].classList.add('active');
  };

  // Manual navigation via dots.
  [...dots.children].forEach((dot, i) => {
    dot.addEventListener('click', () => goTo(i));
  });

  if (items.length <= 1) return;

  // Auto-rotate, pausing on hover.
  let timer;
  const stop = () => window.clearInterval(timer);
  const start = () => {
    stop();
    timer = window.setInterval(() => goTo(current + 1), AUTO_ROTATE_MS);
  };
  start();
  block.addEventListener('mouseenter', stop);
  block.addEventListener('mouseleave', start);
  // Restart the timer after a manual dot click so it doesn't jump immediately.
  [...dots.children].forEach((dot) => dot.addEventListener('click', start));
}
