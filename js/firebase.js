        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
        import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
            from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
        import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, orderBy, limit, onSnapshot, where }
            from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

        const firebaseConfig = {
            apiKey: "AIzaSyCOPUjnhEXjRMl-UZEklYmHNJOYEvkp0bI",
            authDomain: "bgtime-bcca8.firebaseapp.com",
            projectId: "bgtime-bcca8",
            storageBucket: "bgtime-bcca8.firebasestorage.app",
            messagingSenderId: "371182076570",
            appId: "1:371182076570:web:d8b1ae5f055c70c56d1523"
        };

        const app  = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db   = getFirestore(app);
        const provider = new GoogleAuthProvider();

        // ── Caché en memoria (activa solo cuando el usuario está logueado) ──
        window._memHistory   = null;
        window._memFrecuent  = null;
        window._memTemplates = null;

        // ── Funciones de sincronización ────────────────────────────

        // IDs que están confirmados en Firestore (para el icono de nube)
        window._syncedIds = new Set();

        // Firestore no admite arrays anidados. Los serializamos a JSON string antes de guardar.
        const NESTED_ARRAY_FIELDS = ['roundScores', 'itemScores', 'roundItemScores'];

        function serializeForFirestore(entry) {
            const out = { ...entry };
            NESTED_ARRAY_FIELDS.forEach(field => {
                if (out[field] !== undefined) {
                    out[field] = JSON.stringify(out[field]);
                }
            });
            return out;
        }

        function deserializeFromFirestore(data) {
            const out = { ...data };
            NESTED_ARRAY_FIELDS.forEach(field => {
                if (typeof out[field] === 'string') {
                    try { out[field] = JSON.parse(out[field]); } catch(e) { out[field] = []; }
                }
            });
            return out;
        }

        // Sube una partida a Firestore
        window._fbSaveEntry = async (entry) => {
            const user = auth.currentUser;
            if (!user) return;
            try {
                const ref = doc(db, 'users', user.uid, 'history', String(entry.id));
                await setDoc(ref, serializeForFirestore(entry));
                window._syncedIds.add(entry.id);
            } catch (e) {
                console.warn('Error guardando en Firestore:', e);
            }
            // Compartir la partida con amigos conectados que participaron en ella
            try {
                await window._fbShareEntryWithFriends(entry);
            } catch (e) {
                console.warn('Error compartiendo partida con amigos:', e);
            }
        };

        // Comparte una partida con los amigos conectados que aparecen en ella
        window._fbShareEntryWithFriends = async (entry) => {
            const user = auth.currentUser;
            if (!user || !window._currentProfile) return;
            // Obtener amigos desde Firestore directamente (puede que _friends no esté cargado aún)
            const q = query(collection(db, 'connections'), where('uids', 'array-contains', user.uid));
            const snap = await getDocs(q);
            const friends = snap.docs.map(d => {
                const data = d.data();
                const otherUid = data.uids.find(u => u !== user.uid);
                const profile = (data.profiles || {})[otherUid] || {};
                return { uid: otherUid, nickname: profile.nickname || '' };
            }).filter(f => f.uid && f.nickname);

            if (friends.length === 0) return;

            // Nombres de jugadores en la partida (normalizados)
            const playerNames = (entry.results || []).map(r => r.player.trim().toLowerCase());

            const myNickname = window._currentProfile.nickname || '';
            const sharedByInfo = {
                uid: user.uid,
                nickname: myNickname
            };

            for (const friend of friends) {
                // Solo compartir si el amigo jugó en la partida
                if (!playerNames.includes(friend.nickname.trim().toLowerCase())) continue;
                try {
                    const sharedEntry = {
                        ...serializeForFirestore(entry),
                        sharedBy: sharedByInfo,
                        sharedAt: Date.now()
                    };
                    const ref = doc(db, 'users', friend.uid, 'history', String(entry.id));
                    // Usamos create implícito: la regla solo permite "create", no "update",
                    // así que si el doc ya existe fallará con permissions y lo ignoramos.
                    // No hacemos getDoc previo porque no tenemos permiso de lectura en historial ajeno.
                    await setDoc(ref, sharedEntry);
                } catch(e) {
                    // "permissions" puede significar que ya existe (regla solo permite create)
                    // o un error real — en ambos casos no bloqueamos el flujo
                    if (e.code !== 'permission-denied') {
                        console.warn('Error compartiendo con', friend.uid, e);
                    }
                }
            }
        };

        // Borra una partida de Firestore
        window._fbDeleteEntry = async (entryId) => {
            const user = auth.currentUser;
            if (!user) return;
            try {
                const ref = doc(db, 'users', user.uid, 'history', String(entryId));
                await setDoc(ref, { id: entryId, deleted: true }, { merge: true });
                window._syncedIds.delete(entryId);
            } catch (e) {
                console.warn('Error borrando en Firestore:', e);
            }
        };

        // Descarga el historial de Firestore y lo fusiona con el local
        window._fbSyncHistory = async () => {
            const user = auth.currentUser;
            if (!user) return;

            if (window._fbSyncing) return;
            window._fbSyncing = true;

            try {
                const col  = collection(db, 'users', user.uid, 'history');
                const q    = query(col, orderBy('id', 'desc'), limit(100));
                const snap = await getDocs(q);
                const allRemote = snap.docs.map(d => d.data());

                // Separar borrados lógicos del resto
                const deletedIds  = new Set(allRemote.filter(e => e.deleted).map(e => String(e.id)));
                const remoteAlive = allRemote.filter(e => !e.deleted).map(d => deserializeFromFirestore(d));

                window._syncedIds = new Set(remoteAlive.map(e => e.id));

                const local = window._memHistory || [];
                const remoteAliveIds = new Set(remoteAlive.map(e => String(e.id)));

                // Partidas locales que no están en Firestore → nuevas, hay que subirlas
                // (excluir las que están marcadas como borradas en Firestore)
                const pendientesSubir = local.filter(e =>
                    !remoteAliveIds.has(String(e.id)) && !deletedIds.has(String(e.id))
                );

                for (const entry of pendientesSubir) {
                    try {
                        const ref = doc(db, 'users', user.uid, 'history', String(entry.id));
                        await setDoc(ref, serializeForFirestore(entry));
                        window._syncedIds.add(entry.id);
                    } catch (uploadErr) {
                        console.warn('Error subiendo partida', entry.id, uploadErr);
                    }
                }

                // Estado final local = vivos en Firestore + nuevos que acabamos de subir
                // Los deletedIds se excluyen aunque estuvieran en local
                const localMap = {};
                local.forEach(e => { localMap[String(e.id)] = e; });
                remoteAlive.forEach(e => { localMap[String(e.id)] = e; });
                pendientesSubir.forEach(e => { localMap[String(e.id)] = e; });

                const merged = Object.values(localMap)
                    .filter(e => !deletedIds.has(String(e.id)))
                    .sort((a, b) => b.id - a.id)
                    .slice(0, 50);

                window._memHistory = merged;

                if (typeof renderHistoryList === 'function') renderHistoryList();

                showSyncToast(pendientesSubir.length > 0
                    ? `Sincronizado ✓ (+${pendientesSubir.length} nuevas)`
                    : 'Sincronizado ✓');

            } catch (e) {
                console.warn('Error sincronizando:', e);
                showSyncToast('Error de sincronización ⚠️');
            } finally {
                window._fbSyncing = false;
            }
        };

        window.showSyncToast = function showSyncToast(msg) {
            let toast = document.getElementById('syncToast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'syncToast';
                toast.style.cssText = `
                    position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);
                    background:#1a1a2e;color:#fff;padding:10px 20px;border-radius:99px;
                    font-size:13px;font-weight:600;opacity:0;transition:all 0.3s ease;
                    z-index:99999;white-space:nowrap;pointer-events:none;
                `;
                document.body.appendChild(toast);
            }
            toast.textContent = msg;
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(20px)';
            }, 3000);
        }

        // ── Sync jugadores habituales ──────────────────────────────

        window._fbSaveSettings = async () => {
            const user = auth.currentUser;
            if (!user) return;
            try {
                const frecuent  = window._memFrecuent  || [];
                const templates = window._memTemplates || [];
                const ref = doc(db, 'users', user.uid, 'settings', 'data');
                await setDoc(ref, { frecuentPlayers: frecuent, customTemplates: templates });
            } catch (e) {
                console.warn('Error guardando ajustes en Firestore:', e);
            }
        };

        window._fbSyncSettings = async () => {
            const user = auth.currentUser;
            if (!user) return;
            try {
                const ref = doc(db, 'users', user.uid, 'settings', 'data');
                const settingsSnap = await getDoc(ref);

                if (!settingsSnap.exists()) {
                    // Primera vez: subir lo que haya en la caché (pre-cargada desde localStorage al login)
                    const frecuent  = window._memFrecuent  || [];
                    const templates = window._memTemplates || [];
                    if (frecuent.length > 0 || templates.length > 0) {
                        await setDoc(ref, {
                            frecuentPlayers: frecuent,
                            customTemplates: templates,
                            deletedPlayers: [],
                            deletedTemplates: []
                        });
                    }
                    return;
                }

                const remote = settingsSnap.data();

                // Listas de borrados en Firestore (fuente de verdad de lo eliminado)
                const deletedPlayers   = new Set(remote.deletedPlayers   || []);
                const deletedTemplates = new Set(remote.deletedTemplates  || []);

                // ── Jugadores habituales ──────────────────────────────
                const localFrecuent  = window._memFrecuent || [];
                const remoteFrecuent = (remote.frecuentPlayers || []).filter(p => !deletedPlayers.has(p));
                // Añadir locales nuevos que no están ni en remoto ni en borrados
                const soloLocalesFrecuent = localFrecuent.filter(p =>
                    !remoteFrecuent.includes(p) && !deletedPlayers.has(p)
                );
                const finalFrecuent = [...remoteFrecuent, ...soloLocalesFrecuent];
                window._memFrecuent = finalFrecuent;

                // ── Plantillas personalizadas ─────────────────────────
                const localTemplates  = window._memTemplates || [];
                const remoteTemplates = (remote.customTemplates || []).filter(t => !deletedTemplates.has(String(t.id)));
                const remoteTemplateIds = new Set(remoteTemplates.map(t => String(t.id)));
                // Añadir locales nuevas que no están ni en remoto ni en borradas
                const soloLocalesTemplates = localTemplates.filter(t =>
                    !remoteTemplateIds.has(String(t.id)) && !deletedTemplates.has(String(t.id))
                );
                const finalTemplates = [...remoteTemplates, ...soloLocalesTemplates]
                    .sort((a, b) => a.name.localeCompare(b.name));
                window._memTemplates = finalTemplates;

                // Subir estado final a Firestore
                await setDoc(ref, {
                    frecuentPlayers: finalFrecuent,
                    customTemplates: finalTemplates,
                    deletedPlayers:  [...deletedPlayers],
                    deletedTemplates: [...deletedTemplates]
                });

                // Refrescar UI
                if (typeof rebuildLibrary === 'function') rebuildLibrary();
                if (typeof renderSettingsScreen === 'function') {
                    const settingsEl = document.getElementById('settingsScreen');
                    if (settingsEl && settingsEl.classList.contains('active')) renderSettingsScreen();
                }

                showSyncToast('Ajustes sincronizados ✓');
            } catch (e) {
                console.warn('Error sincronizando ajustes:', e);
            }
        };

        // Marca un jugador habitual como borrado en Firestore
        window._fbDeletePlayer = async (playerName) => {
            const user = auth.currentUser;
            if (!user) return;
            try {
                const ref = doc(db, 'users', user.uid, 'settings', 'data');
                const snap = await getDoc(ref);
                if (!snap.exists()) return;
                const data = snap.data();
                await setDoc(ref, {
                    ...data,
                    frecuentPlayers: (data.frecuentPlayers || []).filter(p => p !== playerName),
                    deletedPlayers: [...new Set([...(data.deletedPlayers || []), playerName])]
                });
            } catch (e) {
                console.warn('Error borrando jugador en Firestore:', e);
            }
        };

        // Marca una plantilla como borrada en Firestore
        window._fbDeleteTemplate = async (templateId) => {
            const user = auth.currentUser;
            if (!user) return;
            try {
                const ref = doc(db, 'users', user.uid, 'settings', 'data');
                const snap = await getDoc(ref);
                if (!snap.exists()) return;
                const data = snap.data();
                await setDoc(ref, {
                    ...data,
                    customTemplates: (data.customTemplates || []).filter(t => String(t.id) !== String(templateId)),
                    deletedTemplates: [...new Set([...(data.deletedTemplates || []), String(templateId)])]
                });
            } catch (e) {
                console.warn('Error borrando plantilla en Firestore:', e);
            }
        };

        // Exponer funciones globalmente para que los botones HTML las usen
        window._fbIsLoggedIn = () => !!(auth && auth.currentUser);

        window._fbSignIn = () => signInWithPopup(auth, provider).catch(err => {
            console.error("Error en login:", err);
            alert("No se pudo iniciar sesión. Inténtalo de nuevo.");
        });

        window._fbSignOut = () => signOut(auth);

        // ── Perfil de jugador ──────────────────────────────────────

        // Genera un código único de 6 caracteres alfanuméricos
        function generatePlayerCode() {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let code = '';
            for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
            return code;
        }

        // Carga el perfil del usuario desde Firestore y rellena la UI
        window._fbLoadProfile = async () => {
            const user = auth.currentUser;
            if (!user) return;
            try {
                const ref = doc(db, 'users', user.uid, 'profile', 'data');
                const snap = await getDoc(ref);
                let profile;
                if (snap.exists()) {
                    profile = snap.data();
                } else {
                    // Primera vez: crear perfil con código único
                    profile = {
                        code: generatePlayerCode(),
                        nickname: '',
                        color1: '#667eea',
                        color2: '#764ba2',
                        uid: user.uid
                    };
                    await setDoc(ref, profile);
                    // Registrar el código en el índice público
                    const codeRef = doc(db, 'playerCodes', profile.code);
                    await setDoc(codeRef, { uid: user.uid, nickname: profile.nickname, color1: profile.color1, color2: profile.color2 });
                }
                window._currentProfile = profile;
                // Rellenar UI
                const idText = document.getElementById('profileIdText');
                const nickInput = document.getElementById('profileNickname');
                const c1 = document.getElementById('profileColor1');
                const c2 = document.getElementById('profileColor2');
                if (idText) idText.textContent = profile.code;
                if (nickInput) nickInput.value = profile.nickname || '';
                const color1Val = profile.color1 || '#667eea';
                const color2Val = profile.color2 || '#764ba2';
                if (c1) c1.value = color1Val;
                if (c2) c2.value = color2Val;
                // Actualizar botones de color
                const btn1 = document.getElementById('profileColor1Btn');
                const btn2 = document.getElementById('profileColor2Btn');
                if (btn1) { btn1.style.background = color1Val; btn1.textContent = color1Val.toUpperCase(); }
                if (btn2) { btn2.style.background = color2Val; btn2.textContent = color2Val.toUpperCase(); }
                if (typeof updateProfilePreview === 'function') updateProfilePreview();
            } catch(e) {
                console.warn('Error cargando perfil:', e);
            }
        };

        // Guarda el perfil y actualiza el índice público
        window._fbSaveProfile = async (nickname, color1, color2) => {
            const user = auth.currentUser;
            if (!user || !window._currentProfile) return;
            try {
                const ref = doc(db, 'users', user.uid, 'profile', 'data');
                const updated = { ...window._currentProfile, nickname, color1, color2 };
                await setDoc(ref, updated);
                window._currentProfile = updated;
                // Actualizar índice público
                const codeRef = doc(db, 'playerCodes', updated.code);
                await setDoc(codeRef, { uid: user.uid, nickname, color1, color2 });
            } catch(e) {
                console.warn('Error guardando perfil:', e);
                throw e;
            }
        };

        // Busca un jugador por código en el índice público
        window._fbFindPlayerByCode = async (code) => {
            try {
                const ref = doc(db, 'playerCodes', code.toUpperCase());
                const snap = await getDoc(ref);
                if (!snap.exists()) return null;
                return { code: code.toUpperCase(), ...snap.data() };
            } catch(e) {
                console.warn('Error buscando jugador:', e);
                return null;
            }
        };

        // ── Sistema de conexiones bidireccionales ──────────────────
        // Cada conexión se guarda en: connections/{uid_menor}_{uid_mayor}
        // con campos: uids (array), profiles (objeto uid->datos), createdAt

        function _connectionId(uid1, uid2) {
            return [uid1, uid2].sort().join('_');
        }

        // Carga todas las conexiones del usuario actual desde Firestore
        window._fbLoadFriends = async () => {
            const user = auth.currentUser;
            if (!user) return [];
            try {
                const q1 = query(collection(db, 'connections'), where('uids', 'array-contains', user.uid));
                const snap = await getDocs(q1);
                return snap.docs.map(d => {
                    const data = d.data();
                    const otherUid = data.uids.find(u => u !== user.uid);
                    const profile = (data.profiles || {})[otherUid] || {};
                    return { ...profile, uid: otherUid, connectionId: d.id };
                }).filter(f => f.code);
            } catch(e) {
                console.warn('Error cargando amigos:', e);
                return [];
            }
        };

        // Añade una conexión bidireccional
        window._fbAddConnection = async (otherPlayer) => {
            const user = auth.currentUser;
            if (!user || !window._currentProfile) return;
            try {
                const cid = _connectionId(user.uid, otherPlayer.uid);
                const ref = doc(db, 'connections', cid);
                const myProfile = {
                    code: window._currentProfile.code,
                    nickname: window._currentProfile.nickname || '',
                    color1: window._currentProfile.color1 || '#667eea',
                    color2: window._currentProfile.color2 || '#764ba2'
                };
                await setDoc(ref, {
                    uids: [user.uid, otherPlayer.uid],
                    profiles: {
                        [user.uid]: myProfile,
                        [otherPlayer.uid]: {
                            code: otherPlayer.code,
                            nickname: otherPlayer.nickname || '',
                            color1: otherPlayer.color1 || '#667eea',
                            color2: otherPlayer.color2 || '#764ba2'
                        }
                    },
                    createdAt: Date.now()
                });
            } catch(e) {
                console.warn('Error creando conexión:', e);
                throw e;
            }
        };

        // Elimina una conexión (para ambos)
        window._fbRemoveConnection = async (connectionId) => {
            const user = auth.currentUser;
            if (!user) return;
            try {
                await deleteDoc(doc(db, 'connections', connectionId));
            } catch(e) {
                console.warn('Error eliminando conexión:', e);
            }
        };

        // Actualiza el perfil propio en todas las conexiones existentes
        window._fbUpdateProfileInConnections = async () => {
            const user = auth.currentUser;
            if (!user || !window._currentProfile) return;
            try {
                const q = query(collection(db, 'connections'), where('uids', 'array-contains', user.uid));
                const snap = await getDocs(q);
                const myProfile = {
                    code: window._currentProfile.code,
                    nickname: window._currentProfile.nickname || '',
                    color1: window._currentProfile.color1 || '#667eea',
                    color2: window._currentProfile.color2 || '#764ba2'
                };
                for (const d of snap.docs) {
                    await setDoc(d.ref, {
                        profiles: { ...d.data().profiles, [user.uid]: myProfile }
                    }, { merge: true });
                }
            } catch(e) {
                console.warn('Error actualizando perfil en conexiones:', e);
            }
        };

        // Listener en tiempo real para conexiones
        window._connectionsUnsubscribe = null;
        window._fbListenConnections = () => {
            const user = auth.currentUser;
            if (!user) return;
            if (window._connectionsUnsubscribe) window._connectionsUnsubscribe();
            const q = query(collection(db, 'connections'), where('uids', 'array-contains', user.uid));
            window._connectionsUnsubscribe = onSnapshot(q, () => {
                if (typeof renderFriendsList === 'function') renderFriendsList();
            });
        };

        // Compatibilidad: _fbSaveFriends ya no hace nada (las conexiones se gestionan directamente)
        window._fbSaveFriends = async () => {};

        // Escucha el historial propio en Firestore en tiempo real
        // Detecta partidas nuevas compartidas por amigos (campo sharedBy presente)
        window._historyUnsubscribe = null;
        window._fbListenHistory = () => {
            const user = auth.currentUser;
            if (!user) return;
            if (window._historyUnsubscribe) window._historyUnsubscribe();

            const col = collection(db, 'users', user.uid, 'history');
            // Solo escuchamos partidas recientes (últimas 48h) para no sobrecargar
            const since = Date.now() - 48 * 60 * 60 * 1000;
            const q = query(col, where('id', '>=', since), orderBy('id', 'desc'));

            window._historyUnsubscribe = onSnapshot(q, (snap) => {
                snap.docChanges().forEach(change => {
                    if (change.type !== 'added') return;
                    const data = change.doc.data();
                    if (!data.sharedBy) return; // solo nos interesan las compartidas por amigos

                    const entry = deserializeFromFirestore(data);
                    const local = window._memHistory || [];

                    // Evitar duplicado
                    if (local.some(e => String(e.id) === String(entry.id))) return;

                    // Insertar en caché y guardar
                    const updated = [entry, ...local].sort((a, b) => b.id - a.id).slice(0, 50);
                    window._memHistory = updated;

                    // Refrescar UI si el historial está abierto
                    if (typeof renderHistoryList === 'function') {
                        const hs = document.getElementById('historyScreen');
                        if (hs && hs.classList.contains('active')) renderHistoryList();
                    }

                    // Toast informando de la partida recibida
                    const who = data.sharedBy.nickname || 'Un amigo';
                    showSyncToast(`🎲 ${who} añadió una partida a tu historial`);
                });
            }, (err) => {
                console.warn('Error escuchando historial:', err);
            });
        };

        // Escuchar cambios de sesión

        onAuthStateChanged(auth, user => {
            const signedOut = document.getElementById('authSignedOut');
            const signedIn  = document.getElementById('authSignedIn');
            if (!signedOut || !signedIn) return;

            if (user) {
                signedOut.style.display = 'none';
                signedIn.style.display  = '';

                document.getElementById('authUserEmail').textContent = user.email || '';

                // Pre-cargar caché desde localStorage para que la UI no quede vacía mientras sincroniza
                window._memHistory   = JSON.parse(localStorage.getItem('bgtime_history') || '[]');
                window._memFrecuent  = JSON.parse(localStorage.getItem('bgtime_frecuent_players') || '[]');
                window._memTemplates = JSON.parse(localStorage.getItem('bgtime_custom_templates') || '[]');

                // Sincronizar historial y ajustes al iniciar sesión (sobrescribirá la caché con datos de Firebase)
                window._fbSyncHistory();
                window._fbSyncSettings();
                window._fbLoadProfile();
                // Mostrar sección de amigos
                const friendsSec = document.getElementById('friendsSection');
                if (friendsSec) friendsSec.style.display = '';
                // Ocultar datos y backup (la nube ya se encarga de todo)
                const backupSec = document.getElementById('datosBackupSection');
                if (backupSec) backupSec.style.display = 'none';
                // Ocultar botones de importar/exportar en historial y estadísticas
                const histIE = document.getElementById('historyImportExportBtns');
                if (histIE) histIE.style.display = 'none';
                const statsIE = document.getElementById('statsImportExportBtns');
                if (statsIE) statsIE.style.display = 'none';
                // Escuchar conexiones en tiempo real (y cargar lista)
                if (typeof window._fbListenConnections === 'function') window._fbListenConnections();
                if (typeof renderFriendsList === 'function') renderFriendsList();
                // Escuchar historial en tiempo real (para recibir partidas compartidas por amigos)
                if (typeof window._fbListenHistory === 'function') window._fbListenHistory();
            } else {
                // Persistir caché en localStorage antes de limpiarla (datos disponibles offline)
                if (window._memHistory   !== null) localStorage.setItem('bgtime_history',           JSON.stringify(window._memHistory));
                if (window._memFrecuent  !== null) localStorage.setItem('bgtime_frecuent_players',  JSON.stringify(window._memFrecuent));
                if (window._memTemplates !== null) localStorage.setItem('bgtime_custom_templates',  JSON.stringify(window._memTemplates));
                window._memHistory   = null;
                window._memFrecuent  = null;
                window._memTemplates = null;

                signedOut.style.display = '';
                signedIn.style.display  = 'none';
                const friendsSec = document.getElementById('friendsSection');
                if (friendsSec) friendsSec.style.display = 'none';
                // Volver a mostrar datos y backup para usuarios sin cuenta
                const backupSec = document.getElementById('datosBackupSection');
                if (backupSec) backupSec.style.display = '';
                // Mostrar botones de importar/exportar en historial y estadísticas
                const histIE = document.getElementById('historyImportExportBtns');
                if (histIE) histIE.style.display = '';
                const statsIE = document.getElementById('statsImportExportBtns');
                if (statsIE) statsIE.style.display = '';
                // Detener listener de conexiones
                if (window._connectionsUnsubscribe) {
                    window._connectionsUnsubscribe();
                    window._connectionsUnsubscribe = null;
                }
                // Detener listener de historial
                if (window._historyUnsubscribe) {
                    window._historyUnsubscribe();
                    window._historyUnsubscribe = null;
                }
            }
        });
