import { moveInstrumentation } from '../../scripts/scripts.js';

const VIDEO_HREF = /\.(mp4|webm|ogv|mov)(\?.*)?$/i;
const HLS_JS = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.light.min.js';

function findVideoUrl(block) {
  // A link whose href/text points at a video file or an AEM asset, or a bare URL.
  const link = [...block.querySelectorAll('a')].find((a) => VIDEO_HREF.test(a.getAttribute('href') || '')
    || (a.href || '').includes('/adobe/assets/'));
  if (link) return link.getAttribute('href');
  const text = block.textContent.trim();
  if (VIDEO_HREF.test(text) || text.includes('/adobe/assets/')) return text;
  return null;
}

// AEM dynamic-media delivers video as an adaptive HLS stream. The authored
// asset URL (often ending in /play) needs to resolve to the .m3u8 manifest.
function toStreamUrl(url) {
  if (!url.includes('/adobe/assets/')) return { src: url, hls: false };
  const base = url.replace(/\/play(\/.*)?$/, '').replace(/\/+$/, '');
  return { src: `${base}/manifest.m3u8`, hls: true };
}

function findPoster(block) {
  const img = block.querySelector('img');
  return img ? img.getAttribute('src') : null;
}

function autoplay(video) {
  const p = video.play();
  if (p && typeof p.catch === 'function') p.catch(() => {});
}

// Load hls.js once for browsers without native HLS support.
let hlsPromise;
function loadHls() {
  if (!hlsPromise) {
    hlsPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = HLS_JS;
      s.onload = resolve;
      s.onerror = reject;
      document.head.append(s);
    });
  }
  return hlsPromise;
}

export default function decorate(block) {
  const rawUrl = findVideoUrl(block);
  const poster = findPoster(block);

  const video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.controls = false;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  if (poster) video.poster = poster;

  moveInstrumentation(block, video);
  block.textContent = '';
  block.append(video);

  if (!rawUrl) return;

  const { src, hls } = toStreamUrl(rawUrl);

  if (!hls) {
    // Plain progressive file (mp4/webm/etc.).
    video.src = src;
    autoplay(video);
    return;
  }

  // HLS: use native support where available (Safari/iOS), else hls.js.
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = src;
    autoplay(video);
  } else {
    loadHls().then(() => {
      // eslint-disable-next-line no-undef
      if (window.Hls && window.Hls.isSupported()) {
        // eslint-disable-next-line no-undef
        const player = new window.Hls();
        player.loadSource(src);
        player.attachMedia(video);
        player.on(window.Hls.Events.MANIFEST_PARSED, () => autoplay(video));
      } else {
        video.src = src;
        autoplay(video);
      }
    }).catch(() => {
      video.src = src;
      autoplay(video);
    });
  }
}
