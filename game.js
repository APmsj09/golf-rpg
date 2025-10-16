const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Physics Constants ---
const GRAVITY = -9.8; // A scaled gravity value
const TIME_STEP = 1 / 30; // 30 physics updates per second

// --- RPG & Player Data ---
const SKILL_TREE = {
    power1: { id: "power1", name: "Power Hitter I", desc: "+2 to Power", cost: 1, requirement: null, purchased: false, apply: (p) => p.stats.power += 2 },
    power2: { id: "power2", name: "Power Hitter II", desc: "+3 to Power", cost: 2, requirement: "power1", purchased: false, apply: (p) => p.stats.power += 3 },
    accuracy1: { id: "accuracy1", name: "Steady Hand I", desc: "+2 to Accuracy", cost: 1, requirement: null, purchased: false, apply: (p) => p.stats.accuracy += 2 },
    control1: { id: "control1", name: "Spin Doctor I", desc: "+2 to Control", cost: 1, requirement: null, purchased: false, apply: (p) => p.stats.control += 2 },
};

let player = {
    level: 1, xp: 0, xpToNextLevel: 100,
    stats: { power: 10, accuracy: 10, control: 10 },
    skillPoints: 0, scorecard: [],
};

// --- Game State Variables ---
let ball = {
    x: 400, y: 550, z: 0, // 2D position + height
    vx: 0, vy: 0, vz: 0, // Velocities
    isMoving: false, radius: 5,
};

let hole = { x: 400, y: 50 };
let currentHoleIndex = 0;
let currentHoleData;
let courseLayout = [];
let strokes = 0;
let currentTerrain = TERRAIN_TYPES.TEE_BOX;
let weather = { windSpeed: 0, windDirection: 0, type: 'Calm' };

let swingState = 'idle', powerValue = 0, accuracyValue = 0, controlValue = 0;
let powerDirection = 1, accuracyDirection = 1, controlDirection = 1;
let selectedClub = CLUBS['1W'];

// --- UI Element References ---
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
const useSpinCheckbox = document.getElementById('use-spin-checkbox');
const skillTreeModal = document.getElementById('skill-tree-modal');
const skillsContainer = document.getElementById('skills-container');

// --- Core Logic: Shot & Physics ---

function takeShot() {
    strokes++;
    swingState = 'shot';
    messageEl.textContent = "Woosh!";

    const terrainPerformance = selectedClub.performance[currentTerrain.name] || 0;
    if (terrainPerformance === 0) {
        messageEl.textContent = "Inappropriate club for this lie!";
        setTimeout(resetSwing, 1000);
        return;
    }

    const powerComponent = 1 + (player.stats.power / 100);
    const totalPower = selectedClub.baseDist * powerComponent * (powerValue / 100) * terrainPerformance;

    const accuracyMiss = Math.abs(50 - accuracyValue) / 50;
    const accuracyPenalty = 1 - (player.stats.accuracy / 150);
    const angleOffset = (accuracyMiss * 15 * accuracyPenalty) * (accuracyValue < 50 ? 1 : -1);
    const angleToHole = Math.atan2(hole.y - ball.y, hole.x - ball.x);
    const finalAngle = angleToHole + (angleOffset * Math.PI / 180);

    const loftRadians = selectedClub.loft * Math.PI / 180;
    ball.vz = totalPower * Math.sin(loftRadians) * 0.2;
    const horizontalPower = totalPower * Math.cos(loftRadians) * 0.2;
    ball.vx = Math.cos(finalAngle) * horizontalPower;
    ball.vy = Math.sin(finalAngle) * horizontalPower;

    if (useSpinCheckbox.checked) {
        const spinRaw = (controlValue - 50) / 50;
        const spinEffectiveness = 1 + (player.stats.control / 20);
        const spinPower = spinRaw * spinEffectiveness * 5;
        ball.vx += Math.cos(finalAngle) * spinPower;
        ball.vy += Math.sin(finalAngle) * spinPower;
    }

    ball.isMoving = true;
    physicsLoop();
}

function physicsLoop() {
    if (!ball.isMoving) return;

    ball.vz += GRAVITY * TIME_STEP;
    const windForce = weather.windSpeed / 500;
    ball.vx += Math.cos(weather.windDirection) * windForce;
    ball.vy += Math.sin(weather.windDirection) * windForce;

    ball.x += ball.vx * TIME_STEP * 5;
    ball.y += ball.vy * TIME_STEP * 5;
    ball.z += ball.vz * TIME_STEP * 5;

    if (ball.z <= 0) {
        ball.z = 0;
        currentTerrain = getTerrainAtPoint(ball.x, ball.y);
        ball.vz *= -currentTerrain.bounce;
        ball.vx *= currentTerrain.friction;
        ball.vy *= currentTerrain.friction;
        if (Math.abs(ball.vz) < 1) {
            ball.vz = 0;
        }
    }

    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed < 0.1 && ball.z === 0) {
        ball.isMoving = false;
        ball.vx = 0;
        ball.vy = 0;
        endShot();
    } else {
        requestAnimationFrame(physicsLoop);
    }
}

function endShot() {
    currentTerrain = getTerrainAtPoint(ball.x, ball.y);
    terrainEl.textContent = currentTerrain.name;

    if (currentTerrain === TERRAIN_TYPES.WATER) {
        alert("Water Hazard! One stroke penalty.");
        strokes++;
        ball.x = currentHoleData.startPos.x;
        ball.y = currentHoleData.startPos.y;
        currentTerrain = TERRAIN_TYPES.TEE_BOX;
    }

    checkForWin();
}

// --- Game State & UI Management ---

function checkForWin() {
    const distance = updateDistance();
    if (distance <= 6 && currentTerrain === TERRAIN_TYPES.GREEN) {
        player.scorecard[currentHoleIndex] = strokes;
        const score = strokes - currentHoleData.par;
        let scoreText = score === 0 ? "Par" : (score > 0 ? `+${score}` : `${score}`);
        if (strokes === 1) scoreText = "HOLE IN ONE!!!";
        messageEl.textContent = `In the hole! Score: ${scoreText}`;

        let xpGained = Math.max(10, 50 - (score * 10));
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
            currentHoleIndex = 0;
            player.scorecard = [];
        }
        setTimeout(() => loadHole(currentHoleIndex), 2500);
    } else {
        resetSwing();
    }
}

function loadHole(holeIndex) {
    currentHoleData = COURSE_DATA[holeIndex];
    currentHoleIndex = holeIndex;
    holeNumberEl.textContent = currentHoleData.id;
    holeParEl.textContent = currentHoleData.par;
    ball.x = currentHoleData.startPos.x;
    ball.y = currentHoleData.startPos.y;
    ball.z = 0;
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
        weather.windSpeed = parseFloat((Math.random() * 8).toFixed(1));
        weather.type = 'Calm';
    } else if (rand < 0.8) { // 30% chance of stronger wind
        weather.windSpeed = parseFloat((Math.random() * 12 + 8).toFixed(1));
        weather.type = 'Windy';
    } else if (rand < 0.9) { // 10% chance of rain
        weather.windSpeed = parseFloat((Math.random() * 5).toFixed(1));
        weather.type = 'Rain';
    } else { // 10% chance of snow
        weather.windSpeed = parseFloat((Math.random() * 5).toFixed(1));
        weather.type = 'Snow';
    }
    weather.windDirection = Math.random() * 2 * Math.PI;
    weatherEl.textContent = `${weather.type} (${weather.windSpeed} mph)`;
}

// --- Main Loop & Input ---

function gameLoop() {
    document.getElementById('control-bar-container').style.display = useSpinCheckbox.checked ? 'block' : 'none';

    if (swingState === 'power') {
        powerValue += 2 * powerDirection;
        if (powerValue >= 100 || powerValue <= 0) powerDirection *= -1;
        powerBar.style.width = `${powerValue}%`;
    } else if (swingState === 'accuracy') {
        const accuracySpeed = 5 - (player.stats.accuracy / 4);
        accuracyValue += accuracySpeed * accuracyDirection;
        if (accuracyValue >= 100 || accuracyValue <= 0) accuracyDirection *= -1;
        accuracyMarker.style.left = `${accuracyValue}%`;
    } else if (swingState === 'control' && useSpinCheckbox.checked) {
        const controlSpeed = 5 - (player.stats.control / 4);
        controlValue += controlSpeed * controlDirection;
        if (controlValue >= 100 || controlValue <= 0) controlDirection *= -1;
        controlMarker.style.left = `${controlValue}%`;
    }

    drawCourse();
    requestAnimationFrame(gameLoop);
}

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
        if (isPutting || !useSpinCheckbox.checked) {
            takeShot();
        } else {
            swingState = 'control';
            messageEl.textContent = 'Click to set SPIN!';
        }
    } else if (swingState === 'control') {
        takeShot();
    }
});

clubSelect.addEventListener('change', (e) => selectedClub = CLUBS[e.target.value]);

// --- Helper Functions (Drawing, UI, etc.) ---

function drawCourse() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = courseLayout.length - 1; i >= 0; i--) {
        const part = courseLayout[i];
        if (part.rect) drawRectWithTexture(...part.rect, part.type);
        else if (part.ellipse) drawEllipseWithTexture(...part.ellipse, part.type);
        else if (part.path) drawPathWithTexture(part.path, part.type);
    }
    ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(hole.x, hole.y, 6, 0, Math.PI * 2); ctx.fill();
    if (ball.z > 0) {
        const shadowRadius = ball.radius * (1 - ball.z / 100);
        const shadowOpacity = 0.5 * (1 - ball.z / 100);
        if (shadowRadius > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${shadowOpacity})`;
            ctx.beginPath();
            ctx.arc(ball.x + ball.z / 5, ball.y + ball.z / 5, shadowRadius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    const drawRadius = ball.radius + ball.z / 25;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, drawRadius, 0, Math.PI * 2);
    ctx.fill();
    drawWeatherOverlay();
}

function drawRectWithTexture(x, y, w, h, terrainType) {
    const colors = terrainType.colors;
    ctx.fillStyle = colors[0];
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = colors[1];
    if (terrainType.texture === 'dots') {
        for (let i = 0; i < w; i += 8) for (let j = 0; j < h; j += 8) {
            ctx.beginPath();
            ctx.arc(x + i + Math.random() * 4, y + j + Math.random() * 4, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (terrainType.texture === 'hatch') {
        ctx.strokeStyle = colors[1];
        for (let i = 0; i < w + h; i += 10) {
            ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x, y + i); ctx.stroke();
        }
    } else if (terrainType.texture === 'waves') {
        ctx.strokeStyle = colors[1];
        ctx.lineWidth = 1;
        for (let i = 0; i < h; i += 7) {
            ctx.beginPath(); ctx.moveTo(x, y + i);
            ctx.bezierCurveTo(x + w * 0.25, y + i + 5, x + w * 0.75, y + i - 5, x + w, y + i);
            ctx.stroke();
        }
    }
}

function drawEllipseWithTexture(cx, cy, rx, ry, terrainType) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    ctx.clip();
    drawRectWithTexture(cx - rx, cy - ry, rx * 2, ry * 2, terrainType);
    ctx.restore();
}

function drawPathWithTexture(path, terrainType) {
    if (path.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.closePath();
    ctx.fillStyle = terrainType.colors[0];
    ctx.fill();
}

function drawWeatherOverlay() {
    if (weather.windSpeed > 0) {
        ctx.save();
        ctx.translate(50, 50);
        ctx.rotate(weather.windDirection);
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.font = "20px Arial";
        ctx.fillText(`💨 ${weather.windSpeed.toFixed(1)} mph`, 10, 5);
        ctx.strokeStyle = "white"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-20, 0);
        ctx.moveTo(0, 0); ctx.lineTo(-10, -5);
        ctx.moveTo(0, 0); ctx.lineTo(-10, 5);
        ctx.stroke();
        ctx.restore();
    }
    if (weather.type === 'Rain') {
        ctx.strokeStyle = 'rgba(173, 216, 230, 0.7)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * canvas.width; const y = Math.random() * canvas.height;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 5, y + 15); ctx.stroke();
        }
    } else if (weather.type === 'Snow') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let i = 0; i < 30; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function populateClubs() {
    clubSelect.innerHTML = '';
    for (const key in CLUBS) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = CLUBS[key].name;
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

function getTerrainAtPoint(x, y) {
    for (const layoutPart of courseLayout) {
        if (layoutPart.rect) {
            const [rx, ry, rw, rh] = layoutPart.rect;
            if (x > rx && x < rx + rw && y > ry && y < ry + rh) return layoutPart.type;
        } else if (layoutPart.ellipse) {
            const [ex, ey, erx, ery] = layoutPart.ellipse;
            if ((Math.pow(x - ex, 2) / Math.pow(erx, 2)) + (Math.pow(y - ey, 2) / Math.pow(ery, 2)) <= 1) return layoutPart.type;
        }
    }
    return TERRAIN_TYPES.ROUGH;
}

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

// --- Initialization ---
populateClubs();
loadHole(0);
gameLoop();
