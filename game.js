// Get canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- NEW: Game Data ---
const TERRAIN_TYPES = {
    TEE_BOX: { name: "Tee Box", color: "#52b788", penalty: { power: 1, accuracy: 1 } },
    FAIRWAY: { name: "Fairway", color: "#2a8e43", penalty: { power: 1, accuracy: 1 } },
    GREEN: { name: "Green", color: "#1b612d", penalty: { power: 1, accuracy: 1 } },
    ROUGH: { name: "Rough", color: "#134621", penalty: { power: 0.8, accuracy: 1.5 } }, // 80% power, 50% faster accuracy meter
    SAND: { name: "Sand", color: "#d2b48c", penalty: { power: 0.6, accuracy: 1.2 } },   // 60% power, 20% faster meter
};

const CLUBS = {
    driver: { name: "Driver", baseDistance: 250, suitableTerrain: ["TEE_BOX"] },
    iron: { name: "Iron", baseDistance: 150, suitableTerrain: ["TEE_BOX", "FAIRWAY", "ROUGH"] },
    wedge: { name: "Wedge", baseDistance: 80, suitableTerrain: ["FAIRWAY", "ROUGH", "SAND"] },
    putter: { name: "Putter", baseDistance: 20, suitableTerrain: ["GREEN"] },
};

// --- NEW: Skill Tree Definition ---
const SKILL_TREE = {
    power1: { id: "power1", name: "Power Hitter I", desc: "+2 to Power", cost: 1, requirement: null, purchased: false, apply: (p) => p.stats.power += 2 },
    power2: { id: "power2", name: "Power Hitter II", desc: "+3 to Power", cost: 2, requirement: "power1", purchased: false, apply: (p) => p.stats.power += 3 },
    accuracy1: { id: "accuracy1", name: "Steady Hand I", desc: "+2 to Accuracy", cost: 1, requirement: null, purchased: false, apply: (p) => p.stats.accuracy += 2 },
    control1: { id: "control1", name: "Spin Doctor I", desc: "+2 to Control", cost: 1, requirement: null, purchased: false, apply: (p) => p.stats.control += 2 },
};

// --- RPG Player Stats ---
let player = {
    level: 1, xp: 0, xpToNextLevel: 100,
    stats: { power: 10, accuracy: 10, control: 10 },
    skillPoints: 0,
};

// --- Game State Variables ---
let ball = { x: 400, y: 550, isMoving: false };
let hole = { x: 400, y: 50 };
let courseLayout = [ // NEW: Defines the course terrain
    { type: TERRAIN_TYPES.TEE_BOX, rect: [350, 530, 100, 40] },
    { type: TERRAIN_TYPES.ROUGH, rect: [0, 0, 300, 600] },
    { type: TERRAIN_TYPES.ROUGH, rect: [500, 0, 300, 600] },
    { type: TERRAIN_TYPES.SAND, rect: [450, 150, 60, 60] },
    { type: TERRAIN_TYPES.GREEN, ellipse: [hole.x, hole.y + 20, 80, 40] },
    { type: TERRAIN_TYPES.FAIRWAY, rect: [300, 0, 200, 600] }, // Drawn last to be underneath others
];
let strokes = 0;
let currentTerrain = TERRAIN_TYPES.TEE_BOX;

// Shot mechanics state
let swingState = 'idle'; // 'power', 'accuracy', 'control', 'shot'
let powerValue = 0, accuracyValue = 0, controlValue = 0; // ControlValue: 0-50 is backspin, 50 is none, 51-100 is topspin
let powerDirection = 1, accuracyDirection = 1, controlDirection = 1;
let selectedClub = CLUBS.driver;

// UI Elements
const messageEl = document.getElementById('game-message');
const distanceEl = document.getElementById('distance-to-hole');
const strokesEl = document.getElementById('hole-strokes');
const terrainEl = document.getElementById('terrain-type');
const powerBar = document.getElementById('power-bar');
const accuracyMarker = document.getElementById('accuracy-marker');
const controlMarker = document.getElementById('control-marker');
const clubSelect = document.getElementById('club-select');

// --- Drawing Functions ---
function drawCourse() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw layout from back to front
    for (let i = courseLayout.length - 1; i >= 0; i--) {
        const layoutPart = courseLayout[i];
        ctx.fillStyle = layoutPart.type.color;
        if (layoutPart.rect) {
            ctx.fillRect(...layoutPart.rect);
        } else if (layoutPart.ellipse) {
            ctx.beginPath();
            ctx.ellipse(...layoutPart.ellipse, 0, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
    // Hole
    ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(hole.x, hole.y, 6, 0, 2 * Math.PI); ctx.fill();
    // Ball
    ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(ball.x, ball.y, 5, 0, 2 * Math.PI); ctx.fill();
}

// --- Game Logic ---
function updateDistance() {
    const pixelDistance = Math.sqrt(Math.pow(ball.x - hole.x, 2) + Math.pow(ball.y - hole.y, 2));
    const yards = Math.round(pixelDistance);
    distanceEl.textContent = `${yards} yards`;
    return yards;
}

// MODIFIED: takeShot() to include all new systems
function takeShot() {
    strokes++;
    ball.isMoving = true;
    swingState = 'shot';
    messageEl.textContent = "Woosh!";

    const terrainPenalty = currentTerrain.penalty;

    // 1. Calculate base distance from club and player power
    const powerComponent = (player.stats.power / 100) + 1; // 10 power = 1.1x multiplier
    const maxDistanceForClub = selectedClub.baseDistance * powerComponent;
    
    // 2. Apply power from meter and terrain penalty
    const shotDistance = maxDistanceForClub * (powerValue / 100) * terrainPenalty.power;
    
    // 3. Calculate accuracy deviation
    const accuracyMiss = Math.abs(50 - accuracyValue) / 50; // 0 to 1
    const angleOffset = (accuracyMiss * 15) * (accuracyValue < 50 ? 1 : -1);

    // 4. Calculate final angle and target coordinates
    const angleToHole = Math.atan2(hole.y - ball.y, hole.x - ball.x);
    const finalAngle = angleToHole + (angleOffset * Math.PI / 180);
    const targetX = ball.x + Math.cos(finalAngle) * shotDistance;
    const targetY = ball.y + Math.sin(finalAngle) * shotDistance;

    // 5. Calculate roll based on spin control
    // Control stat makes it easier to add more spin
    const spinRaw = (controlValue - 50) / 50; // -1 (max backspin) to +1 (max topspin)
    const spinEffectiveness = 1 + (player.stats.control / 20); // 10 control = 1.5x spin
    const spinRoll = (shotDistance / 10) * spinRaw * spinEffectiveness;

    animateBall(targetX, targetY, spinRoll);
}

// MODIFIED: animateBall() to handle roll from spin
function animateBall(targetX, targetY, roll) {
    const startX = ball.x, startY = ball.y;
    let progress = 0;

    function flightStep() {
        progress += 0.02; // Speed of flight
        if (progress < 1) {
            ball.x = startX + (targetX - startX) * progress;
            ball.y = startY + (targetY - startY) * progress;
            requestAnimationFrame(flightStep);
        } else {
            ball.x = targetX;
            ball.y = targetY;
            // Now, animate the roll
            animateRoll(roll);
        }
    }
    flightStep();
}

function animateRoll(rollDistance) {
    if (Math.abs(rollDistance) < 1) {
        endShot(); // No significant roll
        return;
    }
    const angle = Math.atan2(ball.y - hole.y, ball.x - hole.x);
    const startX = ball.x, startY = ball.y;
    const targetX = ball.x - Math.cos(angle) * rollDistance;
    const targetY = ball.y - Math.sin(angle) * rollDistance;
    let progress = 0;

    function rollStep() {
        progress += 0.03; // Speed of roll
        if (progress < 1) {
            ball.x = startX + (targetX - startX) * progress;
            ball.y = startY + (targetY - startY) * progress;
            requestAnimationFrame(rollStep);
        } else {
            ball.x = targetX;
            ball.y = targetY;
            endShot();
        }
    }
    rollStep();
}

// NEW: End of shot logic
function endShot() {
    ball.isMoving = false;
    // Determine the terrain the ball landed on
    currentTerrain = getTerrainAtPoint(ball.x, ball.y);
    terrainEl.textContent = currentTerrain.name;
    checkForWin();
}

function getTerrainAtPoint(x, y) {
    for (const layoutPart of courseLayout) {
        if (layoutPart.rect) {
            const [rx, ry, rw, rh] = layoutPart.rect;
            if (x > rx && x < rx + rw && y > ry && y < ry + rh) return layoutPart.type;
        } else if (layoutPart.ellipse) {
            const [ex, ey, erx, ery] = layoutPart.ellipse;
            const value = (Math.pow(x - ex, 2) / Math.pow(erx, 2)) + (Math.pow(y - ey, 2) / Math.pow(ery, 2));
            if (value <= 1) return layoutPart.type;
        }
    }
    return TERRAIN_TYPES.FAIRWAY; // Default
}

function checkForWin() {
    const distance = updateDistance();
    if (distance <= 6 && currentTerrain === TERRAIN_TYPES.GREEN) {
        const score = strokes - 4;
        let scoreText = score === 0 ? "Par" : (score > 0 ? `+${score}` : `${score}`);
        if (strokes === 1) scoreText = "HOLE IN ONE!!!";
        messageEl.textContent = `In the hole! Score: ${scoreText}`;

        let xpGained = 50 - (score * 10);
        if (xpGained < 10) xpGained = 10;
        player.xp += xpGained;

        // Level Up Logic
        if (player.xp >= player.xpToNextLevel) {
            player.level++;
            player.xp -= player.xpToNextLevel;
            player.xpToNextLevel = Math.round(player.xpToNextLevel * 1.5);
            player.skillPoints++;
            alert(`LEVEL UP! You are now level ${player.level}! You have ${player.skillPoints} Skill Point(s) to spend.`);
        }
        updateUI();
        setTimeout(() => { resetHole(); }, 2000);
    } else {
        resetSwing();
    }
}

function resetHole() {
    ball.x = 400; ball.y = 550; strokes = 0;
    currentTerrain = TERRAIN_TYPES.TEE_BOX;
    terrainEl.textContent = currentTerrain.name;
    updateUI();
    resetSwing();
}

function resetSwing() {
    swingState = 'idle';
    powerValue = 0; accuracyValue = 0; controlValue = 0;
    powerBar.style.width = '0%';
    accuracyMarker.style.left = '0%';
    controlMarker.style.left = '0%';
    updateDistance();
    strokesEl.textContent = strokes;
    if (!ball.isMoving) {
        messageEl.textContent = 'Click to start your swing!';
    }
}

// --- Main Game Loop (MODIFIED) ---
function gameLoop() {
    const terrainPenalty = currentTerrain.penalty;
    if (swingState === 'power') {
        powerValue += 2 * powerDirection;
        if (powerValue >= 100 || powerValue <= 0) powerDirection *= -1;
        powerBar.style.width = `${powerValue}%`;
    } else if (swingState === 'accuracy') {
        const accuracySpeed = (5 - (player.stats.accuracy / 4)) * terrainPenalty.accuracy;
        accuracyValue += accuracySpeed * accuracyDirection;
        if (accuracyValue >= 100 || accuracyValue <= 0) accuracyDirection *= -1;
        accuracyMarker.style.left = `${accuracyValue}%`;
    } else if (swingState === 'control') {
        const controlSpeed = 5 - (player.stats.control / 4);
        controlValue += controlSpeed * controlDirection;
        if (controlValue >= 100 || controlValue <= 0) controlDirection *= -1;
        controlMarker.style.left = `${controlValue}%`;
    }

    drawCourse();
    requestAnimationFrame(gameLoop);
}

// --- Player Input (MODIFIED) ---
canvas.addEventListener('click', () => {
    if (ball.isMoving) return;
    
    // Putter automatically skips control
    const isPutting = selectedClub.name === "Putter";

    if (swingState === 'idle') {
        swingState = 'power';
        messageEl.textContent = 'Click to set POWER!';
    } else if (swingState === 'power') {
        swingState = 'accuracy';
        messageEl.textContent = 'Click to set ACCURACY!';
    } else if (swingState === 'accuracy') {
        if (isPutting) {
            takeShot(); // Skip control for putter
        } else {
            swingState = 'control';
            messageEl.textContent = 'Click to set SPIN!';
        }
    } else if (swingState === 'control') {
        takeShot();
    }
});

clubSelect.addEventListener('change', (e) => {
    selectedClub = CLUBS[e.target.value];
});

// --- UI Update Functions ---
function updateUI() {
    document.getElementById('player-level').textContent = player.level;
    document.getElementById('player-xp').textContent = player.xp;
    document.getElementById('xp-to-next-level').textContent = player.xpToNextLevel;
    document.getElementById('player-sp').textContent = player.skillPoints;
    document.getElementById('stat-power').textContent = player.stats.power;
    document.getElementById('stat-accuracy').textContent = player.stats.accuracy;
    document.getElementById('stat-control').textContent = player.stats.control;
}

// --- NEW: Skill Tree Logic ---
const skillTreeModal = document.getElementById('skill-tree-modal');
const skillsContainer = document.getElementById('skills-container');

function renderSkillTree() {
    skillsContainer.innerHTML = '';
    for (const skillId in SKILL_TREE) {
        const skill = SKILL_TREE[skillId];
        const skillDiv = document.createElement('div');
        skillDiv.className = 'skill-item';
        
        let canPurchase = player.skillPoints >= skill.cost && !skill.purchased;
        if (skill.requirement && !SKILL_TREE[skill.requirement].purchased) {
            canPurchase = false;
        }

        if (skill.purchased) skillDiv.classList.add('purchased');
        if (!canPurchase && !skill.purchased) skillDiv.classList.add('locked');

        skillDiv.innerHTML = `
            <div>
                <strong>${skill.name}</strong>
                <small>${skill.desc}</small>
            </div>
            <button data-skill-id="${skill.id}" ${!canPurchase ? 'disabled' : ''}>
                Cost: ${skill.cost} SP
            </button>
        `;
        skillsContainer.appendChild(skillDiv);
    }
}

skillsContainer.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        const skillId = e.target.getAttribute('data-skill-id');
        const skill = SKILL_TREE[skillId];
        if (player.skillPoints >= skill.cost) {
            player.skillPoints -= skill.cost;
            skill.purchased = true;
            skill.apply(player); // Apply the skill bonus
            renderSkillTree();
            updateUI();
        }
    }
});

document.getElementById('skill-tree-btn').addEventListener('click', () => {
    renderSkillTree();
    skillTreeModal.style.display = 'flex';
});
document.getElementById('close-skill-tree-btn').addEventListener('click', () => {
    skillTreeModal.style.display = 'none';
});

// --- Initialization ---
updateUI();
updateDistance();
gameLoop();
