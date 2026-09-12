export function initOnlyTva() {
  const section = document.querySelector('#only-tva');
  const crops = [[0, 590, 620], [630, 810, 620], [1470, 659, 739]];
  section.querySelectorAll('.only-tva__copy article').forEach((article, index) => {
    const [left, width, height] = crops[index];
    const frame = document.createElement('div');
    frame.className = 'only-tva__mobile-art';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.aspectRatio = `${width} / ${height}`;
    const image = document.createElement('img');
    image.src = 'assets/only-tva/strengths-1600.webp';
    image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
    Object.assign(image.style, { width: `${2129 / width * 100}%`, left: `${-left / width * 100}%` });
    frame.append(image);
    if (index === 0) {
      const underline = section.querySelector('.only-tva__underline').cloneNode(true);
      Object.assign(underline.style, { width: `${2129 / width * 100}%`, height: `${739 / height * 100}%` });
      frame.append(underline);
    }
    article.append(frame);
  });
  const art = section.querySelector('.only-tva__art');
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    section.classList.add('is-drawn');
    observer.disconnect();
  }, { threshold: 0.35 });
  observer.observe(art);
  observer.observe(section.querySelector('.only-tva__mobile-art'));
}
