import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

// Matches links that point directly at an image so an author can paste an
// image URL and still get a rendered picture (e.g. AEM asset delivery links).
const IMAGE_HREF = /\.(avif|webp|png|jpe?g|gif|svg)(\?.*)?$/i;

function isImageLink(a) {
  return a && (IMAGE_HREF.test(a.getAttribute('href') || '') || a.href.includes('/adobe/assets/'));
}

// Convert a link-to-an-image into an actual <picture><img> so it displays.
function linkToPicture(a) {
  const picture = document.createElement('picture');
  const img = document.createElement('img');
  img.src = a.getAttribute('href');
  img.loading = 'lazy';
  img.alt = a.textContent.trim().startsWith('http') ? '' : a.textContent.trim();
  picture.append(img);
  return picture;
}

// An author may bundle the name and price inside a single bold run split by a
// <br> (e.g. "<strong>Name<br>Price</strong>"). Split it into separate <strong>
// runs so the name and price style consistently with the other cards.
function splitBundledStrong(body) {
  body.querySelectorAll('strong').forEach((strong) => {
    if (!strong.querySelector('br')) return;
    const parts = strong.innerHTML.split(/<br\s*\/?>/i)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length < 2) return;
    const frag = document.createDocumentFragment();
    parts.forEach((part, i) => {
      const s = document.createElement('strong');
      s.innerHTML = part;
      frag.append(s);
      if (i < parts.length - 1) frag.append(document.createElement('br'));
    });
    strong.replaceWith(frag);
  });
}

export default function decorate(block) {
  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      // Author pasted an image URL as a link: turn it into a real picture.
      const link = div.children.length === 1 && div.querySelector('p > a, a');
      if (link && isImageLink(link)) {
        (link.closest('p') || link).replaceWith(linkToPicture(link));
      }
      if (div.children.length === 1 && div.querySelector('picture')) {
        div.className = 'cards-card-image';
      } else {
        div.className = 'cards-card-body';
        splitBundledStrong(div);
      }
    });
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => {
    // Skip already-absolute/external URLs (e.g. AEM asset delivery links):
    // createOptimizedPicture keeps only the pathname and would break them.
    const raw = img.getAttribute('src') || '';
    if (/^https?:\/\//i.test(raw)) return;
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });
  block.textContent = '';
  block.append(ul);
}
