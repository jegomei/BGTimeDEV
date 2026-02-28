        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
        import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
            from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
        import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
                 collection, doc, setDoc, getDoc, getDocs, deleteDoc,
                 query, onSnapshot, where, arrayUnion, updateDoc }
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
        const db   = initializeFirestore(app, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        });
        const provider = new GoogleAuthProvider();

        // ── Caché en memoria (activa solo cuando el usuario está logueado) ──
        window._memHistory   = null;
        window._memFrecuent  = null;
        window._memTemplates = null;

        // ── Funciones de acceso a datos ────────────────────────────

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

        // Carga el historial desde la colección global matches/ (o su caché IndexedDB si está offline)
        async function loadHistoryIntoCache(uid) {
            try {
                // Sin orderBy en el servidor → no requiere índice compuesto; se ordena en cliente
                const q = query(
                    collection(db, 'matches'),
                    where('participantUids', 'array-contains', uid)
                );
                const snap = await getDocs(q);
                const firestoreEntries = snap.docs
                    .map(d => d.data())
                    .filter(e => !(e.deletedBy || []).includes(uid))
                    .map(e => deserializeFromFirestore(e));

                // Preservar entradas locales no guardadas aún en Firestore (evita race condition)
                const existing = window._memHistory || [];
                const firestoreIds = new Set(firestoreEntries.map(e => String(e.id)));
                const localOnly = existing.filter(e => !firestoreIds.has(String(e.id)));

                window._memHistory = [...firestoreEntries, ...localOnly]
                    .sort((a, b) => b.id - a.id)
                    .slice(0, 50);

                if (typeof renderHistoryList === 'function') renderHistoryList();
            } catch (e) {
                console.warn('Error cargando historial:', e);
                if (window._memHistory === null) window._memHistory = [];
            }
        }

        // Sube una partida a la colección global matches/
        window._fbSaveEntry = async (entry) => {
            const user = auth.currentUser;
            if (!user) return;

            // Construir participantUids: el creador siempre está incluido
            const participantUids = [user.uid];
            try {
                const q = query(collection(db, 'connections'), where('uids', 'array-contains', user.uid));
                const snap = await getDocs(q);
                const playerNames = (entry.results || []).map(r => r.player.trim().toLowerCase());
                for (const d of snap.docs) {
                    const data = d.data();
                    const otherUid = data.uids.find(u => u !== user.uid);
                    const profile  = (data.profiles || {})[otherUid] || {};
                    const nickname = profile.nickname || '';
                    if (nickname && playerNames.includes(nickname.trim().toLowerCase())) {
                        participantUids.push(otherUid);
                    }
                }
            } catch (e) {
                console.warn('Error resolviendo participantUids:', e);
            }

            try {
                const ref = doc(db, 'matches', String(entry.id));
                await setDoc(ref, serializeForFirestore({
                    ...entry,
                    participantUids,
                    creatorUid: user.uid
                }));
            } catch (e) {
                console.warn('Error guardando en Firestore:', e);
            }
        };

        // Oculta una partida del historial del usuario añadiendo su UID a deletedBy
        // La partida sigue siendo visible para los demás participantes
        window._fbDeleteEntry = async (entryId) => {
            const user = auth.currentUser;
            if (!user) return;
            try {
                const ref = doc(db, 'matches', String(entryId));
                await updateDoc(ref, { deletedBy: arrayUnion(user.uid) });
            } catch (e) {
                console.warn('Error borrando en Firestore:', e);
            }
        };

        // Actualiza campos de una partida existente en Firestore
        window._fbUpdateEntry = async (entryId, updatedFields) => {
            const user = auth.currentUser;
            if (!user) return;
            try {
                const ref = doc(db, 'matches', String(entryId));
                await updateDoc(ref, updatedFields);
            } catch (e) {
                console.warn('Error actualizando en Firestore:', e);
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
                await setDoc(ref, { frecuentPlayers: frecuent, customTemplates: templates }, { merge: true });
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
                    // Primera vez: subir lo que haya en la caché en memoria
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
                if (typeof renderLibraryShelves === 'function') renderLibraryShelves();
                if (typeof renderSettingsScreen === 'function') {
                    const settingsEl = document.getElementById('settingsScreen');
                    if (settingsEl && settingsEl.classList.contains('active')) renderSettingsScreen();
                }

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
        window._fbCurrentUid = () => auth.currentUser?.uid || null;

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

        // Escucha en tiempo real las partidas recientes donde el usuario es participante
        // Detecta nuevas partidas de amigos y modificaciones (scores, deletedBy, etc.)
        window._historyUnsubscribe = null;
        window._fbListenHistory = () => {
            const user = auth.currentUser;
            if (!user) return;
            if (window._historyUnsubscribe) window._historyUnsubscribe();

            // Escuchamos todas las partidas del usuario; sin orderBy ni filtros extra
            // para no requerir índice compuesto. Se filtra el toast por las últimas 48h.
            const since = Date.now() - 48 * 60 * 60 * 1000;
            const q = query(
                collection(db, 'matches'),
                where('participantUids', 'array-contains', user.uid)
            );

            window._historyUnsubscribe = onSnapshot(q, (snap) => {
                let needsRender = false;

                snap.docChanges().forEach(change => {
                    const data = change.doc.data();
                    const local = window._memHistory || [];

                    // Si el usuario borró esta partida, eliminarla de la caché (evento modified)
                    if ((data.deletedBy || []).includes(user.uid)) {
                        if (change.type === 'modified') {
                            const idx = local.findIndex(e => String(e.id) === String(data.id));
                            if (idx !== -1) {
                                const updated = [...local];
                                updated.splice(idx, 1);
                                window._memHistory = updated;
                                needsRender = true;
                            }
                        }
                        return;
                    }

                    const entry = deserializeFromFirestore(data);

                    if (change.type === 'added') {
                        // Evitar duplicado (ej: propia partida ya insertada en caché por saveToHistory)
                        if (local.some(e => String(e.id) === String(entry.id))) return;

                        window._memHistory = [entry, ...local].sort((a, b) => b.id - a.id).slice(0, 50);
                        needsRender = true;

                        // Toast solo si la partida la creó otro usuario y es reciente (últimas 48h)
                        if (data.creatorUid && data.creatorUid !== user.uid && data.id >= since) {
                            const friend = (window._friends || []).find(f => f.uid === data.creatorUid);
                            const who = friend?.nickname || 'Un amigo';
                            showSyncToast(`🎲 ${who} añadió una partida a tu historial`);
                        }

                    } else if (change.type === 'modified') {
                        // Actualizar la entrada existente en caché
                        const idx = local.findIndex(e => String(e.id) === String(entry.id));
                        if (idx !== -1) {
                            const updated = [...local];
                            updated[idx] = entry;
                            window._memHistory = updated;
                            needsRender = true;
                        }
                    }
                });

                if (needsRender && typeof renderHistoryList === 'function') {
                    const hs = document.getElementById('statsScreen');
                    if (hs && hs.classList.contains('active')) renderHistoryList();
                }
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

                // Inicializar cachés vacías; Firestore las llenará desde IndexedDB o la red
                window._memHistory   = null;
                window._memFrecuent  = null;
                window._memTemplates = null;

                // Cargar historial (usa caché IndexedDB offline si no hay red)
                loadHistoryIntoCache(user.uid);
                // Cargar ajustes (jugadores frecuentes + plantillas)
                window._fbSyncSettings();
                window._fbLoadProfile();
                // Mostrar sección de amigos
                const friendsSec = document.getElementById('friendsSection');
                if (friendsSec) friendsSec.style.display = '';
                // Mostrar estadísticas al loguearse
                const statsTabs = document.getElementById('statsTabsContainer');
                if (statsTabs) statsTabs.style.display = '';
                const statsHint = document.getElementById('statsLoginHint');
                if (statsHint) statsHint.style.display = 'none';
                // Escuchar conexiones en tiempo real (y cargar lista)
                if (typeof window._fbListenConnections === 'function') window._fbListenConnections();
                if (typeof renderFriendsList === 'function') renderFriendsList();
                // Escuchar historial en tiempo real (para recibir partidas compartidas por amigos)
                if (typeof window._fbListenHistory === 'function') window._fbListenHistory();
            } else {
                window._memHistory   = null;
                window._memFrecuent  = null;
                window._memTemplates = null;

                signedOut.style.display = '';
                signedIn.style.display  = 'none';
                const friendsSec = document.getElementById('friendsSection');
                if (friendsSec) friendsSec.style.display = 'none';
                // Bloquear estadísticas al desloguearse
                const statsTabs = document.getElementById('statsTabsContainer');
                if (statsTabs) statsTabs.style.display = 'none';
                const statsHint = document.getElementById('statsLoginHint');
                if (statsHint) statsHint.style.display = '';
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
