// Get canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- RPG Player Stats ---
const player = {
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    stats: {
        power: 10,     // Affects max distance
        accuracy: 10,  // Affects accuracy meter speed/size
        control: 10,   // Future use: spin, chipping
    },
    skillPoints: 0, // Not implemented yet, but for future use
};

// --- Game State Variables ---
let ball = { x: 400, y: 550, isMoving: false };
const hole = { x: 400, y: 50 };
let strokes = 0;

// Shot mechanics state
let swingState = 'idle'; // 'power', 'accuracy', 'shot'
let powerValue = 0;
let accuracyValue = 0;
let powerDirection = 1;
let accuracyDirection = 1;

// UI Elements
const messageEl = document.getElementById('game-message');
const distanceEl = document.getElementById('distance-to-hole');
const strokesEl = document.getElementById('hole-strokes');
const powerBar = document.getElementById('power-bar');
const accuracyMarker = document.getElementById('accuracy-marker');


// --- Drawing Functions ---
function drawCourse() {
    // Clear canvas
    ctx.fillStyle = '#2a8e43'; // Fairway Green
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Tee Box
    ctx.fillStyle = '#52b788';
    ctx.fillRect(350, 530, 100, 40);

    // Green
    ctx.fillStyle = '#1b612d'; // Darker green for the putting green
    ctx.beginPath();
    ctx.ellipse(hole.x, hole.y + 20, 80, 40, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Hole
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, 6, 0, 2 * Math.PI);
    ctx.fill();

    // Ball
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 5, 0, 2 * Math.PI);
    ctx.fill();
}


// --- Game Logic ---
function updateDistance() {
    // A simple pixel-to-yard conversion
    const pixelDistance = Math.sqrt(Math.pow(ball.x - hole.x, 2) + Math.pow(ball.y - hole.y, 2));
    const yards = Math.round(pixelDistance); // 1 pixel = 1 yard in this simple model
    distanceEl.textContent = `${yards} yards`;
    return yards;
}

function takeShot() {
    strokes++;
    strokesEl.textContent = strokes;
    ball.isMoving = true;
    swingState = 'shot';
    messageEl.textContent = "Woosh!";

    // --- Core RPG Integration ---
    // Max distance is determined by POWER stat.
    const maxDistance = 150 + (player.stats.power * 10);
    const shotDistance = maxDistance * (powerValue / 100);

    // Accuracy affects the outcome. Perfect is 0, miss is higher.
    const accuracyMiss = Math.abs(50 - accuracyValue) / 50; // 0 to 1
    const angleOffset = (accuracyMiss * 15) * (accuracyValue < 50 ? 1 : -1); // Deviate up to 15 degrees

    // Calculate angle to hole
    const angleToHole = Math.atan2(hole.y - ball.y, hole.x - ball.x);
    const finalAngle = angleToHole + (angleOffset * Math.PI / 180);

    const targetX = ball.x + Math.cos(finalAngle) * shotDistance;
    const targetY = ball.y + Math.sin(finalAngle) * shotDistance;

    // Animate the ball
    animateBall(targetX, targetY);
}

function animateBall(targetX, targetY) {
    const startX = ball.x;
    const startY = ball.y;
    let progress = 0;

    function step() {
        progress += 0.02; // Speed of animation
        if (progress < 1) {
            ball.x = startX + (targetX - startX) * progress;
            ball.y = startY + (targetY - startY) * progress;
            requestAnimationFrame(step);
        } else {
            ball.x = targetX;
            ball.y = targetY;
            ball.isMoving = false;
            checkForWin();
        }
    }
    requestAnimationFrame(step);
}

function checkForWin() {
    const distance = updateDistance();
    if (distance <= 6) { // Close enough to be "in the hole"
        const score = strokes - 4; // Par 4 hole
        let scoreText = score === 0 ? "Par" : (score > 0 ? `+${score}` : `${score}`);
        if(strokes === 1) scoreText = "HOLE IN ONE!!!";
        
        messageEl.textContent = `In the hole! Score: ${scoreText}`;
        
        // --- Grant XP ---
        let xpGained = 50 - (score * 10); // More XP for better scores
        if (xpGained < 10) xpGained = 10;
        player.xp += xpGained;
        
        // Reset for next hole (simplified)
        setTimeout(() => {
            alert(`You earned ${xpGained} XP! Ready for the next hole.`);
            resetHole();
        }, 2000);
    } else {
        resetSwing();
    }
}

function resetHole() {
    // In a full game, you'd load the next hole's data here.
    ball.x = 400;
    ball.y = 550;
    strokes = 0;
    strokesEl.textContent = 0;
    updateUI();
    resetSwing();
}

function resetSwing() {
    swingState = 'idle';
    powerValue = 0;
    accuracyValue = 0;
    powerBar.style.width = '0%';
    accuracyMarker.style.left = '0%';
    updateDistance();
    if(!ball.isMoving) {
       messageEl.textContent = 'Click to start your swing!';
    }
}

// --- Main Game Loop ---
function gameLoop() {
    // Handle the power/accuracy meters
    if (swingState === 'power') {
        powerValue += 2 * powerDirection;
        if (powerValue >= 100 || powerValue <= 0) powerDirection *= -1;
        powerBar.style.width = `${powerValue}%`;
    } else if (swingState === 'accuracy') {
        // --- RPG Integration ---
        // ACCURACY stat affects meter speed. Higher stat = slower meter.
        const accuracySpeed = 5 - (player.stats.accuracy / 4);
        accuracyValue += accuracySpeed * accuracyDirection;
        if (accuracyValue >= 100 || accuracyValue <= 0) accuracyDirection *= -1;
        accuracyMarker.style.left = `${accuracyValue}%`;
    }

    // Draw everything
    drawCourse();

    // Loop
    requestAnimationFrame(gameLoop);
}

// --- Player Input ---
canvas.addEventListener('click', () => {
    if (ball.isMoving) return;

    if (swingState === 'idle') {
        swingState = 'power';
        messageEl.textContent = 'Click to set POWER!';
    } else if (swingState === 'power') {
        swingState = 'accuracy';
        messageEl.textContent = 'Click to set ACCURACY!';
    } else if (swingState === 'accuracy') {
        takeShot();
    }
});

// Update UI from player object
function updateUI() {
    document.getElementById('player-level').textContent = player.level;
    document.getElementById('player-xp').textContent = player.xp;
    document.getElementById('xp-to-next-level').textContent = player.xpToNextLevel;
    document.getElementById('stat-power').textContent = player.stats.power;
    document.getElementById('stat-accuracy').textContent = player.stats.accuracy;
    document.getElementById('stat-control').textContent = player.stats.control;
}

// --- Initialization ---
updateUI();
updateDistance();
gameLoop();
