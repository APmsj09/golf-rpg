const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- (SKILL_TREE object remains the same) ---
const SKILL_TREE = {
    power1: { id: "power1", name: "Power Hitter I", desc: "+2 to Power", cost: 1, requirement: null, purchased: false, apply: (p) => p.stats.power += 2 },
    power2: { id: "power2", name: "Power Hitter II", desc: "+3 to Power", cost: 2, requirement: "power1", purchased: false, apply: (p) => p.stats.power += 3 },
    accuracy1: { id: "accuracy1", name: "Steady Hand I", desc: "+2 to Accuracy", cost: 1, requirement: null, purchased: false, apply: (p) => p.stats.accuracy += 2 },
    control1: { id: "control1", name: "Spin Doctor I", desc: "+2 to Control", cost: 1, requirement: null, purchased: false, apply: (p) => p.stats.control += 2 },
};

let player = {
    level: 1, xp: 0, xpToNextLevel: 100,
    stats: { power: 10, accuracy: 10, control: 10 },
    skillPoints: 0,
    scorecard: [],
};

// --- Game State Variables ---
let ball = { x: 400, y: 550, isMoving: false };
let hole = { x: 400, y: 50 };
let currentHoleIndex = 0;
let currentHoleData; // NEW: Store current hole's full data
let courseLayout = [];
let strokes = 0;
let currentTerrain = TERRAIN_TYPES.TEE_BOX;
let weather = { windSpeed: 0, windDirection: 0, type: 'Calm' };

// Shot mechanics state
let swingState = 'idle', powerValue = 0, accuracyValue = 0, controlValue = 0;
let powerDirection = 1, accuracyDirection = 1, controlDirection = 1;
let selectedClub = CLUBS['1W'];

// UI Elements
const messageEl = document.getElementById('game-message');
const distanceEl = document.getElementById('distance-to-hole');
const strokesEl = document.getElementById('hole-strokes');
const terrainEl = document.getElementById('terrain-type');
const powerBar = document.getElementById('power-bar');
const accuracyMarker = document.getElementById('accuracy-marker');
const controlMarker = document.getElementById('control-marker');
const clubSelect = document.getElementById('club-select');
const holeNumberEl = document.getElementById('hole-number');
const holeParEl = document.getElementById('hole-par');
const weatherEl = document.getElementById('weather-conditions');
const useSpinCheckbox = document.getElementById('use-spin-checkbox'); // NEW

// --- NEW: Drawing Functions for Textures ---
function drawRectWithTexture(x, y, w, h, terrainType) {
    const colors = terrainType.colors;
    ctx.fillStyle = colors[0];
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = colors[1]; // Secondary color for texture
    if (terrainType.texture === 'dots') {
        for (let i = 0; i < w; i += 8) {
            for (let j = 0; j < h; j += 8) {
                ctx.beginPath();
                ctx.arc(x + i + Math.random() * 4, y + j + Math.random() * 4, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    } else if (terrainType.texture === 'hatch') {
        for (let i = 0; i < w + h; i += 10) {
            ctx.beginPath();
            ctx.moveTo(x + i, y);
            ctx.lineTo(x, y + i);
            ctx.stroke();
        }
    } else if (terrainType.texture === 'waves') {
        ctx.strokeStyle = colors[1];
        ctx.lineWidth = 1;
        for (let i = 0; i < h; i += 7) {
            ctx.beginPath();
            ctx.moveTo(x, y + i);
            ctx.bezierCurveTo(x + w * 0.25, y + i + 5, x + w * 0.75, y + i - 5, x + w, y + i);
            ctx.stroke();
        }
    }
}

function drawEllipseWithTexture(cx, cy, rx, ry, terrainType) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    ctx.clip(); // Clip subsequent drawing to this ellipse
    drawRectWithTexture(cx - rx, cy - ry, rx * 2, ry * 2, terrainType); // Draw texture within bounds
    ctx.restore(); // Restore context to remove clipping
}

function drawPathWithTexture(path, terrainType) {
    if (path.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = terrainType.colors[0]; // For now, simple fill
    ctx.fill();
    // Complex textured fill for a polygon path would require advanced canvas techniques
}

function drawCourse() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = courseLayout.length - 1; i >= 0; i--) { // Draw background elements first
        const layoutPart = courseLayout[i];
        if (layoutPart.rect) {
            drawRectWithTexture(...layoutPart.rect, layoutPart.type);
        } else if (layoutPart.ellipse) {
            drawEllipseWithTexture(...layoutPart.ellipse, layoutPart.type);
        } else if (layoutPart.path) {
            drawPathWithTexture(layoutPart.path, layoutPart.type);
        }
    }

    // Hole
    ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(hole.x, hole.y, 6, 0, 2 * Math.PI); ctx.fill();
    // Ball
    ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(ball.x, ball.y, 5, 0, 2 * Math.PI); ctx.fill();

    // Draw Wind Arrow
    if (weather.windSpeed > 0) {
        ctx.save();
        ctx.translate(50, 50); // Top-left corner
        ctx.rotate(weather.windDirection);
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.font = "20px Arial";
        ctx.fillText(`💨 ${weather.windSpeed.toFixed(1)} mph`, 10, 5);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(-20, 0);
        ctx.moveTo(0, 0); ctx.lineTo(-10, -5);
        ctx.moveTo(0, 0); ctx.lineTo(-10, 5);
        ctx.stroke();
        ctx.restore();
    }

    // NEW: Draw Weather Visuals
    if (weather.type === 'Rain') {
        ctx.fillStyle = 'rgba(173, 216, 230, 0.5)'; // Light blue for rain
        for (let i = 0; i < 50; i++) {
            ctx.beginPath();
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.lineTo(Math.random() * canvas.width + 5, Math.random() * canvas.height + 15);
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    } else if (weather.type === 'Snow') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        for (let i = 0; i < 30; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// NEW: Function to get point on a path (linear interpolation between segments)
function getPointOnFairwayPath(progress) {
    const path = currentHoleData.fairwayPath;
    if (path.length === 0) return { x: ball.x, y: ball.y };
    if (path.length === 1) return path[0];

    // Find which segment the progress falls into
    const segmentLength = 1 / (path.length - 1);
    const segmentIndex = Math.min(Math.floor(progress / segmentLength), path.length - 2);
    const segmentProgress = (progress % segmentLength) / segmentLength;

    const p1 = path[segmentIndex];
    const p2 = path[segmentIndex + 1];

    return {
        x: p1.x + (p2.x - p1.x) * segmentProgress,
        y: p1.y + (p2.y - p1.y) * segmentProgress,
    };
}


function takeShot() {
    strokes++;
    ball.isMoving = true;
    swingState = 'shot';
    messageEl.textContent = "Woosh!";

    const terrainPenalty = currentTerrain.penalty;
    const powerComponent = (player.stats.power / 100) + 1;
    const maxDistanceForClub = selectedClub.baseDistance * powerComponent;
    
    // NEW: Wind effect on shot distance
    let shotDistance = maxDistanceForClub * (powerValue / 100) * terrainPenalty.power;
    const angleToHole = Math.atan2(hole.y - ball.y, hole.x - ball.x);
    const windEffectFactor = Math.cos(weather.windDirection - angleToHole); // +1 if wind is with, -1 if against
    shotDistance += weather.windSpeed * windEffectFactor * 2; // Wind adds/subtracts distance

    const accuracyMiss = Math.abs(50 - accuracyValue) / 50;
    const angleOffset = (accuracyMiss * 15) * (accuracyValue < 50 ? 1 : -1);
    let finalAngle = angleToHole + (angleOffset * Math.PI / 180);

    // NEW: Calculate landing point based on fairway path for curved holes
    const startPoint = { x: ball.x, y: ball.y };
    const targetPointRaw = { x: startPoint.x + Math.cos(finalAngle) * shotDistance, y: startPoint.y + Math.sin(finalAngle) * shotDistance };

    // Find closest point on fairway path to initial target for more realistic curvature
    let closestPointOnPath = getPointOnFairwayPath(0); // Start at current ball position equivalent on path
    let minPathDist = Infinity;
    const numPathSegments = currentHoleData.fairwayPath.length - 1;
    if (numPathSegments > 0) {
        for (let i = 0; i <= 100; i++) { // Sample 100 points along the path
            const p = getPointOnFairwayPath(i / 100);
            const dist = Math.sqrt(Math.pow(p.x - targetPointRaw.x, 2) + Math.pow(p.y - targetPointRaw.y, 2));
            if (dist < minPathDist) {
                minPathDist = dist;
                closestPointOnPath = p;
            }
        }
    }
    const targetX = closestPointOnPath.x;
    const targetY = closestPointOnPath.y;


    // NEW: Only apply spin if checkbox is checked
    let spinRoll = 0;
    if (useSpinCheckbox.checked) {
        const spinRaw = (controlValue - 50) / 50; // -1 (max backspin) to +1 (max topspin)
        const spinEffectiveness = 1 + (player.stats.control / 20);
        spinRoll = (shotDistance / 10) * spinRaw * spinEffectiveness * terrainPenalty.roll;
    }

    animateBall(targetX, targetY, spinRoll);
}

function animateBall(targetX, targetY, roll) {
    const startX = ball.x, startY = ball.y;
    let progress = 0;
    const totalSteps = 50;

    function flightStep() {
        progress++;
        const flightProgress = progress / totalSteps;
        
        // Use path interpolation for flight if fairwayPath exists and is curvy
        if (currentHoleData.fairwayPath.length > 2) { // More than just start/end implies curvature
            const currentPathPoint = getPointOnFairwayPath(flightProgress);
            ball.x = currentPathPoint.x;
            ball.y = currentPathPoint.y;
        } else {
            // Linear flight for straight holes
            ball.x = startX + (targetX - startX) * flightProgress;
            ball.y = startY + (targetY - startY) * flightProgress;
        }

        // Apply Wind Effect (less pronounced during initial flight)
        const windForce = weather.windSpeed / 400; // Scaled for this animation
        ball.x += Math.cos(weather.windDirection) * windForce;
        ball.y += Math.sin(weather.windDirection) * windForce;

        if (progress < totalSteps) {
            requestAnimationFrame(flightStep);
        } else {
            animateRoll(roll);
        }
    }
    flightStep();
}

// ... (animateRoll is the same as before) ...
function animateRoll(rollDistance) {
    if (Math.abs(rollDistance) < 1) { endShot(); return; }
    const angle = Math.atan2(ball.y - hole.y, ball.x - hole.x);
    const startX = ball.x, startY = ball.y;
    const targetX = ball.x - Math.cos(angle) * rollDistance;
    const targetY = ball.y - Math.sin(angle) * rollDistance;
    let progress = 0;
    function rollStep() {
        progress += 0.03;
        if (progress < 1) {
            ball.x = startX + (targetX - startX) * progress;
            ball.y = startY + (targetY - startY) * progress;
            requestAnimationFrame(rollStep);
        } else { ball.x = targetX; ball.y = targetY; endShot(); }
    }
    rollStep();
}

function endShot() {
    ball.isMoving = false;
    currentTerrain = getTerrainAtPoint(ball.x, ball.y);
    terrainEl.textContent = currentTerrain.name;

    if (currentTerrain === TERRAIN_TYPES.WATER) {
        alert("Water Hazard! One stroke penalty. Ball reset to last safe spot.");
        strokes++;
        // Reset to approximate tee position or nearest fairway if possible
        ball.x = currentHoleData.startPos.x;
        ball.y = currentHoleData.startPos.y;
        currentTerrain = TERRAIN_TYPES.TEE_BOX; // Re-evaluate in case of reset to fairway
    }
    
    checkForWin();
}

function checkForWin() {
    const distance = updateDistance();
    if (distance <= 6 && currentTerrain === TERRAIN_TYPES.GREEN) {
        player.scorecard[currentHoleIndex] = strokes;
        const score = strokes - COURSE_DATA[currentHoleIndex].par;
        let scoreText = score === 0 ? "Par" : (score > 0 ? `+${score}` : `${score}`);
        if(strokes === 1) scoreText = "HOLE IN ONE!!!";
        messageEl.textContent = `In the hole! Score: ${scoreText}`;

        let xpGained = 50 - (score * 10);
        if (xpGained < 10) xpGained = 10;
        player.xp += xpGained;

        if (player.xp >= player.xpToNextLevel) {
            player.level++;
            player.xp -= player.xpToNextLevel;
            player.xpToNextLevel = Math.round(player.xpToNextLevel * 1.5);
            player.skillPoints++;
            alert(`LEVEL UP! You are now level ${player.level}! You have ${player.skillPoints} Skill Point(s) to spend.`);
        }
        updateUI();
        
        currentHoleIndex++;
        if (currentHoleIndex >= COURSE_DATA.length) {
            let totalScore = player.scorecard.reduce((a, b) => a + b, 0);
            alert(`Round Complete! Your total score is: ${totalScore}`);
            currentHoleIndex = 0; // Restart course
            player.scorecard = [];
        }

        setTimeout(() => {
            loadHole(currentHoleIndex);
        }, 2500);
    } else {
        resetSwing();
    }
}

function loadHole(holeIndex) {
    currentHoleData = COURSE_DATA[holeIndex]; // Store full hole data
    currentHoleIndex = holeIndex;
    
    holeNumberEl.textContent = currentHoleData.id;
    holeParEl.textContent = currentHoleData.par;
    
    ball.x = currentHoleData.startPos.x;
    ball.y = currentHoleData.startPos.y;
    hole.x = currentHoleData.holePos.x;
    hole.y = currentHoleData.holePos.y;
    
    courseLayout = currentHoleData.layout;
    strokes = 0;
    currentTerrain = getTerrainAtPoint(ball.x, ball.y);
    
    updateWeather();
    resetSwing();
    updateUI();
}

function updateWeather() {
    const rand = Math.random();
    if (rand < 0.5) { // 50% chance of calm/light wind
        weather.windSpeed = parseFloat((Math.random() * 8).toFixed(1)); // 0-8 mph
        weather.windDirection = Math.random() * 2 * Math.PI;
        weather.type = 'Calm';
    } else if (rand < 0.8) { // 30% chance of stronger wind
        weather.windSpeed = parseFloat((Math.random() * 12 + 8).toFixed(1)); // 8-20 mph
        weather.windDirection = Math.random() * 2 * Math.PI;
        weather.type = 'Windy';
    } else if (rand < 0.9) { // 10% chance of rain
        weather.windSpeed = parseFloat((Math.random() * 5).toFixed(1)); // Light wind
        weather.windDirection = Math.random() * 2 * Math.PI;
        weather.type = 'Rain';
    } else { // 10% chance of snow
        weather.windSpeed = parseFloat((Math.random() * 5).toFixed(1)); // Light wind
        weather.windDirection = Math.random() * 2 * Math.PI;
        weather.type = 'Snow';
    }
    weatherEl.textContent = `${weather.type} (${weather.windSpeed} mph)`;
}

// ... (populateClubs, updateUI, renderSkillTree, skill tree event listeners remain the same) ...
function populateClubs() {
    clubSelect.innerHTML = '';
    for (const key in CLUBS) {
        const club = CLUBS[key];
        const option = document.createElement('option');
        option.value = key;
        option.textContent = club.name;
        clubSelect.appendChild(option);
    }
}

function updateUI() {
    document.getElementById('player-level').textContent = player.level;
    document.getElementById('player-xp').textContent = player.xp;
    document.getElementById('xp-to-next-level').textContent = player.xpToNextLevel;
    document.getElementById('player-sp').textContent = player.skillPoints;
    document.getElementById('stat-power').textContent = player.stats.power;
    document.getElementById('stat-accuracy').textContent = player.stats.accuracy;
    document.getElementById('stat-control').textContent = player.stats.control;
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
function updateDistance() {
    const pixelDistance = Math.sqrt(Math.pow(ball.x - hole.x, 2) + Math.pow(ball.y - hole.y, 2));
    const yards = Math.round(pixelDistance);
    distanceEl.textContent = `${yards} yards`;
    return yards;
}

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
            skill.apply(player);
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

// --- Main Game Loop (MODIFIED) ---
function gameLoop() {
    const terrainPenalty = currentTerrain.penalty;
    // Hide/show control bar based on checkbox
    document.getElementById('control-bar-container').style.display = useSpinCheckbox.checked ? 'block' : 'none';

    if (swingState === 'power') {
        powerValue += 2 * powerDirection;
        if (powerValue >= 100 || powerValue <= 0) powerDirection *= -1;
        powerBar.style.width = `${powerValue}%`;
    } else if (swingState === 'accuracy') {
        const accuracySpeed = (5 - (player.stats.accuracy / 4)) * terrainPenalty.accuracy;
        accuracyValue += accuracySpeed * accuracyDirection;
        if (accuracyValue >= 100 || accuracyValue <= 0) accuracyDirection *= -1;
        accuracyMarker.style.left = `${accuracyValue}%`;
    } else if (swingState === 'control' && useSpinCheckbox.checked) { // Only animate if spin is enabled
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
    const isPutting = selectedClub.name.includes("Putter");

    if (swingState === 'idle') {
        swingState = 'power';
        messageEl.textContent = 'Click to set POWER!';
    } else if (swingState === 'power') {
        swingState = 'accuracy';
        messageEl.textContent = 'Click to set ACCURACY!';
    } else if (swingState === 'accuracy') {
        if (isPutting || !useSpinCheckbox.checked) { // Skip control if putting OR spin is disabled
            takeShot();
        } else {
            swingState = 'control';
            messageEl.textContent = 'Click to set SPIN!';
        }
    } else if (swingState === 'control') {
        takeShot();
    }
});


// --- Initialization ---
populateClubs();
loadHole(0); // Load the first hole
gameLoop();
