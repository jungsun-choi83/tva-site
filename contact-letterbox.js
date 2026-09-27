// CONTACT — Melius-style split card + floating Goya in space (left) + letter form (right).

// SEND opens the visitor's mail app as a draft to jadechoi@eternalbeamapp.com.

import { applyI18n, getLang, t } from './i18n.js?v=eb-20260919v';



const CONTACT_IMAGE = 'gallery-original/assets/photos/optimized/dogc.png';

const MAIL = 'jadechoi@eternalbeamapp.com';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LIM = { first: 40, last: 40, email: 120, phone: 30, subject: 120, message: 2000 };

const NEAR = 0.8;



function markup() {

  return `<div class="ctl">

<div class="stage" id="ctl-stage">

  <div class="ctl-shell">

    <article class="ctl-card" aria-labelledby="ctl-contact-title">

      <div class="ctl-card__viz" aria-hidden="true">
        <img class="ctl-viz-image" src="${CONTACT_IMAGE}" width="1122" height="1402" alt="" decoding="async">
      </div>

      <div class="ctl-card__body">

        <header class="ctl-head">

          <p class="ctl-kicker" data-i18n="contact.melius.kicker">Contact</p>

          <h2 id="ctl-contact-title" class="ctl-title" data-i18n="contact.melius.h">Contact us</h2>

          <p class="ctl-lead" data-i18n="contact.melius.lead">Questions about Eternal Beam, a partnership, or launch news? Send us a note and we will get back to you.</p>

        </header>

        <form class="form" id="ctl-form" novalidate>

          <div class="row">

            <label class="f" data-ctl-reveal style="--d:0"><span data-i18n="contact.firstName">First name</span><input name="first_name" required autocomplete="given-name" maxlength="${LIM.first}" placeholder="Jane"></label>

            <label class="f" data-ctl-reveal style="--d:1"><span data-i18n="contact.lastName">Last name</span><input name="last_name" required autocomplete="family-name" maxlength="${LIM.last}" placeholder="Doe"></label>

          </div>

          <label class="f" data-ctl-reveal style="--d:2"><span data-i18n="contact.needEmail">Email</span><small class="cnt" hidden></small><input name="email" type="email" required autocomplete="email" maxlength="${LIM.email}" placeholder="jane@company.com"></label>

          <label class="f" data-ctl-reveal style="--d:3"><span data-i18n="contact.mailPhone">Phone</span> <i data-i18n="contact.optional">(optional)</i><small class="cnt" hidden></small><input name="phone" type="tel" autocomplete="tel" maxlength="${LIM.phone}" placeholder="+82 10 0000 0000"></label>

          <label class="f" data-ctl-reveal style="--d:4"><span data-i18n="contact.subject">Subject</span><small class="cnt" hidden></small><input name="subject" maxlength="${LIM.subject}" placeholder="What's this about?"></label>

          <label class="f msg" data-ctl-reveal style="--d:5"><span data-i18n="contact.needMsg">Message</span><small class="cnt" hidden></small><textarea name="message" required maxlength="${LIM.message}" rows="5" placeholder="Tell us a little more…"></textarea></label>

          <input type="text" name="_gotcha" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">

          <div class="foot" data-ctl-reveal style="--d:6">

            <div class="consent"><label><input type="checkbox" name="privacy_consent" required><span class="en">Privacy</span> <i data-i18n="contact.consentShort">개인정보 동의</i></label></div>

            <button type="button" class="pv" id="ctl-pvbtn" aria-expanded="false" aria-controls="ctl-privacy" aria-label="개인정보 처리방침 내용 보기"><span class="en">Details</span> <i data-i18n="contact.pvBtn">내용 보기</i> →</button>

            <button class="send" type="submit" data-i18n="contact.submit">Submit</button>

            <p class="note" id="ctl-note" aria-live="polite"></p>

          </div>

        </form>

        <div class="privacy" id="ctl-privacy" role="dialog" aria-modal="false" aria-label="개인정보 수집·이용 안내" hidden>

          <h3 data-i18n="contact.pvTitle">개인정보 수집·이용 안내</h3>

          <dl>

            <dt data-i18n="contact.pvItemsDt">수집 항목</dt><dd data-i18n="contact.pvItemsDd">이름, 이메일, 연락처, 문의 내용</dd>

            <dt data-i18n="contact.pvPurposeDt">이용 목적</dt><dd data-i18n="contact.pvPurposeDd">문의 확인과 회신</dd>

            <dt data-i18n="contact.pvKeepDt">보유 기간</dt><dd data-i18n="contact.pvKeepDd">회신 완료 후 1년, 이후 파기</dd>

            <dt data-i18n="contact.pvHowDt">처리 방법</dt><dd data-i18n="contact.pvHowDd">보내기를 누르면 쓰시던 메일 앱에 편지가 담깁니다. 메일 앱에서 직접 보내 주셔야 jadechoi@eternalbeamapp.com 로 전달됩니다.</dd>

            <dt data-i18n="contact.pvTrustDt">처리 위탁</dt><dd data-i18n="contact.pvTrustDd">없음. 홈페이지는 문의 내용을 저장하지 않습니다.</dd>

          </dl>

          <p class="pvmore"><a href="privacy.html" target="_blank" rel="noopener" data-i18n="contact.pvMore">개인정보 처리방침 전문 보기</a></p>

          <button type="button" class="pvclose" id="ctl-pvclose" data-i18n="contact.pvClose">Close 닫기</button>

        </div>

      </div>

    </article>

    <p class="posted" id="ctl-posted" hidden><b data-i18n="contact.postedB">메일 앱에 편지를 담았습니다</b><span data-i18n-html="contact.postedS">메일 앱에서 보내기를 한 번 더 눌러 주셔야 전달됩니다.<br>창이 열리지 않았다면 이 주소로 보내 주셔도 됩니다.</span><a href="mailto:${MAIL}">${MAIL}</a></p>

    <button class="again" id="ctl-again" type="button" hidden>Write again <i data-i18n="contact.again">새 편지 쓰기</i></button>

  </div>

</div>

</div>`;

}



function objectParticle(word) {

  const last = String(word).trim().slice(-1);

  const code = last.charCodeAt(0);

  if (!(code >= 0xac00 && code <= 0xd7a3)) return '을';

  return (code - 0xac00) % 28 ? '을' : '를';

}



function mailHref(name, email, phone, subject, message) {

  // Follow-up: replace this mailto handoff with a real form endpoint; some in-app browsers do not open mail clients reliably.

  const head = [`${t('contact.mailName')}: ${name}`, `${t('contact.mailEmail')}: ${email}`];

  if (phone) head.push(`${t('contact.mailPhone')}: ${phone}`);

  if (subject) head.push(`${t('contact.subject')}: ${subject}`);

  const body = `${head.join('\n')}\n\n${message}`;

  const subj = subject || `${t('contact.mailSubject')}${name}`;

  return `mailto:${MAIL}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;

}



export function initContact(root) {

  root.innerHTML = markup();

  applyI18n(root);

  root.closest('section')?.classList.add('contact-letterbox');

  const $ = id => root.querySelector('#ctl-' + id);

  const wrap = root.querySelector('.ctl');

  const stage = $('stage');

  const card = root.querySelector('.ctl-card');

  const form = $('form');

  const section = root.closest('#contact') || root.closest('section');

  const vizVideo = root.querySelector('.ctl-viz-video');

  let reduced = false;

  let riseTimer = 0;

  function playVizVideo() {
    if (!vizVideo || reduced) return;
    const p = vizVideo.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }
  function contactGateOpen() {
    return !section?.classList.contains('contact-bleib')
      || section.classList.contains('is-bleib-open');
  }

  playVizVideo();
  if (section && vizVideo) {
    const vWatch = new IntersectionObserver(([entry]) => {
      if (!contactGateOpen()) {
        vizVideo.pause();
        return;
      }
      if (entry?.isIntersecting) playVizVideo();
      else vizVideo.pause();
    }, { threshold: 0.12 });
    vWatch.observe(section);
  }

  function setRisen(on, immediate) {

    clearTimeout(riseTimer);

    if (reduced || wrap.classList.contains('reduced-motion')) {

      stage.classList.add('is-risen');

      card?.classList.add('is-ready');

      return;

    }

    if (!on) {

      stage.classList.remove('is-risen');

      card?.classList.remove('is-ready');

      return;

    }

    const lift = () => {

      stage.classList.add('is-risen');

      card?.classList.add('is-ready');

    };

    if (immediate) lift();

    else riseTimer = window.setTimeout(lift, 120);

  }



  function openLetter() {

    stage.classList.add('open');

    stage.classList.remove('sent');

    setRisen(true, true);

  }



  const riseWatch = new IntersectionObserver(([entry]) => {

    if (!entry || !contactGateOpen()) return;

    if (entry.isIntersecting && entry.intersectionRatio >= .28) setRisen(true, false);

    else if (!entry.isIntersecting) setRisen(false, true);

  }, { threshold: [0, .28, .55] });

  if (section) {
    riseWatch.observe(section);
    section.addEventListener('eb:bleib-open', () => setRisen(true, false));
    section.addEventListener('eb:bleib-close', () => setRisen(false, true));
  }



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

  const fFirst = form.querySelector('[name="first_name"]')?.closest('.f');

  const fLast = form.querySelector('[name="last_name"]')?.closest('.f');

  const fEmail = form.querySelector('[name="email"]')?.closest('.f');

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

  const shakeSheet = () => { card?.classList.remove('shake'); void card?.offsetWidth; card?.classList.add('shake'); };



  form.addEventListener('input', e => {

    const f = e.target.closest('.f'); if (f) clearOne(f);

    const o = counters.find(x => x.i === e.target); if (o) syncCount(o);

  });

  form.addEventListener('change', e => {

    if (e.target.matches('.consent input[type="checkbox"]')) { consentBox.classList.remove('bad'); if (e.target.checked) showNote(''); }

  });



  function sent() {

    stage.classList.add('sent');

    posted.hidden = false;

    againBtn.hidden = false;

  }



  function openMail(href) {

    const a = document.createElement('a');

    a.href = href;

    a.style.display = 'none';

    document.body.append(a);

    a.click();

    a.remove();

  }



  form.addEventListener('submit', e => {

    e.preventDefault();

    if (stage.classList.contains('sent')) return;

    clearBad(); showNote('');

    clampFields(); syncCounts();

    if (form.querySelector('.hp').value) return;

    const first = form.elements.first_name.value.trim();

    const last = form.elements.last_name.value.trim();

    const name = `${first} ${last}`.trim();

    const email = form.elements.email.value.trim();

    const phone = form.elements.phone.value.trim();

    const subject = form.elements.subject.value.trim();

    const message = form.elements.message.value.trim();

    const consentInp = form.querySelector('.consent input[type="checkbox"]');

    let msg = '', needConsent = false, emailBad = false;

    const missing = [];

    if (!first) { markBad(fFirst); missing.push(t('contact.firstName')); }

    if (!last) { markBad(fLast); missing.push(t('contact.lastName')); }

    if (!email) { markBad(fEmail); missing.push(t('contact.needEmail')); }

    else if (!EMAIL_RE.test(email)) { markBad(fEmail); emailBad = true; }

    if (!message) { markBad(form.querySelector('textarea').closest('.f')); missing.push(t('contact.needMsg')); }

    let bad = missing.length > 0 || emailBad;

    if (missing.length) {

      msg = getLang() === 'en'

        ? t('contact.fill').replace('{list}', missing.join(', '))

        : missing.join(', ') + objectParticle(missing[missing.length - 1]) + ' 채워 주세요';

    } else if (emailBad) msg = t('contact.emailBad');

    else if (!consentInp || !consentInp.checked) { bad = true; needConsent = true; msg = t('contact.needConsent'); consentBox.classList.add('bad'); }

    if (bad) {

      showNote(msg); shakeSheet();

      if (needConsent) consentInp?.focus({ preventScroll: true });

      else form.querySelector('.f.bad input, .f.bad textarea')?.focus({ preventScroll: true });

      return;

    }

    openMail(mailHref(name, email, phone, subject, message));

    setPrivacy(false);

    form.reset();

    clearBad();

    syncCounts();

    showNote('');

    sent();

  });



  function again() {

    againBtn.hidden = true;

    posted.hidden = true;

    stage.classList.remove('sent');

    sendBtn.disabled = false;

    setPrivacy(false);

    clearBad(); syncCounts(); showNote('');

    openLetter();

    form.elements.first_name.focus({ preventScroll: true });

  }

  againBtn.addEventListener('click', again);



  let opener = null;

  openLetter();

  syncCounts();



  return {

    open() {

      section?._ebBleibOpen?.();

      openLetter();

      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      requestAnimationFrame(() => form.elements.first_name.focus({ preventScroll: true }));

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

      if (reduced) {
        setRisen(true, true);
        vizVideo?.pause();
      } else playVizVideo();

    },

  };

}

