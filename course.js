// Defines terrain colors for visual texturing
const TERRAIN_COLORS = {
    TEE_BOX: ["#52b788", "#5ac792"],
    FAIRWAY: ["#2a8e43", "#319e4a"],
    GREEN: ["#1b612d", "#217036"],
    ROUGH: ["#134621", "#1a5a2a"],
    SAND: ["#d2b48c", "#dcbfa0"],
    WATER: ["#457b9d", "#5a8fb0"],
};

// Defines terrain types with their physics properties (friction, bounce)
const TERRAIN_TYPES = {
    TEE_BOX: { name: "Tee Box", colors: TERRAIN_COLORS.TEE_BOX, texture: 'hatch', friction: 0.98, bounce: 0.4 },
    FAIRWAY: { name: "Fairway", colors: TERRAIN_COLORS.FAIRWAY, texture: 'solid', friction: 0.95, bounce: 0.45 },
    GREEN: { name: "Green", colors: TERRAIN_COLORS.GREEN, texture: 'solid', friction: 0.85, bounce: 0.2 },
    ROUGH: { name: "Rough", colors: TERRAIN_COLORS.ROUGH, texture: 'dots', friction: 0.70, bounce: 0.25 },
    SAND: { name: "Sand", colors: TERRAIN_COLORS.SAND, texture: 'dots', friction: 0.55, bounce: 0.1 },
    WATER: { name: "Water", colors: TERRAIN_COLORS.WATER, texture: 'waves', friction: 0, bounce: 0 },
};

// Defines a full set of clubs, each with a base distance, loft, and a performance matrix for different terrains.
// Performance is a multiplier from 0 (unusable) to 1.0 (perfect).
const CLUBS = {
    // Woods
    '1W': { name: "Driver", baseDist: 260, loft: 10, performance: { "Tee Box": 1.0, "Fairway": 0.8, "Rough": 0.1, "Sand": 0, "Green": 0 } },
    '3W': { name: "3 Wood", baseDist: 230, loft: 15, performance: { "Tee Box": 1.0, "Fairway": 1.0, "Rough": 0.5, "Sand": 0.1, "Green": 0 } },
    '5W': { name: "5 Wood", baseDist: 210, loft: 18, performance: { "Tee Box": 1.0, "Fairway": 1.0, "Rough": 0.6, "Sand": 0.2, "Green": 0 } },
    // Hybrids
    '3H': { name: "3 Hybrid", baseDist: 190, loft: 21, performance: { "Tee Box": 1.0, "Fairway": 1.0, "Rough": 0.8, "Sand": 0.4, "Green": 0 } },
    // Irons
    '3I': { name: "3 Iron", baseDist: 180, loft: 24, performance: { "Tee Box": 0.9, "Fairway": 1.0, "Rough": 0.7, "Sand": 0.3, "Green": 0 } },
    '5I': { name: "5 Iron", baseDist: 160, loft: 30, performance: { "Tee Box": 0.9, "Fairway": 1.0, "Rough": 0.8, "Sand": 0.4, "Green": 0 } },
    '7I': { name: "7 Iron", baseDist: 140, loft: 38, performance: { "Tee Box": 0.9, "Fairway": 1.0, "Rough": 0.9, "Sand": 0.6, "Green": 0 } },
    '9I': { name: "9 Iron", baseDist: 120, loft: 45, performance: { "Tee Box": 0.9, "Fairway": 1.0, "Rough": 1.0, "Sand": 0.8, "Green": 0 } },
    // Wedges
    'PW': { name: "Pitching Wedge", baseDist: 100, loft: 50, performance: { "Tee Box": 0.8, "Fairway": 1.0, "Rough": 1.0, "Sand": 0.9, "Green": 0 } },
    'SW': { name: "Sand Wedge", baseDist: 70, loft: 56, performance: { "Tee Box": 0.7, "Fairway": 1.0, "Rough": 1.0, "Sand": 1.0, "Green": 0 } },
    'LW': { name: "Lob Wedge", baseDist: 50, loft: 60, performance: { "Tee Box": 0.6, "Fairway": 1.0, "Rough": 1.0, "Sand": 1.0, "Green": 0 } },
    // Putter
    'P': { name: "Putter", baseDist: 20, loft: 4, performance: { "Tee Box": 0.1, "Fairway": 0.2, "Rough": 0.1, "Sand": 0.1, "Green": 1.0 } },
};

// Helper function to create a standard hole layout.
function createStandardLayout(teePos, holePos) {
    return [
        { type: TERRAIN_TYPES.TEE_BOX, rect: [teePos.x - 25, teePos.y - 10, 50, 20] },
        { type: TERRAIN_TYPES.ROUGH, rect: [0, 0, 280, 600] },
        { type: TERRAIN_TYPES.ROUGH, rect: [520, 0, 280, 600] },
        { type: TERRAIN_TYPES.SAND, ellipse: [450, 150, 40, 30] },
        { type: TERRAIN_TYPES.GREEN, ellipse: [holePos.x, holePos.y + 10, 60, 30] },
        { type: TERRAIN_TYPES.FAIRWAY, rect: [280, 0, 240, 600] },
    ];
}

// Defines the full 18-hole course.
const COURSE_DATA = [
    { id: 1, par: 4, startPos: { x: 400, y: 550 }, holePos: { x: 400, y: 80 },
      fairwayPath: [{x: 400, y: 550}, {x: 400, y: 80}],
      layout: createStandardLayout({ x: 400, y: 550 }, { x: 400, y: 80 })
    },
    { id: 2, par: 3, startPos: { x: 400, y: 550 }, holePos: { x: 400, y: 200 },
      fairwayPath: [{x: 400, y: 550}, {x: 400, y: 200}],
      layout: [
        { type: TERRAIN_TYPES.TEE_BOX, rect: [375, 540, 50, 20] },
        { type: TERRAIN_TYPES.WATER, rect: [0, 280, 800, 120] },
        { type: TERRAIN_TYPES.GREEN, ellipse: [400, 210, 80, 35] },
        { type: TERRAIN_TYPES.ROUGH, rect: [0, 0, 800, 600] },
      ]
    },
    { id: 3, par: 5, startPos: { x: 350, y: 550 }, holePos: { x: 450, y: 100 },
      fairwayPath: [{x: 350, y: 550}, {x: 350, y: 350}, {x: 450, y: 350}, {x: 450, y: 100}],
      layout: [
        { type: TERRAIN_TYPES.TEE_BOX, rect: [325, 540, 50, 20] },
        { type: TERRAIN_TYPES.ROUGH, rect: [0, 0, 800, 600] },
        { type: TERRAIN_TYPES.FAIRWAY, path: [
            {x: 320, y: 560}, {x: 320, y: 340}, {x: 470, y: 340}, {x: 470, y: 80}, {x: 430, y: 80}, {x: 430, y: 360}, {x: 340, y: 360}, {x: 340, y: 560}
        ]},
        { type: TERRAIN_TYPES.SAND, ellipse: [320, 300, 30, 20] },
        { type: TERRAIN_TYPES.GREEN, ellipse: [450, 110, 60, 30] },
    ]},
    ...Array(15).fill(null).map((_, i) => ({
        id: i + 4, par: 4, startPos: { x: 400, y: 550 }, holePos: { x: 400, y: 80 },
        fairwayPath: [{x: 400, y: 550}, {x: 400, y: 80}],
        layout: createStandardLayout({ x: 400, y: 550 }, { x: 400, y: 80 })
    }))
];
