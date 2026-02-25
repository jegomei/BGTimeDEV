        // Prevent all zoom: double-tap, pinch gesture (iOS & Android)
        document.addEventListener('gesturestart',  function(e) { e.preventDefault(); }, { passive: false });
        document.addEventListener('gesturechange', function(e) { e.preventDefault(); }, { passive: false });
        document.addEventListener('gestureend',    function(e) { e.preventDefault(); }, { passive: false });
        document.addEventListener('touchmove', function(e) {
            if (e.touches.length > 1) e.preventDefault();
        }, { passive: false });
        var lastTap = 0;
        document.addEventListener('touchend', function(e) {
            var now = Date.now();
            if (now - lastTap < 300) e.preventDefault();
            lastTap = now;
        }, { passive: false });

        let gameData = {
            gameName: '',
            players: [],
            playerColors: [],
            playerGradients: [],
            timePerPlayer: 60,
            timerMode: 'per_turn',
            reorderEachRound: true,
            hasTemplate: false,
            scoringType: 'rounds',
            roundScoringMode: 'all_at_end',
            numRounds: 5,
            targetScore: 40,
            currentRound: 1,
            roundScores: [],
            items: [],
            roundItems: [],
            roundItemScores: [],
            orderedPlayers: [],
            orderedColors: [],
            orderedGradients: [],
            usedTimer: false,
            gameStartTime: null,
            gameEndTime: null,
            playerTotalTimes: []
        };

        let timerData = {
            currentPlayerIndex: 0,
            timeRemaining: 60,
            interval: null,
            isPaused: false,
            playerTimeUsed: [],
            playerTimeRemaining: null
        };

        const PLAYER_PALETTE = [
            '#E74C3C', // rojo
            '#3498DB', // azul
            '#2ECC71', // verde
            '#F1C40F', // amarillo
            '#E91E8C', // rosa
            '#9B59B6', // violeta
            '#00BCD4', // cian
            '#1ABC9C', // turquesa
            '#8BC34A', // verde lima
            '#E67E22', // naranja
            '#795548', // marrón
            '#34495E', // gris pizarra
        ];

        const defaultPlayerColors = PLAYER_PALETTE;

        function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }

        function getPlayerTimeSub(playerName) {
            if (!gameData.usedTimer || !gameData.playerTotalTimes || !gameData.orderedPlayers) return '';
            const idx = gameData.orderedPlayers.indexOf(playerName);
            if (idx === -1) return '';
            const secs = (gameData.playerTotalTimes[idx] || 0) + (timerData.playerTimeUsed ? (timerData.playerTimeUsed[idx] || 0) : 0);
            if (secs <= 0) return '';
            return `<span style="display:block;font-size:10px;font-weight:400;opacity:0.75;letter-spacing:0.3px;margin-top:2px;font-family:'DM Mono',monospace;">${formatTime(secs)}</span>`;
        }

        function stepRounds(delta) {
            const input = document.getElementById('numRounds');
            const display = document.getElementById('numRoundsDisplay');
            let val = parseInt(input.value) + delta;
            if (val < 1) val = 1;
            input.value = val;
            display.textContent = val;
        }

        function stepRoundsWithItems(delta) {
            const input = document.getElementById('numRoundsWithItems');
            const display = document.getElementById('numRoundsWithItemsDisplay');
            let val = parseInt(input.value) + delta;
            if (val < 1) val = 1;
            input.value = val;
            display.textContent = val;
        }

        function stepTime(delta) {
            const input = document.getElementById('timePerPlayer');
            const display = document.getElementById('timePerPlayerDisplay');
            let mins = Math.round(parseInt(input.value) / 60) + delta;
            if (mins < 1) mins = 1;
            input.value = mins * 60;
            display.textContent = mins;
        }

        function stepTimeChess(delta) {
            const input = document.getElementById('timePerPlayerChess');
            const display = document.getElementById('timePerPlayerChessDisplay');
            let mins = parseInt(input.value) + delta;
            if (mins < 1) mins = 1;
            input.value = mins;
            display.textContent = mins;
        }

        function selectTimerMode(mode, btn) {
            document.getElementById('timerPerTurn').checked = (mode === 'per_turn');
            document.getElementById('timerChess').checked   = (mode === 'chess');
            document.getElementById('timerNone').checked    = (mode === 'none');
            document.querySelectorAll('#playersScreen .scoring-type-card').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateTimerOptions();
        }

        function selectReorder(value) {
            document.getElementById('reorderEachRound').checked = value;
            document.getElementById('toggleReorderOn').classList.toggle('active', value);
            document.getElementById('toggleReorderOff').classList.toggle('active', !value);
        }

        function updateTimerOptions() {
            const mode = document.querySelector('input[name="timerMode"]:checked').value;
            document.getElementById('optionsPerTurn').style.display = mode === 'per_turn' ? 'block' : 'none';
            document.getElementById('optionsChess').style.display = mode === 'chess' ? 'block' : 'none';
        }

        function startGameFromPlayers() {
            // Obtener jugadores de la pantalla
            const playerRows = document.querySelectorAll('#playersContainer .player-input-row');
            
            const players = [];
            const colors = [];
            const gradients = [];
            
            playerRows.forEach(row => {
                const name = row.querySelector('.player-name').value.trim();
                const btn = row.querySelector('.player-color-btn');
                const color = btn.dataset.color;
                const gradient = btn.dataset.gradient || null;
                if (name !== '') {
                    players.push(name);
                    colors.push(color);
                    gradients.push(gradient);
                }
            });

            if (players.length < 2) {
                document.getElementById('playersError').textContent = 'Necesitas al menos 2 jugadores';
                return;
            } else {
                document.getElementById('playersError').textContent = '';
            }

            gameData.players = players;
            gameData.playerColors = colors;
            gameData.playerGradients = gradients;

            // Aplicar plantilla si hay una seleccionada
            const templateSelect = document.getElementById('templateSelect');
            const templateIndex = templateSelect.value;
            const allTemplates = window._allTemplates || (typeof GAME_TEMPLATES !== 'undefined' ? GAME_TEMPLATES : []);
            const hasTemplate = templateIndex !== '' && allTemplates[parseInt(templateIndex)] != null;
            if (hasTemplate) {
                applyTemplate(allTemplates[parseInt(templateIndex)]);
            }

            // Determinar qué modo de temporizador se ha seleccionado
            const timerMode = document.querySelector('input[name="timerMode"]:checked').value;

            if (timerMode === 'none') {
                // Sin temporizador: ir directamente a puntuación
                gameData.usedTimer = false;
                document.getElementById('btnVolverTimer').style.display = 'none';
                if (hasTemplate) {
                    // Saltar configuración e ir directo a la tabla de puntuación
                    goToScoringScreenWithTemplate();
                } else {
                    document.getElementById('gameDisplayScoring').textContent = gameData.gameName;
                    showScreen('scoringSetupScreen');
                }
            } else {
                // Con temporizador: configurar y empezar
                gameData.timerMode = timerMode;

                if (timerMode === 'per_turn') {
                    gameData.timePerPlayer = parseInt(document.getElementById('timePerPlayer').value);
                } else if (timerMode === 'chess') {
                    gameData.timePerPlayer = parseInt(document.getElementById('timePerPlayerChess').value) * 60;
                }

                gameData.orderedPlayers = [...gameData.players];
                gameData.orderedColors = [...gameData.playerColors];
                gameData.orderedGradients = [...(gameData.playerGradients || [])];
                gameData.reorderEachRound = document.getElementById('reorderEachRound').checked;

                renderOrderList();
                showScreen('timerScreen');
                document.getElementById('orderOverlay').classList.add('visible');
            }
        }

        // Orden de las pantallas en el flujo principal (para determinar dirección)
        const SCREEN_ORDER = [
            'setupScreen', 'playersScreen',
            'orderPlayersScreen', 'timerScreen', 'scoringSetupScreen',
            'scoringScreen', 'resultsScreen'
        ];
        // settingsScreen and historyScreen are treated as overlays (always slide from right)

        let _currentScreenId = 'setupScreen';

        function setOverlayBtnState(screenId) {
            document.getElementById('settingsBtn').classList.toggle('btn-on', screenId === 'settingsScreen');
            document.getElementById('statsBtn').classList.toggle('btn-on', screenId === 'statsScreen');
        }

        function showScreen(screenId, forceDirection) {
            const incoming = document.getElementById(screenId);
            if (!incoming) return;

            // Determinar dirección: 1 = avanzar (slide desde derecha), -1 = retroceder (slide desde izquierda)
            let direction = 1;
            if (forceDirection !== undefined) {
                direction = forceDirection;
            } else {
                const fromIdx = SCREEN_ORDER.indexOf(_currentScreenId);
                const toIdx   = SCREEN_ORDER.indexOf(screenId);
                if (fromIdx !== -1 && toIdx !== -1) {
                    direction = toIdx >= fromIdx ? 1 : -1;
                }
                // statsScreen siempre entra desde la derecha
                if (screenId === 'statsScreen') direction = 1;
            }

            // Ocultar todas salvo la entrante
            document.querySelectorAll('.screen').forEach(screen => {
                if (screen.id !== screenId) {
                    screen.classList.remove('active', 'slide-in-right', 'slide-in-left');
                    screen.style.display = 'none';
                }
            });

            // Aplicar animación y mostrar
            incoming.classList.remove('slide-in-right', 'slide-in-left');
            // Forzar reflow para reiniciar la animación si la pantalla ya era activa
            void incoming.offsetWidth;
            incoming.style.display = '';
            incoming.classList.add('active', direction >= 0 ? 'slide-in-right' : 'slide-in-left');

            _currentScreenId = screenId;
            setOverlayBtnState(screenId);

            const footer = document.querySelector('.footer-credit.footer-outside');
            if (footer) {
                if (screenId === 'timerScreen' || screenId === 'orderPlayersScreen') {
                    footer.style.display = 'none';
                } else {
                    footer.style.display = 'block';
                }
            }

            saveAppState();
        }

        // Pantalla 1: Setup
        document.getElementById('librarySearch').addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && e.target.value.trim().length > 0) {
                scheduleCloseLibrary();
                goToPlayersScreen();
            }
        });

        // Aplica el degradado de perfil a un botón de color y lo bloquea
        function applyProfileGradientToBtn(btn, color1, color2) {
            const grad = `linear-gradient(135deg, ${color1}, ${color2})`;
            btn.style.background = grad;
            btn.dataset.color = color1; // fallback color sólido
            btn.dataset.gradient = grad;
            btn.dataset.locked = '1';
            btn.title = 'Color de perfil (no editable)';
            btn.onclick = null;
        }

        function goToPlayersScreen() {
            const rawInput = document.getElementById('librarySearch').value.trim();
            // If a template is selected, the label includes emoji — extract just the name
            const templateIndex = document.getElementById('templateSelect').value;
            let gameName = rawInput;
            if (templateIndex !== '' && typeof _libraryIndex !== 'undefined') {
                const entry = _libraryIndex.find(t => t.index == templateIndex);
                if (entry) gameName = entry.name;
            }
            // Sync hidden field
            document.getElementById('gameName').value = gameName;
            
            if (!gameName) {
                document.getElementById('gameNameError').textContent = 'Por favor, ingresa el nombre del juego';
                return;
            }
            
            gameData.gameName = gameName;
            document.getElementById('gameNameTitle').textContent = gameName;
            document.getElementById('gameNameError').textContent = '';
            
            renderFrecuentChips();

            // Inicializar el contenedor de jugadores oculto si está vacío
            const container = document.getElementById('playersContainer');
            if (container.children.length === 0) {
                // Rellenar jugador 1 con el perfil del usuario si está logueado
                const profile = window._currentProfile;
                if (profile && profile.nickname) {
                    const div = document.createElement('div');
                    div.className = 'player-input-row';
                    const defaultColor = '#e74c3c';
                    div.innerHTML = `
                        <input type="text" placeholder="Nombre del jugador 1" class="player-name" value="${profile.nickname}">
                        <button class="player-color-btn" style="background:${defaultColor};" data-color="${defaultColor}" onclick="openColorPicker(this)" title="Color del jugador"></button>
                        <button onclick="removePlayerInput(this)" class="remove-player-btn" style="display:none;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    `;
                    container.appendChild(div);
                    // Aplicar degradado del perfil si está disponible
                    const colorBtn = div.querySelector('.player-color-btn');
                    if (colorBtn && profile.color1 && profile.color2) {
                        applyProfileGradientToBtn(colorBtn, profile.color1, profile.color2);
                    }
                }
                // No crear la segunda fila vacía automáticamente
            }

            showScreen('playersScreen');
            updateRemoveButtons(true); // Skip pills update here
            updatePlayerPills(); // Update pills once at the end
        }

        function applyTemplate(tpl) {
            gameData.hasTemplate      = true;
            gameData.scoringType       = tpl.scoringType;
            gameData.roundScoringMode  = tpl.roundScoringMode  || 'all_at_end';
            gameData.numRounds         = tpl.numRounds         || 5;
            gameData.targetScore       = tpl.targetScore       || 40;
            gameData.items             = (tpl.items            || []).map(i => ({ ...i }));
            gameData.roundItems        = (tpl.roundItems       || []).map(i => ({ ...i }));
        }

        function getActiveMaxPlayers() {
            const select = document.getElementById('templateSelect');
            const allTpl = window._allTemplates || (typeof GAME_TEMPLATES !== 'undefined' ? GAME_TEMPLATES : []);
            if (select.value === '' || !allTpl[parseInt(select.value)]) return null;
            return allTpl[parseInt(select.value)].maxPlayers || null;
        }

        function addPlayerInput() {
            const container = document.getElementById('playersContainer');
            const max = getActiveMaxPlayers();
            if (max !== null && container.children.length >= max) return;

            const playerNum = container.children.length + 1;
            const defaultColor = defaultPlayerColors[(playerNum - 1) % defaultPlayerColors.length];
            
            const div = document.createElement('div');
            div.className = 'player-input-row';
            div.innerHTML = `
                <input type="text" placeholder="Nombre del jugador ${playerNum}" class="player-name">
                <button class="player-color-btn" style="background:${defaultColor};" data-color="${defaultColor}" onclick="openColorPicker(this)" title="Color del jugador"></button>
                <button onclick="removePlayerInput(this)" class="remove-player-btn"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            `;
            container.appendChild(div);
            
            updateRemoveButtons();
        }

        function removePlayerInput(button) {
            button.closest('.player-input-row').remove();
            updateRemoveButtons();
        }

        function updateRemoveButtons(skipPillsUpdate = false) {
            const rows = document.querySelectorAll('#playersContainer .player-input-row');
            const max = getActiveMaxPlayers();
            const addBtn = document.getElementById('addPlayerBtn');

            rows.forEach((row) => {
                const btn = row.querySelector('.remove-player-btn');
                if (btn) {
                    btn.style.display = rows.length > 2 ? 'block' : 'none';
                }
            });

            // Solo actualizar el botón si existe (ya no está en la nueva interfaz)
            if (addBtn) {
                if (max !== null) {
                    const atMax = rows.length >= max;
                    addBtn.disabled = atMax;
                    addBtn.textContent = atMax
                        ? `Máximo ${max} jugadores`
                        : `+ Añadir Jugador (máx. ${max})`;
                } else {
                    addBtn.disabled = false;
                    addBtn.textContent = '+ Añadir Jugador';
                }
            }

            if (!skipPillsUpdate) {
                updatePlayerPills();
            }
        }

        function updatePlayerPills() {
            const container = document.getElementById('selectedPlayersPills');
            if (!container) return;

            const playerRows = document.querySelectorAll('#playersContainer .player-input-row');
            const players = [];

            playerRows.forEach((row, index) => {
                const nameInput = row.querySelector('.player-name');
                const colorBtn = row.querySelector('.player-color-btn');
                const name = nameInput.value.trim();
                
                if (name) {
                    const color = colorBtn.dataset.color;
                    const gradient = colorBtn.dataset.gradient;
                    const isConnected = !!gradient;
                    
                    players.push({
                        name,
                        color,
                        gradient,
                        isConnected,
                        index
                    });
                }
            });

            container.classList.remove('empty');
            container.innerHTML = '';

            // Agregar pills de jugadores existentes
            players.forEach(player => {
                const pill = document.createElement('div');
                pill.className = `player-pill ${player.isConnected ? 'connected' : 'regular'}`;
                
                if (player.isConnected) {
                    // Extraer los dos colores del gradiente
                    const gradientMatch = player.gradient.match(/linear-gradient\(135deg,\s*([^,]+),\s*([^)]+)\)/);
                    if (gradientMatch) {
                        pill.style.setProperty('--pill-color-1', gradientMatch[1].trim());
                        pill.style.setProperty('--pill-color-2', gradientMatch[2].trim());
                    } else {
                        pill.style.setProperty('--pill-color-1', player.color);
                        pill.style.setProperty('--pill-color-2', player.color);
                    }
                } else {
                    pill.style.setProperty('--pill-color-1', player.color);
                }

                pill.innerHTML = `<span class="player-pill-name">${player.name}</span>`;

                // Agregar manejador de clic en la pill - todas abren el selector de color
                pill.addEventListener('click', (e) => {
                    const rows = document.querySelectorAll('#playersContainer .player-input-row');
                    const targetRow = rows[player.index];
                    if (targetRow) {
                        const colorBtn = targetRow.querySelector('.player-color-btn');
                        if (colorBtn) {
                            openColorPickerWithDelete(colorBtn, player.index, player.isConnected);
                        }
                    }
                });

                container.appendChild(pill);
            });

            // SIEMPRE agregar pill de "+ Añadir"
            // Verificar si hay límite de jugadores alcanzado
            const templateSelect = document.getElementById('templateSelect');
            const templateIndex = templateSelect ? templateSelect.value : '';
            const allTemplates = window._allTemplates || (typeof GAME_TEMPLATES !== 'undefined' ? GAME_TEMPLATES : []);
            const template = (templateIndex !== '' && allTemplates[parseInt(templateIndex)]) ? allTemplates[parseInt(templateIndex)] : null;
            const maxPlayers = template && template.maxPlayers ? template.maxPlayers : Infinity;
            const limitReached = players.length >= maxPlayers;

            const addPill = document.createElement('div');
            addPill.className = `player-pill add-player ${limitReached ? 'disabled' : ''}`;
            addPill.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span class="player-pill-name">Añadir</span>
            `;
            
            if (!limitReached) {
                addPill.addEventListener('click', () => {
                    showAddPlayerModal();
                });
            }
            
            container.appendChild(addPill);
        }

        function removePlayerFromPill(index) {
            const rows = document.querySelectorAll('#playersContainer .player-input-row');
            if (rows[index]) {
                rows[index].remove();
                updateRemoveButtons(true); // Skip pills update, we'll do it once at the end
                updatePlayerPills(); // Update pills once
                renderFrecuentChips(); // Actualizar chips para que jugadores conectados eliminados vuelvan a aparecer
            }
        }

        // Escuchar cambios en los inputs de nombre para actualizar píldoras en tiempo real
        document.addEventListener('DOMContentLoaded', () => {
            const playersContainer = document.getElementById('playersContainer');
            if (playersContainer) {
                playersContainer.addEventListener('input', (e) => {
                    if (e.target.classList.contains('player-name')) {
                        updatePlayerPills();
                    }
                });
            }
        });

        function openColorPicker(btn) {
            closeAllColorPickers();

            const currentColor = btn.dataset.color.toUpperCase();

            const overlay = document.createElement('div');
            overlay.className = 'color-palette-overlay';

            const popup = document.createElement('div');
            popup.className = 'color-palette-popup';

            PLAYER_PALETTE.forEach(color => {
                const swatch = document.createElement('button');
                swatch.className = 'color-swatch' + (color.toUpperCase() === currentColor ? ' selected' : '');
                swatch.style.background = color;
                swatch.title = color;
                swatch.setAttribute('type', 'button');
                swatch.onclick = (e) => {
                    e.stopPropagation();
                    btn.style.background = color;
                    btn.dataset.color = color;
                    closeAllColorPickers();
                    updatePlayerPills(); // Actualizar píldoras al cambiar color
                };
                popup.appendChild(swatch);
            });

            overlay.appendChild(popup);
            document.body.appendChild(overlay);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeAllColorPickers();
            });
        }

        function openColorPickerWithDelete(btn, playerIndex, isConnected) {
            closeAllColorPickers();

            const currentColor = btn.dataset.color.toUpperCase();

            const overlay = document.createElement('div');
            overlay.className = 'color-palette-overlay';

            const popup = document.createElement('div');
            popup.className = 'color-palette-popup';

            // Botón de eliminar jugador en la parte superior
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'color-picker-delete-btn';
            deleteBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Quitar de la partida</span>
            `;
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                removePlayerFromPill(playerIndex);
                closeAllColorPickers();
            };
            popup.appendChild(deleteBtn);

            // Separador
            const separator = document.createElement('div');
            separator.className = 'color-picker-separator';
            popup.appendChild(separator);

            // Solo mostrar selector de color para jugadores no conectados
            if (!isConnected) {
                // Paleta de colores
                PLAYER_PALETTE.forEach(color => {
                    const swatch = document.createElement('button');
                    swatch.className = 'color-swatch' + (color.toUpperCase() === currentColor ? ' selected' : '');
                    swatch.style.background = color;
                    swatch.title = color;
                    swatch.setAttribute('type', 'button');
                    swatch.onclick = (e) => {
                        e.stopPropagation();
                        btn.style.background = color;
                        btn.dataset.color = color;
                        closeAllColorPickers();
                        updatePlayerPills(); // Actualizar píldoras al cambiar color
                    };
                    popup.appendChild(swatch);
                });
            }

            overlay.appendChild(popup);
            document.body.appendChild(overlay);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeAllColorPickers();
            });
        }

        function closeAllColorPickers() {
            document.querySelectorAll('.color-palette-overlay').forEach(p => p.remove());
        }

        function goToScoringScreenWithTemplate() {
            document.getElementById('gameDisplayFinal').textContent = gameData.gameName;
            const container = document.getElementById('scoringTableContainer');

            if (gameData.scoringType === 'rounds') {
                gameData.roundScores = gameData.players.map(() => []);
                gameData.currentRound = 1;
                if (gameData.roundScoringMode === 'round_by_round') {
                    createRoundByRoundTable(container);
                } else {
                    createAllRoundsTable(container);
                }
            } else if (gameData.scoringType === 'items') {
                createItemsTable(container);
            } else if (gameData.scoringType === 'rounds_with_items') {
                gameData.roundItemScores = gameData.players.map(() => []);
                gameData.currentRound = 1;
                createRoundWithItemsTable(container);
            } else if (gameData.scoringType === 'target_score') {
                gameData.roundScoringMode = 'round_by_round';
                gameData.roundScores = gameData.players.map(() => []);
                gameData.currentRound = 1;
                createTargetScoreTable(container);
            }

            showScreen('scoringScreen');
        }

        function renderOrderList() {
            const container = document.getElementById('orderOverlayContainer');
            container.innerHTML = '';
            
            gameData.orderedPlayers.forEach((player, index) => {
                const div = document.createElement('div');
                div.className = 'order-item';
                div.dataset.index = index;
                const grad = gameData.orderedGradients && gameData.orderedGradients[index];
                div.style.background = grad || gameData.orderedColors[index];
                div.style.borderColor = gameData.orderedColors[index];
                div.innerHTML = `
                    <div class="order-player-name" style="color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.4);">${player}</div>
                    <div class="order-controls">
                        <button class="order-btn" onclick="movePlayerUp(${index})" ${index === 0 ? 'disabled' : ''}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>
                        <button class="order-btn" onclick="movePlayerDown(${index})" ${index === gameData.orderedPlayers.length - 1 ? 'disabled' : ''}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
                    </div>
                `;
                container.appendChild(div);
            });
        }

        function movePlayerUp(index) {
            if (index === 0) return;
            [gameData.orderedPlayers[index], gameData.orderedPlayers[index - 1]] = 
            [gameData.orderedPlayers[index - 1], gameData.orderedPlayers[index]];
            [gameData.orderedColors[index], gameData.orderedColors[index - 1]] = 
            [gameData.orderedColors[index - 1], gameData.orderedColors[index]];
            [gameData.orderedGradients[index], gameData.orderedGradients[index - 1]] = 
            [gameData.orderedGradients[index - 1], gameData.orderedGradients[index]];
            renderOrderList();
        }

        function movePlayerDown(index) {
            if (index === gameData.orderedPlayers.length - 1) return;
            [gameData.orderedPlayers[index], gameData.orderedPlayers[index + 1]] = 
            [gameData.orderedPlayers[index + 1], gameData.orderedPlayers[index]];
            [gameData.orderedColors[index], gameData.orderedColors[index + 1]] = 
            [gameData.orderedColors[index + 1], gameData.orderedColors[index]];
            [gameData.orderedGradients[index], gameData.orderedGradients[index + 1]] = 
            [gameData.orderedGradients[index + 1], gameData.orderedGradients[index]];
            renderOrderList();
        }

        function confirmOrder() {
            const isReorder = gameData.usedTimer; // ya estaba en marcha

            timerData.currentPlayerIndex = 0;
            timerData.isPaused = false;

            if (!isReorder) {
                // Primera vez: inicializar todo
                if (gameData.timerMode === 'chess') {
                    timerData.playerTimeRemaining = gameData.orderedPlayers.map(() => gameData.timePerPlayer);
                    timerData.timeRemaining = timerData.playerTimeRemaining[0];
                } else {
                    timerData.timeRemaining = gameData.timePerPlayer;
                    timerData.playerTimeRemaining = null;
                }

                gameData.usedTimer = true;
                gameData.gameStartTime = Date.now();
                gameData.playerTotalTimes = gameData.orderedPlayers.map(() => 0);
                timerData.playerTimeUsed = gameData.orderedPlayers.map(() => 0);
            } else {
                // Re-ordenación entre rondas: resetear solo el tiempo del turno actual
                if (gameData.timerMode === 'chess') {
                    // En modo ajedrez reordenar también reordena los tiempos restantes
                    // playerTimeRemaining ya está sincronizado con orderedPlayers por índice
                    timerData.timeRemaining = timerData.playerTimeRemaining[0];
                } else {
                    timerData.timeRemaining = gameData.timePerPlayer;
                }
                timerData.playerTimeUsed = gameData.orderedPlayers.map(() => 0);
            }

            document.getElementById('orderOverlay').classList.remove('visible');
            startFullscreenTimer();
        }

        function startFullscreenTimer() {
            showScreen('timerScreen');
            updateTimerDisplay();
            startCountdown();
        }

        function updateTimerGradient() {
            const card = document.getElementById('timerFullscreen');
            if (card.classList.contains('timer-overtime')) return;  // overtime maneja su propio fondo
            const color = gameData.orderedColors[timerData.currentPlayerIndex];
            const grad  = gameData.orderedGradients && gameData.orderedGradients[timerData.currentPlayerIndex];
            const initialTime = gameData.timePerPlayer;
            const remaining = Math.max(0, timerData.timeRemaining);
            const pct = Math.round((remaining / initialTime) * 100);
            const blackPct = 100 - pct; // cuánto negro sube desde abajo

            // Fondo fijo: siempre el degradado completo del jugador
            if (grad) {
                const gradParts = grad.replace('linear-gradient(135deg,', '').replace(')', '').split(',').map(s => s.trim());
                const color2 = gradParts[1] || color;
                card.style.background = `linear-gradient(to bottom, ${color} 0%, ${color2} 100%)`;
            } else {
                card.style.background = color;
            }

            // El negro sube desde abajo mediante el overlay
            const overlay = document.getElementById('timerBlackOverlay');
            if (overlay) overlay.style.height = `${blackPct}%`;

            card.querySelectorAll('.player-name-large, .time-display-large').forEach(el => {
                el.style.color = 'white';
                el.style.textShadow = '0 4px 10px rgba(0,0,0,0.3)';
            });

            card.querySelectorAll('.timer-btn').forEach(btn => {
                btn.style.color = 'rgba(255,255,255,0.85)';
                btn.style.borderColor = 'rgba(255,255,255,0.4)';
                btn.style.background = 'rgba(255,255,255,0.15)';
                btn.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
            });
        }

        function updateTimerDisplay() {
            const currentPlayer = gameData.orderedPlayers[timerData.currentPlayerIndex];
            const nextIndex = (timerData.currentPlayerIndex + 1) % gameData.orderedPlayers.length;
            const nextPlayer = gameData.orderedPlayers[nextIndex];
            document.getElementById('currentPlayerName').textContent = currentPlayer;
            document.getElementById('timeDisplayLarge').textContent = formatTime(timerData.timeRemaining);
            const nextEl = document.getElementById('nextPlayerName');
            if (nextEl) nextEl.textContent = nextPlayer;
            updateTimerGradient();
        }

        // ── Wake Lock para mantener pantalla activa ───────────────
        let wakeLock = null;

        async function requestWakeLock() {
            // Solo si el navegador soporta Wake Lock API
            if ('wakeLock' in navigator) {
                try {
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('Wake Lock activado');
                    
                    // Manejar cuando se libera el wake lock (ej: cambio de tab)
                    wakeLock.addEventListener('release', () => {
                        console.log('Wake Lock liberado');
                    });
                    
                } catch (err) {
                    console.warn('No se pudo activar Wake Lock:', err);
                }
            }
        }

        async function releaseWakeLock() {
            if (wakeLock !== null) {
                try {
                    await wakeLock.release();
                    wakeLock = null;
                    console.log('Wake Lock desactivado manualmente');
                } catch (err) {
                    console.warn('Error al liberar Wake Lock:', err);
                }
            }
        }

        // Re-adquirir wake lock cuando la página vuelve a ser visible
        document.addEventListener('visibilitychange', async () => {
            if (wakeLock !== null && document.visibilityState === 'visible') {
                // Solo re-adquirir si había un timer activo
                if (timerData.interval && !timerData.isPaused) {
                    await requestWakeLock();
                }
            }
        });

        // ── Audio: tic-tac con Web Audio API ─────────────────────────
        let _audioCtx = null;
        function _getAudioCtx() {
            if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            return _audioCtx;
        }
        function playTick(isLast) {
            try {
                const ctx = _getAudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = isLast ? 880 : 660;   // tono más agudo en el último
                gain.gain.setValueAtTime(0.35, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.08);
            } catch(e) {}
        }

        function startCountdown() {
            if (timerData.interval) clearInterval(timerData.interval);

            // Activar Wake Lock cuando inicia el temporizador
            requestWakeLock();

            timerData.interval = setInterval(() => {
                if (timerData.isPaused) return;

                timerData.timeRemaining--;
                timerData.playerTimeUsed[timerData.currentPlayerIndex]++;

                if (gameData.timerMode === 'chess') {
                    timerData.playerTimeRemaining[timerData.currentPlayerIndex] = timerData.timeRemaining;
                }

                const card = document.getElementById('timerFullscreen');
                const display = document.getElementById('timeDisplayLarge');

                if (timerData.timeRemaining > 0) {
                    // Tiempo normal
                    card.classList.remove('timer-overtime');
                    if (timerData.timeRemaining <= 5) {
                        card.classList.add('timer-warning');
                        playTick(timerData.timeRemaining === 1);
                    } else {
                        card.classList.remove('timer-warning');
                    }
                    display.textContent = formatTime(timerData.timeRemaining);
                    updateTimerGradient();

                } else {
                    // Tiempo extra (timeRemaining es 0 o negativo)
                    card.classList.remove('timer-warning');
                    card.classList.add('timer-overtime');
                    const overtime = -timerData.timeRemaining;  // segundos de extra
                    display.textContent = '+' + formatTime(overtime);
                    // Fondo rojo fijo
                    card.style.background = 'linear-gradient(to bottom, #3a0000 0%, #111111 100%)';
                    // Sonido cada segundo en overtime
                    playTick(false);
                }
            }, 1000);
        }

        function nextPlayerTurn() {
            // Limpiar estado visual de overtime/warning
            const card = document.getElementById('timerFullscreen');
            card.classList.remove('timer-overtime', 'timer-warning');

            // Resetear overlay negro para el nuevo turno
            const overlay = document.getElementById('timerBlackOverlay');
            if (overlay) overlay.style.height = '0%';

            gameData.playerTotalTimes[timerData.currentPlayerIndex] += timerData.playerTimeUsed[timerData.currentPlayerIndex];
            timerData.playerTimeUsed[timerData.currentPlayerIndex] = 0;

            timerData.currentPlayerIndex = (timerData.currentPlayerIndex + 1) % gameData.orderedPlayers.length;

            if (gameData.timerMode === 'chess') {
                timerData.timeRemaining = timerData.playerTimeRemaining[timerData.currentPlayerIndex];
            } else {
                timerData.timeRemaining = gameData.timePerPlayer;
            }

            timerData.isPaused = false;
            document.getElementById('pauseIcon').innerHTML = SVG_PAUSE;
            document.getElementById('pausedOverlay').classList.remove('visible');
            const nextBtn = document.querySelector('.timer-btn.next-btn');
            if (nextBtn) nextBtn.style.pointerEvents = '';

            updateTimerDisplay();
            playTurnStart();
            startCountdown();
        }

        function playTurnStart() {
            try {
                const ctx = _getAudioCtx();
                // Dos notas ascendentes rápidas: sensación de "arranque"
                [[440, 0], [600, 0.1]].forEach(([freq, delay]) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
                    gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + delay + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.13);
                    osc.start(ctx.currentTime + delay);
                    osc.stop(ctx.currentTime + delay + 0.13);
                });
            } catch(e) {}
        }

        const SVG_PAUSE = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
        const SVG_PLAY  = '<polygon points="5 3 19 12 5 21 5 3"/>';

        function togglePause() {
            timerData.isPaused = !timerData.isPaused;
            const pauseIcon = document.getElementById('pauseIcon');
            pauseIcon.innerHTML = timerData.isPaused ? SVG_PLAY : SVG_PAUSE;

            const overlay = document.getElementById('pausedOverlay');
            const nextBtn = document.querySelector('.timer-btn.next-btn');

            if (timerData.isPaused) {
                overlay.classList.add('visible');
                if (nextBtn) nextBtn.style.pointerEvents = 'none';
                // Liberar Wake Lock al pausar
                releaseWakeLock();
            } else {
                overlay.classList.remove('visible');
                if (nextBtn) nextBtn.style.pointerEvents = '';
                playTurnStart();
                // Reactivar Wake Lock al reanudar
                requestWakeLock();
            }
        }


        function endTimerSession() {
            if (gameData.usedTimer) {
                gameData.playerTotalTimes[timerData.currentPlayerIndex] += timerData.playerTimeUsed[timerData.currentPlayerIndex];
                gameData.gameEndTime = Date.now();
            }
            
            if (timerData.interval) {
                clearInterval(timerData.interval);
                timerData.interval = null;
            }

            // Liberar Wake Lock al finalizar el temporizador
            releaseWakeLock();

            // Limpiar estado visual del overlay de pausa al salir del timer
            timerData.isPaused = false;
            const pauseIcon = document.getElementById('pauseIcon');
            if (pauseIcon) pauseIcon.innerHTML = SVG_PAUSE;
            document.getElementById('pausedOverlay').classList.remove('visible');
            const nextBtn = document.querySelector('.timer-btn.next-btn');
            if (nextBtn) nextBtn.style.pointerEvents = '';

            // Si ya estamos en modo ronda a ronda activo o target_score, ir directo a la ronda pendiente
            const isActiveRoundMode = (
                (gameData.roundScores.length > 0 && (
                    (gameData.scoringType === 'rounds' && gameData.roundScoringMode === 'round_by_round') ||
                    gameData.scoringType === 'target_score'
                )) ||
                (gameData.scoringType === 'rounds_with_items' && gameData.roundItemScores.length > 0)
            );

            if (isActiveRoundMode) {
                document.getElementById('gameDisplayFinal').textContent = gameData.gameName;
                const container = document.getElementById('scoringTableContainer');
                if (gameData.scoringType === 'target_score') {
                    createTargetScoreTable(container);
                } else if (gameData.scoringType === 'rounds_with_items') {
                    createRoundWithItemsTable(container);
                } else {
                    createRoundByRoundTable(container);
                }
                showScreen('scoringScreen');
            } else if (gameData.hasTemplate) {
                // Hay plantilla aplicada, saltar configuración
                document.getElementById('btnVolverTimer').style.display = 'flex';
                goToScoringScreenWithTemplate();
            } else {
                document.getElementById('btnVolverTimer').style.display = 'flex';
                document.getElementById('gameDisplayScoring').textContent = gameData.gameName;
                showScreen('scoringSetupScreen');
            }
        }

        function returnToTimer() {
            if (gameData.reorderEachRound) {
                renderOrderList();
                showScreen('timerScreen');
                document.getElementById('orderOverlay').classList.add('visible');
                return;
            }
            showScreen('timerScreen');
            // Asegurarse de que el timer no quede en pausa al volver
            timerData.isPaused = false;
            const pauseIcon = document.getElementById('pauseIcon');
            if (pauseIcon) pauseIcon.innerHTML = SVG_PAUSE;
            const overlay = document.getElementById('pausedOverlay');
            if (overlay) overlay.classList.remove('visible');
            const nextBtn = document.querySelector('.timer-btn.next-btn');
            if (nextBtn) nextBtn.style.pointerEvents = '';

            if (!timerData.interval) {
                startCountdown();
            }
        }

        function skipToScoring() {
            document.getElementById('btnVolverTimer').style.display = 'flex';
            if (gameData.hasTemplate) {
                goToScoringScreenWithTemplate();
            } else {
                document.getElementById('gameDisplayScoring').textContent = gameData.gameName;
                showScreen('scoringSetupScreen');
            }
        }

        function goToScoring() {
            if (timerData.interval) {
                clearInterval(timerData.interval);
                timerData.interval = null;
            }
            // Liberar Wake Lock al ir a scoring
            releaseWakeLock();
            showScreen('scoringSetupScreen');
            document.getElementById('gameDisplayScoring').textContent = gameData.gameName;
        }

        // Pantalla 4: Scoring Setup
        function selectScoringType(type) {
            // Actualizar radio oculto
            document.getElementById({
                rounds: 'roundsRadio',
                items: 'itemsRadio',
                rounds_with_items: 'roundsWithItemsRadio',
                target_score: 'targetScoreRadio'
            }[type]).checked = true;

            // Actualizar estado visual de los botones
            document.querySelectorAll('.scoring-type-card').forEach(btn => btn.classList.remove('active'));
            event.currentTarget.classList.add('active');

            // Mostrar panel correspondiente
            document.getElementById('roundsConfig').style.display           = type === 'rounds'            ? 'block' : 'none';
            document.getElementById('itemsConfig').style.display            = type === 'items'             ? 'block' : 'none';
            document.getElementById('roundsWithItemsConfig').style.display  = type === 'rounds_with_items' ? 'block' : 'none';
            document.getElementById('targetScoreConfig').style.display      = type === 'target_score'      ? 'block' : 'none';
        }

        function selectRoundMode(mode) {
            document.getElementById(mode === 'all_at_end' ? 'allAtEndRadio' : 'roundByRoundRadio').checked = true;
            document.getElementById('toggleAllAtEnd').classList.toggle('active', mode === 'all_at_end');
            document.getElementById('toggleRoundByRound').classList.toggle('active', mode === 'round_by_round');
        }

        // Mantener compatibilidad con listeners de radio por si acaso
        document.getElementById('roundsRadio').addEventListener('change', function() {
            document.getElementById('roundsConfig').style.display = 'block';
            document.getElementById('itemsConfig').style.display = 'none';
            document.getElementById('roundsWithItemsConfig').style.display = 'none';
            document.getElementById('targetScoreConfig').style.display = 'none';
        });

        document.getElementById('itemsRadio').addEventListener('change', function() {
            document.getElementById('roundsConfig').style.display = 'none';
            document.getElementById('itemsConfig').style.display = 'block';
            document.getElementById('roundsWithItemsConfig').style.display = 'none';
            document.getElementById('targetScoreConfig').style.display = 'none';
        });

        document.getElementById('roundsWithItemsRadio').addEventListener('change', function() {
            document.getElementById('roundsConfig').style.display = 'none';
            document.getElementById('itemsConfig').style.display = 'none';
            document.getElementById('roundsWithItemsConfig').style.display = 'block';
            document.getElementById('targetScoreConfig').style.display = 'none';
        });

        document.getElementById('targetScoreRadio').addEventListener('change', function() {
            document.getElementById('roundsConfig').style.display = 'none';
            document.getElementById('itemsConfig').style.display = 'none';
            document.getElementById('roundsWithItemsConfig').style.display = 'none';
            document.getElementById('targetScoreConfig').style.display = 'block';
        });

        function addRoundItemInput() {
            const container = document.getElementById('roundItemsContainer');
            const div = document.createElement('div');
            div.className = 'scoring-item';
            div.innerHTML = `
                <input type="text" placeholder="Nombre del ítem" class="round-item-name">
                <div class="scoring-item-footer">
                    <label class="resta-toggle">
                        <input type="checkbox" class="round-item-negative">
                        <span class="resta-toggle-pill"></span>
                        <span class="resta-toggle-label">Resta puntos</span>
                    </label>
                    <button class="item-delete-btn" onclick="removeRoundItem(this)" title="Eliminar ítem"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
            `;
            container.appendChild(div);
        }

        function removeRoundItem(button) {
            button.closest('.scoring-item').remove();
        }

        function addItemInput() {
            const container = document.getElementById('itemsContainer');
            const div = document.createElement('div');
            div.className = 'scoring-item';
            div.innerHTML = `
                <input type="text" placeholder="Nombre del ítem" class="item-name">
                <div class="scoring-item-footer">
                    <label class="resta-toggle">
                        <input type="checkbox" class="item-negative">
                        <span class="resta-toggle-pill"></span>
                        <span class="resta-toggle-label">Resta puntos</span>
                    </label>
                    <button class="item-delete-btn" onclick="removeItem(this)" title="Eliminar ítem"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
            `;
            container.appendChild(div);
        }

        function removeItem(button) {
            button.closest('.scoring-item').remove();
        }

        function setupScoring() {
            gameData.scoringType = document.querySelector('input[name="scoringType"]:checked').value;
            
            document.getElementById('gameDisplayFinal').textContent = gameData.gameName;
            
            const container = document.getElementById('scoringTableContainer');
            
            if (gameData.scoringType === 'rounds') {
                gameData.numRounds = parseInt(document.getElementById('numRounds').value);
                gameData.roundScoringMode = document.querySelector('input[name="roundScoring"]:checked').value;
                
                if (gameData.roundScores.length === 0) {
                    gameData.roundScores = gameData.players.map(() => []);
                    gameData.currentRound = 1;
                }
                
                if (gameData.roundScoringMode === 'round_by_round') {
                    createRoundByRoundTable(container);
                } else {
                    createAllRoundsTable(container);
                }
                
            } else if (gameData.scoringType === 'items') {
                const items = Array.from(document.querySelectorAll('.item-name'))
                    .map((input, index) => ({
                        name: input.value.trim(),
                        negative: document.querySelectorAll('.item-negative')[index].checked
                    }))
                    .filter(item => item.name !== '');
                
                if (items.length === 0) {
                    alert('Por favor, añade al menos un ítem puntuable');
                    return;
                }
                
                gameData.items = items;
                createItemsTable(container);
                
            } else if (gameData.scoringType === 'rounds_with_items') {
                gameData.numRounds = parseInt(document.getElementById('numRoundsWithItems').value);
                
                const roundItems = Array.from(document.querySelectorAll('.round-item-name'))
                    .map((input, index) => ({
                        name: input.value.trim(),
                        negative: document.querySelectorAll('.round-item-negative')[index].checked
                    }))
                    .filter(item => item.name !== '');
                
                if (roundItems.length === 0) {
                    alert('Por favor, añade al menos un ítem a puntuar por ronda');
                    return;
                }
                
                gameData.roundItems = roundItems;
                
                if (gameData.roundItemScores.length === 0) {
                    gameData.currentRound = 1;
                    gameData.roundItemScores = gameData.players.map(() => []);
                }
                
                createRoundWithItemsTable(container);

            } else if (gameData.scoringType === 'target_score') {
                gameData.targetScore = parseInt(document.getElementById('targetScore').value);
                gameData.roundScoringMode = 'round_by_round';

                if (gameData.roundScores.length === 0) {
                    gameData.roundScores = gameData.players.map(() => []);
                    gameData.currentRound = 1;
                }

                createTargetScoreTable(container);
            }
            
            showScreen('scoringScreen');
        }

        function createItemsTable(container) {
            let table = '<div class="table-wrapper"><table class="score-table"><thead><tr><th>Ítem</th>';
            
            gameData.players.forEach(player => {
                table += `<th>${player}${getPlayerTimeSub(player)}</th>`;
            });
            table += '</tr></thead><tbody>';
            
            gameData.items.forEach((item, itemIndex) => {
                table += `<tr><td><strong>${item.name}${item.negative ? ' (-)' : ''}</strong></td>`;
                gameData.players.forEach((player, playerIndex) => {
                    table += `<td><input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" id="score-${playerIndex}-${itemIndex}" onchange="updateTotalItems(${playerIndex})"></td>`;
                });
                table += '</tr>';
            });
            
            table += '<tr class="total-row"><td><strong>TOTAL</strong></td>';
            gameData.players.forEach((player, playerIndex) => {
                table += `<td><strong id="total-${playerIndex}">0</strong></td>`;
            });
            table += '</tr>';
            
            table += '</tbody></table></div>';
            container.innerHTML = table;

            const continueBtn = document.getElementById('btnScoringContinue');
            const backBtn = document.getElementById('btnScoringBack');
            continueBtn.textContent = 'Calcular Resultados';
            continueBtn.onclick = calculateResults;
            if (gameData.usedTimer) {
                backBtn.style.display = 'inline-block';
                backBtn.onclick = returnToTimerFromScoring;
            } else {
                backBtn.style.display = 'inline-block';
                backBtn.onclick = () => showScreen('scoringSetupScreen');
            }
        }

        function createAllRoundsTable(container) {
            let html = '<div class="table-wrapper">';
            html += '<table class="score-table"><thead><tr><th>Ronda</th>';
            
            gameData.players.forEach(player => {
                html += `<th>${player}${getPlayerTimeSub(player)}</th>`;
            });
            html += '</tr></thead><tbody>';
            
            for (let round = 0; round < gameData.numRounds; round++) {
                html += `<tr><td><strong>R${round + 1}</strong></td>`;
                gameData.players.forEach((player, playerIndex) => {
                    html += `<td><input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" id="score-${playerIndex}-${round}" onchange="updateTotal(${playerIndex})"></td>`;
                });
                html += '</tr>';
            }
            
            html += '<tr class="total-row"><td><strong>TOTAL</strong></td>';
            gameData.players.forEach((player, playerIndex) => {
                html += `<td><strong id="total-${playerIndex}">0</strong></td>`;
            });
            html += '</tr>';
            
            html += '</tbody></table></div>';
            container.innerHTML = html;

            const continueBtn = document.getElementById('btnScoringContinue');
            const backBtn = document.getElementById('btnScoringBack');
            continueBtn.textContent = 'Calcular Resultados';
            continueBtn.onclick = calculateResults;
            if (gameData.usedTimer) {
                backBtn.style.display = 'inline-block';
                backBtn.onclick = returnToTimerFromScoring;
            } else {
                backBtn.style.display = 'inline-block';
                backBtn.onclick = () => showScreen('scoringSetupScreen');
            }
        }

        function createRoundByRoundTable(container) {
            let html = `
                <div class="round-header">
                    <h2>Ronda ${gameData.currentRound} de ${gameData.numRounds}</h2>
                </div>
                <div class="table-wrapper">
                <table class="score-table">
                    <thead>
                        <tr>
                            <th></th>
            `;
            
            gameData.players.forEach(player => {
                html += `<th>${player}${getPlayerTimeSub(player)}</th>`;
            });
            
            html += `</tr></thead><tbody>`;

            // Filas de rondas anteriores ya guardadas
            const completedRounds = gameData.currentRound - 1;
            for (let r = 0; r < completedRounds; r++) {
                html += `<tr><td><strong style="color:var(--text-secondary)">R${r + 1}</strong></td>`;
                gameData.players.forEach((player, playerIndex) => {
                    html += `<td style="color:var(--text-secondary)">${gameData.roundScores[playerIndex][r] ?? 0}</td>`;
                });
                html += '</tr>';
            }

            html += `<tr><td><strong>R${gameData.currentRound}</strong></td>`;
            
            gameData.players.forEach((player, playerIndex) => {
                html += `<td><input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" id="round-score-${playerIndex}" style="width: 100%;"></td>`;
            });
            
            html += `</tr><tr class="total-row"><td><strong>Total</strong></td>`;
            
            gameData.players.forEach((player, playerIndex) => {
                const currentTotal = gameData.roundScores[playerIndex].reduce((sum, score) => sum + score, 0);
                html += `<td><strong>${currentTotal}</strong></td>`;
            });
            
            html += `</tr></tbody></table></div>`;
            
            container.innerHTML = html;
            
            const continueBtn = document.getElementById('btnScoringContinue');
            const backBtn = document.getElementById('btnScoringBack');

            if (gameData.currentRound < gameData.numRounds) {
                continueBtn.textContent = 'Siguiente Ronda →';
                continueBtn.onclick = saveRoundAndContinue;
            } else {
                continueBtn.textContent = 'Calcular Resultados';
                continueBtn.onclick = saveRoundAndFinish;
            }

            if (gameData.usedTimer) {
                backBtn.style.display = 'inline-block';
                backBtn.onclick = () => returnToTimerFromScoring();
            } else if (gameData.currentRound > 1) {
                backBtn.style.display = 'inline-block';
                backBtn.onclick = () => scoringGoBack();
            } else {
                backBtn.style.display = 'none';
            }
        }

        function saveRoundAndContinue() {
            gameData.players.forEach((player, playerIndex) => {
                const score = parseInt(document.getElementById(`round-score-${playerIndex}`).value) || 0;
                gameData.roundScores[playerIndex].push(score);
            });
            gameData.currentRound++;
            if (gameData.usedTimer) {
                returnToTimerFromScoring();
            } else {
                createRoundByRoundTable(document.getElementById('scoringTableContainer'));
            }
        }

        function scoringGoBack() {
            if (gameData.usedTimer) {
                returnToTimerFromScoring();
                return;
            }
            if (gameData.currentRound <= 1) return;
            gameData.currentRound--;
            if (gameData.scoringType === 'rounds_with_items') {
                gameData.roundItemScores.forEach(ps => ps.pop());
                createRoundWithItemsTable(document.getElementById('scoringTableContainer'));
            } else if (gameData.scoringType === 'target_score') {
                gameData.roundScores.forEach(ps => ps.pop());
                createTargetScoreTable(document.getElementById('scoringTableContainer'));
            } else {
                gameData.roundScores.forEach(ps => ps.pop());
                createRoundByRoundTable(document.getElementById('scoringTableContainer'));
            }
        }

        function returnToTimerFromScoring() {
            // Si está activado reordenar entre rondas, mostrar overlay de orden
            if (gameData.reorderEachRound) {
                renderOrderList();
                showScreen('timerScreen');
                document.getElementById('orderOverlay').classList.add('visible');
                return;
            }
            showScreen('timerScreen');
            // Reiniciar el temporizador para la nueva ronda
            timerData.currentPlayerIndex = 0;
            if (gameData.timerMode === 'chess') {
                timerData.timeRemaining = timerData.playerTimeRemaining[0];
            } else {
                timerData.timeRemaining = gameData.timePerPlayer;
            }
            timerData.isPaused = false;
            document.getElementById('pauseIcon').innerHTML = SVG_PAUSE;
            updateTimerDisplay();
            startCountdown();
        }

        function saveRoundAndFinish() {
            gameData.players.forEach((player, playerIndex) => {
                const score = parseInt(document.getElementById(`round-score-${playerIndex}`).value) || 0;
                gameData.roundScores[playerIndex].push(score);
            });
            
            calculateRoundByRoundResults();
        }

        function createTargetScoreTable(container) {
            // Calcular totales actuales
            const totals = gameData.players.map((player, playerIndex) =>
                gameData.roundScores[playerIndex].reduce((sum, s) => sum + s, 0)
            );

            // Comprobar si alguien ya ha ganado
            const winnerIndex = totals.findIndex(t => t >= gameData.targetScore);

            let html = `
                <div class="round-header">
                    <h2>Ronda ${gameData.currentRound} · Meta: ${gameData.targetScore} pts</h2>
                </div>
                <div class="table-wrapper">
                <table class="score-table">
                    <thead>
                        <tr><th></th>
            `;

            gameData.players.forEach(player => {
                html += `<th>${player}${getPlayerTimeSub(player)}</th>`;
            });

            html += `</tr></thead><tbody>`;

            // Filas de rondas anteriores ya guardadas
            const completedRounds = gameData.currentRound - 1;
            for (let r = 0; r < completedRounds; r++) {
                html += `<tr><td><strong style="color:var(--text-secondary)">R${r + 1}</strong></td>`;
                gameData.players.forEach((player, playerIndex) => {
                    html += `<td style="color:var(--text-secondary)">${gameData.roundScores[playerIndex][r] ?? 0}</td>`;
                });
                html += '</tr>';
            }

            html += `<tr><td><strong>R${gameData.currentRound}</strong></td>`;

            gameData.players.forEach((player, playerIndex) => {
                html += `<td><input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" id="round-score-${playerIndex}" style="width: 100%;"></td>`;
            });

            html += `</tr><tr class="total-row"><td><strong>Total</strong></td>`;

            gameData.players.forEach((player, playerIndex) => {
                const color = totals[playerIndex] >= gameData.targetScore ? '#2ecc71' : '';
                html += `<td><strong${color ? ` style="color:${color}"` : ''}>${totals[playerIndex]}</strong></td>`;
            });

            html += `</tr></tbody></table></div>`;

            container.innerHTML = html;

            const continueBtn = document.getElementById('btnScoringContinue');
            const backBtn = document.getElementById('btnScoringBack');

            if (winnerIndex !== -1) {
                continueBtn.textContent = 'Ver Resultados';
                continueBtn.onclick = saveTargetRoundAndFinish;
                backBtn.style.display = 'none';
            } else {
                continueBtn.textContent = 'Siguiente Ronda →';
                continueBtn.onclick = saveTargetRoundAndContinue;
                if (gameData.usedTimer) {
                    backBtn.style.display = 'inline-block';
                    backBtn.onclick = () => returnToTimerFromScoring();
                } else if (gameData.currentRound > 1) {
                    backBtn.style.display = 'inline-block';
                    backBtn.onclick = () => scoringGoBack();
                } else {
                    backBtn.style.display = 'none';
                }
            }
        }

        function saveTargetRoundAndContinue() {
            gameData.players.forEach((player, playerIndex) => {
                const score = parseInt(document.getElementById(`round-score-${playerIndex}`).value) || 0;
                gameData.roundScores[playerIndex].push(score);
            });

            // Comprobar si alguien alcanzó el objetivo tras guardar
            const totals = gameData.players.map((p, i) =>
                gameData.roundScores[i].reduce((sum, s) => sum + s, 0)
            );
            const someoneWon = totals.some(t => t >= gameData.targetScore);

            gameData.currentRound++;

            if (someoneWon) {
                calculateRoundByRoundResults();
            } else if (gameData.usedTimer) {
                returnToTimerFromScoring();
            } else {
                createTargetScoreTable(document.getElementById('scoringTableContainer'));
            }
        }

        function saveTargetRoundAndFinish() {
            // La puntuación ya estaba guardada antes de que apareciera el botón "Ver Resultados"
            // Solo calculamos resultados
            calculateRoundByRoundResults();
        }

        function calculateRoundByRoundResults() {
            const results = gameData.players.map((player, index) => ({
                player: player,
                score: gameData.roundScores[index].reduce((sum, score) => sum + score, 0)
            }));
            
            showFinalResults(results);
        }

        function createRoundWithItemsTable(container) {
            let html = `
                <div class="round-header">
                    <h2>Ronda ${gameData.currentRound} de ${gameData.numRounds}</h2>
                </div>
                <div class="table-wrapper">
                <table class="score-table">
                    <thead>
                        <tr>
                            <th>Ítem</th>
            `;
            
            gameData.players.forEach(player => {
                html += `<th>${player}${getPlayerTimeSub(player)}</th>`;
            });
            
            html += `</tr></thead><tbody>`;

            // Filas de rondas anteriores ya guardadas
            const completedRounds = gameData.currentRound - 1;
            for (let r = 0; r < completedRounds; r++) {
                // Mostrar una fila por ítem de rondas anteriores
                gameData.roundItems.forEach((item, itemIndex) => {
                    html += `<tr><td style="color:var(--text-secondary)"><em>R${r+1} ${item.name}${item.negative ? ' (-)' : ''}</em></td>`;
                    gameData.players.forEach((player, playerIndex) => {
                        const val = gameData.roundItemScores[playerIndex][r]?.[itemIndex] ?? 0;
                        html += `<td style="color:var(--text-secondary)">${val}</td>`;
                    });
                    html += '</tr>';
                });
                // Subtotal de esa ronda
                html += `<tr style="border-top:2px solid var(--border-color)"><td><strong style="color:var(--text-secondary)">Subtotal R${r+1}</strong></td>`;
                gameData.players.forEach((player, playerIndex) => {
                    let roundTotal = 0;
                    gameData.roundItems.forEach((item, itemIndex) => {
                        const val = gameData.roundItemScores[playerIndex][r]?.[itemIndex] ?? 0;
                        roundTotal += item.negative ? -val : val;
                    });
                    html += `<td><strong style="color:var(--text-secondary)">${roundTotal}</strong></td>`;
                });
                html += '</tr>';
            }
            
            gameData.roundItems.forEach((item, itemIndex) => {
                const isFirst = itemIndex === 0;
                html += `<tr${isFirst ? ' style="border-top:2px solid var(--primary-color)"' : ''}><td><strong>${item.name}${item.negative ? ' (-)' : ''}</strong></td>`;
                gameData.players.forEach((player, playerIndex) => {
                    html += `<td><input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="0" id="round-item-${playerIndex}-${itemIndex}" style="width: 100%;"></td>`;
                });
                html += '</tr>';
            });
            
            html += '<tr class="total-row"><td><strong>Total Ronda</strong></td>';
            gameData.players.forEach((player, playerIndex) => {
                html += `<td><strong id="round-total-${playerIndex}">0</strong></td>`;
            });
            html += '</tr>';
            
            html += '<tr class="total-row"><td><strong>Total Acumulado</strong></td>';
            gameData.players.forEach((player, playerIndex) => {
                const accumulated = calculateAccumulatedTotal(playerIndex);
                html += `<td><strong>${accumulated}</strong></td>`;
            });
            html += '</tr></tbody></table></div>';
            
            container.innerHTML = html;
            
            gameData.roundItems.forEach((item, itemIndex) => {
                gameData.players.forEach((player, playerIndex) => {
                    const input = document.getElementById(`round-item-${playerIndex}-${itemIndex}`);
                    if (input) {
                        input.addEventListener('input', () => updateRoundTotal(playerIndex));
                    }
                });
            });
            
            const continueBtn = document.getElementById('btnScoringContinue');
            const backBtn = document.getElementById('btnScoringBack');
            if (gameData.currentRound < gameData.numRounds) {
                continueBtn.textContent = 'Siguiente Ronda →';
                continueBtn.onclick = saveRoundWithItemsAndContinue;
            } else {
                continueBtn.textContent = 'Calcular Resultados';
                continueBtn.onclick = saveRoundWithItemsAndFinish;
            }
            if (gameData.usedTimer) {
                backBtn.style.display = 'inline-block';
                backBtn.onclick = () => returnToTimerFromScoring();
            } else if (gameData.currentRound > 1) {
                backBtn.style.display = 'inline-block';
                backBtn.onclick = () => scoringGoBack();
            } else {
                backBtn.style.display = 'none';
            }
        }

        function updateRoundTotal(playerIndex) {
            let total = 0;
            gameData.roundItems.forEach((item, itemIndex) => {
                const el = document.getElementById(`round-item-${playerIndex}-${itemIndex}`);
                const value = el ? (parseInt(el.value) || 0) : 0;
                total += item.negative ? -value : value;
            });
            const totalElement = document.getElementById(`round-total-${playerIndex}`);
            if (totalElement) {
                totalElement.textContent = total;
            }
        }

        function calculateAccumulatedTotal(playerIndex) {
            let total = 0;
            gameData.roundItemScores[playerIndex].forEach(roundScores => {
                roundScores.forEach((score, itemIndex) => {
                    const item = gameData.roundItems[itemIndex];
                    total += item.negative ? -score : score;
                });
            });
            return total;
        }

        function saveRoundWithItemsAndContinue() {
            _saveCurrentRoundWithItemsIfNeeded();
            gameData.currentRound++;
            if (gameData.usedTimer) {
                returnToTimerFromScoring();
            } else {
                createRoundWithItemsTable(document.getElementById('scoringTableContainer'));
            }
        }

        function saveRoundWithItemsAndFinish() {
            _saveCurrentRoundWithItemsIfNeeded();
            calculateRoundWithItemsResults();
        }

        function calculateRoundWithItemsResults() {
            const results = gameData.players.map((player, index) => {
                let total = 0;
                gameData.roundItemScores[index].forEach(roundScores => {
                    roundScores.forEach((score, itemIndex) => {
                        const item = gameData.roundItems[itemIndex];
                        total += item.negative ? -score : score;
                    });
                });
                return { player: player, score: total };
            });
            
            showFinalResults(results);
        }

        function updateTotal(playerIndex) {
            let total = 0;
            for (let round = 0; round < gameData.numRounds; round++) {
                const value = parseInt(document.getElementById(`score-${playerIndex}-${round}`).value) || 0;
                total += value;
            }
            document.getElementById(`total-${playerIndex}`).textContent = total;
        }

        function updateTotalItems(playerIndex) {
            let total = 0;
            gameData.items.forEach((item, itemIndex) => {
                const value = parseInt(document.getElementById(`score-${playerIndex}-${itemIndex}`).value) || 0;
                total += item.negative ? -value : value;
            });
            document.getElementById(`total-${playerIndex}`).textContent = total;
        }

        function showFinalResults(results) {
            results.sort((a, b) => b.score - a.score);

            // Añadir colores del jugador si están disponibles
            results.forEach(r => {
                const idx = gameData.players.indexOf(r.player);
                if (idx !== -1 && gameData.playerColors[idx]) {
                    r.color = gameData.playerColors[idx];
                    r.gradient = (gameData.playerGradients && gameData.playerGradients[idx]) || null;
                }
            });

            // Detectar grupos de empate
            const tieGroups = [];
            let i = 0;
            while (i < results.length) {
                let j = i + 1;
                while (j < results.length && results[j].score === results[i].score) j++;
                if (j - i > 1) {
                    tieGroups.push({ startIndex: i, players: results.slice(i, j) });
                }
                i = j;
            }

            if (tieGroups.length > 0) {
                // Hay empates: mostrar modal de desempate secuencial
                _resolveTiesSequentially(tieGroups, 0, results, function(resolvedResults) {
                    _finalizeFinalResults(resolvedResults);
                });
            } else {
                _finalizeFinalResults(results);
            }
        }

        function _finalizeFinalResults(results) {
            gameData.lastResults = results;
            saveToHistory(results);
            document.getElementById('gameDisplayResults') && (document.getElementById('gameDisplayResults').textContent = gameData.gameName);
            renderResultItems(results, document.getElementById('resultsWinner'), document.getElementById('resultsContainer'));
            showScreen('resultsScreen');
        }

        function _resolveTiesSequentially(tieGroups, groupIndex, results, callback) {
            if (groupIndex >= tieGroups.length) {
                callback(results);
                return;
            }

            const group = tieGroups[groupIndex];
            const startPos = group.startIndex + 1; // posición 1-based

            _showTiebreakerModal(
                group.players,
                startPos,
                groupIndex,
                tieGroups.length,
                function(orderedPlayers) {
                    // Reemplazar el segmento en results con el orden elegido
                    for (let k = 0; k < orderedPlayers.length; k++) {
                        results[group.startIndex + k] = orderedPlayers[k];
                    }
                    _resolveTiesSequentially(tieGroups, groupIndex + 1, results, callback);
                }
            );
        }

        function _showTiebreakerModal(players, startPos, currentGroup, totalGroups, callback) {
            let orderedPlayers = [...players];

            const overlay = document.createElement('div');
            overlay.className = 'tiebreaker-overlay';
            document.body.appendChild(overlay);

            function posLabel(pos) {
                return pos === 1 ? '🥇 1.º' : pos === 2 ? '🥈 2.º' : pos === 3 ? '🥉 3.º' : pos + '.º';
            }

            function render() {
                const progressHTML = totalGroups > 1
                    ? `<div class="tiebreaker-progress">Empate ${currentGroup + 1} de ${totalGroups}</div>`
                    : '';
                const score = orderedPlayers[0].score;

                const modal = document.createElement('div');
                modal.className = 'tiebreaker-modal';
                modal.innerHTML = `
                    <div class="tiebreaker-title">¡Hay un empate!</div>
                    <div class="tiebreaker-subtitle">Estos jugadores han quedado empatados a <strong>${score} puntos</strong>.<br>Usa las flechas para ordenarlos.</div>
                    ${progressHTML}
                    <div class="tiebreaker-list" id="tiebreakerList"></div>
                    <div class="tiebreaker-actions">
                        <button class="tiebreaker-confirm-btn" id="tiebreakerConfirm">Confirmar orden ✓</button>
                    </div>
                `;
                overlay.innerHTML = '';
                overlay.appendChild(modal);

                const list = modal.querySelector('#tiebreakerList');
                orderedPlayers.forEach((p, i) => {
                    const color = p.color || '#667eea';
                    const div = document.createElement('div');
                    div.className = 'order-item';
                    div.style.background = p.gradient || color;
                    div.style.borderColor = color;
                    div.innerHTML = `
                        <span class="order-player-name" style="color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.4);">${p.player}</span>
                        <div class="order-controls">
                            <button class="order-btn" data-dir="up" data-i="${i}" ${i === 0 ? 'disabled' : ''}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                            </button>
                            <button class="order-btn" data-dir="down" data-i="${i}" ${i === orderedPlayers.length - 1 ? 'disabled' : ''}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                        </div>
                    `;
                    list.appendChild(div);
                });

                list.querySelectorAll('.order-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const i = parseInt(btn.dataset.i);
                        const dir = btn.dataset.dir;
                        if (dir === 'up' && i > 0) {
                            [orderedPlayers[i], orderedPlayers[i - 1]] = [orderedPlayers[i - 1], orderedPlayers[i]];
                        } else if (dir === 'down' && i < orderedPlayers.length - 1) {
                            [orderedPlayers[i], orderedPlayers[i + 1]] = [orderedPlayers[i + 1], orderedPlayers[i]];
                        }
                        render();
                    });
                });

                modal.querySelector('#tiebreakerConfirm').addEventListener('click', () => {
                    document.body.removeChild(overlay);
                    callback(orderedPlayers);
                });
            }

            render();
        }

        const MEDAL = ['1', '2', '3'];
        const WINNER_COLORS = ['#e8a838','#3b82f6','#8b5cf6','#10b981','#ef4444','#f97316','#ec4899','#06b6d4'];

        function renderResultItems(results, winnerEl, listEl) {
            winnerEl.innerHTML = '';
            listEl.innerHTML = '';
            if (!results || results.length === 0) return;

            // Winner card
            const winner = results[0];
            const color = winner.color || WINNER_COLORS[0];
            const card = document.createElement('div');
            card.className = 'results-winner-card';
            card.style.background = winner.gradient || color;
            card.innerHTML = `
                <div class="results-winner-crown"><svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg></div>
                <div class="results-winner-name">${winner.player}</div>
                <div class="results-winner-score">${winner.score} puntos</div>
                <div class="results-winner-label">Ganador</div>
            `;
            winnerEl.appendChild(card);

            // Rest of players
            results.slice(1).forEach((result, i) => {
                const delay = (i * 80) + 'ms';
                const div = document.createElement('div');
                div.className = 'result-item';
                div.style.animationDelay = delay;
                div.innerHTML = `
                    <div class="result-item-left">
                        <span class="result-position">${MEDAL[i + 1] || (i + 2) + 'º'}</span>
                        <span class="result-player-name">${result.player}</span>
                    </div>
                    <span class="result-item-right">${result.score} pts</span>
                `;
                listEl.appendChild(div);
            });
        }

        function calculateResults() {
            if (gameData.scoringType === 'rounds_with_items') {
                // Guardar los valores actuales del DOM si existen, luego calcular
                _saveCurrentRoundWithItemsIfNeeded();
                calculateRoundWithItemsResults();
                return;
            }
            if ((gameData.scoringType === 'rounds' && gameData.roundScoringMode === 'round_by_round') ||
                gameData.scoringType === 'target_score') {
                _saveCurrentRoundIfNeeded();
                calculateRoundByRoundResults();
                return;
            }
            // items o rounds all_at_end: leer valores del DOM y guardar en gameData
            if (gameData.scoringType === 'items') {
                gameData.itemScores = gameData.players.map((player, playerIndex) =>
                    gameData.items.map((item, itemIndex) => {
                        const el = document.getElementById(`score-${playerIndex}-${itemIndex}`);
                        return el ? (parseInt(el.value) || 0) : 0;
                    })
                );
            } else if (gameData.scoringType === 'rounds') {
                // all_at_end: guardar scores de rondas
                gameData.roundScores = gameData.players.map((player, playerIndex) =>
                    Array.from({ length: gameData.numRounds }, (_, round) => {
                        const el = document.getElementById(`score-${playerIndex}-${round}`);
                        return el ? (parseInt(el.value) || 0) : 0;
                    })
                );
            }
            const results = gameData.players.map((player, index) => ({
                player: player,
                score: parseInt(document.getElementById(`total-${index}`)?.textContent) || 0
            }));
            
            showFinalResults(results);
        }

        function _saveCurrentRoundWithItemsIfNeeded() {
            // Solo guardar si el número de rondas guardadas es menor que currentRound
            const alreadySaved = gameData.roundItemScores[0]?.length >= gameData.currentRound;
            if (alreadySaved) return;
            gameData.players.forEach((player, playerIndex) => {
                const roundScores = [];
                gameData.roundItems.forEach((item, itemIndex) => {
                    const el = document.getElementById(`round-item-${playerIndex}-${itemIndex}`);
                    roundScores.push(el ? (parseInt(el.value) || 0) : 0);
                });
                gameData.roundItemScores[playerIndex].push(roundScores);
            });
        }

        function _saveCurrentRoundIfNeeded() {
            const alreadySaved = gameData.roundScores[0]?.length >= gameData.currentRound;
            if (alreadySaved) return;
            gameData.players.forEach((player, playerIndex) => {
                const el = document.getElementById(`round-score-${playerIndex}`);
                const score = el ? (parseInt(el.value) || 0) : 0;
                gameData.roundScores[playerIndex].push(score);
            });
        }

        function generarEnlacePartida(entrada) {
            const datos = {
                g: entrada.gameName,
                e: entrada.emoji || '🎲',
                d: entrada.date,
                r: (entrada.results || []).map(r => ({ p: r.player, s: r.score }))
            };
            const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(datos))));
            return `https://jegomei.github.io/BGTime/?partida=${encoded}`;
        }

        function shareResults() {
            let results;
            
            if ((gameData.scoringType === 'rounds' && gameData.roundScoringMode === 'round_by_round') ||
                gameData.scoringType === 'target_score') {
                results = gameData.players.map((player, index) => ({
                    player: player,
                    score: gameData.roundScores[index].reduce((sum, score) => sum + score, 0)
                }));
            } else if (gameData.scoringType === 'rounds_with_items') {
                results = gameData.players.map((player, index) => {
                    let total = 0;
                    gameData.roundItemScores[index].forEach(roundScores => {
                        roundScores.forEach((score, itemIndex) => {
                            const item = gameData.roundItems[itemIndex];
                            total += item.negative ? -score : score;
                        });
                    });
                    return { player: player, score: total };
                });
            } else {
                results = gameData.players.map((player, index) => ({
                    player: player,
                    score: parseInt(document.getElementById(`total-${index}`).textContent)
                }));
            }
            
            results.sort((a, b) => b.score - a.score);

            // Emoji e nombre del juego
            const templateIndex = document.getElementById('templateSelect').value;
            const tplEmoji = (templateIndex !== '' && typeof GAME_TEMPLATES !== 'undefined')
                ? ((window._allTemplates || GAME_TEMPLATES)[parseInt(templateIndex)].emoji || '🎲')
                : '🎲';

            let shareText = `${tplEmoji} ${gameData.gameName}\n`;
            
            if (gameData.usedTimer && gameData.gameEndTime) {
                const totalTime = Math.floor((gameData.gameEndTime - gameData.gameStartTime) / 1000);
                const minutes = Math.floor(totalTime / 60);
                const seconds = totalTime % 60;
                shareText += `⏱️ ${minutes}m ${seconds}s\n`;
            }

            shareText += '\n';
            
            let fastestPlayer = -1;
            let slowestPlayer = -1;
            
            if (gameData.usedTimer && gameData.playerTotalTimes.length > 0) {
                const maxTime = Math.max(...gameData.playerTotalTimes);
                const minTime = Math.min(...gameData.playerTotalTimes.filter(t => t > 0));
                
                if (maxTime > 0) {
                    slowestPlayer = gameData.playerTotalTimes.indexOf(maxTime);
                }
                if (minTime > 0 && minTime < maxTime) {
                    fastestPlayer = gameData.playerTotalTimes.indexOf(minTime);
                }
            }
            
            results.forEach((result, index) => {
                const originalIndex = gameData.players.indexOf(result.player);
                let playerLine = `${index + 1}. ${result.player}: ${result.score} pts`;
                
                if (gameData.usedTimer) {
                    if (originalIndex === fastestPlayer) playerLine += ' 🐇';
                    if (originalIndex === slowestPlayer) playerLine += ' 🐢';
                }
                
                if (index === 0) playerLine += ' 👑';
                
                shareText += playerLine + '\n';
            });
            
            shareText += `\nÚnete a BGTime - https://jegomei.github.io/BGTime/`;

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(shareText).then(() => {
                    alert('✅ Resultados copiados al portapapeles!\n\nAhora puedes pegarlos en WhatsApp, Telegram, etc.');
                }).catch(err => {
                    fallbackCopyText(shareText);
                });
            } else {
                fallbackCopyText(shareText);
            }
        }

        function fallbackCopyText(text) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                alert('✅ Resultados copiados al portapapeles!\n\nAhora puedes pegarlos en WhatsApp, Telegram, etc.');
            } catch (err) {
                alert('Copia este texto:\n\n' + text);
            }
            
            document.body.removeChild(textArea);
        }

        const SAFE_SCREENS = new Set(["setupScreen", "resultsScreen", "historyScreen"]);

        function resetGame() {
            const activeScreen = document.querySelector(".screen.active");
            const screenId = activeScreen ? activeScreen.id : "setupScreen";
            if (!SAFE_SCREENS.has(screenId)) {
                document.getElementById("confirmResetModal").style.display = "flex";
                return;
            }
            doResetGame();
        }

        function confirmReset() {
            closeConfirmModal();
            doResetGame();
        }

        function closeConfirmModal(e) {
            if (e && e.target !== document.getElementById("confirmResetModal")) return;
            document.getElementById("confirmResetModal").style.display = "none";
        }

        function doResetGame() {
            if (timerData.interval) {
                clearInterval(timerData.interval);
            }
            // Liberar Wake Lock al resetear el juego
            releaseWakeLock();
            localStorage.removeItem('bgtime_state');
            
            gameData = {
                gameName: '',
                players: [],
                playerColors: [],
                timePerPlayer: 60,
                timerMode: 'per_turn',
                reorderEachRound: true,
                hasTemplate: false,
                scoringType: 'rounds',
                roundScoringMode: 'all_at_end',
                numRounds: 5,
                targetScore: 40,
                currentRound: 1,
                roundScores: [],
                items: [],
                roundItems: [],
                roundItemScores: [],
                orderedPlayers: [],
                orderedColors: [],
            orderedGradients: [],
                usedTimer: false,
                gameStartTime: null,
                gameEndTime: null,
                playerTotalTimes: []
            };
            
            timerData = {
                currentPlayerIndex: 0,
                timeRemaining: 60,
                interval: null,
                isPaused: false,
                playerTimeUsed: [],
                playerTimeRemaining: null
            };
            
            document.getElementById('gameName').value = '';
            document.getElementById('gameNameError').textContent = '';
            document.getElementById('reorderEachRound').checked = true;
            clearLibrarySelection();
            document.getElementById('playersContainer').innerHTML = `
                <div class="player-input-row">
                    <input type="text" placeholder="Nombre del jugador 1" class="player-name">
                    <button class="player-color-btn" style="background:#e74c3c;" data-color="#e74c3c" onclick="openColorPicker(this)" title="Color del jugador"></button>
                    <button onclick="removePlayerInput(this)" class="remove-player-btn" style="display: none;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
                <div class="player-input-row">
                    <input type="text" placeholder="Nombre del jugador 2" class="player-name">
                    <button class="player-color-btn" style="background:#3498db;" data-color="#3498db" onclick="openColorPicker(this)" title="Color del jugador"></button>
                    <button onclick="removePlayerInput(this)" class="remove-player-btn" style="display: none;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
            `;
            document.getElementById('itemsContainer').innerHTML = `
                <div class="scoring-item">
                    <input type="text" placeholder="Nombre del ítem (ej: Ciudades)" class="item-name">
                    <div class="scoring-item-footer">
                        <label class="resta-toggle">
                            <input type="checkbox" class="item-negative">
                            <span class="resta-toggle-pill"></span>
                            <span class="resta-toggle-label">Resta puntos</span>
                        </label>
                        <button class="item-delete-btn" onclick="removeItem(this)" title="Eliminar ítem"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                    </div>
                </div>
            `;
            
            showScreen('setupScreen');
        }

        const SVG_MOON = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
        const SVG_SUN  = '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>';

        // ── HISTORIAL ──────────────────────────────────────────────
        function saveToHistory(results) {
            const history = getHistory();
            const templateIndex = document.getElementById('templateSelect').value;
            const tplEmoji = (templateIndex !== '' && typeof GAME_TEMPLATES !== 'undefined')
                ? ((window._allTemplates || GAME_TEMPLATES)[parseInt(templateIndex)].emoji || '🎲')
                : '🎲';

            const entry = {
                id: Date.now(),
                date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }),
                gameName: gameData.gameName,
                emoji: tplEmoji,
                results: results.map(r => ({ player: r.player, score: r.score })),
                scoringType: gameData.scoringType,
                roundScoringMode: gameData.roundScoringMode,
                players: [...gameData.players],
                numRounds: gameData.numRounds,
                targetScore: gameData.targetScore,
                roundScores: gameData.roundScores ? gameData.roundScores.map(r => [...r]) : [],
                items: gameData.items ? [...gameData.items] : [],
                itemScores: gameData.itemScores ? gameData.itemScores.map(r => [...r]) : [],
                roundItems: gameData.roundItems ? [...gameData.roundItems] : [],
                roundItemScores: gameData.roundItemScores ? gameData.roundItemScores.map(r => r.map(rr => [...rr])) : [],
                usedTimer: gameData.usedTimer || false,
                orderedPlayers: gameData.orderedPlayers ? [...gameData.orderedPlayers] : [],
                playerTotalTimes: gameData.playerTotalTimes ? [...gameData.playerTotalTimes] : []
            };

            history.unshift(entry);

            // Guardar máximo 50 partidas (logueado) o 5 (sin login)
            const limit = window._fbIsLoggedIn?.() ? 50 : 5;
            saveHistory(history.slice(0, limit));

            // Subir a Firestore si hay sesión
            if (window._fbSaveEntry) window._fbSaveEntry(entry);

            // ── Auto-guardar plantilla si el juego es personalizado ──────
            // Solo cuando el usuario escribió un nombre de juego libre (templateIndex === '')
            if (templateIndex === '') {
                _autoSaveGameAsTemplate(gameData);
            }
        }

        // Guarda automáticamente un juego personalizado como plantilla si aún no existe
        function _autoSaveGameAsTemplate(gd) {
            if (!gd || !gd.gameName) return;
            const list = getCustomTemplates();
            const nameNorm = gd.gameName.trim().toLowerCase();

            // Si ya existe una plantilla con ese nombre (ignorando mayúsculas), no duplicar
            const alreadyExists = list.some(t => t.name.trim().toLowerCase() === nameNorm);
            if (alreadyExists) return;

            // Construir la plantilla a partir de los datos de la partida
            const scoringType = gd.scoringType || 'rounds';
            const tpl = {
                id: Date.now(),
                name: gd.gameName.trim(),
                emoji: '🎲',
                scoringType,
                numRounds: gd.numRounds || 5,
                targetScore: gd.targetScore || 40,
                roundScoringMode: gd.roundScoringMode || 'all_at_end',
                items: scoringType === 'items'
                    ? (gd.items || []).map(it => ({ name: it.name || it, negative: it.negative || false }))
                    : [],
                roundItems: scoringType === 'rounds_with_items'
                    ? (gd.roundItems || []).map(it => ({ name: it.name || it, negative: it.negative || false }))
                    : [],
                _autoSaved: true   // marca interna para distinguirlas si se necesita en el futuro
            };

            list.push(tpl);
            saveCustomTemplates(list);
        }

        let previousScreenId = 'setupScreen';


        function renderHistoryList(showAll = false) {
            const history = getHistory();
            const container = document.getElementById('historyContainer');
            container.innerHTML = '';

            if (history.length === 0) {
                container.innerHTML += '<div class="history-empty">Aún no hay partidas guardadas.<br>¡Juega una partida para verla aquí!</div>';
                return;
            }

            const LIMIT = 5;
            const visible = showAll ? history : history.slice(0, LIMIT);

            visible.forEach(entry => {
                const card = document.createElement('div');
                card.className = 'history-card';

                // Pills de jugadores
                const pillsHtml = entry.results.map((r, i) => {
                    const crownSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="flex-shrink:0;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
                    const scoreStr = typeof r.score === 'number' ? ` · ${r.score} pts` : '';
                    return `<span class="history-card-player-pill${i === 0 ? ' winner' : ''}">${i === 0 ? crownSvg : ''}${r.player}${scoreStr}</span>`;
                }).join('');

                const isLoggedIn = window._fbIsLoggedIn && window._fbIsLoggedIn();
                const synced = window._syncedIds && window._syncedIds.has(entry.id);
                const syncIcon = (isLoggedIn && !synced)
                    ? `<span style="display:inline-flex;align-items:center;color:#e74c3c;flex-shrink:0;" title="No sincronizado en la nube">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                       </span>`
                    : '';

                const sharedByHtml = entry.sharedBy
                    ? `<div class="shared-by-badge">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                        Añadida por ${entry.sharedBy.nickname || 'un amigo'}
                       </div>`
                    : '';

                card.innerHTML = `
                    <div class="history-card-top">
                        <div class="history-card-emoji">${entry.emoji || '🎲'}</div>
                        <div class="history-card-meta">
                            <div class="history-card-game">${entry.gameName}</div>
                            <div class="history-card-date">${syncIcon}${formatRelativeDate(entry.date)}</div>
                        </div>
                    </div>
                    <div class="history-card-divider"></div>
                    <div class="history-card-players">${pillsHtml}</div>
                    ${sharedByHtml}
                `;
                card.addEventListener('click', () => showHistoryDetail(entry));
                container.appendChild(card);
            });

            if (!showAll && history.length > LIMIT) {
                const remaining = history.length - LIMIT;
                const btn = document.createElement('button');
                btn.className = 'secondary';
                btn.style.cssText = 'width:100%;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;';
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>Ver ${remaining} partida${remaining !== 1 ? 's' : ''} más`;
                btn.addEventListener('click', () => renderHistoryList(true));
                container.appendChild(btn);
            }

            if (!window._fbIsLoggedIn?.()) {
                const msg = document.createElement('p');
                msg.className = 'history-login-hint';
                msg.textContent = 'Para guardar más de 5 partidas, inicia sesión.';
                container.appendChild(msg);
            }
        }

        function clearHistory() {
            const syncNote = document.getElementById('clearHistorySyncNote');
            if (syncNote) syncNote.style.display = window._fbIsLoggedIn && window._fbIsLoggedIn() ? '' : 'none';
            document.getElementById('confirmClearHistoryModal').style.display = 'flex';
        }

        let _currentHistoryEntry = null;

        function closeHistoryDetailModal(e) {
            if (e && e.target !== document.getElementById('historyDetailModal')) return;
            document.getElementById('historyDetailModal').style.display = 'none';
        }

        function deleteHistoryEntry() {
            const entry = _currentHistoryEntry;
            if (!entry) return;
            document.getElementById('deleteEntryDesc').textContent =
                `${entry.emoji} ${entry.gameName} · ${entry.date}. Esta acción no se puede deshacer.`;
            const syncNote = document.getElementById('deleteEntrySyncNote');
            syncNote.style.display = (window._syncedIds && window._syncedIds.has(entry.id)) ? '' : 'none';
            document.getElementById('confirmDeleteEntryModal').style.display = 'flex';
        }

        function closeDeleteEntryModal(e) {
            if (e && e.target !== document.getElementById('confirmDeleteEntryModal')) return;
            document.getElementById('confirmDeleteEntryModal').style.display = 'none';
        }

        function confirmDeleteEntry() {
            const entry = _currentHistoryEntry;
            if (!entry) return;
            const history = getHistory();
            const updated = history.filter(e => e.id !== entry.id);
            saveHistory(updated);
            document.getElementById('confirmDeleteEntryModal').style.display = 'none';
            document.getElementById('historyDetailModal').style.display = 'none';

            // Borrar de Firestore si hay sesión
            if (window._fbDeleteEntry) window._fbDeleteEntry(entry.id);

            showStats();
        }

        function showHistoryDetail(entry) {
            _currentHistoryEntry = entry;
            document.getElementById('historyDetailTitle').textContent = `${entry.emoji} ${entry.gameName} · ${formatRelativeDate(entry.date)}`;
            const container = document.getElementById('historyDetailTable');
            container.innerHTML = buildHistoryDetailTable(entry);
            document.getElementById('historyDetailModal').style.display = 'flex';
        }

        function shareHistoryEntry() {
            const entry = _currentHistoryEntry;
            if (!entry) return;
            const results = [...entry.results].sort((a, b) => b.score - a.score);
            let text = `${entry.emoji} ${entry.gameName}\n📅 ${entry.date}\n\n`;
            results.forEach((r, i) => {
                text += `${i + 1}. ${r.player}: ${r.score} pts${i === 0 ? ' 👑' : ''}\n`;
            });
            text += `\nÚnete a BGTime - https://jegomei.github.io/BGTime/`;

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    alert('✅ Resultados copiados al portapapeles!\n\nAhora puedes pegarlos en WhatsApp, Telegram, etc.');
                }).catch(() => fallbackCopyText(text));
            } else {
                fallbackCopyText(text);
            }
        }

        function buildHistoryDetailTable(entry) {
            const players = entry.players || entry.results.map(r => r.player);
            const type = entry.scoringType;
            let html = '<div class="table-wrapper"><table class="score-table">';

            if (type === 'rounds' || type === 'target_score') {
                const scores = entry.roundScores; // [playerIndex][roundIndex]
                if (scores && scores.length && scores[0].length) {
                    const numRounds = scores[0].length;
                    html += '<thead><tr><th></th>';
                    players.forEach(p => { html += `<th>${p}</th>`; });
                    html += '</tr></thead><tbody>';
                    for (let r = 0; r < numRounds; r++) {
                        html += `<tr><td><strong>R${r+1}</strong></td>`;
                        players.forEach((p, pi) => {
                            html += `<td>${scores[pi]?.[r] ?? 0}</td>`;
                        });
                        html += '</tr>';
                    }
                } else {
                    // Sin detalle de rondas (partida antigua)
                    return buildSimpleResultsTable(entry);
                }
            } else if (type === 'rounds_with_items') {
                const roundItems = entry.roundItems || [];
                const roundItemScores = entry.roundItemScores; // [playerIndex][roundIndex][itemIndex]
                if (roundItems.length && roundItemScores && roundItemScores.length && roundItemScores[0].length) {
                    const numRounds = roundItemScores[0].length;
                    html += '<thead><tr><th>Ítem</th>';
                    players.forEach(p => { html += `<th>${p}</th>`; });
                    html += '</tr></thead><tbody>';
                    for (let r = 0; r < numRounds; r++) {
                        roundItems.forEach((item, ii) => {
                            html += `<tr><td><em${ii === 0 ? ' style="font-weight:600"' : ''}>R${r+1}${ii === 0 ? '' : ''} ${item.name}${item.negative ? ' (-)' : ''}</em></td>`;
                            players.forEach((p, pi) => {
                                const val = roundItemScores[pi]?.[r]?.[ii] ?? 0;
                                html += `<td>${val}</td>`;
                            });
                            html += '</tr>';
                        });
                        // Subtotal de la ronda
                        html += `<tr style="border-top:2px solid var(--border-color)"><td><strong>Subtotal R${r+1}</strong></td>`;
                        players.forEach((p, pi) => {
                            let sub = 0;
                            roundItems.forEach((item, ii) => {
                                const val = roundItemScores[pi]?.[r]?.[ii] ?? 0;
                                sub += item.negative ? -val : val;
                            });
                            html += `<td><strong>${sub}</strong></td>`;
                        });
                        html += '</tr>';
                    }
                } else {
                    return buildSimpleResultsTable(entry);
                }
            } else if (type === 'items') {
                const items = entry.items || [];
                const itemScores = entry.itemScores; // [playerIndex][itemIndex]
                if (items.length && itemScores && itemScores.length) {
                    html += '<thead><tr><th>Ítem</th>';
                    players.forEach(p => { html += `<th>${p}</th>`; });
                    html += '</tr></thead><tbody>';
                    items.forEach((item, ii) => {
                        html += `<tr><td><strong>${item.name}${item.negative ? ' (-)' : ''}</strong></td>`;
                        players.forEach((p, pi) => {
                            html += `<td>${itemScores[pi]?.[ii] ?? 0}</td>`;
                        });
                        html += '</tr>';
                    });
                } else {
                    return buildSimpleResultsTable(entry);
                }
            } else {
                return buildSimpleResultsTable(entry);
            }

            // Fila total
            html += '<tr class="total-row"><td><strong>TOTAL</strong></td>';
            players.forEach((p, pi) => {
                const result = entry.results.find(r => r.player === p);
                html += `<td><strong>${result ? result.score : 0}</strong></td>`;
            });
            html += '</tr></tbody></table></div>';
            return html;
        }

        function buildSimpleResultsTable(entry) {
            const players = entry.players || entry.results.map(r => r.player);
            let html = '<div class="table-wrapper"><table class="score-table">';
            html += '<thead><tr><th>Jugador</th><th>Puntos</th></tr></thead><tbody>';
            entry.results.forEach((r, i) => {
                html += `<tr class="${i === 0 ? 'total-row' : ''}"><td><strong>${i === 0 ? '<span style="display:inline-flex;align-items:center;margin-right:3px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>' : ''}${r.player}</strong></td><td><strong>${r.score}</strong></td></tr>`;
            });
            html += '</tbody></table></div>';
            return html;
        }

        function confirmClearHistory() {
            closeClearHistoryModal();
            // Soft delete de todas las partidas que estén en Firestore
            const history = getHistory();
            history.forEach(entry => {
                if (window._fbDeleteEntry) window._fbDeleteEntry(entry.id);
            });
            removeHistory();
            showStats();
        }

        function closeClearHistoryModal(e) {
            if (e && e.target !== document.getElementById('confirmClearHistoryModal')) return;
            document.getElementById('confirmClearHistoryModal').style.display = 'none';
        }

        // ── PERSISTENCIA DE ESTADO ─────────────────────────────────
        function saveAppState() {
            const activeScreen = document.querySelector('.screen.active');
            if (!activeScreen) return;
            const screenId = activeScreen.id;
            // No persistir pantallas intermedias del temporizador (no restaurables fácilmente)
            if (screenId === 'timerScreen') return;
            try {
                localStorage.setItem('bgtime_state', JSON.stringify({
                    screenId,
                    gameData,
                    timerData: { ...timerData, interval: null }
                }));
            } catch(e) {}
        }

        function restoreAppState() {
            try {
                const saved = localStorage.getItem('bgtime_state');
                if (!saved) return false;
                const { screenId, gameData: gd, timerData: td } = JSON.parse(saved);
                if (!screenId || !gd || screenId === 'setupScreen') return false;

                // Restaurar gameData
                Object.assign(gameData, gd);

                // Restaurar timerData (sin intervalo)
                Object.assign(timerData, td);
                timerData.interval = null;

                // Si estaba en pantalla de resultados, reconstruir la pantalla
                if (screenId === 'resultsScreen') {
                    renderResultsFromGameData();
                }

                // Si estaba puntuando, reconstruir la tabla
                if (screenId === 'scoringScreen') {
                    document.getElementById('gameDisplayFinal').textContent = gameData.gameName;
                    const container = document.getElementById('scoringTableContainer');
                    if (gameData.hasTemplate) {
                        goToScoringScreenWithTemplate();
                        return true;
                    } else {
                        showScreen(screenId);
                        return true;
                    }
                }

                showScreen(screenId);
                return true;
            } catch(e) {
                localStorage.removeItem('bgtime_state');
                return false;
            }
        }

        function renderResultsFromGameData() {
            if (!gameData.lastResults) return;
            renderResultItems(
                gameData.lastResults,
                document.getElementById('resultsWinner'),
                document.getElementById('resultsContainer')
            );
        }


        // ── PWA Install ──────────────────────────────────────────────
        let _deferredInstallPrompt = null;

        // Capturar el evento beforeinstallprompt (Android/Chrome)
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            _deferredInstallPrompt = e;
            _updateInstallCard();
        });

        // Si se instala desde el prompt nativo, ocultar la tarjeta
        window.addEventListener('appinstalled', () => {
            _deferredInstallPrompt = null;
            const card = document.getElementById('installCard');
            if (card) card.style.display = 'none';
        });

        function _isRunningAsPwa() {
            return window.matchMedia('(display-mode: standalone)').matches
                || window.navigator.standalone === true
                || document.referrer.startsWith('android-app://');
        }

        function _isIos() {
            return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
        }

        function _updateInstallCard() {
            const card = document.getElementById('installCard');
            if (!card) return;

            // Si ya está instalada como PWA, ocultar la tarjeta completamente
            if (_isRunningAsPwa()) {
                card.style.display = 'none';
                return;
            }

            // Siempre mostrar la tarjeta si no está instalada
            card.style.display = '';

            // Ocultar todos los sub-bloques primero
            document.getElementById('installCardNative').style.display = 'none';
            document.getElementById('installCardIos').style.display = 'none';
            document.getElementById('installCardAndroid').style.display = 'none';

            if (_deferredInstallPrompt) {
                // Chrome/Edge/Android: hay prompt nativo disponible → botón directo
                document.getElementById('installCardNative').style.display = '';
            } else if (_isIos()) {
                // iOS Safari: instrucciones manuales de iOS
                document.getElementById('installCardIos').style.display = '';
            } else {
                // Resto (escritorio sin prompt, otros navegadores): instrucciones Android/genéricas
                document.getElementById('installCardAndroid').style.display = '';
            }
        }

        function triggerPwaInstall() {
            if (!_deferredInstallPrompt) return;
            _deferredInstallPrompt.prompt();
            _deferredInstallPrompt.userChoice.then((choice) => {
                _deferredInstallPrompt = null;
                if (choice.outcome === 'accepted') {
                    const card = document.getElementById('installCard');
                    if (card) card.style.display = 'none';
                }
            });
        }
        // ── Fin PWA Install ──────────────────────────────────────────

        document.addEventListener('DOMContentLoaded', function() {
            // Inicializar tarjeta de instalación PWA
            _updateInstallCard();
            const installBtn = document.getElementById('installCardBtn');
            if (installBtn) installBtn.addEventListener('click', triggerPwaInstall);

            // Poblar la Biblioteca con las plantillas de games.js + plantillas propias
            rebuildLibrary();
            renderFavoritePills();

            // Inicializar píldoras de jugadores (mostrará el botón +Añadir desde el inicio)
            updatePlayerPills();

            restoreAppState();
        });

        // ── AUTOCOMPLETE BIBLIOTECA ────────────────────────────────
        // Índice ordenado: [{index, name, emoji, label}]
        let _libraryIndex = [];
        let _libraryCloseTimer = null;

        function formatRelativeDate(dateStr) {
            if (!dateStr) return dateStr;
            
            let date;
            
            // Si es un número (timestamp), convertir a Date
            if (typeof dateStr === 'number') {
                date = new Date(dateStr);
                if (isNaN(date.getTime())) return String(dateStr);
            } 
            // Si es un string con formato DD/MM/AA
            else if (typeof dateStr === 'string') {
                const parts = dateStr.split('/');
                if (parts.length !== 3) return dateStr;
                const day   = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year  = 2000 + parseInt(parts[2], 10);
                date = new Date(year, month, day);
                if (isNaN(date.getTime())) return dateStr;
            }
            // Si no es ni número ni string, devolver tal cual
            else {
                return String(dateStr);
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            date.setHours(0, 0, 0, 0);
            const diffDays = Math.round((today - date) / 86400000);

            if (diffDays === 0) return 'Hoy';
            if (diffDays === 1) return 'Ayer';
            if (diffDays <= 7) return `Hace ${diffDays} días`;
            
            // Si era un timestamp, devolver formato legible
            if (typeof dateStr === 'number') {
                return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
            }
            
            return dateStr;
        }

        function normStr(s) {
            return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        }

        function buildLibraryIndex() {
            const source = window._allTemplates || (typeof GAME_TEMPLATES !== 'undefined' ? GAME_TEMPLATES : []);
            const seen = new Map(); // norm → entry, custom gana sobre predefinida
            source.forEach((tpl, i) => {
                const entry = {
                    index: i,
                    name: tpl.name,
                    emoji: tpl.emoji || '🎲',
                    label: `${tpl.emoji || '🎲'} ${tpl.name}`,
                    norm: normStr(tpl.name),
                    _custom: tpl._custom || false
                };
                const existing = seen.get(entry.norm);
                if (!existing || entry._custom) seen.set(entry.norm, entry);
            });
            _libraryIndex = [...seen.values()]
                .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
        }

        function positionLibraryDropdown() {
            const input = document.getElementById('librarySearch');
            const dropdown = document.getElementById('libraryDropdown');
            if (!input || !dropdown) return;
            const rect = input.getBoundingClientRect();
            dropdown.style.top = (rect.bottom + 6) + 'px';
            dropdown.style.left = rect.left + 'px';
            dropdown.style.width = rect.width + 'px';
        }

        function filterLibraryAndSync() {
            // Clear template selection when user types freely
            if (document.getElementById('templateSelect').value !== '') {
                document.getElementById('templateSelect').value = '';
                document.getElementById('libraryClearBtn').style.display = 'none';
            }
            filterLibrary();
        }

        function filterLibrary() {
            const q = normStr(document.getElementById('librarySearch').value.trim());
            const dropdown = document.getElementById('libraryDropdown');

            const matches = q === ''
                ? _libraryIndex
                : _libraryIndex.filter(t => t.norm.includes(q));

            renderDropdown(matches, q);
            positionLibraryDropdown();
            dropdown.style.display = 'block';
        }

        function renderDropdown(items, q) {
            const dropdown = document.getElementById('libraryDropdown');
            dropdown.innerHTML = '';

            if (items.length === 0) {
                dropdown.innerHTML = `<li class="library-dropdown-empty">Sin resultados para "${q}"</li>`;
                return;
            }

            items.forEach(t => {
                const li = document.createElement('li');
                // Resaltar la parte que coincide con la búsqueda
                let nameHtml = escapeHtml(t.name);
                if (q) {
                    const idx = t.norm.indexOf(q);
                    if (idx !== -1) {
                        nameHtml =
                            escapeHtml(t.name.slice(0, idx)) +
                            `<span class="lib-match">${escapeHtml(t.name.slice(idx, idx + q.length))}</span>` +
                            escapeHtml(t.name.slice(idx + q.length));
                    }
                }
                li.innerHTML = `<span>${t.emoji}</span><span>${nameHtml}</span>`;
                li.addEventListener('mousedown', (e) => e.preventDefault()); // evita blur antes de click
                li.addEventListener('click', () => selectLibraryItem(t));
                dropdown.appendChild(li);
            });
        }

        function escapeHtml(str) {
            return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        }

        function selectLibraryItem(t) {
            document.getElementById('templateSelect').value = t.index;
            document.getElementById('librarySearch').value = t.label;
            document.getElementById('libraryClearBtn').style.display = 'flex';
            document.getElementById('libraryDropdown').style.display = 'none';
            document.getElementById('gameNameError').textContent = '';
            updateRemoveButtons();
        }

        // ── Píldoras de plantillas favoritas + recientes ─────────────
        function renderFavoritePills() {
            const container = document.getElementById('favoritePillsContainer');
            if (!container) return;

            const templates  = getCustomTemplates ? getCustomTemplates() : [];
            const favs       = templates.filter(t => t.favorite);
            const favNorms   = new Set(favs.map(t => normStr(t.name)));

            // SVGs
            const starSvg  = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            const clockSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 14.5 14.5"/></svg>`;

            // Favoritas
            const favPills = favs.map(tpl => {
                const origIndex = templates.indexOf(tpl);
                return `<button class="fav-pill" onclick="selectFavoriteTemplate(${origIndex})" title="Cargar plantilla: ${tpl.name}">${starSvg} ${tpl.emoji || '🎲'} ${tpl.name}</button>`;
            }).join('');

            // Recientes: últimas 2 del historial cuyo nombre no coincida con una favorita
            // y que existan en _libraryIndex (es decir, tienen plantilla)
            let recentPills = '';
            try {
                const history = getHistory();
                const seen    = new Set();
                const recents = [];
                for (const entry of history) {
                    if (!entry.gameName) continue;
                    const n = normStr(entry.gameName);
                    if (seen.has(n)) continue;
                    seen.add(n);
                    if (favNorms.has(n)) continue; // ya aparece como favorita
                    // Solo si tiene plantilla en la biblioteca
                    const libEntry = _libraryIndex.find(t => t.norm === n);
                    if (!libEntry) continue;
                    recents.push({ name: entry.gameName, emoji: entry.emoji || libEntry.emoji || '🎲', libEntry });
                    if (recents.length === 2) break;
                }
                recentPills = recents.map(r =>
                    `<button class="recent-pill" onclick="selectRecentTemplate('${r.name.replace(/'/g, "\\'")}', ${r.libEntry.index})" title="Cargar plantilla: ${r.name}">${clockSvg} ${r.emoji} ${r.name}</button>`
                ).join('');
            } catch(e) {}

            if (!favPills && !recentPills) {
                container.innerHTML = '';
                return;
            }
            container.innerHTML = `<div class="fav-pills-row">${favPills}${recentPills}</div>`;
        }

        function selectRecentTemplate(gameName, libIndex) {
            // Igual que selectLibraryItem pero llamando después a goToPlayersScreen
            const libEntry = _libraryIndex.find(t => t.index === libIndex);
            if (!libEntry) return;
            document.getElementById('templateSelect').value = libEntry.index;
            document.getElementById('librarySearch').value  = libEntry.label;
            document.getElementById('libraryClearBtn').style.display = 'flex';
            document.getElementById('libraryDropdown').style.display = 'none';
            document.getElementById('gameNameError').textContent = '';
            goToPlayersScreen();
        }

        function selectFavoriteTemplate(index) {
            const templates = getCustomTemplates ? getCustomTemplates() : [];
            const tpl = templates[index];
            if (!tpl) return;

            // Buscar en _libraryIndex (igual que selectLibraryItem) para obtener el índice global correcto
            const normName = normStr(tpl.name);
            const libEntry = _libraryIndex.find(t => t.norm === normName);
            if (!libEntry) return; // no debería pasar, la plantilla está en la biblioteca

            // Rellenar el campo y el selector oculto exactamente igual que selectLibraryItem
            document.getElementById('templateSelect').value = libEntry.index;
            document.getElementById('librarySearch').value = libEntry.label;
            document.getElementById('libraryClearBtn').style.display = 'flex';
            document.getElementById('libraryDropdown').style.display = 'none';
            document.getElementById('gameNameError').textContent = '';

            // Pasar a la pantalla de jugadores usando el mismo flujo que el botón de flecha
            goToPlayersScreen();
        }
        // ─────────────────────────────────────────────────────────────

        function openLibraryDropdown() {
            cancelCloseLibrary();
            const q = normStr(document.getElementById('librarySearch').value.trim());
            const matches = q === ''
                ? _libraryIndex
                : _libraryIndex.filter(t => t.norm.includes(q));
            renderDropdown(matches, q);
            positionLibraryDropdown();
            document.getElementById('libraryDropdown').style.display = 'block';
        }

        function scheduleCloseLibrary() {
            _libraryCloseTimer = setTimeout(() => {
                document.getElementById('libraryDropdown').style.display = 'none';
            }, 150);
        }

        function cancelCloseLibrary() {
            if (_libraryCloseTimer) clearTimeout(_libraryCloseTimer);
        }

        function clearLibrarySelection() {
            document.getElementById('templateSelect').value = '';
            document.getElementById('librarySearch').value = '';
            document.getElementById('gameName').value = '';
            document.getElementById('libraryClearBtn').style.display = 'none';
            document.getElementById('libraryDropdown').style.display = 'none';
        }

        // ══════════════════════════════════════════════════════════════
        //  AJUSTES — Jugadores habituales, plantillas propias, backup
        // ══════════════════════════════════════════════════════════════

        // ── Helpers de datos (localStorage cuando deslogueado, caché en memoria cuando logueado) ──
        function getHistory() {
            if (window._fbIsLoggedIn?.()) return window._memHistory || [];
            return JSON.parse(localStorage.getItem('bgtime_history') || '[]');
        }
        function saveHistory(arr) {
            if (window._fbIsLoggedIn?.()) { window._memHistory = arr; }
            else { localStorage.setItem('bgtime_history', JSON.stringify(arr)); }
        }
        function removeHistory() {
            window._memHistory = [];
            localStorage.removeItem('bgtime_history');
        }
        function getFrecuentPlayers() {
            if (window._fbIsLoggedIn?.()) return window._memFrecuent || [];
            return JSON.parse(localStorage.getItem('bgtime_frecuent_players') || '[]');
        }
        function saveFrecuentPlayers(list) {
            if (window._fbIsLoggedIn?.()) { window._memFrecuent = list; }
            else { localStorage.setItem('bgtime_frecuent_players', JSON.stringify(list)); }
            if (window._fbSaveSettings) window._fbSaveSettings();
        }
        function getCustomTemplates() {
            if (window._fbIsLoggedIn?.()) return window._memTemplates || [];
            return JSON.parse(localStorage.getItem('bgtime_custom_templates') || '[]');
        }
        function saveCustomTemplates(list) {
            if (window._fbIsLoggedIn?.()) { window._memTemplates = list; }
            else { localStorage.setItem('bgtime_custom_templates', JSON.stringify(list)); }
            rebuildLibrary();
            if (window._fbSaveSettings) window._fbSaveSettings();
        }

        // Mezcla GAME_TEMPLATES con las plantillas personalizadas y reconstruye el índice
        function rebuildLibrary() {
            const custom = getCustomTemplates().map(t => ({ ...t, _custom: true }));
            window._allTemplates = [
                ...(typeof GAME_TEMPLATES !== 'undefined' ? GAME_TEMPLATES : []),
                ...custom
            ];
            buildLibraryIndex();
        }

        // ── Navegación settings ───────────────────────────────────────
        let _settingsPreviousScreen = 'setupScreen';

        function showSettings() {
            const activeScreen = document.querySelector('.screen.active');
            if (activeScreen && activeScreen.id === 'settingsScreen') {
                showScreen(_settingsPreviousScreen, -1);
                return;
            }
            if (activeScreen) _settingsPreviousScreen = activeScreen.id;
            renderSettingsScreen();
            showScreen('settingsScreen', 1);
            // Sincronizar ajustes con Firestore al abrir (por si hay cambios desde otro dispositivo)
            if (window._fbSyncSettings) window._fbSyncSettings();
        }

        // ── Render settings ───────────────────────────────────────────
        function renderSettingsScreen() {
            renderFrecuentPlayersList();
            renderCustomTemplatesList();
            if (window._fbIsLoggedIn && window._fbIsLoggedIn()) {
                renderFriendsList();
                if (window._fbLoadProfile) window._fbLoadProfile();
            }
        }

        // ── Jugadores habituales ──────────────────────────────────────
        function renderFrecuentPlayersList() {
            const connectedNicknames = new Set(
                (_friends || []).map(f => f.nickname && f.nickname.trim().toLowerCase()).filter(Boolean)
            );
            let list = getFrecuentPlayers();

            // Limpiar silenciosamente los jugadores conectados que pudieran haberse colado
            const clean = list.filter(name => !connectedNicknames.has(name.trim().toLowerCase()));
            if (clean.length !== list.length) {
                saveFrecuentPlayers(clean);
                list = clean;
            }

            const container = document.getElementById('frecuentPlayersList');
            if (list.length === 0) {
                container.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;">Aún no hay jugadores guardados.</p>';
                return;
            }
            container.innerHTML = list.map((name, i) => `
                <div class="frecuent-item">
                    <span>${name}</span>
                    <button class="frecuent-item-del" onclick="deleteFrecuentPlayer(${i})" aria-label="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
            `).join('');
        }

        function addFrecuentPlayer() {
            const input = document.getElementById('newFrecuentPlayer');
            const name = input.value.trim();
            if (!name) return;
            // No añadir si ya es un jugador conectado
            if (_friends && _friends.some(f => f.nickname && f.nickname.trim().toLowerCase() === name.toLowerCase())) {
                input.value = '';
                return;
            }
            const list = getFrecuentPlayers();
            if (list.includes(name)) { input.value = ''; return; }
            list.push(name);
            saveFrecuentPlayers(list);
            input.value = '';
            renderFrecuentPlayersList();
        }

        let _pendingDeletePlayerIndex = null;

        function deleteFrecuentPlayer(index) {
            _pendingDeletePlayerIndex = index;
            const list = getFrecuentPlayers();
            const name = list[index];
            document.getElementById('deletePlayerDesc').textContent = `"${name}" se eliminará de tus jugadores habituales.`;
            const syncNote = document.getElementById('deletePlayerSyncNote');
            syncNote.style.display = window._fbIsLoggedIn && window._fbIsLoggedIn() ? '' : 'none';
            document.getElementById('confirmDeletePlayerModal').style.display = 'flex';
        }

        function closeDeletePlayerModal() {
            document.getElementById('confirmDeletePlayerModal').style.display = 'none';
            _pendingDeletePlayerIndex = null;
        }

        function confirmDeletePlayer() {
            const index = _pendingDeletePlayerIndex;
            if (index === null) return;
            const list = getFrecuentPlayers();
            const name = list[index];
            list.splice(index, 1);
            saveFrecuentPlayers(list);
            if (window._fbDeletePlayer) window._fbDeletePlayer(name);
            closeDeletePlayerModal();
            renderFrecuentPlayersList();
        }

        // Chips en la pantalla de jugadores
        function renderFrecuentChips() {
            const list = getFrecuentPlayers();
            const connected = (typeof _friends !== 'undefined') ? _friends.filter(f => f.nickname) : [];
            const row = document.getElementById('frecuentPlayersChips');
            if (!row) return;

            // Obtener jugadores actualmente en la partida
            const container = document.getElementById('playersContainer');
            const playersInGame = new Set(
                Array.from(container.querySelectorAll('.player-name'))
                    .map(i => i.value.trim())
                    .filter(Boolean)
            );

            // Crear lista completa de amigos (incluye al usuario actual si está logeado)
            let allConnected = [...connected];
            const currentProfile = window._currentProfile;
            if (currentProfile && currentProfile.nickname) {
                // Verificar que el usuario actual no esté ya en la lista de amigos
                const isAlreadyInFriends = connected.some(f => f.nickname === currentProfile.nickname);
                if (!isAlreadyInFriends) {
                    allConnected.unshift({
                        nickname: currentProfile.nickname,
                        color1: currentProfile.color1 || '#667eea',
                        color2: currentProfile.color2 || '#764ba2'
                    });
                }
            }

            // Filtrar jugadores que ya están en la partida
            const availableConnected = allConnected.filter(f => !playersInGame.has(f.nickname));

            if (availableConnected.length === 0) {
                row.style.display = 'none';
                return;
            }
            row.style.display = 'flex';

            let html = '';

            // Sección: amigos (con degradado de color)
            html += `<span class="frecuent-chips-section-label">Amigos</span>`;
            html += availableConnected.map(f => {
                const name = f.nickname.replace(/'/g, "\'");
                const c1 = f.color1 || '#667eea';
                const c2 = f.color2 || '#764ba2';
                return `<button class="connected-chip" style="background:linear-gradient(135deg,${c1},${c2});" onclick="addConnectedChipPlayer('${name}','${c1}','${c2}')">${f.nickname}</button>`;
            }).join('');

            row.innerHTML = html;
        }

        function addChipPlayer(name) {
            const container = document.getElementById('playersContainer');
            const existing = Array.from(container.querySelectorAll('.player-name')).map(i => i.value.trim());
            if (existing.includes(name)) return;
            
            // Siempre crear una nueva fila
            addPlayerInput();
            const rows = container.querySelectorAll('.player-name');
            rows[rows.length - 1].value = name;
            updateRemoveButtons(true); // Skip pills update, we'll do it once at the end
            updatePlayerPills(); // Update pills once
        }

        function addConnectedChipPlayer(name, color1, color2) {
            const container = document.getElementById('playersContainer');
            const existing = Array.from(container.querySelectorAll('.player-name')).map(i => i.value.trim());
            if (existing.includes(name)) return;

            // Elegir color: primario si no está en uso, secundario si está, fallback a paleta
            const usedColors = new Set(
                Array.from(container.querySelectorAll('.player-color-btn')).map(b => b.dataset.color.toUpperCase())
            );
            const chosenColor = !usedColors.has(color1.toUpperCase()) ? color1
                : !usedColors.has(color2.toUpperCase()) ? color2
                : color1; // si ambos ocupados, usar primario igualmente

            // Siempre crear una nueva fila
            addPlayerInput();
            const rows = container.querySelectorAll('.player-input-row');
            const targetRow = rows[rows.length - 1];
            targetRow.querySelector('.player-name').value = name;

            // Aplicar el degradado del perfil y bloquear el botón
            const colorBtn = targetRow.querySelector('.player-color-btn');
            if (colorBtn) {
                applyProfileGradientToBtn(colorBtn, color1, color2);
            }
            updateRemoveButtons(true); // Skip pills update, we'll do it once at the end
            updatePlayerPills(); // Update pills once
            renderFrecuentChips(); // Actualizar chips para ocultar el jugador recién añadido
        }

        // ── Modal para añadir jugador nuevo ──────────────────────────
        function showAddPlayerModal() {
            const modal = document.getElementById('addPlayerModal');
            const input = document.getElementById('addPlayerNameInput');
            modal.style.display = 'flex';
            input.value = '';
            setTimeout(() => input.focus(), 100);
            
            // Permitir añadir con Enter
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmAddPlayer();
                }
            };

            // Renderizar chips de jugadores habituales del historial
            renderAddPlayerModalChips();
        }

        function renderAddPlayerModalChips() {
            const chipsContainer = document.getElementById('addPlayerModalChips');
            if (!chipsContainer) return;

            // Obtener jugadores del historial (únicos)
            const history = getHistory();
            const playersFromHistory = new Set();
            history.forEach(entry => {
                (entry.results || []).forEach(r => {
                    if (r.player && r.player.trim()) {
                        playersFromHistory.add(r.player.trim());
                    }
                });
            });

            // Obtener amigos (incluyendo usuario actual)
            const connected = (typeof _friends !== 'undefined') ? _friends.filter(f => f.nickname) : [];
            const friendNames = new Set(connected.map(f => f.nickname));
            
            // Añadir usuario actual a la lista de amigos
            const currentProfile = window._currentProfile;
            if (currentProfile && currentProfile.nickname) {
                friendNames.add(currentProfile.nickname);
            }

            // Obtener jugadores ya en la partida
            const container = document.getElementById('playersContainer');
            const playersInGame = new Set(
                Array.from(container.querySelectorAll('.player-name'))
                    .map(i => i.value.trim())
                    .filter(Boolean)
            );

            // Filtrar: solo jugadores del historial que NO son amigos y NO están en la partida
            const availablePlayers = Array.from(playersFromHistory).filter(name => 
                !friendNames.has(name) && !playersInGame.has(name)
            );

            if (availablePlayers.length === 0) {
                chipsContainer.style.display = 'none';
                return;
            }

            chipsContainer.style.display = 'flex';
            chipsContainer.innerHTML = availablePlayers.map(name =>
                `<button class="frecuent-chip" onclick="addPlayerFromModalChip('${name.replace(/'/g, "\\'")}')">${name}</button>`
            ).join('');
        }

        function addPlayerFromModalChip(name) {
            const input = document.getElementById('addPlayerNameInput');
            input.value = name;
            confirmAddPlayer();
        }

        function closeAddPlayerModal() {
            document.getElementById('addPlayerModal').style.display = 'none';
        }

        function confirmAddPlayer() {
            const input = document.getElementById('addPlayerNameInput');
            const name = input.value.trim();
            
            if (!name) {
                closeAddPlayerModal();
                return;
            }

            // Verificar si el jugador ya está en la partida
            const container = document.getElementById('playersContainer');
            const existing = Array.from(container.querySelectorAll('.player-name')).map(i => i.value.trim());
            if (existing.includes(name)) {
                closeAddPlayerModal();
                return;
            }

            // Añadir el jugador con un color por defecto
            addPlayerInput();
            const rows = container.querySelectorAll('.player-input-row');
            const newRow = rows[rows.length - 1];
            newRow.querySelector('.player-name').value = name;
            updateRemoveButtons(true); // Skip pills update, we'll do it once at the end
            updatePlayerPills(); // Update pills once
            
            closeAddPlayerModal();
        }

        // ── Mis plantillas + Juegos del historial ────────────────────
        function renderCustomTemplatesList(showAllTpl = false, showAllHist = false) {
            const templates = getCustomTemplates();
            const history   = getHistory();
            const LIMIT = 5;

            const svgEdit = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
            const svgDel  = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
            const svgPlus = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
            const svgChevron = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

            // ── Tarjeta "Mis plantillas" ──────────────────────────────
            const tplContainer = document.getElementById('customTemplatesList');
            if (tplContainer) {
                if (templates.length === 0) {
                    tplContainer.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;">Aún no tienes plantillas. Crea una o juega una partida.</p>';
                } else {
                    // Ordenar: favoritas primero, luego el resto
                    const sorted = [
                        ...templates.map((t, i) => ({ ...t, _origIndex: i })).filter(t => t.favorite),
                        ...templates.map((t, i) => ({ ...t, _origIndex: i })).filter(t => !t.favorite)
                    ];
                    const svgStarFull  = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
                    const svgStarEmpty = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
                    const visible = showAllTpl ? sorted : sorted.slice(0, LIMIT);
                    const rows = visible.map(tpl => {
                        const i = tpl._origIndex;
                        const isFav = tpl.favorite;
                        const starSvg = isFav ? svgStarFull : svgStarEmpty;
                        const starColor = isFav ? '#f5a623' : 'var(--text-secondary)';
                        return `
                        <div class="custom-tpl-item">
                            <span>${tpl.emoji || '🎲'} <strong>${tpl.name}</strong> <span style="font-size:12px;color:var(--text-secondary);">${scoringTypeLabel(tpl.scoringType)}</span></span>
                            <div class="custom-tpl-item-actions">
                                <button class="custom-tpl-btn" data-fav-index="${i}" onclick="toggleFavoriteTemplate(${i})" title="${isFav ? 'Quitar de favoritas' : 'Marcar como favorita'}" style="color:${starColor};">${starSvg}</button>
                                <button class="custom-tpl-btn" onclick="editCustomTemplate(${i})" title="Editar" style="color:#7c6cfc;">${svgEdit}</button>
                                <button class="custom-tpl-btn" onclick="deleteCustomTemplate(${i})" title="Eliminar" style="color:#e74c3c;">${svgDel}</button>
                            </div>
                        </div>
                    `}).join('');
                    const remaining = sorted.length - LIMIT;
                    const showMoreBtn = (!showAllTpl && sorted.length > LIMIT)
                        ? `<button class="secondary" onclick="renderCustomTemplatesList(true, ${showAllHist})" style="width:100%;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;">${svgChevron}Ver ${remaining} plantilla${remaining !== 1 ? 's' : ''} más</button>`
                        : '';
                    tplContainer.innerHTML = rows + showMoreBtn;
                }
            }

            // ── Tarjeta "Juegos del historial" ────────────────────────
            const histContainer = document.getElementById('historyGamesList');
            if (!histContainer) return;

            // Índice de plantillas por nombre normalizado
            const tplByName = new Set(templates.map(t => t.name.trim().toLowerCase()));

            // Juegos únicos del historial sin plantilla propia
            const seen = new Set();
            const historyOnlyGames = [];
            history.forEach(entry => {
                const key = entry.gameName.trim().toLowerCase();
                if (!tplByName.has(key) && !seen.has(key)) {
                    seen.add(key);
                    historyOnlyGames.push({ name: entry.gameName, emoji: entry.emoji || '🎲' });
                }
            });

            if (historyOnlyGames.length === 0) {
                histContainer.innerHTML = '<p style="color:var(--text-secondary);font-size:14px;">Todos tus juegos ya tienen plantilla.</p>';
            } else {
                const visibleHist = showAllHist ? historyOnlyGames : historyOnlyGames.slice(0, LIMIT);
                const histRows = visibleHist.map(g => `
                    <div class="custom-tpl-item">
                        <span>${g.emoji} <strong>${g.name}</strong></span>
                        <div class="custom-tpl-item-actions">
                            <button class="custom-tpl-btn" onclick="createTemplateFromHistory('${g.name.replace(/'/g, "\\'")}')" title="Añadir a mis plantillas" style="color:#7c6cfc;">${svgPlus}</button>
                        </div>
                    </div>
                `).join('');
                const remainingHist = historyOnlyGames.length - LIMIT;
                const showMoreHist = (!showAllHist && historyOnlyGames.length > LIMIT)
                    ? `<button class="secondary" onclick="renderCustomTemplatesList(${showAllTpl}, true)" style="width:100%;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;">${svgChevron}Ver ${remainingHist} juego${remainingHist !== 1 ? 's' : ''} más</button>`
                    : '';
                histContainer.innerHTML = histRows + showMoreHist;
            }
        }

        // Crea una plantilla a partir del último juego con ese nombre en el historial
        function createTemplateFromHistory(gameName) {
            const history = getHistory();
            const entry = history.find(e => e.gameName.trim().toLowerCase() === gameName.trim().toLowerCase());
            if (!entry) return;

            // Pre-rellenar el formulario con los datos del historial y abrirlo
            _editingTemplateIndex = null;
            document.getElementById('templateFormTitle').textContent = 'Nueva plantilla';
            document.getElementById('tplSaveBtn').textContent = 'Añadir a mis plantillas';
            document.getElementById('tplEmoji').value = entry.emoji || '🎲';
            document.getElementById('tplName').value = entry.gameName;
            document.getElementById('tplScoringType').value = entry.scoringType || 'rounds';
            document.getElementById('tplNumRounds').value = entry.numRounds || 5;
            document.getElementById('tplTargetScore').value = entry.targetScore || 40;
            document.getElementById('tplMaxPlayers').value = '';
            document.getElementById('tplFormError').textContent = '';
            document.getElementById('tplItemsList').innerHTML = '';
            const items = entry.items || entry.roundItems || [];
            items.forEach(it => addTplItem(it.name || it, it.negative || false));
            onTplScoringChange();
            document.getElementById('templateFormModal').style.display = 'flex';
        }

        function toggleFavoriteTemplate(index) {
            const list = getCustomTemplates();
            const tpl = list[index];
            const favCount = list.filter(t => t.favorite).length;
            if (!tpl.favorite && favCount >= 3) {
                // Ya hay 3 favoritas, no permitir más — feedback visual breve
                const btn = document.querySelector(`[data-fav-index="${index}"]`);
                if (btn) {
                    btn.style.transform = 'scale(1.4)';
                    setTimeout(() => btn.style.transform = '', 300);
                }
                return;
            }
            tpl.favorite = !tpl.favorite;
            saveCustomTemplates(list);
            renderCustomTemplatesList();
            renderFavoritePills();
        }

        function scoringTypeLabel(type) {
            return { rounds: 'Rondas', items: 'Ítems', rounds_with_items: 'Rondas+ítems', target_score: 'Objetivo' }[type] || type;
        }

        let _pendingDeleteTemplateIndex = null;

        function deleteCustomTemplate(index) {
            _pendingDeleteTemplateIndex = index;
            const list = getCustomTemplates();
            const tpl = list[index];
            document.getElementById('deleteTemplateDesc').textContent = `"${tpl.emoji || '🎲'} ${tpl.name}" se eliminará de tus plantillas.`;
            const syncNote = document.getElementById('deleteTemplateSyncNote');
            syncNote.style.display = window._fbIsLoggedIn && window._fbIsLoggedIn() ? '' : 'none';
            document.getElementById('confirmDeleteTemplateModal').style.display = 'flex';
        }

        function closeDeleteTemplateModal() {
            document.getElementById('confirmDeleteTemplateModal').style.display = 'none';
            _pendingDeleteTemplateIndex = null;
        }

        function confirmDeleteTemplate() {
            const index = _pendingDeleteTemplateIndex;
            if (index === null) return;
            const list = getCustomTemplates();
            const tpl = list[index];
            list.splice(index, 1);
            saveCustomTemplates(list);
            if (window._fbDeleteTemplate) window._fbDeleteTemplate(tpl.id);
            closeDeleteTemplateModal();
            renderCustomTemplatesList();
            renderFavoritePills();
        }
        // ── Formulario de plantilla ───────────────────────────────────
        let _editingTemplateIndex = null;

        function openNewTemplateForm() {
            _editingTemplateIndex = null;
            document.getElementById('templateFormTitle').textContent = 'Nueva plantilla';
            document.getElementById('tplSaveBtn').textContent = 'Guardar';
            document.getElementById('tplEmoji').value = '';
            document.getElementById('tplName').value = '';
            document.getElementById('tplScoringType').value = 'rounds';
            document.getElementById('tplNumRounds').value = '5';
            document.getElementById('tplTargetScore').value = '40';
            document.getElementById('tplMaxPlayers').value = '';
            document.getElementById('tplItemsList').innerHTML = '';
            document.getElementById('tplFormError').textContent = '';
            onTplScoringChange();
            document.getElementById('templateFormModal').style.display = 'flex';
        }

        function editCustomTemplate(index) {
            const tpl = getCustomTemplates()[index];
            _editingTemplateIndex = index;
            document.getElementById('templateFormTitle').textContent = 'Editar plantilla';
            document.getElementById('tplSaveBtn').textContent = 'Guardar';
            document.getElementById('tplEmoji').value = tpl.emoji || '';
            document.getElementById('tplName').value = tpl.name || '';
            document.getElementById('tplScoringType').value = tpl.scoringType || 'rounds';
            document.getElementById('tplNumRounds').value = tpl.numRounds || 5;
            document.getElementById('tplTargetScore').value = tpl.targetScore || 40;
            document.getElementById('tplMaxPlayers').value = tpl.maxPlayers || '';
            document.getElementById('tplFormError').textContent = '';
            // Render items
            document.getElementById('tplItemsList').innerHTML = '';
            const items = tpl.items || tpl.roundItems || [];
            items.forEach(item => addTplItem(item.name, item.negative));
            onTplScoringChange();
            document.getElementById('templateFormModal').style.display = 'flex';
        }

        function closeTemplateFormModal(e) {
            if (e && e.target !== document.getElementById('templateFormModal')) return;
            document.getElementById('templateFormModal').style.display = 'none';
        }

        function onTplScoringChange() {
            const type = document.getElementById('tplScoringType').value;
            document.getElementById('tplRoundsGroup').style.display =
                (type === 'rounds' || type === 'rounds_with_items') ? 'block' : 'none';
            document.getElementById('tplTargetGroup').style.display =
                type === 'target_score' ? 'block' : 'none';
            document.getElementById('tplItemsGroup').style.display =
                (type === 'items' || type === 'rounds_with_items') ? 'block' : 'none';
        }

        function addTplItem(name = '', negative = false) {
            const list = document.getElementById('tplItemsList');
            const div = document.createElement('div');
            div.className = 'tpl-item-row';
            div.innerHTML = `
                <input type="text" placeholder="Nombre del ítem" class="tpl-item-name" value="${name.replace(/"/g,'&quot;')}">
                <div class="checkbox-label">
                    <input type="checkbox" class="tpl-item-negative" ${negative ? 'checked' : ''}>
                    <label>Resta</label>
                </div>
                <button class="tpl-item-del" onclick="this.closest('.tpl-item-row').remove()"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            `;
            list.appendChild(div);
        }

        function saveTemplateForm() {
            const name = document.getElementById('tplName').value.trim();
            if (!name) {
                document.getElementById('tplFormError').textContent = 'El nombre es obligatorio.';
                return;
            }
            const scoringType = document.getElementById('tplScoringType').value;
            const items = Array.from(document.querySelectorAll('.tpl-item-name')).map((inp, i) => ({
                name: inp.value.trim(),
                negative: document.querySelectorAll('.tpl-item-negative')[i].checked
            })).filter(it => it.name);

            const tpl = {
                id: _editingTemplateIndex !== null ? getCustomTemplates()[_editingTemplateIndex].id : Date.now(),
                name,
                emoji: document.getElementById('tplEmoji').value.trim() || '🎲',
                scoringType,
                numRounds: parseInt(document.getElementById('tplNumRounds').value) || 5,
                targetScore: parseInt(document.getElementById('tplTargetScore').value) || 40,
                roundScoringMode: 'all_at_end',
                items: scoringType === 'items' ? items : [],
                roundItems: scoringType === 'rounds_with_items' ? items : [],
                favorite: _editingTemplateIndex !== null ? (getCustomTemplates()[_editingTemplateIndex].favorite || false) : false,
            };
            const maxP = parseInt(document.getElementById('tplMaxPlayers').value);
            if (maxP >= 2) tpl.maxPlayers = maxP;

            const list = getCustomTemplates();
            const oldEmoji = _editingTemplateIndex !== null ? (list[_editingTemplateIndex].emoji || '🎲') : null;
            if (_editingTemplateIndex !== null) {
                list[_editingTemplateIndex] = tpl;
            } else {
                list.push(tpl);
            }
            saveCustomTemplates(list);

            // ── Si cambió el emoji al editar, propagarlo al historial ──
            if (_editingTemplateIndex !== null && tpl.emoji !== oldEmoji) {
                const nameNorm = tpl.name.trim().toLowerCase();
                const history = getHistory();
                let changed = false;
                history.forEach(e => {
                    if (e.gameName.trim().toLowerCase() === nameNorm) {
                        e.emoji = tpl.emoji;
                        changed = true;
                    }
                });
                if (changed) {
                    saveHistory(history);
                    if (window._fbSaveEntry) {
                        history.filter(e => e.gameName.trim().toLowerCase() === nameNorm)
                               .forEach(e => window._fbSaveEntry(e));
                    }
                }
            }

            document.getElementById('templateFormModal').style.display = 'none';
            renderCustomTemplatesList();
            renderFavoritePills();
        }

        // ── Perfil de jugador (UI) ────────────────────────────────────

        function toggleProfileSection() {
            const toggle = document.getElementById('profileToggle');
            const body = document.getElementById('profileSectionBody');
            if (!toggle || !body) return;
            const isOpen = body.classList.contains('open');
            toggle.classList.toggle('open', !isOpen);
            body.classList.toggle('open', !isOpen);
        }

        function openProfileColorPicker(inputId, btnId) {
            closeAllColorPickers();
            const input = document.getElementById(inputId);
            const btn = document.getElementById(btnId);
            if (!input || !btn) return;
            const currentColor = input.value.toUpperCase();

            const overlay = document.createElement('div');
            overlay.className = 'color-palette-overlay';
            const popup = document.createElement('div');
            popup.className = 'color-palette-popup';

            PLAYER_PALETTE.forEach(color => {
                const swatch = document.createElement('button');
                swatch.className = 'color-swatch' + (color.toUpperCase() === currentColor ? ' selected' : '');
                swatch.style.background = color;
                swatch.title = color;
                swatch.setAttribute('type', 'button');
                swatch.onclick = (e) => {
                    e.stopPropagation();
                    input.value = color;
                    btn.style.background = color;
                    btn.textContent = color.toUpperCase();
                    closeAllColorPickers();
                    updateProfilePreview();
                    // Actualizar degradado del badge del código
                    updateProfileIdBadgeGradient();
                };
                popup.appendChild(swatch);
            });

            overlay.appendChild(popup);
            document.body.appendChild(overlay);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeAllColorPickers();
            });
        }

        function updateProfileIdBadgeGradient() {
            const c1 = document.getElementById('profileColor1')?.value || '#667eea';
            const c2 = document.getElementById('profileColor2')?.value || '#764ba2';
            const badge = document.getElementById('profileIdBadge');
            if (badge) badge.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
        }

        function updateProfilePreview() {
            const nickname = (document.getElementById('profileNickname')?.value || '').trim();
            const c1 = document.getElementById('profileColor1')?.value || '#667eea';
            const c2 = document.getElementById('profileColor2')?.value || '#764ba2';
            const gradient = `linear-gradient(135deg, ${c1}, ${c2})`;
            const letter = nickname ? nickname[0].toUpperCase() : '?';

            // Preview dentro del desplegable
            const avatar = document.getElementById('profilePreviewAvatar');
            const nameEl = document.getElementById('profilePreviewName');
            if (avatar) { avatar.style.background = gradient; avatar.textContent = letter; }
            if (nameEl) nameEl.textContent = nickname || 'Tu nombre';

            // Mini avatar + nombre en la cabecera del toggle (visible cuando está plegado)
            const toggleAvatar = document.getElementById('profileToggleAvatar');
            const toggleName = document.getElementById('profileToggleName');
            if (toggleAvatar) { toggleAvatar.style.background = gradient; toggleAvatar.textContent = letter; }
            if (toggleName) toggleName.textContent = nickname || 'Mi perfil de jugador';

            updateProfileIdBadgeGradient();
        }

        async function savePlayerProfile() {
            const nickname = (document.getElementById('profileNickname')?.value || '').trim();
            const c1 = document.getElementById('profileColor1')?.value || '#667eea';
            const c2 = document.getElementById('profileColor2')?.value || '#764ba2';
            if (!nickname) {
                alert('Por favor, introduce tu nombre de jugador.');
                return;
            }
            if (!window._fbSaveProfile) { alert('Inicia sesión para guardar el perfil.'); return; }
            try {
                await window._fbSaveProfile(nickname, c1, c2);
                // Propagar cambios de perfil a todas las conexiones existentes
                if (window._fbUpdateProfileInConnections) await window._fbUpdateProfileInConnections();
                showSyncToast('Perfil guardado ✓');
            } catch(e) {
                alert('Error al guardar el perfil. Inténtalo de nuevo.');
            }
        }

        function copyProfileId() {
            const code = document.getElementById('profileIdText')?.textContent;
            if (!code || code === '—') return;
            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(code).then(() => showSyncToast('Código copiado ✓'));
            } else {
                const ta = document.createElement('textarea');
                ta.value = code;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                showSyncToast('Código copiado ✓');
            }
        }

        // ── Amigos (UI) ───────────────────────────────────────────────

        let _friends = []; // [{ code, nickname, color1, color2, uid }]

        async function renderFriendsList() {
            if (!window._fbLoadFriends) return;
            _friends = await window._fbLoadFriends();

            // Refrescar chips en pantalla de jugadores si está activa
            if (typeof renderFrecuentChips === 'function') {
                const ps = document.getElementById('playersScreen');
                if (ps && ps.classList.contains('active')) renderFrecuentChips();
            }

            const container = document.getElementById('friendsList');
            if (!container) return;
            if (_friends.length === 0) {
                container.innerHTML = '<p style="font-size:13px;color:var(--text-secondary);">Aún no tienes amigos añadidos.</p>';
                return;
            }
            container.innerHTML = _friends.map((f) => `
                <div class="friend-item">
                    <div class="friend-avatar" style="background:linear-gradient(135deg,${f.color1||'#667eea'},${f.color2||'#764ba2'});">${(f.nickname||'?')[0].toUpperCase()}</div>
                    <div class="friend-info">
                        <div class="friend-name">${f.nickname || 'Sin nombre'}</div>
                        <div class="friend-code">${f.code}</div>
                    </div>
                    <button class="friend-del-btn" onclick="askRemoveFriend('${f.connectionId}', '${f.nickname || 'este amigo'}')" title="Eliminar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            `).join('');
        }

        async function addFriendByCode() {
            const input = document.getElementById('friendCodeInput');
            const errEl = document.getElementById('addFriendError');
            const code = (input?.value || '').trim().toUpperCase();
            errEl.style.display = 'none';

            if (code.length !== 6) {
                errEl.textContent = 'El código debe tener 6 caracteres.';
                errEl.style.display = '';
                return;
            }
            // No añadirse a uno mismo
            if (window._currentProfile && code === window._currentProfile.code) {
                errEl.textContent = 'No puedes añadirte a ti mismo.';
                errEl.style.display = '';
                return;
            }
            // Comprobar duplicado
            if (_friends.some(f => f.code === code)) {
                errEl.textContent = 'Ya tienes a este jugador en tu lista.';
                errEl.style.display = '';
                return;
            }
            if (!window._fbFindPlayerByCode) return;
            const player = await window._fbFindPlayerByCode(code);
            if (!player) {
                errEl.textContent = 'No se encontró ningún jugador con ese código.';
                errEl.style.display = '';
                return;
            }
            try {
                await window._fbAddConnection(player);
                input.value = '';
                // renderFriendsList se llama automáticamente via onSnapshot
                showSyncToast(`¡${player.nickname || 'Jugador'} añadido como amigo! ✓`);
            } catch(e) {
                errEl.textContent = 'Error al añadir amigo. Inténtalo de nuevo.';
                errEl.style.display = '';
            }
        }

        let _pendingRemoveFriendId = null;

        function askRemoveFriend(connectionId, nickname) {
            _pendingRemoveFriendId = connectionId;
            document.getElementById('deleteFriendDesc').textContent = `¿Seguro que quieres eliminar a ${nickname} de tus amigos?`;
            document.getElementById('confirmDeleteFriendModal').style.display = 'flex';
        }

        function closeDeleteFriendModal() {
            document.getElementById('confirmDeleteFriendModal').style.display = 'none';
            _pendingRemoveFriendId = null;
        }

        async function confirmDeleteFriend() {
            if (!_pendingRemoveFriendId || !window._fbRemoveConnection) return;
            closeDeleteFriendModal();
            await window._fbRemoveConnection(_pendingRemoveFriendId);
            // renderFriendsList se llama automáticamente via onSnapshot
        }

        // ── Estadísticas ──────────────────────────────────────────
        let _openStatsTab = null;

        function showStats() {
            const activeScreen = document.querySelector('.screen.active');
            if (activeScreen && activeScreen.id === 'statsScreen') {
                showScreen(previousScreenId, -1);
                return;
            }
            if (activeScreen) previousScreenId = activeScreen.id;
            renderHistoryList();
            if (window._fbSyncHistory) window._fbSyncHistory();
            showScreen('statsScreen', 1);
        }

        function toggleStatsTab(tab) {
            const btn = document.getElementById('statsTab-' + tab);
            const card = document.getElementById('statsCard-' + tab);

            if (_openStatsTab === tab) {
                // Close
                btn.classList.remove('active');
                card.classList.remove('open');
                _openStatsTab = null;
                return;
            }

            // Close any open tab
            if (_openStatsTab) {
                document.getElementById('statsTab-' + _openStatsTab).classList.remove('active');
                document.getElementById('statsCard-' + _openStatsTab).classList.remove('open');
            }

            // Open this tab
            _openStatsTab = tab;
            btn.classList.add('active');
            card.innerHTML = buildStatsCardContent(tab);
            card.classList.add('open');
            if (tab === 'vs') renderVSComparison();
        }

        function buildStatsCardContent(tab) {
            const history = getHistory();
            const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;

            if (history.length === 0) {
                return `<div class="stats-placeholder">${placeholderSvg}<p>Aún no hay partidas registradas.<br>¡Juega una partida para ver estadísticas!</p></div>`;
            }

            if (tab === 'game') return buildStatsGame(history);
            if (tab === 'player') return buildStatsPlayer(history);
            if (tab === 'vs') return buildStatsVS(history);

            const tabLabels = { player: 'Por jugador', vs: 'VS' };
            return `<div class="stats-placeholder">${placeholderSvg}<p><strong>${tabLabels[tab]}</strong><br>Próximamente aquí verás tus estadísticas.<br><span style="font-size:11px;opacity:0.5;">${history.length} partida${history.length !== 1 ? 's' : ''} guardada${history.length !== 1 ? 's' : ''}</span></p></div>`;
        }

        // Devuelve la key y el nombre a mostrar para cualquier nombre crudo del historial
        function resolvePlayer(rawName) {
            const key = normStr(rawName.trim());
            return { key, display: rawName.trim() };
        }

        function buildStatsVS(history) {
            const noSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>`;

            // Recoger todos los jugadores únicos resolviendo fusiones y nombres preferidos
            const playerMap = {}; // key -> displayName
            history.forEach(e => {
                if (e.results) e.results.forEach(r => {
                    const { key, display } = resolvePlayer(r.player);
                    playerMap[key] = display;
                });
            });
            // Ordenar por displayName; usar key como value interno
            const allPlayers = Object.entries(playerMap)
                .map(([key, display]) => ({ key, display }))
                .sort((a, b) => a.display.localeCompare(b.display));

            if (allPlayers.length < 2) {
                return `<div class="stats-placeholder">${noSvg}<p>Necesitas al menos 2 jugadores distintos en el historial para usar VS.</p></div>`;
            }

            const options   = allPlayers.map(p => `<option value="${p.key}">${p.display}</option>`).join('');
            const p2Options = allPlayers.map((p, i) => `<option value="${p.key}" ${i === 1 ? 'selected' : ''}>${p.display}</option>`).join('');

            return `
                <div class="vs-selector">
                    <select class="vs-select" id="vsSelectLeft" onchange="renderVSComparison()">${options}</select>
                    <span class="vs-label">VS</span>
                    <select class="vs-select" id="vsSelectRight" onchange="renderVSComparison()">${p2Options}</select>
                </div>
                <div id="vsResult" class="vs-result"></div>`;
        }

        function renderVSComparison() {
            const leftEl  = document.getElementById('vsSelectLeft');
            const rightEl = document.getElementById('vsSelectRight');
            if (!leftEl || !rightEl) return;

            const keyA = leftEl.value;
            const keyB = rightEl.value;
            const nameA = leftEl.options[leftEl.selectedIndex].text;
            const nameB = rightEl.options[rightEl.selectedIndex].text;
            const container = document.getElementById('vsResult');

            if (keyA === keyB) {
                container.innerHTML = `<div class="vs-no-data">Selecciona dos jugadores distintos.</div>`;
                return;
            }

            const history = getHistory();

            // Partidas en las que participaron AMBOS (resolviendo fusiones)
            const shared = history.filter(e => {
                if (!e.results) return false;
                const keys = e.results.map(r => resolvePlayer(r.player).key);
                return keys.includes(keyA) && keys.includes(keyB);
            });

            if (shared.length === 0) {
                container.innerHTML = `<div class="vs-no-data">No hay partidas en las que hayan jugado juntos.</div>`;
                return;
            }

            let globalBetter_A = 0, globalBetter_B = 0, globalTie = 0;
            let globalWins_A = 0, globalWins_B = 0;

            const gameMap = {};
            shared.forEach(entry => {
                const gkey = entry.gameName.trim().toLowerCase();
                if (!gameMap[gkey]) gameMap[gkey] = {
                    name: entry.gameName, emoji: entry.emoji || '🎲',
                    games: 0, better_A: 0, better_B: 0, wins_A: 0, wins_B: 0
                };
                const g = gameMap[gkey];
                g.games++;

                // Resolver resultados con fusiones
                const results = entry.results.map(r => ({ ...r, _key: resolvePlayer(r.player).key }));
                const posA = results.findIndex(r => r._key === keyA);
                const posB = results.findIndex(r => r._key === keyB);

                if (posA < posB)      { g.better_A++; globalBetter_A++; }
                else if (posB < posA) { g.better_B++; globalBetter_B++; }
                else                  { g.better_A++; g.better_B++; globalTie++; }

                if (posA === 0) { g.wins_A++; globalWins_A++; }
                if (posB === 0) { g.wins_B++; globalWins_B++; }
            });

            const games = Object.values(gameMap).sort((a, b) => b.games - a.games);
            const winnerGlobal = globalBetter_A > globalBetter_B ? 'left'
                               : globalBetter_B > globalBetter_A ? 'right' : 'tie';

            const globalHtml = `
                <div class="vs-header">
                    <span class="vs-player-name left" style="${winnerGlobal === 'left' ? 'color:var(--primary-color)' : ''}">${nameA}</span>
                    <span class="vs-header-label">${shared.length} partida${shared.length !== 1 ? 's' : ''}</span>
                    <span class="vs-player-name right" style="${winnerGlobal === 'right' ? 'color:var(--primary-color)' : ''}">${nameB}</span>
                </div>
                <div class="vs-global-score">
                    <div style="text-align:center">
                        <div class="vs-global-num" style="${winnerGlobal === 'left' ? '' : 'opacity:0.45'}">${globalBetter_A}</div>
                        <div class="vs-global-sub">${globalWins_A} vic.</div>
                    </div>
                    <span class="vs-global-sep">–</span>
                    <div style="text-align:center">
                        <div class="vs-global-num" style="${winnerGlobal === 'right' ? '' : 'opacity:0.45'}">${globalBetter_B}</div>
                        <div class="vs-global-sub">${globalWins_B} vic.</div>
                    </div>
                </div>`;

            const gameRows = games.map(g => {
                const winnerGame = g.better_A > g.better_B ? 'left'
                                 : g.better_B > g.better_A ? 'right' : 'tie';
                return `
                    <div class="vs-game-row">
                        <div class="vs-score-block">
                            <span class="vs-score-num ${winnerGame === 'left' ? 'winner' : ''}">${g.better_A}</span>
                            <span class="vs-score-wins">${g.wins_A} vic.</span>
                        </div>
                        <span class="vs-score-dash">–</span>
                        <div class="vs-game-title">
                            <div class="vs-game-name">${g.emoji} ${g.name}</div>
                            <div class="vs-game-sub">${g.games} partida${g.games !== 1 ? 's' : ''}</div>
                        </div>
                        <span class="vs-score-dash">–</span>
                        <div class="vs-score-block">
                            <span class="vs-score-num ${winnerGame === 'right' ? 'winner' : ''}">${g.better_B}</span>
                            <span class="vs-score-wins">${g.wins_B} vic.</span>
                        </div>
                    </div>`;
            }).join('');

            container.innerHTML = globalHtml + gameRows;
        }

        window._playerSortMode = 'games';
        window._statsShowAllGames   = false;
        window._statsShowAllPlayers = false;

        window.setPlayerSort = function(mode) {
            window._playerSortMode = mode;
            window._statsShowAllPlayers = false;
            const history = getHistory();
            const card = document.getElementById('statsCard-player');
            if (card) card.innerHTML = buildStatsPlayer(history);
        };

        window.statsShowMoreGames = function() {
            window._statsShowAllGames = true;
            const history = getHistory();
            const card = document.getElementById('statsCard-game');
            if (card) card.innerHTML = buildStatsGame(history);
        };

        window.statsShowMorePlayers = function() {
            window._statsShowAllPlayers = true;
            const history = getHistory();
            const card = document.getElementById('statsCard-player');
            if (card) card.innerHTML = buildStatsPlayer(history);
        };

        function buildStatsPlayer(history) {
            // Agrupar por jugador: partidas, victorias y tiempo total
            const playerMap = {};
            history.forEach(entry => {
                if (!entry.results || entry.results.length === 0) return;
                const winner = entry.results[0].player;
                entry.results.forEach(r => {
                    const key = normStr(r.player.trim());
                    if (!playerMap[key]) playerMap[key] = { key, names: new Set(), games: 0, wins: 0, totalDevPct: 0, timedGames: 0 };
                    playerMap[key].names.add(r.player.trim());
                    playerMap[key].games++;
                    if (normStr(winner.trim()) === key) playerMap[key].wins++;
                });
                // Acumular tiempos si los hay
                if (entry.usedTimer && Array.isArray(entry.playerTotalTimes) && Array.isArray(entry.orderedPlayers)) {
                    const times = entry.playerTotalTimes;
                    const total = times.reduce((s, t) => s + t, 0);
                    const n     = entry.orderedPlayers.length;
                    if (total > 0 && n > 0) {
                        const mean = total / n;
                        entry.orderedPlayers.forEach((name, i) => {
                            const key = normStr(name.trim());
                            const t = times[i] || 0;
                            if (playerMap[key] && t > 0) {
                                const devPct = ((t - mean) / mean) * 100;
                                playerMap[key].totalDevPct += devPct;
                                playerMap[key].timedGames++;
                            }
                        });
                    }
                }
            });

            const sort = window._playerSortMode || 'games';
            const players = Object.values(playerMap).sort((a, b) => {
                if (sort === 'winrate') {
                    const wA = a.games ? a.wins / a.games : 0;
                    const wB = b.games ? b.wins / b.games : 0;
                    return wB !== wA ? wB - wA : b.games - a.games;
                }
                if (sort === 'time') {
                    // Más lento primero (mayor desviación positiva)
                    const dA = a.timedGames ? a.totalDevPct / a.timedGames : -Infinity;
                    const dB = b.timedGames ? b.totalDevPct / b.timedGames : -Infinity;
                    return dB !== dA ? dB - dA : b.games - a.games;
                }
                // default: games
                return b.games !== a.games ? b.games - a.games : (b.wins / b.games) - (a.wins / a.games);
            });

            if (players.length === 0) {
                const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;
                return `<div class="stats-placeholder">${svg}<p>Aún no hay partidas registradas.</p></div>`;
            }

            const STATS_LIMIT_P = 5;
            const showAllPlayers = window._statsShowAllPlayers;
            const visiblePlayers = showAllPlayers ? players : players.slice(0, STATS_LIMIT_P);

            // Selector de orden
            const sortBar = `
                <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
                    <button onclick="setPlayerSort('games')" style="flex:1;min-width:0;padding:7px 10px;border-radius:20px;font-size:12px;font-weight:700;border:1.5px solid var(--border-color);min-height:unset;box-shadow:none;margin:0;transition:all 0.15s;${sort==='games' ? 'background:var(--btn-primary-gradient);color:#fff;border-color:transparent;' : 'background:var(--table-row-alt);color:var(--text-secondary);'}">Partidas</button>
                    <button onclick="setPlayerSort('winrate')" style="flex:1;min-width:0;padding:7px 10px;border-radius:20px;font-size:12px;font-weight:700;border:1.5px solid var(--border-color);min-height:unset;box-shadow:none;margin:0;transition:all 0.15s;${sort==='winrate' ? 'background:var(--btn-primary-gradient);color:#fff;border-color:transparent;' : 'background:var(--table-row-alt);color:var(--text-secondary);'}">Winrate</button>
                    <button onclick="setPlayerSort('time')" style="flex:1;min-width:0;padding:7px 10px;border-radius:20px;font-size:12px;font-weight:700;border:1.5px solid var(--border-color);min-height:unset;box-shadow:none;margin:0;transition:all 0.15s;${sort==='time' ? 'background:var(--btn-primary-gradient);color:#fff;border-color:transparent;' : 'background:var(--table-row-alt);color:var(--text-secondary);'}">Tiempo</button>
                </div>`;

            // Construir mapa nickname (normalizado) → perfil para yo + amigos conectados
            const profileAvatarMap = {};
            if (window._currentProfile && window._currentProfile.nickname) {
                const n = window._currentProfile.nickname.trim().toLowerCase();
                profileAvatarMap[n] = {
                    color1: window._currentProfile.color1 || '#667eea',
                    color2: window._currentProfile.color2 || '#764ba2',
                    letter: window._currentProfile.nickname[0].toUpperCase()
                };
            }
            if (Array.isArray(window._friends)) {
                window._friends.forEach(f => {
                    if (f.nickname) {
                        const n = f.nickname.trim().toLowerCase();
                        profileAvatarMap[n] = {
                            color1: f.color1 || '#667eea',
                            color2: f.color2 || '#764ba2',
                            letter: f.nickname[0].toUpperCase()
                        };
                    }
                });
            }

            const rows = visiblePlayers.map((p, i) => {
                const winRate = Math.round((p.wins / p.games) * 100);
                const namesArr = [...p.names].sort();
                const displayName = namesArr.reduce((a, b) => b.length > a.length ? b : a);

                // Avatar circular si el jugador es yo o un amigo conectado
                const profileKey = displayName.trim().toLowerCase();
                const prof = profileAvatarMap[profileKey];
                const avatarHtml = prof
                    ? `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,${prof.color1},${prof.color2});display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff;flex-shrink:0;text-shadow:0 1px 3px rgba(0,0,0,0.2);">${prof.letter}</div>`
                    : `<span class="stats-player-rank">${i + 1}</span>`;

                // Métrica derecha según el modo de orden activo
                let rightHtml;
                if (sort === 'winrate') {
                    rightHtml = `<div class="stats-game-count"><span class="stats-game-count-num">${winRate}%</span><span class="stats-game-count-label">winrate</span></div>`;
                } else if (sort === 'time' && p.timedGames > 0) {
                    const avgDev = p.totalDevPct / p.timedGames;
                    const val    = Math.round(Math.abs(avgDev));
                    const isSlow = avgDev > 2;
                    const isFast = avgDev < -2;
                    const sign   = isSlow ? '+' : (isFast ? '−' : '±');
                    const color  = isSlow ? '#e74c3c' : (isFast ? '#2ecc71' : 'var(--primary-color)');
                    const label  = isSlow ? 'más lento' : (isFast ? 'más rápido' : 'en la media');
                    rightHtml = `<div class="stats-game-count"><span class="stats-game-count-num" style="color:${color};">${sign}${val}%</span><span class="stats-game-count-label">${label}</span></div>`;
                } else if (sort === 'time') {
                    rightHtml = `<div class="stats-game-count"><span class="stats-game-count-num" style="font-size:12px;opacity:0.4;">—</span><span class="stats-game-count-label">sin timer</span></div>`;
                } else {
                    rightHtml = `<div class="stats-game-count"><span class="stats-game-count-num">${p.games}</span><span class="stats-game-count-label">${p.games === 1 ? 'partida' : 'partidas'}</span></div>`;
                }

                const subInfo = `${p.wins} victoria${p.wins !== 1 ? 's' : ''}${sort === 'time' ? ` · ${p.games} partida${p.games !== 1 ? 's' : ''}` : ''}`;

                return `
                    <div class="stats-player-row">
                        ${avatarHtml}
                        <div class="stats-player-info">
                            <div class="stats-player-name">${displayName}</div>
                            <div class="stats-player-sub">${subInfo}</div>
                        </div>
                        ${rightHtml}
                    </div>`;
            }).join('');

            const svgChevronP = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
            const remainingP = players.length - STATS_LIMIT_P;
            const showMoreBtnPlayer = (!showAllPlayers && players.length > STATS_LIMIT_P)
                ? `<button class="secondary" onclick="statsShowMorePlayers()" style="width:100%;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;">${svgChevronP}Ver ${remainingP} jugador${remainingP !== 1 ? 'es' : ''} más</button>`
                : '';

            return `<div class="stats-player-list">${sortBar}${rows}${showMoreBtnPlayer}</div>`;
        }


        function buildStatsGame(history) {
            const gameMap = {};
            history.forEach(entry => {
                const key = entry.gameName.trim().toLowerCase();
                if (!gameMap[key]) {
                    gameMap[key] = {
                        name: entry.gameName,
                        emoji: entry.emoji || '🎲',
                        count: 0,
                        wins: {}
                    };
                }
                gameMap[key].count++;
                if (entry.results && entry.results.length > 0) {
                    const { key: pKey, display } = resolvePlayer(entry.results[0].player);
                    if (!gameMap[key].wins[pKey]) gameMap[key].wins[pKey] = { display, count: 0 };
                    gameMap[key].wins[pKey].count++;
                }
            });

            const games = Object.values(gameMap).sort((a, b) => b.count - a.count);

            const STATS_LIMIT = 5;
            const showAllGames = window._statsShowAllGames;
            const visibleGames = showAllGames ? games : games.slice(0, STATS_LIMIT);

            const rows = visibleGames.map((g, i) => {
                let topPlayer = null, topWins = 0;
                Object.values(g.wins).forEach(w => {
                    if (w.count > topWins) { topWins = w.count; topPlayer = w.display; }
                });
                const winRate = topPlayer ? Math.round((topWins / g.count) * 100) : 0;
                const winnerHtml = topPlayer
                    ? `<span class="stats-game-winner-badge">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            ${topPlayer} &nbsp;${winRate}%
                       </span>`
                    : '';
                const key = g.name.trim().toLowerCase();
                return `
                    <div class="stats-game-row" onclick="showGameDetail('${key.replace(/'/g,"\\'")}')">
                        <span class="stats-game-rank">${i + 1}</span>
                        <span class="stats-game-emoji">${g.emoji}</span>
                        <div class="stats-game-info">
                            <div class="stats-game-name">${g.name}</div>
                            <div class="stats-game-meta">${winnerHtml}</div>
                        </div>
                        <div class="stats-game-count">
                            <span class="stats-game-count-num">${g.count}</span>
                            <span class="stats-game-count-label">${g.count === 1 ? 'partida' : 'partidas'}</span>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="stats-game-row-arrow"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>`;
            }).join('');

            const svgChevron = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
            const remaining = games.length - STATS_LIMIT;
            const showMoreBtnGame = (!showAllGames && games.length > STATS_LIMIT)
                ? `<button class="secondary" onclick="statsShowMoreGames()" style="width:100%;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:8px;">${svgChevron}Ver ${remaining} juego${remaining !== 1 ? 's' : ''} más</button>`
                : '';

            return `<div class="stats-game-list">${rows}${showMoreBtnGame}</div>`;
        }

        // ── Game detail sheet ───────────────────────────────────────────────
        let _currentGameKey = null;

        function showGameDetail(gameKey) {
            _currentGameKey = gameKey;
            const history = getHistory();
            const entries = history.filter(e => e.gameName.trim().toLowerCase() === gameKey);
            if (!entries.length) return;

            document.getElementById('gameDetailEmoji').textContent = entries[0].emoji || '🎲';
            document.getElementById('gameDetailTitle').textContent = entries[0].gameName;
            document.getElementById('gameDetailCount').textContent =
                `${entries.length} ${entries.length === 1 ? 'partida' : 'partidas'}`;

            _renderGameDetailCards(entries);
            document.getElementById('gameDetailModal').classList.add('open');
        }

        function _renderGameDetailCards(entries) {
            const body = document.getElementById('gameDetailBody');
            body.innerHTML = '';
            const crownSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="flex-shrink:0;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
            entries.forEach(entry => {
                const pillsHtml = (entry.results || []).map((r, i) => {
                    const scoreStr = typeof r.score === 'number' ? ` · ${r.score} pts` : '';
                    return `<span class="history-card-player-pill${i === 0 ? ' winner' : ''}">${i === 0 ? crownSvg : ''}${r.player}${scoreStr}</span>`;
                }).join('');
                const card = document.createElement('div');
                card.className = 'history-card';
                card.innerHTML = `
                    <div class="history-card-top">
                        <div class="history-card-emoji">${entry.emoji || '🎲'}</div>
                        <div class="history-card-meta">
                            <div class="history-card-game">${entry.gameName}</div>
                            <div class="history-card-date">${formatRelativeDate(entry.date)}</div>
                        </div>
                    </div>
                    <div class="history-card-divider"></div>
                    <div class="history-card-players">${pillsHtml}</div>
                `;
                card.addEventListener('click', () => {
                    document.getElementById('gameDetailModal').classList.remove('open');
                    setTimeout(() => showHistoryDetail(entry), 120);
                });
                body.appendChild(card);
            });
        }

        function toggleEmojiPicker(e) {
            e.stopPropagation();
            const panel = document.getElementById('emojiPickerPanel');
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) {
                setTimeout(() => document.getElementById('emojiPickerCustom').focus(), 50);
            }
        }

        // Limitar a 1 grafema (emoji) con Intl.Segmenter
        document.addEventListener('DOMContentLoaded', () => {
            const input = document.getElementById('emojiPickerCustom');
            if (!input) return;
            input.addEventListener('input', () => {
                const val = input.value;
                if (!val) return;
                try {
                    const segs = [...new Intl.Segmenter().segment(val)].map(s => s.segment);
                    input.value = segs[segs.length - 1];
                } catch(e) {
                    input.value = [...val][0] || '';
                }
            });
            input.addEventListener('keydown', ev => {
                if (ev.key === 'Enter') confirmCustomEmoji();
            });
        });

        function confirmCustomEmoji() {
            const val = document.getElementById('emojiPickerCustom').value.trim();
            if (!val || !_currentGameKey) return;
            _saveEmojiForGame(_currentGameKey, val);
            document.getElementById('emojiPickerCustom').value = '';
            document.getElementById('emojiPickerPanel').classList.remove('open');
        }

        function _saveEmojiForGame(gameKey, emoji) {
            const history = getHistory();
            history.forEach(e => {
                if (e.gameName.trim().toLowerCase() === gameKey) e.emoji = emoji;
            });
            saveHistory(history);
            document.getElementById('gameDetailEmoji').textContent = emoji;
            document.querySelectorAll('#gameDetailBody .history-card-emoji').forEach(c => c.textContent = emoji);
            if (window._fbSaveEntry) {
                history.filter(e => e.gameName.trim().toLowerCase() === gameKey)
                       .forEach(e => window._fbSaveEntry(e));
            }
            const statsCard = document.getElementById('statsCard-game');
            if (statsCard && statsCard.classList.contains('open')) {
                statsCard.innerHTML = buildStatsGame(getHistory());
            }

            // ── Sincronizar emoji con la plantilla personalizada del mismo juego ──
            const templates = getCustomTemplates();
            const tpl = templates.find(t => t.name.trim().toLowerCase() === gameKey);
            if (tpl) {
                tpl.emoji = emoji;
                saveCustomTemplates(templates);
            }
        }

        function closeGameDetailModal(e) {
            if (e.target === document.getElementById('gameDetailModal')) {
                document.getElementById('gameDetailModal').classList.remove('open');
            }
        }
        // ── Fin game detail ─────────────────────────────────────────────────


        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js', { scope: './' })
                    .then(reg => console.log('BGTime SW registrado:', reg.scope))
                    .catch(err => console.warn('BGTime SW error:', err));
            });
        }
