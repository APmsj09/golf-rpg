// --- NEW: Terrain Texture Colors (slightly varied for patterns) ---
const TERRAIN_COLORS = {
    TEE_BOX: ["#52b788", "#5ac792"],
    FAIRWAY: ["#2a8e43", "#319e4a"],
    GREEN: ["#1b612d", "#217036"],
    ROUGH: ["#134621", "#1a5a2a"],
    SAND: ["#d2b48c", "#dcbfa0"],
    WATER: ["#457b9d", "#5a8fb0"],
};

const TERRAIN_TYPES = {
    TEE_BOX: { name: "Tee Box", colors: TERRAIN_COLORS.TEE_BOX, penalty: { power: 1, accuracy: 1, roll: 1 }, texture: 'hatch' },
    FAIRWAY: { name: "Fairway", colors: TERRAIN_COLORS.FAIRWAY, penalty: { power: 1, accuracy: 1, roll: 1 }, texture: 'solid' },
    GREEN: { name: "Green", colors: TERRAIN_COLORS.GREEN, penalty: { power: 1, accuracy: 1, roll: 0.1 }, texture: 'solid' },
    ROUGH: { name: "Rough", colors: TERRAIN_COLORS.ROUGH, penalty: { power: 0.8, accuracy: 1.5, roll: 0.5 }, texture: 'dots' },
    SAND: { name: "Sand", colors: TERRAIN_COLORS.SAND, penalty: { power: 0.6, accuracy: 1.2, roll: 0.2 }, texture: 'dots' },
    WATER: { name: "Water", colors: TERRAIN_COLORS.WATER, penalty: { power: 0, accuracy: 10, roll: 0 }, texture: 'waves' }, // Unplayable
};

const CLUBS = {
    '1W': { name: "Driver (1W)", baseDistance: 260, suitableTerrain: ["TEE_BOX"] },
    '3W': { name: "3 Wood", baseDistance: 230, suitableTerrain: ["TEE_BOX", "FAIRWAY"] },
    '5I': { name: "5 Iron", baseDistance: 180, suitableTerrain: ["TEE_BOX", "FAIRWAY", "ROUGH"] },
    '7I': { name: "7 Iron", baseDistance: 150, suitableTerrain: ["TEE_BOX", "FAIRWAY", "ROUGH"] },
    '9I': { name: "9 Iron", baseDistance: 120, suitableTerrain: ["TEE_BOX", "FAIRWAY", "ROUGH"] },
    'PW': { name: "Pitching Wedge", baseDistance: 90, suitableTerrain: ["FAIRWAY", "ROUGH", "SAND"] },
    'SW': { name: "Sand Wedge", baseDistance: 60, suitableTerrain: ["FAIRWAY", "ROUGH", "SAND"] },
    'P': { name: "Putter", baseDistance: 20, suitableTerrain: ["GREEN"] },
};

// Helper function for creating standard hole layouts
function createStandardLayout(teePos, holePos) {
    return [
        { type: TERRAIN_TYPES.TEE_BOX, rect: [teePos.x - 25, teePos.y - 10, 50, 20] },
        { type: TERRAIN_TYPES.ROUGH, rect: [0, 0, 280, 600] },
        { type: TERRAIN_TYPES.ROUGH, rect: [520, 0, 280, 600] },
        { type: TERRAIN_TYPES.SAND, ellipse: [450, 150, 40, 30] }, // Smaller sand trap
        { type: TERRAIN_TYPES.GREEN, ellipse: [holePos.x, holePos.y + 10, 60, 30] },
        { type: TERRAIN_TYPES.FAIRWAY, rect: [280, 0, 240, 600] },
    ];
}


const COURSE_DATA = [
    { id: 1, par: 4, startPos: { x: 400, y: 550 }, holePos: { x: 400, y: 80 },
      fairwayPath: [{x: 400, y: 550}, {x: 400, y: 80}], // Straight
      layout: createStandardLayout({ x: 400, y: 550 }, { x: 400, y: 80 })
    },
    { id: 2, par: 3, startPos: { x: 400, y: 550 }, holePos: { x: 400, y: 200 },
      fairwayPath: [{x: 400, y: 550}, {x: 400, y: 200}],
      layout: [
        { type: TERRAIN_TYPES.TEE_BOX, rect: [375, 540, 50, 20] },
        { type: TERRAIN_TYPES.WATER, rect: [0, 280, 800, 120] }, // Water hazard across fairway
        { type: TERRAIN_TYPES.GREEN, ellipse: [400, 210, 80, 35] },
        { type: TERRAIN_TYPES.ROUGH, rect: [0, 0, 800, 600] },
      ]
    },
    { id: 3, par: 5, startPos: { x: 350, y: 550 }, holePos: { x: 450, y: 100 },
      fairwayPath: [{x: 350, y: 550}, {x: 350, y: 350}, {x: 450, y: 350}, {x: 450, y: 100}], // Dogleg right
      layout: [
        { type: TERRAIN_TYPES.TEE_BOX, rect: [325, 540, 50, 20] },
        { type: TERRAIN_TYPES.ROUGH, rect: [0, 0, 800, 600] },
        { type: TERRAIN_TYPES.FAIRWAY, path: [ // Custom path for fairway (should follow fairwayPath)
            {x: 320, y: 560}, {x: 320, y: 340}, {x: 470, y: 340}, {x: 470, y: 80}, {x: 430, y: 80}, {x: 430, y: 360}, {x: 340, y: 360}, {x: 340, y: 560}
        ]},
        { type: TERRAIN_TYPES.SAND, ellipse: [320, 300, 30, 20] },
        { type: TERRAIN_TYPES.GREEN, ellipse: [450, 110, 60, 30] },
    ]},
    { id: 4, par: 4, startPos: { x: 400, y: 550 }, holePos: { x: 400, y: 80 },
      fairwayPath: [{x: 400, y: 550}, {x: 400, y: 80}], // Straight
      layout: [
        { type: TERRAIN_TYPES.TEE_BOX, rect: [375, 540, 50, 20] },
        { type: TERRAIN_TYPES.ROUGH, rect: [0, 0, 800, 600] },
        { type: TERRAIN_TYPES.FAIRWAY, rect: [280, 0, 240, 600] },
        { type: TERRAIN_TYPES.WATER, rect: [300, 280, 200, 50] }, // Small water hazard on fairway
        { type: TERRAIN_TYPES.GREEN, ellipse: [400, 90, 60, 30] },
      ]
    },
    // ... (For brevity, remaining holes will be clones of Hole 1 for now) ...
    ...Array(14).fill(null).map((_, i) => ({
        id: i + 5,
        par: 4,
        startPos: { x: 400, y: 550 },
        holePos: { x: 400, y: 80 },
        fairwayPath: [{x: 400, y: 550}, {x: 400, y: 80}],
        layout: createStandardLayout({ x: 400, y: 550 }, { x: 400, y: 80 })
    }))
];
