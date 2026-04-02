// Configure the EarthQuake!
const wiggleData = {
    action: 'triggerEarthquake',
    wiggleAmount: 80, // increase for more shake
    wiggleDuration: 800, // increase for longer duration
};

// Toggle for DM screen shake
const dmShake = true; // Set to false to disable DM screen shake

// Define the sound to play during the quake
const soundToPlay = ''; // Your sound file

function playSound() {
    const sound = new Audio(soundToPlay);
    sound.volume = 0.5; // Adjust the volume as needed
    sound.play();
}

// Broadcast Earthquake to Players and play sound
game.socket.emit('module.earthquake', wiggleData);
playSound();

// Screen wiggle logic for the GM's screen (if enabled)
if (dmShake) {
    const originalPosition = canvas.stage.pivot.clone();
    const startTime = Date.now();

    function animateGMWiggle() {
        const currentTime = Date.now();
        const elapsedTime = currentTime - startTime;
        if (elapsedTime >= wiggleData.wiggleDuration) {
            canvas.animatePan({ x: originalPosition.x, y: originalPosition.y });
            return;
        }
        const xOffset = (Math.random() * wiggleData.wiggleAmount - wiggleData.wiggleAmount / 2) | 0;
        const yOffset = (Math.random() * wiggleData.wiggleAmount - wiggleData.wiggleAmount / 2) | 0;
        canvas.animatePan({ x: originalPosition.x + xOffset, y: originalPosition.y + yOffset });
        requestAnimationFrame(animateGMWiggle);
    }

    animateGMWiggle();
}