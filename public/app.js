import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDlq2E1cnQey1oMoosMPRlizbRNhbO9CBw",
  authDomain: "vacante-docentes.firebaseapp.com",
  projectId: "vacante-docentes",
  storageBucket: "vacante-docentes.firebasestorage.app",
  messagingSenderId: "205007755547",
  appId: "1:205007755547:web:6204ed1e05b18ba3e89bbe"
};

if (location.hash === "#formulario") {
  location.replace("./formulario.html");
}

const ADMIN_EMAILS = [
  "alekcaballeromusic@gmail.com",
  "catalina.medina.leal@gmail.com",
  "adminmusicala@gmail.com"
];

const TEAM_EMAILS = [...ADMIN_EMAILS];

const AREAS = ["Música", "Danza", "Artes plásticas", "Teatro", "Cheerleading"];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

await setPersistence(auth, browserLocalPersistence);

let currentUser = null;
let currentRole = "public";
let teachers = [];
let applications = [];
let needs = [];
const BASE_FORM_FIELDS = [
  ["nombre", "Nombres y apellidos", true],
  ["documento", "Tipo y número de documento", true],
  ["fechaNacimiento", "Fecha de nacimiento", true],
  ["localidad", "Localidad o municipio de residencia", true],
  ["direccion", "Dirección de residencia", true],
  ["email", "Correo electrónico", true],
  ["celular", "Celular", true],
  ["telefonoFijo", "Teléfono fijo", false],
  ["transporte", "Principal medio de transporte", true],
  ["areaPrincipal", "¿Qué clases te gustaría dictar?", true],
  ["instrumento", "Instrumento o especialidad principal", true],
  ["otraArea1", "¿Te gustaría añadir otra área?", false],
  ["modalidades", "¿En qué modalidades te gustaría enfocarte?", true],
  ["estilos", "Estilos", false],
  ["otraArea2", "Otra área o habilidad artística", false],
  ["enfasis", "Énfasis o temas que puedes enseñar", false],
  ["otraArea3", "¿Deseas añadir otra área adicional?", false],
  ["resena", "Reseña docente", true],
  ["disponibilidad", "Disponibilidad para dictar clases", true],
  ["portafolioUrl", "Portafolio, video o perfil artístico", false],
  ["googleMaps", "Enlace de Google Maps de tu ubicación", false],
  ["comentarios", "Comentarios adicionales", false],
  ["hvFile", "Hoja de vida", true]
];
let formConfig = { title: "Postulación docente Musicala", intro: "", questions: [], fields: {} };
let unsubTeachers = null;
let unsubApplications = null;
let unsubNeeds = null;
let lastReplacementContext = {};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const els = {
  pageTitle: $("#pageTitle"),
  notice: $("#systemNotice"),
  userBox: $("#userBox"),
  loginBtn: $("#loginBtn"),
  logoutBtn: $("#logoutBtn"),
  totalTeachers: $("#totalTeachers"),
  statHigh: $("#statHigh"),
  statMusic: $("#statMusic"),
  statDance: $("#statDance"),
  statArts: $("#statArts"),
  statTheatre: $("#statTheatre"),
  statApplications: $("#statApplications"),
  needsList: $("#needsList"),
  teachersGrid: $("#teachersGrid"),
  applicationsList: $("#applicationsList"),
  resultsCount: $("#resultsCount"),
  activeFiltersText: $("#activeFiltersText"),
  replacementResults: $("#replacementResults"),
  replacementSummary: $("#replacementSummary"),
  importLog: $("#importLog"),
  teacherDialog: $("#teacherDialog"),
  teacherForm: $("#teacherForm"),
  deleteTeacherBtn: $("#deleteTeacherBtn"),
  teacherDialogTitle: $("#teacherDialogTitle"),
  teamConfig: $("#teamConfig")
  ,teamTeachersGrid: $("#teamTeachersGrid")
  ,teamCount: $("#teamCount")
  ,customFormFields: $("#customFormFields")
  ,formConfigEditor: $("#formConfigEditor")
  ,teacherDetailsDialog: $("#teacherDetailsDialog")
  ,teacherDetailsTitle: $("#teacherDetailsTitle")
  ,teacherDetailsContent: $("#teacherDetailsContent")
  ,needDialog: $("#needDialog")
  ,needForm: $("#needForm")
  ,deleteNeedBtn: $("#deleteNeedBtn")
  ,baseFormFieldsEditor: $("#baseFormFieldsEditor")
  ,publicFormPreview: $("#publicFormPreview")
};

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\w@.+# ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(v => String(v).trim()).filter(Boolean);
  return String(value ?? "")
    .split(/[,;\n|/]+|\s+y\s+/i)
    .map(v => v.trim())
    .filter(Boolean);
}

function uniqueArray(values) {
  const seen = new Set();
  const out = [];
  values.forEach(value => {
    const key = normalize(value);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(String(value).trim());
    }
  });
  return out;
}

function cleanPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("57") && digits.length > 10) return digits.slice(-10);
  return digits || String(value ?? "").trim();
}

function slugify(value) {
  const slug = normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 56);
  return slug || `docente-${Date.now()}`;
}

async function hashId(text) {
  const buffer = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buffer)).slice(0, 4).map(b => b.toString(16).padStart(2, "0")).join("");
}

function makeSearchText(data) {
  const pieces = [
    data.nombre,
    data.email,
    data.celular,
    data.localidad,
    data.transporte,
    data.estado,
    data.prioridad,
    ...(data.areas || []),
    ...(data.subareas || []),
    ...(data.modalidades || []),
    ...(data.disponibilidad?.dias || []),
    ...(data.disponibilidad?.franjas || [])
  ];
  return normalize(pieces.join(" "));
}

function roleForEmail(email) {
  const clean = String(email || "").toLowerCase();
  if (ADMIN_EMAILS.includes(clean)) return "admin";
  return "public";
}

function isTeam() {
  return currentRole === "admin";
}

function isAdmin() {
  return currentRole === "admin";
}

function showNotice(message, type = "warn") {
  els.notice.textContent = message;
  els.notice.classList.remove("hidden");
  els.notice.dataset.type = type;
}

function hideNotice() {
  els.notice.classList.add("hidden");
}

function logImport(message) {
  const time = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  els.importLog.textContent += `[${time}] ${message}\n`;
  els.importLog.scrollTop = els.importLog.scrollHeight;
}

function setRoleUI() {
  const logged = !!currentUser;
  els.loginBtn.classList.toggle("hidden", logged);
  els.logoutBtn.classList.toggle("hidden", !logged);

  if (!logged) {
    els.userBox.innerHTML = `<span class="muted">Sin sesión</span>`;
  } else {
    els.userBox.innerHTML = `
      <strong>${escapeHTML(currentUser.displayName || currentUser.email)}</strong>
      <small>${escapeHTML(currentUser.email)} · ${escapeHTML(currentRole)}</small>
    `;
  }

  $$(".team-only").forEach(el => el.classList.toggle("hidden", !isTeam()));
  $$(".admin-only").forEach(el => el.classList.toggle("hidden", !isAdmin()));
  $$(".nav-btn").forEach(el => {
    if (el.dataset.view !== "formulario") el.classList.toggle("hidden", !isAdmin());
  });

  if (logged && currentRole === "public") {
    showNotice("Esta cuenta no está autorizada para ver la base docente. Puedes usar el formulario público, pero no el panel interno.");
  } else {
    hideNotice();
  }
  if (!isAdmin()) showView("formulario");

  renderTeamConfig();
}

function showView(name) {
  $$(".view").forEach(view => view.classList.toggle("active", view.id === `view-${name}`));
  $$(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === name));
  const titles = {
    dashboard: "Banco docente Musicala",
    reemplazo: "Buscar reemplazo",
    docentes: "Base docente",
    equipo: "Equipo actual",
    postulaciones: "Postulaciones",
    formulario: "Formulario público",
    configuracion: "Editar formulario"
  };
  els.pageTitle.textContent = titles[name] || "Banco docente Musicala";
  if (name === "formulario") history.replaceState(null, "", "#formulario");
  if (name !== "formulario" && location.hash === "#formulario") history.replaceState(null, "", location.pathname);
}

function setupNavigation() {
  $$(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.view === "formulario") {
        location.href = "./formulario.html";
        return;
      }
      showView(btn.dataset.view);
    });
  });

  if (location.hash === "#formulario") {
    showView("formulario");
  }
}

function startListeners() {
  stopListeners();
  if (!isTeam()) return;

  unsubTeachers = onSnapshot(collection(db, "docentes"), snapshot => {
    teachers = snapshot.docs.map(s => ({ id: s.id, ...s.data() }));
    teachers.sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"));
    renderAll();
  }, err => showNotice(`No se pudo leer docentes: ${err.message}`));

  unsubApplications = onSnapshot(collection(db, "postulaciones"), snapshot => {
    applications = snapshot.docs.map(s => ({ id: s.id, ...s.data() }));
    applications.sort((a, b) => String(b.createdAt?.seconds || 0).localeCompare(String(a.createdAt?.seconds || 0)));
    renderStats();
    renderApplications();
  }, err => showNotice(`No se pudo leer postulaciones: ${err.message}`));

  unsubNeeds = onSnapshot(collection(db, "necesidades"), snapshot => {
    needs = snapshot.docs.map(s => ({ id: s.id, ...s.data() }));
    needs.sort((a, b) => `${a.area}-${a.subarea}`.localeCompare(`${b.area}-${b.subarea}`, "es"));
    renderNeeds();
  }, err => showNotice(`No se pudo leer necesidades: ${err.message}`));

}

function stopListeners() {
  [unsubTeachers, unsubApplications, unsubNeeds].forEach(fn => fn && fn());
  unsubTeachers = null;
  unsubApplications = null;
  unsubNeeds = null;
}

function renderAll() {
  renderStats();
  renderNeeds();
  renderTeachers();
  renderTeamTeachers();
}

function renderStats() {
  els.totalTeachers.textContent = teachers.length;
  els.statHigh.textContent = teachers.filter(t => ["alta", "urgente"].includes(normalize(t.prioridad))).length;
  els.statMusic.textContent = teachers.filter(t => (t.areas || []).some(a => normalize(a) === "musica")).length;
  els.statDance.textContent = teachers.filter(t => (t.areas || []).some(a => normalize(a) === "danza")).length;
  els.statArts.textContent = teachers.filter(t => (t.areas || []).some(a => normalize(a) === "artes plasticas")).length;
  els.statTheatre.textContent = teachers.filter(t => (t.areas || []).some(a => normalize(a) === "teatro")).length;
  els.statApplications.textContent = applications.length;
}

function renderNeeds() {
  if (!needs.length) {
    els.needsList.innerHTML = `<p class="muted">No hay necesidades cargadas todavía.</p>`;
    return;
  }
  els.needsList.innerHTML = needs.map(need => {
    const urgent = normalize(need.urgencia) === "alto" || normalize(need.urgencia) === "urgente";
    return `
      <button type="button" class="need need-edit" data-need-id="${escapeHTML(need.id)}">
        <strong>${escapeHTML(need.area)} · ${escapeHTML(need.subarea)}</strong>
        <small>${escapeHTML(need.estado || "Por cubrir")} · <span class="${urgent ? "badge high" : "badge"}">${escapeHTML(need.urgencia || "Media")}</span></small>
      </button>
    `;
  }).join("");
  $$(".need-edit", els.needsList).forEach(button => {
    button.addEventListener("click", () => openNeedDialog(button.dataset.needId));
  });
}

function openNeedDialog(id = "") {
  if (!isAdmin()) return;
  const need = needs.find(item => item.id === id) || {};
  els.needForm.reset();
  els.needForm.elements.id.value = need.id || "";
  els.needForm.elements.area.value = need.area || "";
  els.needForm.elements.subarea.value = need.subarea || "";
  els.needForm.elements.estado.value = need.estado || "Por cubrir";
  els.needForm.elements.urgencia.value = need.urgencia || "Media";
  els.needForm.elements.notas.value = need.notas || "";
  $("#needDialogTitle").textContent = need.id ? "Editar necesidad" : "Agregar necesidad";
  els.deleteNeedBtn.classList.toggle("hidden", !need.id);
  els.needDialog.showModal();
}

async function saveNeed(event) {
  event.preventDefault();
  if (!isAdmin()) return;
  const data = Object.fromEntries(new FormData(els.needForm).entries());
  const id = data.id || slugify(`${data.area}-${data.subarea}-${Date.now()}`);
  await setDoc(doc(db, "necesidades", id), {
    area: data.area,
    subarea: data.subarea.trim(),
    estado: data.estado,
    urgencia: data.urgencia,
    notas: data.notas.trim(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  els.needDialog.close();
}

async function deleteNeed() {
  if (!isAdmin()) return;
  const id = els.needForm.elements.id.value;
  if (!id || !confirm("¿Eliminar esta necesidad?")) return;
  await deleteDoc(doc(db, "necesidades", id));
  els.needDialog.close();
}

function teacherMatchesFilters(teacher) {
  const search = normalize($("#searchInput").value);
  const area = normalize($("#areaFilter").value);
  const subarea = normalize($("#subareaFilter").value);
  const locality = normalize($("#localityFilter").value);
  const mode = normalize($("#modeFilter").value);
  const status = normalize($("#statusFilter").value);
  const text = teacher.searchText || makeSearchText(teacher);

  if (search && !text.includes(search)) return false;
  if (area && !(teacher.areas || []).some(a => normalize(a) === area)) return false;
  if (subarea && !(teacher.subareas || []).some(s => normalize(s).includes(subarea)) && !text.includes(subarea)) return false;
  if (locality && !normalize(teacher.localidad).includes(locality)) return false;
  if (mode && !(teacher.modalidades || []).some(m => normalize(m).includes(mode))) return false;
  if (status && normalize(teacher.estado) !== status) return false;
  return true;
}

function renderTeachers() {
  if (!isTeam()) {
    els.teachersGrid.innerHTML = `<div class="panel"><p class="muted">Inicia sesión con una cuenta autorizada para ver la base docente.</p></div>`;
    els.resultsCount.textContent = "0 resultados";
    return;
  }

  const filtered = teachers.filter(teacherMatchesFilters);
  els.resultsCount.textContent = `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`;

  const active = [
    $("#searchInput").value && `búsqueda: ${$("#searchInput").value}`,
    $("#areaFilter").value && `área: ${$("#areaFilter").value}`,
    $("#subareaFilter").value && `subárea: ${$("#subareaFilter").value}`,
    $("#localityFilter").value && `localidad: ${$("#localityFilter").value}`,
    $("#modeFilter").value && `modalidad: ${$("#modeFilter").value}`,
    $("#statusFilter").value && `estado: ${$("#statusFilter").value}`
  ].filter(Boolean);
  els.activeFiltersText.textContent = active.join(" · ");

  if (!filtered.length) {
    els.teachersGrid.innerHTML = `<div class="panel"><p class="muted">No hay resultados. El Excel descansa por hoy, pero toca ajustar filtros.</p></div>`;
    return;
  }

  els.teachersGrid.innerHTML = filtered.slice(0, 240).map(t => teacherCardHTML(t)).join("");
  bindTeacherCardActions(els.teachersGrid);
}

function renderTeamTeachers() {
  if (!els.teamTeachersGrid) return;
  const team = teachers.filter(t => t.equipoActual || normalize(t.estado) === "contratado");
  els.teamCount.textContent = `${team.length} docente${team.length === 1 ? "" : "s"}`;
  els.teamTeachersGrid.innerHTML = team.length
    ? team.map(t => teacherCardHTML(t)).join("")
    : `<p class="muted">Aún no hay docentes marcados como equipo actual.</p>`;
  bindTeacherCardActions(els.teamTeachersGrid);
}

function renderFormConfig() {
  if (!els.customFormFields) return;
  const questions = Array.isArray(formConfig.questions) ? formConfig.questions : [];
  els.customFormFields.innerHTML = questions.map((q, index) => `
    <label class="full">${escapeHTML(q.label)}${q.required ? " *" : ""}
      <input name="custom_${index}" ${q.required ? "required" : ""} />
    </label>
  `).join("");
  const intro = $("#view-formulario .form-panel > p");
  if (intro && formConfig.intro) intro.textContent = formConfig.intro;
  if (els.formConfigEditor) {
    els.formConfigEditor.elements.title.value = formConfig.title || "Postulación docente Musicala";
    els.formConfigEditor.elements.intro.value = formConfig.intro || "";
    els.formConfigEditor.elements.questions.value = questions.map(q => `${q.label}${q.required ? "*" : ""}`).join("\n");
  }
  if (els.baseFormFieldsEditor) {
    els.baseFormFieldsEditor.innerHTML = BASE_FORM_FIELDS.map(([key, defaultLabel, required]) => {
      const setting = formConfig.fields?.[key] || {};
      const enabled = required || setting.enabled !== false;
      return `
        <div class="field-editor-row">
          <label class="field-toggle">
            <input type="checkbox" name="field_enabled_${escapeHTML(key)}" ${enabled ? "checked" : ""} ${required ? "disabled" : ""} />
            <span>${required ? "Obligatoria" : "Mostrar"}</span>
          </label>
          <label>Texto de la pregunta
            <input name="field_label_${escapeHTML(key)}" value="${escapeHTML(setting.label || defaultLabel)}" />
          </label>
        </div>
      `;
    }).join("");
  }
}

async function saveFormConfig(evt) {
  evt.preventDefault();
  if (!isAdmin()) return;
  const data = Object.fromEntries(new FormData(evt.currentTarget).entries());
  const questions = String(data.questions || "").split(/\n+/).map(v => v.trim()).filter(Boolean).map(line => ({
    label: line.replace(/\*$/, "").trim(),
    required: /\*$/.test(line)
  }));
  const fields = Object.fromEntries(BASE_FORM_FIELDS.map(([key, defaultLabel, required]) => [key, {
    label: String(data[`field_label_${key}`] || defaultLabel).trim(),
    enabled: required || data[`field_enabled_${key}`] === "on",
    required
  }]));
  await setDoc(doc(db, "config", "formulario"), {
    title: String(data.title || "Postulación docente Musicala").trim(),
    intro: String(data.intro || "").trim(),
    fields,
    questions,
    updatedAt: serverTimestamp()
  }, { merge: true });
  $("#formConfigStatus").textContent = "Formulario actualizado.";
  if (els.publicFormPreview) els.publicFormPreview.src = `./formulario.html?preview=${Date.now()}`;
}

function statusBadgeClass(teacher) {
  const status = normalize(teacher.estado);
  const priority = normalize(teacher.prioridad);
  if (priority === "alta" || priority === "urgente") return "badge high status";
  if (["opcionado", "seleccionada hv", "contratado"].includes(status)) return "badge good status";
  if (["descartado"].includes(status)) return "badge bad status";
  if (["entrevistado", "en proceso de entrevista", "contactado"].includes(status)) return "badge warn status";
  return "badge status";
}

function teacherCardHTML(t, extra = "") {
  const phone = cleanPhone(t.celular);
  const whatsapp = phone ? `https://wa.me/57${phone}?text=${encodeURIComponent(defaultWhatsAppMessage(t))}` : "#";
  const mail = t.email ? `mailto:${t.email}?subject=${encodeURIComponent("Proceso docente Musicala")}` : "#";
  const meta = [t.celular, t.email, t.localidad].filter(Boolean).join(" · ");
  const areas = (t.areas || []).slice(0, 4).map(a => `<span class="chip">${escapeHTML(a)}</span>`).join("");
  const subareas = (t.subareas || []).slice(0, 9).join(", ");
  const notes = t.notas || t.resena || t.entrevistaAlek || t.entrevistaCata || "";

  return `
    <article class="teacher-card" data-id="${escapeHTML(t.id)}">
      <div class="card-top">
        <div>
          <h3 class="teacher-name">${escapeHTML(t.nombre || "Sin nombre")}</h3>
          <p class="teacher-meta">${escapeHTML(meta || "Sin datos de contacto")}</p>
        </div>
        <span class="${statusBadgeClass(t)}">${escapeHTML(t.estado || "Nuevo")}</span>
      </div>
      <div class="chip-row areas">${areas || `<span class="chip">Sin área</span>`}</div>
      <p class="teacher-subareas">${escapeHTML(subareas || "Sin subáreas registradas")}</p>
      ${extra}
      <p class="teacher-notes">${escapeHTML(notes || "Sin notas internas todavía.")}</p>
      <div class="card-actions">
        <button class="btn mini subtle details-btn" data-details="${escapeHTML(t.id)}">Ver ficha completa</button>
        <a class="btn mini whatsapp ${phone ? "" : "hidden"}" target="_blank" rel="noreferrer" href="${whatsapp}">WhatsApp</a>
        <a class="btn mini email-link ${t.email ? "" : "hidden"}" href="${mail}">Correo</a>
        <a class="btn mini hv-link ${t.hvUrl ? "" : "hidden"}" href="${escapeHTML(t.hvUrl || "#")}" target="_blank" rel="noreferrer">HV</a>
        <a class="btn mini hv-link ${t.portafolioUrl ? "" : "hidden"}" href="${escapeHTML(t.portafolioUrl || "#")}" target="_blank" rel="noreferrer">Portafolio</a>
        <button class="btn mini subtle edit-btn admin-only ${isAdmin() ? "" : "hidden"}" data-edit="${escapeHTML(t.id)}">Editar</button>
      </div>
    </article>
  `;
}

function bindTeacherCardActions(root) {
  $$(".details-btn", root).forEach(btn => {
    btn.addEventListener("click", () => openTeacherDetails(btn.dataset.details));
  });
  $$(".edit-btn", root).forEach(btn => {
    btn.addEventListener("click", () => openTeacherDialog(btn.dataset.edit));
  });
}

function detailRow(label, value) {
  if (value === undefined || value === null || value === "") return "";
  const display = Array.isArray(value) ? value.join(", ") : value;
  if (!String(display).trim()) return "";
  return `<div class="detail-row"><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(display)}</dd></div>`;
}

function detailLink(label, url) {
  if (!url) return "";
  return `<a class="btn subtle" href="${escapeHTML(url)}" target="_blank" rel="noreferrer">${escapeHTML(label)}</a>`;
}

function openTeacherDetails(id) {
  const t = teachers.find(item => item.id === id);
  if (!t || !isAdmin()) return;
  els.teacherDetailsTitle.textContent = t.nombre || "Información completa";
  const evaluation = t.evaluacion || {};
  els.teacherDetailsContent.innerHTML = `
    <section class="detail-section">
      <h3>Datos personales y contacto</h3>
      <dl class="detail-grid">
        ${detailRow("Documento", t.tipoDocumento || t.documento)}
        ${detailRow("Fecha de nacimiento", t.fechaNacimiento)}
        ${detailRow("Celular", t.celular)}
        ${detailRow("Teléfono fijo", t.telefonoFijo)}
        ${detailRow("Correo", t.email)}
        ${detailRow("Localidad o municipio", t.localidad)}
        ${detailRow("Dirección", t.direccion)}
        ${detailRow("Transporte", t.transporte)}
      </dl>
    </section>
    <section class="detail-section">
      <h3>Perfil docente y artístico</h3>
      <dl class="detail-grid">
        ${detailRow("Estado", t.estado)}
        ${detailRow("Equipo actual", t.equipoActual ? "Sí" : "No")}
        ${detailRow("Prioridad", t.prioridad)}
        ${detailRow("Áreas", t.areas)}
        ${detailRow("Instrumentos, estilos y énfasis", t.subareas)}
        ${detailRow("Modalidades", t.modalidades)}
        ${detailRow("Disponibilidad", [...(t.disponibilidad?.dias || []), ...(t.disponibilidad?.franjas || [])])}
        ${detailRow("Fecha de postulación", t.fechaPostulacion || t.createdAtExcel)}
        ${detailRow("Fuente", t.fuente)}
      </dl>
      ${t.resena ? `<div class="detail-long"><strong>Reseña docente</strong><p>${escapeHTML(t.resena)}</p></div>` : ""}
      ${t.notas ? `<div class="detail-long"><strong>Notas internas</strong><p>${escapeHTML(t.notas)}</p></div>` : ""}
    </section>
    <section class="detail-section">
      <h3>Seguimiento del proceso</h3>
      <dl class="detail-grid">
        ${detailRow("Fecha de entrevista", t.fechaEntrevista)}
        ${detailRow("Entrevista virtual Alek", evaluation.entrevistaVirtualAlek || t.entrevistaAlek)}
        ${detailRow("Entrevista virtual Cata", evaluation.entrevistaVirtualCata || t.entrevistaCata)}
        ${detailRow("Entrevista presencial", evaluation.entrevistaPresencial || t.entrevistaPresencial)}
        ${detailRow("Prueba", evaluation.prueba || t.prueba)}
        ${detailRow("Opcionado por Alek", evaluation.opcionadoAlek)}
        ${detailRow("Opcionado por Cata", evaluation.opcionadoCata)}
      </dl>
    </section>
    <div class="detail-links">
      ${detailLink("Abrir hoja de vida", t.hvUrl)}
      ${detailLink("Ver portafolio", t.portafolioUrl)}
      ${detailLink("Ver ubicación", t.googleMaps)}
    </div>
  `;
  els.teacherDetailsDialog.showModal();
}

function defaultWhatsAppMessage(teacher) {
  const ctx = lastReplacementContext || {};
  const base = `Hola ${teacher.nombre || ""} 😊 te habla Musicala.`;
  if (ctx.area || ctx.subarea || ctx.date || ctx.time || ctx.place) {
    return `${base} ¿Tienes disponibilidad para cubrir una clase de ${ctx.area || "artes"} ${ctx.subarea ? `(${ctx.subarea})` : ""} ${ctx.date ? `el ${ctx.date}` : ""} ${ctx.time ? `en la franja ${ctx.time}` : ""} ${ctx.place ? `en ${ctx.place}` : ""}?`;
  }
  return `${base} Queremos revisar tu disponibilidad para posibles clases o reemplazos docentes.`;
}

function weekdayFromDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  return days[date.getDay()];
}

function scoreTeacherForReplacement(teacher, ctx) {
  let score = 0;
  const reasons = [];
  const text = teacher.searchText || makeSearchText(teacher);
  const area = normalize(ctx.area);
  const sub = normalize(ctx.subarea);
  const mode = normalize(ctx.mode);
  const place = normalize(ctx.place);
  const weekday = normalize(weekdayFromDate(ctx.date));
  const time = normalize(ctx.time);

  if (area && (teacher.areas || []).some(a => normalize(a) === area)) {
    score += 32; reasons.push("área");
  }
  if (sub && ((teacher.subareas || []).some(s => normalize(s).includes(sub) || sub.includes(normalize(s))) || text.includes(sub))) {
    score += 28; reasons.push("subárea");
  }
  if (mode && (teacher.modalidades || []).some(m => normalize(m).includes(mode))) {
    score += 12; reasons.push("modalidad");
  }
  if (place && normalize(teacher.localidad).includes(place)) {
    score += 10; reasons.push("zona");
  }
  if (weekday && (teacher.disponibilidad?.dias || []).some(d => normalize(d).includes(weekday))) {
    score += 14; reasons.push("día");
  }
  if (time && (teacher.disponibilidad?.franjas || []).some(f => time.includes(normalize(f)) || normalize(f).includes(time))) {
    score += 8; reasons.push("franja");
  }

  const status = normalize(teacher.estado);
  const priority = normalize(teacher.prioridad);
  if (["contratado", "opcionado", "seleccionada hv"].includes(status)) {
    score += 16; reasons.push("validado");
  } else if (["entrevistado", "en proceso de entrevista", "contactado"].includes(status)) {
    score += 9; reasons.push("contacto previo");
  }

  if (priority === "alta" || priority === "urgente") {
    score += 9; reasons.push("prioridad");
  }

  if (teacher.scoreManual && Number(teacher.scoreManual) >= 24) {
    score += 8; reasons.push("puntaje interno");
  }

  const transport = normalize(teacher.transporte);
  if (["moto", "carro", "bicicleta"].some(t => transport.includes(t))) {
    score += 4; reasons.push("movilidad");
  }

  if (!ctx.area && !ctx.subarea) score += 1;
  return { score, reasons: uniqueArray(reasons) };
}

function runReplacementSearch() {
  lastReplacementContext = {
    area: $("#repArea").value,
    subarea: $("#repSubarea").value,
    date: "",
    time: "",
    place: "",
    mode: ""
  };

  const ranked = teachers
    .map(t => ({ ...t, _rank: scoreTeacherForReplacement(t, lastReplacementContext) }))
    .filter(t => t._rank.score > 0 || (!lastReplacementContext.area && !lastReplacementContext.subarea))
    .sort((a, b) => b._rank.score - a._rank.score)
    .slice(0, 30);

  els.replacementSummary.textContent = ranked.length
    ? `${ranked.length} perfiles sugeridos. Revisa score y razones antes de escribirles, no seamos robots con WhatsApp.`
    : "No encontré perfiles fuertes con esos criterios.";

  els.replacementResults.innerHTML = ranked.length
    ? ranked.map(t => teacherCardHTML(t, `
        <div class="chip-row">
          <span class="badge high">Fit ${t._rank.score}</span>
          ${t._rank.reasons.map(r => `<span class="chip">${escapeHTML(r)}</span>`).join("")}
        </div>
      `)).join("")
    : `<p class="muted">Prueba quitando localidad o subárea. A veces el reemplazo perfecto existe, pero está en clase, en TransMilenio o en otra dimensión.</p>`;

  bindTeacherCardActions(els.replacementResults);
}

function clearReplacementSearch() {
  ["#repArea", "#repSubarea"].forEach(sel => $(sel).value = "");
  lastReplacementContext = {};
  els.replacementSummary.textContent = "Aún no has buscado reemplazo.";
  els.replacementResults.innerHTML = "";
}

function renderApplications() {
  if (!isTeam()) return;
  if (!applications.length) {
    els.applicationsList.innerHTML = `<p class="muted">No hay postulaciones todavía.</p>`;
    return;
  }

  els.applicationsList.innerHTML = applications.map(app => `
    <article class="teacher-card" data-application="${escapeHTML(app.id)}">
      <div class="card-top">
        <div>
          <h3 class="teacher-name">${escapeHTML(app.nombre)}</h3>
          <p class="teacher-meta">${escapeHTML([app.celular, app.email, app.localidad].filter(Boolean).join(" · "))}</p>
        </div>
        <span class="badge warn">${escapeHTML(app.estado || "Nueva")}</span>
      </div>
      <div class="chip-row">${(app.areas || [app.areaPrincipal]).filter(Boolean).map(a => `<span class="chip">${escapeHTML(a)}</span>`).join("")}</div>
      <p class="teacher-subareas">${escapeHTML((app.subareas || []).join(", ") || app.subareasTexto || "Sin subáreas")}</p>
      <p class="teacher-notes">${escapeHTML(app.resena || "Sin reseña.")}</p>
      <div class="card-actions">
        <a class="btn mini ${app.celular ? "" : "hidden"}" target="_blank" rel="noreferrer" href="https://wa.me/57${cleanPhone(app.celular)}">WhatsApp</a>
        <a class="btn mini ${app.email ? "" : "hidden"}" href="mailto:${escapeHTML(app.email)}">Correo</a>
        <a class="btn mini ${app.hvUrl ? "" : "hidden"}" href="${escapeHTML(app.hvUrl || "#")}" target="_blank" rel="noreferrer">HV</a>
        <button class="btn mini primary promote-btn admin-only" data-promote="${escapeHTML(app.id)}">Pasar a base</button>
      </div>
    </article>
  `).join("");

  $$(".promote-btn", els.applicationsList).forEach(btn => {
    btn.addEventListener("click", () => promoteApplication(btn.dataset.promote));
  });
}

async function promoteApplication(id) {
  if (!isAdmin()) return;
  const app = applications.find(a => a.id === id);
  if (!app) return;

  const baseId = `${slugify(app.email || app.celular || app.nombre)}-${await hashId(app.id)}`;
  const teacher = {
    nombre: app.nombre || "",
    email: app.email || "",
    celular: cleanPhone(app.celular || ""),
    localidad: app.localidad || "",
    transporte: app.transporte || "",
    areas: app.areas?.length ? app.areas : [app.areaPrincipal].filter(Boolean),
    areaPrincipal: app.areaPrincipal || app.areas?.[0] || "",
    subareas: app.subareas || asArray(app.subareasTexto),
    modalidades: app.modalidades || asArray(app.modalidadesTexto),
    estado: "Nuevo",
    prioridad: "Media",
    fuente: "Formulario público",
    fechaPostulacion: new Date().toISOString().slice(0, 10),
    hvUrl: app.hvUrl || "",
    portafolioUrl: app.portafolioUrl || "",
    resena: app.resena || "",
    notas: "Promovido desde postulaciones.",
    disponibilidad: app.disponibilidad || { dias: [], franjas: [] },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  teacher.searchText = makeSearchText(teacher);

  await setDoc(doc(db, "docentes", baseId), teacher, { merge: true });
  await setDoc(doc(db, "postulaciones", id), { estado: "Promovida", promotedTeacherId: baseId, updatedAt: serverTimestamp() }, { merge: true });
}

function teacherFromForm(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const areas = uniqueArray(asArray(data.areas));
  const subareas = uniqueArray(asArray(data.subareas));
  const modalidades = uniqueArray(asArray(data.modalidades));
  const teacher = {
    nombre: data.nombre?.trim() || "",
    celular: cleanPhone(data.celular),
    email: data.email?.trim().toLowerCase() || "",
    localidad: data.localidad?.trim() || "",
    transporte: data.transporte || "",
    areas,
    areaPrincipal: areas[0] || "",
    subareas,
    modalidades,
    estado: data.estado || "Nuevo",
    prioridad: data.prioridad || "Media",
    equipoActual: data.equipoActual === "on" || data.estado === "Contratado",
    hvUrl: data.hvUrl?.trim() || "",
    portafolioUrl: data.portafolioUrl?.trim() || "",
    notas: data.notas?.trim() || "",
    disponibilidad: {
      dias: uniqueArray(asArray(data.dias)),
      franjas: uniqueArray(asArray(data.franjas))
    },
    fuente: "Carga manual",
    updatedAt: serverTimestamp()
  };
  teacher.searchText = makeSearchText(teacher);
  return { id: data.id, teacher };
}

function fillTeacherForm(t = {}) {
  els.teacherForm.reset();
  els.teacherForm.elements.id.value = t.id || "";
  els.teacherForm.elements.nombre.value = t.nombre || "";
  els.teacherForm.elements.celular.value = t.celular || "";
  els.teacherForm.elements.email.value = t.email || "";
  els.teacherForm.elements.localidad.value = t.localidad || "";
  els.teacherForm.elements.transporte.value = t.transporte || "";
  els.teacherForm.elements.estado.value = t.estado || "Nuevo";
  els.teacherForm.elements.prioridad.value = t.prioridad || "Media";
  els.teacherForm.elements.equipoActual.checked = !!t.equipoActual || normalize(t.estado) === "contratado";
  els.teacherForm.elements.areas.value = (t.areas || []).join(", ");
  els.teacherForm.elements.subareas.value = (t.subareas || []).join(", ");
  els.teacherForm.elements.modalidades.value = (t.modalidades || []).join(", ");
  els.teacherForm.elements.dias.value = (t.disponibilidad?.dias || []).join(", ");
  els.teacherForm.elements.franjas.value = (t.disponibilidad?.franjas || []).join(", ");
  els.teacherForm.elements.hvUrl.value = t.hvUrl || "";
  els.teacherForm.elements.portafolioUrl.value = t.portafolioUrl || "";
  els.teacherForm.elements.notas.value = t.notas || "";
}

function openTeacherDialog(id = "") {
  if (!isAdmin()) return;
  const teacher = teachers.find(t => t.id === id);
  fillTeacherForm(teacher || {});
  els.teacherDialogTitle.textContent = teacher ? "Editar docente" : "Agregar docente";
  els.deleteTeacherBtn.classList.toggle("hidden", !teacher || !isAdmin());
  els.teacherDialog.showModal();
}

async function saveTeacherFromDialog(evt) {
  evt.preventDefault();
  if (!isAdmin()) return;

  const { id, teacher } = teacherFromForm(els.teacherForm);
  let finalId = id;
  if (!finalId) {
    finalId = `${slugify(teacher.email || teacher.celular || teacher.nombre)}-${await hashId(`${teacher.nombre}${teacher.email}${teacher.celular}${Date.now()}`)}`;
    teacher.createdAt = serverTimestamp();
  }

  await setDoc(doc(db, "docentes", finalId), teacher, { merge: true });
  els.teacherDialog.close();
}

async function deleteCurrentTeacher() {
  if (!isAdmin()) return;
  const id = els.teacherForm.elements.id.value;
  if (!id) return;
  const ok = confirm("¿Eliminar este docente de la base? Esto no borra el Excel original, pero sí este registro en Firestore.");
  if (!ok) return;
  await deleteDoc(doc(db, "docentes", id));
  els.teacherDialog.close();
}

async function submitPublicApplication(evt) {
  evt.preventDefault();
  const form = evt.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const area = data.areaPrincipal;
  const customAnswers = {};
  (formConfig.questions || []).forEach((question, index) => {
    customAnswers[question.label] = String(data[`custom_${index}`] || "").trim();
  });
  const application = {
    nombre: data.nombre?.trim() || "",
    email: data.email?.trim().toLowerCase() || "",
    celular: cleanPhone(data.celular),
    localidad: data.localidad?.trim() || "",
    transporte: data.transporte || "",
    areaPrincipal: area,
    areas: [area].filter(Boolean),
    subareas: uniqueArray(asArray(data.subareas)),
    subareasTexto: data.subareas || "",
    modalidades: uniqueArray(asArray(data.modalidades)),
    modalidadesTexto: data.modalidades || "",
    disponibilidadTexto: data.disponibilidad || "",
    disponibilidad: {
      dias: [],
      franjas: uniqueArray(asArray(data.disponibilidad))
    },
    hvUrl: data.hvUrl?.trim() || "",
    portafolioUrl: data.portafolioUrl?.trim() || "",
    resena: data.resena?.trim() || "",
    consentimiento: data.consentimiento === "on",
    customAnswers,
    estado: "Nueva",
    source: "formulario_publico",
    createdAt: serverTimestamp()
  };
  application.searchText = makeSearchText(application);

  $("#formStatus").textContent = "Enviando...";
  try {
    await addDoc(collection(db, "postulaciones"), application);
    $("#formStatus").textContent = "Postulación enviada. Gracias por querer hacer parte de Musicala 💜";
    form.reset();
  } catch (err) {
    $("#formStatus").textContent = `No se pudo enviar: ${err.message}`;
  }
}

async function importSeedTeachers() {
  if (!isAdmin()) return;
  els.importLog.textContent = "";
  logImport("Leyendo seed-docentes.json...");
  const response = await fetch("./data/seed-docentes.json");
  const payload = await response.json();
  const docs = payload.docentes || [];

  logImport(`Encontrados ${docs.length} docentes. Iniciando carga por lotes.`);
  let batch = writeBatch(db);
  let count = 0;
  let batchCount = 0;

  for (const item of docs) {
    const id = item.id || `${slugify(item.email || item.celular || item.nombre)}-${count}`;
    const ref = doc(db, "docentes", id);
    const data = {
      ...item,
      id,
      searchText: item.searchText || makeSearchText(item),
      importedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    batch.set(ref, data, { merge: true });
    count++;
    batchCount++;

    if (batchCount >= 450) {
      await batch.commit();
      logImport(`Lote guardado. Total parcial: ${count}`);
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  logImport(`Listo. ${count} docentes importados/actualizados. El Excel puede llorar en silencio.`);
}

async function importNeeds() {
  if (!isAdmin()) return;
  logImport("Leyendo seed-necesidades.json...");
  const response = await fetch("./data/seed-necesidades.json");
  const payload = await response.json();
  const items = payload.necesidades || [];
  const batch = writeBatch(db);

  items.forEach(item => {
    const id = slugify(`${item.area}-${item.subarea}`);
    batch.set(doc(db, "necesidades", id), {
      ...item,
      id,
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  await batch.commit();
  logImport(`${items.length} necesidades cargadas/actualizadas.`);
}

function exportTeachersCSV() {
  const rows = teachers.filter(teacherMatchesFilters);
  const headers = ["nombre", "celular", "email", "areas", "subareas", "localidad", "transporte", "modalidades", "estado", "prioridad", "notas", "hvUrl", "portafolioUrl"];
  const csv = [
    headers.join(","),
    ...rows.map(row => headers.map(h => {
      const value = Array.isArray(row[h]) ? row[h].join(" | ") : (row[h] ?? "");
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(","))
  ].join("\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `docentes-musicala-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function copyFormLink() {
  const basePath = location.pathname.replace(/[^/]*$/, "");
  const link = `${location.origin}${basePath}formulario.html`;
  navigator.clipboard?.writeText(link);
  showNotice("Link del formulario copiado. Compártelo con candidatos y que el algoritmo haga su mini magia.", "ok");
  setTimeout(hideNotice, 3500);
}

function renderTeamConfig() {
  if (!els.teamConfig) return;
  els.teamConfig.innerHTML = TEAM_EMAILS.map(email => `
    <div class="team-row">
      <span>${escapeHTML(email)}</span>
      <strong>${ADMIN_EMAILS.includes(email) ? "admin" : "viewer"}</strong>
    </div>
  `).join("");
}

function bindEvents() {
  els.loginBtn.addEventListener("click", () => signInWithPopup(auth, provider));
  els.logoutBtn.addEventListener("click", () => signOut(auth));
  $("#copyFormLinkBtn").addEventListener("click", copyFormLink);

  ["#searchInput", "#areaFilter", "#subareaFilter", "#localityFilter", "#modeFilter", "#statusFilter"].forEach(sel => {
    $(sel).addEventListener("input", renderTeachers);
    $(sel).addEventListener("change", renderTeachers);
  });

  $("#runReplacementBtn").addEventListener("click", runReplacementSearch);
  $("#clearReplacementBtn").addEventListener("click", clearReplacementSearch);
  $("#openNewTeacherBtn").addEventListener("click", () => openTeacherDialog());
  $("#closeTeacherDialog").addEventListener("click", () => els.teacherDialog.close());
  $("#cancelTeacherBtn").addEventListener("click", () => els.teacherDialog.close());
  els.teacherForm.addEventListener("submit", saveTeacherFromDialog);
  els.deleteTeacherBtn.addEventListener("click", deleteCurrentTeacher);
  $("#closeTeacherDetails").addEventListener("click", () => els.teacherDetailsDialog.close());
  $("#closeTeacherDetailsBottom").addEventListener("click", () => els.teacherDetailsDialog.close());
  $("#addNeedBtn").addEventListener("click", () => openNeedDialog());
  $("#closeNeedDialog").addEventListener("click", () => els.needDialog.close());
  $("#cancelNeedBtn").addEventListener("click", () => els.needDialog.close());
  els.needForm.addEventListener("submit", saveNeed);
  els.deleteNeedBtn.addEventListener("click", deleteNeed);
  $("#publicApplicationForm").addEventListener("submit", submitPublicApplication);
  els.formConfigEditor?.addEventListener("submit", saveFormConfig);
  $("#exportCsvBtn").addEventListener("click", exportTeachersCSV);
}

onAuthStateChanged(auth, user => {
  currentUser = user;
  currentRole = roleForEmail(user?.email);
  setRoleUI();

  if (isTeam()) {
    startListeners();
  } else {
    stopListeners();
    teachers = [];
    applications = [];
    needs = [];
    renderAll();
    renderApplications();
  }
});

setupNavigation();
bindEvents();
renderTeamConfig();
renderAll();
onSnapshot(doc(db, "config", "formulario"), snapshot => {
  if (snapshot.exists()) formConfig = { ...formConfig, ...snapshot.data() };
  renderFormConfig();
}, () => renderFormConfig());
