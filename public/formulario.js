import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, collection, doc, addDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDlq2E1cnQey1oMoosMPRlizbRNhbO9CBw",
  authDomain: "vacante-docentes.firebaseapp.com",
  projectId: "vacante-docentes",
  storageBucket: "vacante-docentes.firebasestorage.app",
  messagingSenderId: "205007755547",
  appId: "1:205007755547:web:6204ed1e05b18ba3e89bbe"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);
const form = document.querySelector("#applicationForm");
const fileInput = document.querySelector("#hvFile");
const fileName = document.querySelector("#fileName");
const status = document.querySelector("#formStatus");
const submitBtn = document.querySelector("#submitBtn");
const uploadBox = document.querySelector("#uploadBox");
const additionalSection = document.querySelector("#additionalQuestionsSection");
const additionalQuestions = document.querySelector("#additionalQuestions");
let liveFormConfig = { questions: [], fields: {} };
const allowedTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const text = (data, key) => String(data.get(key) || "").trim();
const cleanPhone = value => String(value || "").replace(/\D/g, "").slice(-10);
const normalize = value => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

function fieldContainer(name) {
  const control = form.querySelector(`[name="${name}"]`);
  return name === "modalidades" ? control?.closest("fieldset") : control?.closest("label");
}

function replaceLabelText(container, label, required) {
  if (!container) return;
  if (container.tagName === "FIELDSET") {
    container.querySelector("legend").innerHTML = `${label}${required ? " <b>*</b>" : ""}`;
    return;
  }
  if (container.classList.contains("upload-box")) {
    container.querySelector("strong").innerHTML = `${label}${required ? " <b>*</b>" : ""}`;
    return;
  }
  const textNode = [...container.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (textNode) textNode.textContent = `${label} `;
}

function applyFormConfig(config = {}) {
  liveFormConfig = { questions: [], fields: {}, ...config };
  const title = liveFormConfig.title || "Postulación docente Musicala";
  document.title = title;
  document.querySelector(".form-header h1").textContent = title;
  if (liveFormConfig.intro) document.querySelector(".form-header p").textContent = liveFormConfig.intro;

  Object.entries(liveFormConfig.fields || {}).forEach(([name, setting]) => {
    const container = fieldContainer(name);
    if (!container) return;
    container.classList.toggle("hidden", setting.enabled === false && !setting.required);
    replaceLabelText(container, setting.label || name, !!setting.required);
  });

  const questions = Array.isArray(liveFormConfig.questions) ? liveFormConfig.questions : [];
  additionalSection.classList.toggle("hidden", !questions.length);
  additionalQuestions.innerHTML = questions.map((question, index) => `
    <label>${question.label}${question.required ? " <b>*</b>" : ""}
      <input name="custom_${index}" ${question.required ? "required" : ""} />
    </label>
  `).join("");
}

onSnapshot(doc(db, "config", "formulario"), snapshot => {
  applyFormConfig(snapshot.exists() ? snapshot.data() : {});
}, () => applyFormConfig({}));

function validateFile(file) {
  if (!file) throw new Error("Debes seleccionar tu hoja de vida.");
  if (file.size > 10 * 1024 * 1024) throw new Error("La hoja de vida supera el máximo de 10 MB.");
  const extensionOk = /\.(pdf|doc|docx)$/i.test(file.name);
  if (!allowedTypes.has(file.type) && !extensionOk) throw new Error("La hoja de vida debe ser PDF, DOC o DOCX.");
}

fileInput.addEventListener("change", () => {
  fileName.textContent = fileInput.files[0]?.name || "Ningún archivo seleccionado";
});
["dragenter", "dragover"].forEach(event => uploadBox.addEventListener(event, () => uploadBox.classList.add("dragging")));
["dragleave", "drop"].forEach(event => uploadBox.addEventListener(event, () => uploadBox.classList.remove("dragging")));

form.addEventListener("submit", async event => {
  event.preventDefault();
  status.className = "";
  status.textContent = "";
  submitBtn.disabled = true;

  try {
    const data = new FormData(form);
    const file = fileInput.files[0];
    validateFile(file);
    if (!data.getAll("modalidades").length) throw new Error("Selecciona al menos una modalidad.");
    const submissionId = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100);
    const storagePath = `postulaciones/${submissionId}/hoja-de-vida-${safeName}`;

    status.textContent = "Subiendo hoja de vida…";
    const snapshot = await uploadBytes(ref(storage, storagePath), file, {
      contentType: file.type || "application/octet-stream",
      customMetadata: { submissionId }
    });
    const hvUrl = await getDownloadURL(snapshot.ref);
    const modalidades = data.getAll("modalidades").map(String);
    const areaPrincipal = text(data, "areaPrincipal");
    const instrumento = text(data, "instrumento");
    const extras = [text(data, "otraArea1"), text(data, "otraArea2"), text(data, "otraArea3")].filter(Boolean);
    const customAnswers = Object.fromEntries((liveFormConfig.questions || []).map((question, index) => [
      question.label,
      text(data, `custom_${index}`)
    ]));

    status.textContent = "Guardando postulación…";
    await addDoc(collection(db, "postulaciones"), {
      submissionId,
      nombre: text(data, "nombre"),
      documento: text(data, "documento"),
      fechaNacimiento: text(data, "fechaNacimiento"),
      localidad: text(data, "localidad"),
      direccion: text(data, "direccion"),
      email: text(data, "email").toLowerCase(),
      celular: cleanPhone(text(data, "celular")),
      telefonoFijo: cleanPhone(text(data, "telefonoFijo")),
      transporte: text(data, "transporte"),
      areaPrincipal,
      areas: [areaPrincipal, ...extras],
      clases: areaPrincipal,
      instrumento,
      subareas: [instrumento, text(data, "estilos"), text(data, "enfasis")].filter(Boolean),
      otraArea1: text(data, "otraArea1"),
      estilos: text(data, "estilos"),
      otraArea2: text(data, "otraArea2"),
      enfasis: text(data, "enfasis"),
      otraArea3: text(data, "otraArea3"),
      modalidades,
      modalidadesTexto: modalidades.join(", "),
      disponibilidadTexto: text(data, "disponibilidad"),
      disponibilidad: { dias: [], franjas: [text(data, "disponibilidad")] },
      resena: text(data, "resena"),
      portafolioUrl: text(data, "portafolioUrl"),
      googleMaps: text(data, "googleMaps"),
      comentarios: text(data, "comentarios"),
      customAnswers,
      hvUrl,
      hvStoragePath: storagePath,
      hvFileName: file.name,
      hvContentType: snapshot.metadata.contentType || file.type,
      hvSize: file.size,
      consentimiento: data.get("consentimiento") === "on",
      estado: "Nueva",
      source: "formulario_publico",
      searchText: normalize([text(data, "nombre"), text(data, "email"), areaPrincipal, instrumento, ...extras].join(" ")),
      createdAt: serverTimestamp()
    });

    form.reset();
    fileName.textContent = "Ningún archivo seleccionado";
    status.className = "success";
    status.textContent = "Tu postulación fue enviada correctamente. ¡Gracias!";
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    console.error(error);
    status.className = "error";
    status.textContent = error.message || "No fue posible enviar la postulación.";
  } finally {
    submitBtn.disabled = false;
  }
});
