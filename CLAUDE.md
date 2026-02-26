# BGTime — Guía de desarrollo

## ¿Qué es BGTime?

BGTime es una **PWA (Progressive Web App)** para móvil que actúa como temporizador y
contador de puntuación para juegos de mesa. Está diseñada para ser instalable en iOS/Android
y funcionar sin servidor propio: todo el frontend es estático y el backend es Firebase.

---

## Estructura del proyecto

```
BGTimeDEV/
├── index.html          # HTML puro (~960 líneas). Sin scripts inline ni estilos.
├── styles.css          # Todo el CSS de la app (~3300 líneas)
├── sw.js               # Service Worker (PWA). Debe estar en la raíz por scope.
├── manifest.json       # Manifiesto PWA
├── favicon.svg
└── js/
    ├── firebase.js     # Módulo ES (type="module"). Firebase Auth + Firestore.
    └── app.js          # Lógica principal de la app (~5100 líneas). Script normal.
```

`js/firebase.js` se carga como `<script type="module">` y expone todo mediante
`window._fb*` para que `app.js` (script normal) pueda llamarlo.

---

## Cómo funciona la app

### Flujo principal

1. El usuario entra en la pantalla de **Setup**: elige juego, jugadores y modo de temporizador.
2. Pasa a la pantalla de **Scoring** donde se registran puntos ronda a ronda (o ítem a ítem).
3. Al terminar llega a **Results**: clasificación final con tiempos y puntuaciones.
4. La partida se guarda automáticamente en el historial.

### Pantallas
La app es **single-page**: todas las pantallas son `<div class="screen">` que se
muestran/ocultan con JS. Las principales son:

| ID | Descripción |
|----|-------------|
| `setupScreen` | Configuración de la partida (juego, jugadores, timer) |
| `scoringScreen` | Introducción de puntuaciones durante la partida |
| `timerScreen` | Temporizador por turno en pantalla completa |
| `resultsScreen` | Resultados finales |
| `historyScreen` | Historial de partidas guardadas |
| `statsScreen` | Estadísticas (por juego, por jugador, VS) |
| `settingsScreen` | Ajustes: perfil, amigos, plantillas, backup |

### Tipos de puntuación (`scoringType`)

Configurables por el usuario al crear un juego:

| Tipo | Descripción |
|------|-------------|
| `rounds` | Puntuación por rondas simples |
| `items` | Ítems con categorías al final de la partida |
| `rounds_with_items` | Rondas con categorías por ronda |
| `target_score` | Hasta llegar a una puntuación objetivo |

### Temporizador

Dos modos:
- **`per_turn`**: cada jugador tiene su propio tiempo por turno
- **`global`**: un único cronómetro para toda la partida

---

## Almacenamiento de datos

### Arquitectura: localStorage + caché en memoria + Firebase

| Clave | Contenido | Sin login | Con login |
|-------|-----------|-----------|-----------|
| `bgtime_history` | Array de partidas (máx. 50) | localStorage | Caché en memoria (`window._memHistory`) |
| `bgtime_frecuent_players` | Array de nombres de jugadores habituales | localStorage | Caché en memoria (`window._memFrecuent`) |
| `bgtime_custom_templates` | Array de plantillas personalizadas | localStorage | Caché en memoria (`window._memTemplates`) |
| `bgtime_state` | Estado de sesión para recuperar partidas interrumpidas | localStorage | localStorage (siempre) |

### Cómo funciona la caché en memoria (cuando logueado)

1. **Login** → se pre-carga la caché desde localStorage (UI inmediata)
2. **`_fbSyncHistory` / `_fbSyncSettings`** → sobrescriben la caché con datos de Firebase
3. **Lecturas** → `getHistory()`, `getFrecuentPlayers()`, `getCustomTemplates()` leen la caché
4. **Escrituras** → actualizan la caché al instante + llaman a Firebase async
5. **Logout** → la caché se persiste en localStorage y se limpia (`null`)

### Helpers de acceso a datos (en `app.js`)

Usar **siempre** estos helpers, nunca acceder a localStorage directamente para los 3 keys principales:

```js
getHistory()              // lee historial
saveHistory(arr)          // guarda historial
removeHistory()           // borra historial
getFrecuentPlayers()      // lee jugadores habituales
saveFrecuentPlayers(list) // guarda jugadores habituales
getCustomTemplates()      // lee plantillas personalizadas
saveCustomTemplates(list) // guarda plantillas personalizadas
```

### Estructura de una entrada de historial

```js
{
  id,               // timestamp de creación (número)
  date,             // fecha legible
  gameName,
  emoji,
  scoringType,
  results,          // array de { player, score, ... } ordenado por puntuación
  usedTimer,        // boolean
  orderedPlayers,   // array de nombres en orden de turno
  playerTotalTimes, // array de tiempos en ms (paralelo a orderedPlayers)
  // Campos variables según scoringType:
  roundScores, items, itemScores, roundItems, roundItemScores,
  numRounds, targetScore, roundScoringMode,
  // Solo si fue compartida por un amigo:
  sharedBy: { uid, nickname },
  sharedAt
}
```

---

## Firebase

### Servicios usados
- **Firebase Auth** — login con Google
- **Cloud Firestore** — almacenamiento de datos de usuario

### Colecciones de Firestore

| Ruta | Contenido |
|------|-----------|
| `users/{uid}/history/{entryId}` | Partidas del usuario (máx. 100 en Firestore) |
| `users/{uid}/settings/data` | Jugadores habituales y plantillas personalizadas |
| `users/{uid}/profile/data` | Perfil: nickname, colores, código de jugador |
| `playerCodes/{code}` | Índice público de códigos → uid (para búsqueda de amigos) |
| `connections/{uid1_uid2}` | Conexión entre dos jugadores (uids ordenados alfabéticamente) |

### Funciones Firebase expuestas en `window` (desde `firebase.js`)

```js
window._fbIsLoggedIn()          // boolean: ¿está logueado?
window._fbSignIn()              // login con Google
window._fbSignOut()             // cerrar sesión
window._fbSaveEntry(entry)      // sube una partida a Firestore
window._fbDeleteEntry(entryId)  // borrado lógico de una partida
window._fbSyncHistory()         // descarga y fusiona historial desde Firestore
window._fbSaveSettings()        // sube jugadores y plantillas a Firestore
window._fbSyncSettings()        // descarga y fusiona ajustes desde Firestore
window._fbLoadProfile()         // carga perfil del usuario
window._fbSaveProfile(n,c1,c2)  // guarda perfil
window._fbAddConnection(player) // añade un amigo
window._fbRemoveConnection(id)  // elimina un amigo
window._fbFindPlayerByCode(code)// busca jugador por código
```

### Datos de campos anidados
Firestore no admite arrays anidados. Los campos `roundScores`, `itemScores` y
`roundItemScores` se serializan a JSON string antes de guardar y se deserializan
al leer (funciones `serializeForFirestore` / `deserializeFromFirestore` en `firebase.js`).

### Compartir partidas entre amigos
Cuando se guarda una partida, `_fbShareEntryWithFriends` escribe el documento
en el historial de cada amigo que aparezca como jugador (comparando nickname con
nombres de jugadores en `results`). El documento compartido incluye el campo `sharedBy`.
El listener `_fbListenHistory` detecta estos documentos nuevos en tiempo real.

---

## PWA y Service Worker

- El SW usa estrategia **Network first, cache fallback**.
- Firebase, Google Fonts y otros recursos externos **no se cachean** (pasan directo a la red).
- Para forzar una actualización del caché, incrementar `CACHE_VERSION` en `sw.js`.
- El scope del SW es `/BGTime/` (ver `manifest.json`).

---

## Añadir un juego a la biblioteca

Los juegos solo se añaden a través de la interfaz ("Añadir juego" en la biblioteca) o recibiendo una partida compartida por otro usuario. No hay plantillas predefinidas en el código (`games.js` fue eliminado).

---

## Convenciones de código

- **Sin framework**: vanilla JS + CSS custom properties para temas.
- **Sin build tools**: los archivos se sirven tal cual. No hay npm, webpack ni transpilación.
- **Pantallas como HTML strings**: muchas pantallas se generan dinámicamente con template
  literals en `app.js` (funciones `build*Screen`, `render*`, etc.).
- **Funciones globales en `app.js`**: los `onclick` del HTML llaman a funciones globales
  definidas en `app.js`. No hay event delegation general.
- **Tema oscuro/claro**: controlado con `body.dark-theme`. Todos los colores usan
  variables CSS (`--text-primary`, `--container-bg`, etc.) definidas en `styles.css`.
- **Scores negativos**: el campo `negative: true` en los ítems de una plantilla indica
  que ese ítem resta puntos.

---

## Reglas de Firestore

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{uid}/history/{entryId} {
      allow read, write: if request.auth.uid == uid;
      allow create: if request.auth != null
        && request.resource.data.sharedBy.uid == request.auth.uid;
    }

    match /users/{uid}/profile/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    match /users/{uid}/settings/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    match /playerCodes/{code} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.uid;
      allow update: if request.auth != null
        && request.auth.uid == resource.data.uid;
    }

    match /connections/{connectionId} {
      allow read, delete: if request.auth != null
        && request.auth.uid in resource.data.uids;
      allow create, update: if request.auth != null
        && request.auth.uid in request.resource.data.uids;
    }
  }
}
```
