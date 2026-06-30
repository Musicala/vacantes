# Musicala Talento Docente

Aplicativo web con Firebase para administrar una base de docentes, buscar reemplazos rápidamente y recibir nuevas postulaciones desde un formulario público.

## Qué trae

- Panel con login Google.
- Base de docentes con búsqueda local rápida.
- Filtros por área, subárea, localidad, modalidad y estado.
- Módulo de búsqueda de reemplazos con ranking de fit.
- Mensajes de WhatsApp prearmados para contactar profes.
- Formulario público de inscripción docente.
- Vista de postulaciones recibidas.
- Promoción de postulación a base docente.
- Carga inicial desde el Excel entregado.
- Seed limpio: no incluye cédulas, direcciones ni fechas de nacimiento.
- Reglas de Firestore con:
  - lectura interna solo para equipo,
  - escritura/admin solo para admins,
  - creación pública únicamente en `postulaciones`.

## Proyecto Firebase usado

```js
const firebaseConfig = {
  apiKey: "AIzaSyDlq2E1cnQey1oMoosMPRlizbRNhbO9CBw",
  authDomain: "vacante-docentes.firebaseapp.com",
  projectId: "vacante-docentes",
  storageBucket: "vacante-docentes.firebasestorage.app",
  messagingSenderId: "205007755547",
  appId: "1:205007755547:web:6204ed1e05b18ba3e89bbe"
};
```

## Usuarios configurados

Admins:

- alekcaballeromusic@gmail.com
- catalina.medina.leal@gmail.com
- adminmusicala@gmail.com

No existen cuentas de solo lectura: cualquier otro correo únicamente puede usar el formulario público.

## Estructura de Firestore

### `docentes/{id}`

Campos principales:

```js
{
  nombre,
  email,
  celular,
  localidad,
  transporte,
  areas: [],
  areaPrincipal,
  subareas: [],
  modalidades: [],
  estado,
  prioridad,
  disponibilidad: {
    dias: [],
    franjas: []
  },
  hvUrl,
  portafolioUrl,
  resena,
  notas,
  fuente,
  searchText
}
```

### `postulaciones/{id}`

Recibe el formulario público. No entra directo a la base docente.

### `necesidades/{id}`

Lista inicial de áreas y subáreas a cubrir.

## Pasos para instalar

### 1. Activar Firebase Auth

En Firebase Console:

1. Entra al proyecto `vacante-docentes`.
2. Ve a **Authentication**.
3. Activa **Google** como método de acceso.
4. Agrega el dominio donde se alojará la app si Firebase lo pide.

### 2. Crear Firestore

1. Ve a **Firestore Database**.
2. Crea base en modo production.
3. Elige la región que prefieras.
4. Copia el contenido de `firestore.rules` y publícalo.

### 3. Desplegar Hosting

Desde la carpeta del proyecto:

```bash
npm install -g firebase-tools
firebase login
firebase use vacante-docentes
firebase deploy
```

Si no tienes asociado el proyecto localmente:

```bash
firebase use --add
```

Seleccionas `vacante-docentes`.

### 4. Importar datos iniciales

1. Abre la app desplegada.
2. Entra con una cuenta admin.
3. Ve a **Carga inicial**.
4. Haz clic en **Importar / actualizar docentes**.
5. Luego haz clic en **Importar necesidades**.

La importación usa:

- `public/data/seed-docentes.json`
- `public/data/seed-necesidades.json`

## Formulario público

El link público queda así:

```txt
https://TU-DOMINIO.web.app/#formulario
```

También hay botón interno para copiarlo.

## Notas importantes

- La app carga toda la base docente en memoria del navegador para que la búsqueda sea rápida. Con 500-3000 registros funciona bien.
- Si en el futuro la base crece muchísimo, conviene pasar algunos filtros a queries de Firestore.
- El ranking de reemplazos no “decide”, solo ordena por fit:
  - área,
  - subárea,
  - modalidad,
  - localidad,
  - disponibilidad,
  - estado,
  - prioridad,
  - puntaje interno.
- Los datos sensibles del Excel original no fueron importados al seed:
  - cédula,
  - dirección,
  - fecha de nacimiento.

## Personalización rápida

En `public/app.js` puedes ajustar:

- `ADMIN_EMAILS`
- `VIEWER_EMAILS`
- áreas disponibles
- fórmula del ranking en `scoreTeacherForReplacement`
- texto de WhatsApp en `defaultWhatsAppMessage`

Recuerda actualizar también `firestore.rules` si cambias correos o permisos.
