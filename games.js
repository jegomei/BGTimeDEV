/**
 * Plantillas de juegos de mesa
 * ============================
 * Cada entrada define la configuración de puntuación de un juego.
 * Añade, elimina o edita entradas libremente.
 *
 * Campos disponibles:
 *
 *   name          (string)   Nombre del juego que aparece en el selector
 *   emoji         (string)   Emoji decorativo (opcional)
 *   maxPlayers    (number)   Número máximo de jugadores (opcional, sin límite si se omite)
 *   scoringType   (string)   Tipo de puntuación:
 *                              'rounds'            → rondas simples
 *                              'items'             → ítems al final
 *                              'rounds_with_items' → rondas con categorías
 *                              'target_score'      → hasta puntuación objetivo
 *
 *   --- Solo para scoringType 'rounds' ---
 *   numRounds       (number)  Número de rondas
 *   roundScoringMode (string) 'all_at_end' | 'round_by_round'
 *
 *   --- Solo para scoringType 'items' ---
 *   items  (array)  Lista de ítems: { name: string, negative: boolean }
 *
 *   --- Solo para scoringType 'rounds_with_items' ---
 *   numRounds  (number)  Número de rondas
 *   roundItems (array)   Lista de ítems: { name: string, negative: boolean }
 *
 *   --- Solo para scoringType 'target_score' ---
 *   targetScore (number)  Puntuación para ganar
 */

const GAME_TEMPLATES = [


    /* JUEGOS POR TARGET */
    
    {
        name: "Océanos de papel",
        emoji: "🐙",
        maxPlayers: 4,
        scoringType: "target_score",
        targetScore: 40
    },

    /*JUEGOS CON ÍTEMS */ 

    {
        name: "Viajeros al tren",
        emoji: "🚂",
        maxPlayers: 5,
        scoringType: "items",
        items: [
            { name: "Rutas", negative: false },
            { name: "Objetivos completados", negative: false },
            { name: "10p x Ruta más larga", negative: false },
            { name: "Objetivos fallidos", negative: true },
            { name: "4p x Estaciones sin usar", negative: false },
        ]
    },

    {
        name: "Dioses!",
        emoji: "⚡️",
        maxPlayers: 6,
        scoringType: "items",
        items: [
            { name: "Cuadrícula", negative: false },
            { name: "Objetivo común", negative: false },
            { name: "Leyes", negative: false },
            { name: "Patrones", negative: false },
        ]
    },
     
    {
        name: "Sagrada",
        emoji: "🌈",
        maxPlayers: 6,
        scoringType: "items",
        items: [
            { name: "Obj. Público", negative: false },
            { name: "Obj. Privado", negative: false },
            { name: "Donativos sin usar", negative: false },
            { name: "Huecos", negative: true },
        ]
    },

     {
        name: "Fromage",
        emoji: "🧀",
        maxPlayers: 4,
        scoringType: "items",
        items: [
            { name: "Bistro", negative: false },
            { name: "Festival", negative: false },
            { name: "Quesería", negative: false },
            { name: "Ciudades", negative: false },
            { name: "Estructuras", negative: false },
            { name: "Fruta", negative: false },
            { name: "Pedidos", negative: false },
            { name: "Recursos sin usar", negative: false },
        ]
    },

    {
        name: "Harmonies",
        emoji: "🦁",
        maxPlayers: 4,
        scoringType: "items",
        items: [
            { name: "Árboles", negative: false },
            { name: "Montañas", negative: false },
            { name: "Campos", negative: false },
            { name: "Agua", negative: false },
            { name: "Edificios", negative: false },
            { name: "Cartas de animal", negative: false },
            { name: "Cartas de animal", negative: false },
            { name: "Cartas de animal", negative: false },
            { name: "Cartas de animal", negative: false },
            { name: "Cartas de animal", negative: false },
        ]
    },

    {
            name: "Agrícola",
            emoji: "🌾",
            maxPlayers: 5,
            scoringType: "items",
            items: [
                { name: "Campos", negative: false },
                { name: "Pastos", negative: false },
                { name: "Cereales", negative: false },
                { name: "Verduras", negative: false },
                { name: "Ovejas", negative: false },
                { name: "Jabalíes", negative: false },
                { name: "Vacas", negative: false },
                { name: "Establos vacíos", negative: true },
                { name: "Habitaciones", negative: false },
                { name: "Puntos de cartas", negative: false },
                { name: "Mendicidad", negative: true }
            ]
    },

   /*{
        name: "7 Wonders",
        emoji: "🏛️",
        maxPlayers: 7,
        scoringType: "items",
        items: [
            { name: "Militar", negative: false },
            { name: "Monedas", negative: false },
            { name: "Maravillas", negative: false },
            { name: "Cultura", negative: false },
            { name: "Comercio", negative: false },
            { name: "Gremios", negative: false },
            { name: "Ciencia", negative: false }
        ]
    }, */

    /*JUEGOS CON RONDAS CON ÍTEMS */ 

    /*JUEGOS CON RONDAS */ 

     
    
    
   
];