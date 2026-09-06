import { moveInstrumentation } from '../../scripts/scripts.js';

const VIDEO_HREF = /\.(mp4|webm|ogv|mov)(\?.*)?$/i;

function findVideoUrl(block) {
  // A link whose href/text points at a video file, or a bare URL in text.
  const link = [...block.querySelectorAll('a')].find((a) => VIDEO_HREF.test(a.getAttribute('href') || '')
    || (a.href || '').includes('/adobe/assets/'));
  if (link) return link.getAttribute('href');
  const text = block.textContent.trim();
  if (VIDEO_HREF.test(text) || text.includes('/adobe/assets/')) return text;
  return null;
}

function findPoster(block) {
  const img = block.querySelector('img');
  return img ? img.getAttribute('src') : null;
}

export default function decorate(block) {
  const src = findVideoUrl(block);
  const poster = findPoster(block);

  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  if (poster) video.poster = poster;

  if (src) {
    const source = document.createElement('source');
    source.src = src;
    video.append(source);
  }

  moveInstrumentation(block, video);
  block.textContent = '';
  block.append(video);

  // Some browsers need an explicit play() for muted autoplay.
  const tryPlay = video.play();
  if (tryPlay && typeof tryPlay.catch === 'function') tryPlay.catch(() => {});
}
