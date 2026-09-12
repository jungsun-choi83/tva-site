const createContact = () => `
  <section class="tva-contact" aria-labelledby="contact-title">
    <div class="tva-contact__stage">
      <div class="tva-contact__art" aria-hidden="true">
        <picture>
          <source srcset="assets/contact/telephone/contact-telephone-art-v1.webp" type="image/webp">
          <img src="assets/contact/telephone/contact-telephone-art-v1.webp" alt="" width="1672" height="941" loading="lazy" decoding="async" draggable="false">
        </picture>
      </div>
      <div class="tva-contact__form-wrap">
        <form class="tva-contact-form" novalidate>
          <header class="tva-contact-form__header">
            <h2 id="contact-title">CONTACT <span>문의하기</span></h2>
          </header>
          <p class="tva-contact-context" hidden></p>
          <div class="tva-contact-form__grid">
            <label class="tva-field tva-field--wide">
              <span>NAME <b>이름</b><i>*</i></span>
              <input name="name" autocomplete="name" required aria-describedby="contact-form-status">
            </label>
            <label class="tva-field tva-field--wide">
              <span>EMAIL <b>이메일</b><i>*</i></span>
              <input name="email" type="email" autocomplete="email" required aria-describedby="contact-form-status">
            </label>
            <label class="tva-field">
              <span>PHONE <b>연락처</b></span>
              <input name="phone" type="tel" autocomplete="tel" aria-describedby="contact-form-status">
            </label>
            <label class="tva-field tva-field--attachment">
              <span>ATTACHMENT <b>파일첨부</b></span>
              <span class="tva-file-control">
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15.8 6.2-7.3 7.3a3 3 0 0 0 4.2 4.2l7-7a4.6 4.6 0 0 0-6.5-6.5l-7.5 7.5a6.2 6.2 0 0 0 8.8 8.8l6.1-6.1"/></svg>
                <em data-file-name>UPLOAD 업로드</em>
                <input name="attachment" type="file" aria-describedby="contact-form-status">
                <button class="tva-file-clear" type="button" data-file-clear hidden aria-label="Remove attachment">×</button>
              </span>
            </label>
            <label class="tva-field tva-field--wide tva-field--message">
              <span>MESSAGE <b>문의 내용</b><i>*</i></span>
              <textarea name="note" rows="6" required aria-describedby="contact-form-status" placeholder="프로젝트의 내용이나 궁금한 점을 자유롭게 적어주세요."></textarea>
            </label>
          </div>
          <div class="tva-contact-form__consent">
            <label class="tva-check"><input name="privacy" type="checkbox" required><span>PRIVACY <b>개인정보 동의</b></span></label>
            <button class="tva-details-button" type="button" data-privacy-details>DETAILS <b>내용 보기</b></button>
          </div>
          <button class="tva-contact-form__submit" type="submit"><span>SEND</span><b>보내기</b></button>
          <p class="tva-contact-form__status" id="contact-form-status" role="status" aria-live="polite">LOCAL PREVIEW · 전송되지 않습니다.</p>
        </form>
      </div>
    </div>
  </section>
  <dialog class="tva-privacy-dialog" aria-labelledby="privacy-title">
    <form method="dialog">
      <button class="tva-privacy-dialog__close" value="close" aria-label="Close privacy details">×</button>
      <p class="tva-contact__eyebrow">PRIVACY / 개인정보</p>
      <h3 id="privacy-title">내용 보기</h3>
      <p>이 페이지는 문의 내용을 현재 브라우저 탭에서만 다룹니다. 실제 이메일 전송과 파일 업로드는 연결된 서버가 준비된 뒤 활성화됩니다.</p>
    </form>
  </dialog>`;

const getEditableFields = (form) => [...form.elements].filter((field) =>
  field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement);

export function initContact(root) {
  root.innerHTML = createContact();
  const section = root.querySelector(".tva-contact");
  const form = root.querySelector(".tva-contact-form");
  const status = root.querySelector(".tva-contact-form__status");
  const contextNode = root.querySelector(".tva-contact-context");
  const fileInput = form.elements.namedItem("attachment");
  const fileName = root.querySelector("[data-file-name]");
  const privacyDetails = root.querySelector("[data-privacy-details]");
  const privacyDialog = root.querySelector(".tva-privacy-dialog");
  let opener = null;

  const setStatus = (message, state = "") => {
    status.textContent = message;
    status.dataset.state = state;
  };

  const renderContext = (context) => {
    if (!context) {
      contextNode.hidden = true;
      contextNode.replaceChildren();
      return;
    }
    const label = document.createElement("span");
    label.textContent = `INQUIRY CONTEXT / ${context.kind.toUpperCase()} / ${context.title}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "REMOVE";
    remove.addEventListener("click", () => {
      renderContext(null);
      setStatus("문의 맥락이 제거되었습니다.");
    });
    contextNode.replaceChildren(label, remove);
    contextNode.hidden = false;
  };

  const clearInvalidState = (field) => {
    field.setCustomValidity("");
    field.removeAttribute("aria-invalid");
  };

  const validate = () => {
    const required = getEditableFields(form).filter((field) => field.required);
    const invalid = required.filter((field) => {
      clearInvalidState(field);
      const isEmpty = field.type === "checkbox" ? !field.checked : !field.value.trim();
      if (isEmpty) field.setCustomValidity("Please complete this field.");
      const valid = field.checkValidity();
      field.setAttribute("aria-invalid", String(!valid));
      return !valid;
    });
    if (!invalid.length) return true;
    setStatus("CHECK THE REQUIRED FIELDS BEFORE SENDING.", "error");
    invalid[0].focus({ preventScroll: false });
    return false;
  };

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileName.textContent = file ? file.name : "UPLOAD 업로드";
    fileName.dataset.hasFile = String(Boolean(file));
    root.querySelector("[data-file-clear]").hidden = !file;
  });
  root.querySelector("[data-file-clear]").addEventListener("click", () => {
    fileInput.value = "";
    fileName.textContent = "UPLOAD 업로드";
    fileName.dataset.hasFile = "false";
    root.querySelector("[data-file-clear]").hidden = true;
  });

  form.addEventListener("input", (event) => {
    if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) return;
    clearInvalidState(event.target);
    if (status.dataset.state === "error") setStatus("LOCAL PREVIEW · 전송되지 않습니다.");
  });
  form.addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement) clearInvalidState(event.target);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validate()) return;
    setStatus("작성 내용이 준비되었습니다 · 전송되지 않습니다.", "ready");
  });
  privacyDetails.addEventListener("click", () => {
    if (typeof privacyDialog.showModal === "function") privacyDialog.showModal();
  });
  privacyDialog.addEventListener("click", (event) => {
    if (event.target === privacyDialog) privacyDialog.close();
  });

  return {
    open(nextContext) {
      if (nextContext) renderContext(nextContext);
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      requestAnimationFrame(() => form.elements.name.focus({ preventScroll: true }));
    },
    closeForNavigation() {
      const wasFocused = form.contains(document.activeElement);
      if (privacyDialog.open) privacyDialog.close();
      if (wasFocused && opener instanceof HTMLElement) opener.focus({ preventScroll: true });
      opener = null;
      return wasFocused;
    },
    setReducedMotion(value) {
      section.classList.toggle("reduced-motion", Boolean(value));
    },
  };
}
