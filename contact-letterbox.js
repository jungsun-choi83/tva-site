// CONTACT — archive hall + letter sheet. Goya looks for a letter; SEND opens mail to jadechoi@eternalbeamapp.com
const A = 'assets/contact/';
const GOYA = 'assets/goya/goya-letter-search.png?v=eternal-beam-r63';
const MAIL = 'jadechoi@eternalbeamapp.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIM = { name: 60, email: 120, phone: 30, message: 2000 };
const NEAR = 0.8;

function markup() {
  return `<div class="ctl">
<div class="stage" id="ctl-stage">
  <div class="hall" id="ctl-s1">
    <picture>
      <source type="image/webp" srcset="${A}archive-drawers.webp?v=eternal-beam-r67">
      <img src="${A}archive-drawers.jpg?v=eternal-beam-r67" alt="Eternal Beam archive drawers">
    </picture>
    <img class="ctl-s1char" id="ctl-s1char" src="${GOYA}" alt="">
  </div>
  <svg class="beam" id="ctl-beam" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="ctl-beam-grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#f6e2a8" stop-opacity=".15"/>
        <stop offset=".45" stop-color="#f4d48a" stop-opacity=".95"/>
        <stop offset="1" stop-color="#fff6d6" stop-opacity=".2"/>
      </linearGradient>
      <filter id="ctl-beam-glow" x="-20%" y="-40%" width="140%" height="180%">
        <feGaussianBlur stdDeviation="1.1" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <path d="M42 24 C54 20, 64 28, 78 38"/>
    <path d="M48 34 C58 30, 68 36, 79 44"/>
    <path d="M52 48 C62 42, 70 46, 80 52"/>
  </svg>
  <div class="copy" id="ctl-copy">
    <h2>CONTACT</h2>
    <button class="openbtn" id="ctl-openbtn" type="button" aria-controls="ctl-letter">Write <i>편지 쓰기</i></button>
  </div>
  <div class="letter" id="ctl-letter">
    <div class="paper" id="ctl-paper">
      <img class="sheet" src="${A}letter-sheet.png?v=eternal-beam-r63" alt="">
      <div class="inner" id="ctl-inner">
        <form class="form" id="ctl-form" novalidate>
          <div class="row">
            <label class="f"><span>Name <i>이름</i><small class="cnt" hidden></small></span><input name="name" required autocomplete="name" maxlength="${LIM.name}"></label>
            <label class="f"><span>Email <i>이메일</i><small class="cnt" hidden></small></span><input name="email" type="email" required autocomplete="email" maxlength="${LIM.email}"></label>
            <label class="f"><span>Phone <i>연락처</i><small class="cnt" hidden></small></span><input name="phone" type="tel" autocomplete="tel" maxlength="${LIM.phone}"></label>
          </div>
          <label class="f msg"><span>Message <i>문의 내용</i><small class="cnt" hidden></small></span><textarea name="message" required maxlength="${LIM.message}" rows="6"></textarea></label>
          <input type="text" name="_gotcha" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" aria-label="스팸 방지용 빈 칸">
          <div class="foot">
            <div class="consent"><label><input type="checkbox" name="privacy_consent" required><span class="en">Privacy</span> <i>개인정보 동의</i></label><button type="button" class="pv" id="ctl-pvbtn" aria-expanded="false" aria-controls="ctl-privacy" aria-label="개인정보 처리방침 내용 보기"><span class="en">Details</span> <i>내용 보기</i></button></div>
            <button class="send" type="submit">SEND <i>보내기</i></button>
            <p class="note" id="ctl-note" aria-live="polite"></p>
          </div>
        </form>
        <div class="privacy" id="ctl-privacy" role="dialog" aria-modal="false" aria-label="개인정보 수집·이용 안내" hidden>
          <h3>개인정보 수집·이용 안내</h3>
          <dl>
            <dt>수집 항목</dt><dd>이름, 이메일, 연락처, 문의 내용</dd>
            <dt>이용 목적</dt><dd>문의 확인과 회신</dd>
            <dt>보유 기간</dt><dd>회신 완료 후 1년, 이후 파기</dd>
            <dt>처리 방법</dt><dd>보내기 시 ${MAIL} 메일 작성 창이 열립니다</dd>
          </dl>
          <button type="button" class="pvclose" id="ctl-pvclose">Close 닫기</button>
        </div>
      </div>
    </div>
  </div>
  <p class="posted" id="ctl-posted" hidden>편지를 보냈습니다<br><a href="mailto:${MAIL}">${MAIL}</a></p>
  <button class="again" id="ctl-again" type="button" hidden>Write again <i>새 편지 쓰기</i></button>
</div>
</div>`;
}

function mailHref(name, email, phone, message) {
  const lines = [`이름: ${name}`, `이메일: ${email}`, phone ? `연락처: ${phone}` : '', '', message].filter(v => v !== null);
  return `mailto:${MAIL}?subject=${encodeURIComponent('Eternal Beam 홈페이지 문의 — ' + name)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

export function initContact(root) {
  root.innerHTML = markup();
  root.closest('section')?.classList.add('contact-letterbox');
  const $ = id => root.querySelector('#ctl-' + id);
  const wrap = root.querySelector('.ctl');
  const stage = $('stage'), letter = $('letter'), paper = $('paper'), form = $('form');
  let reduced = false;

  function openLetter(fade) {
    stage.classList.add('open');
    if (fade && !reduced) letter.classList.add('in');
  }
  letter.addEventListener('animationend', () => letter.classList.remove('in'));
  const SMALL = matchMedia('(max-width:760px), (max-aspect-ratio:1/1)');
  if (!SMALL.matches) openLetter();
  $('openbtn').addEventListener('click', () => { openLetter(true); form.elements.name.focus({ preventScroll: true }); layoutBeams(); });
  SMALL.addEventListener('change', e => { if (!e.matches) openLetter(); layoutBeams(); });

  function layoutBeams() {
    const svg = $('beam'), hall = $('s1');
    if (!svg || !hall || !letter) return;
    const sr = stage.getBoundingClientRect(), hr = hall.getBoundingClientRect(), pr = letter.getBoundingClientRect();
    if (!sr.width || !pr.width) return;
    const to = (x, y) => [((x - sr.left) / sr.width) * 100, ((y - sr.top) / sr.height) * 100];
    const starts = [[.70, .20], [.84, .32], [.90, .48]].map(([x, y]) => [hr.left + hr.width * x, hr.top + hr.height * y]);
    const endX = pr.left + pr.width * .06;
    const ends = [.20, .36, .52].map(y => pr.top + pr.height * y);
    svg.querySelectorAll('path').forEach((path, i) => {
      const [x1, y1] = to(starts[i][0], starts[i][1]);
      const [x2, y2] = to(endX, ends[i]);
      const cx1 = x1 + (x2 - x1) * .4, cy1 = y1 - 7;
      const cx2 = x1 + (x2 - x1) * .74, cy2 = y2 - 1;
      path.setAttribute('d', `M${x1.toFixed(2)} ${y1.toFixed(2)} C${cx1.toFixed(2)} ${cy1.toFixed(2)}, ${cx2.toFixed(2)} ${cy2.toFixed(2)}, ${x2.toFixed(2)} ${y2.toFixed(2)}`);
    });
  }
  window.addEventListener('resize', layoutBeams);
  requestAnimationFrame(() => { layoutBeams(); requestAnimationFrame(layoutBeams); });

  const pvBtn = $('pvbtn'), pvPanel = $('privacy'), pvClose = $('pvclose');
  function setPrivacy(open, moveFocus) {
    pvPanel.hidden = !open;
    pvBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!moveFocus) return;
    if (open) pvClose.focus({ preventScroll: true }); else pvBtn.focus({ preventScroll: true });
  }
  pvBtn.addEventListener('click', () => setPrivacy(pvPanel.hidden, true));
  pvClose.addEventListener('click', () => setPrivacy(false, true));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || pvPanel.hidden) return;
    e.stopPropagation();
    setPrivacy(false, pvPanel.contains(document.activeElement));
  }, true);

  const noteEl = $('note'), sendBtn = form.querySelector('.send');
  const fieldEls = form.querySelectorAll('.f');
  const consentBox = form.querySelector('.consent');
  const againBtn = $('again');
  const posted = $('posted');
  const [fName, fEmail, fPhone] = fieldEls;
  const counters = [...fieldEls].map(f => {
    const i = f.querySelector('input,textarea'), c = f.querySelector('.cnt');
    return (i && c && i.maxLength > 0) ? { i, c, max: i.maxLength } : null;
  }).filter(Boolean);
  const syncCount = o => {
    const n = o.i.value.length, show = n >= Math.floor(o.max * NEAR);
    if (show) o.c.textContent = n + ' / ' + o.max;
    o.c.hidden = !show;
    o.c.classList.toggle('full', n >= o.max);
  };
  const syncCounts = () => counters.forEach(syncCount);
  const clampFields = () => counters.forEach(o => { if (o.i.value.length > o.max) o.i.value = o.i.value.slice(0, o.max); });
  const showNote = (msg, ok) => {
    noteEl.textContent = msg;
    if (ok) noteEl.dataset.ok = '1'; else delete noteEl.dataset.ok;
  };
  const markBad = f => {
    f.classList.add('bad');
    const i = f.querySelector('input,textarea');
    if (i) { i.setAttribute('aria-invalid', 'true'); i.setAttribute('aria-describedby', 'ctl-note'); }
  };
  const clearOne = f => {
    f.classList.remove('bad');
    const i = f.querySelector('input,textarea');
    if (i) { i.removeAttribute('aria-invalid'); i.removeAttribute('aria-describedby'); }
  };
  const clearBad = () => { fieldEls.forEach(clearOne); consentBox.classList.remove('bad'); };
  const shakeSheet = () => { paper.classList.remove('shake'); void paper.offsetWidth; paper.classList.add('shake'); };

  form.addEventListener('input', e => {
    const f = e.target.closest('.f'); if (f) clearOne(f);
    const o = counters.find(x => x.i === e.target); if (o) syncCount(o);
  });
  form.addEventListener('change', e => {
    if (e.target.matches('.consent input[type="checkbox"]')) { consentBox.classList.remove('bad'); if (e.target.checked) showNote(''); }
  });

  function sent() {
    stage.classList.add('sent');
    letter.inert = true;
    posted.hidden = false;
    againBtn.hidden = false;
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    clearBad(); showNote('');
    clampFields(); syncCounts();
    if (form.querySelector('.hp').value) return;
    const nameInp = fName.querySelector('input'), emailInp = fEmail.querySelector('input'), phoneInp = fPhone.querySelector('input');
    const msgArea = form.querySelector('textarea');
    const consentInp = form.querySelector('.consent input[type="checkbox"]');
    const name = nameInp.value.trim(), email = emailInp.value.trim(), phone = phoneInp.value.trim(), message = msgArea.value.trim();
    let bad = false, msg = '', needConsent = false;
    const missing = [];
    if (!name) { markBad(fName); bad = true; missing.push('이름'); }
    if (!email || !EMAIL_RE.test(email)) { markBad(fEmail); bad = true; missing.push(email ? '올바른 이메일' : '이메일'); }
    if (!message) { markBad(msgArea.closest('.f')); bad = true; missing.push('문의 내용'); }
    if (bad) { msg = missing.join(', ') + '을(를) 채워 주세요'; }
    else if (!consentInp || !consentInp.checked) { bad = true; needConsent = true; msg = '개인정보 동의가 필요해요'; consentBox.classList.add('bad'); }
    if (bad) {
      showNote(msg); shakeSheet();
      if (needConsent) consentInp?.focus({ preventScroll: true });
      else form.querySelector('.f.bad input, .f.bad textarea')?.focus({ preventScroll: true });
      return;
    }
    const href = mailHref(name, email, phone, message);
    const a = document.createElement('a');
    a.href = href;
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    a.remove();
    setPrivacy(false);
    sent();
    form.reset();
    clearBad();
    syncCounts();
    showNote('');
  });

  function again() {
    againBtn.hidden = true;
    posted.hidden = true;
    stage.classList.remove('sent');
    letter.inert = false;
    sendBtn.disabled = false;
    setPrivacy(false);
    clearBad(); syncCounts(); showNote('');
    openLetter(true);
    form.elements.name.focus({ preventScroll: true });
  }
  againBtn.addEventListener('click', again);

  const q = new URLSearchParams(location.search);
  if (q.get('demo') === 'open') openLetter();

  let opener = null;
  return {
    open() {
      openLetter(true);
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      requestAnimationFrame(() => form.elements.name.focus({ preventScroll: true }));
    },
    closeForNavigation() {
      const wasFocused = form.contains(document.activeElement);
      if (wasFocused) document.activeElement.blur();
      if (wasFocused && opener instanceof HTMLElement) opener.focus({ preventScroll: true });
      opener = null;
      return wasFocused;
    },
    setReducedMotion(value) {
      reduced = Boolean(value);
      wrap.classList.toggle('reduced-motion', reduced);
    },
  };
}
