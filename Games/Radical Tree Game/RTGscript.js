let TP = 0;
document.getElementById("TPDisplay").textContent = TP;

let intervalID;
let gainMultiplier = 1;
let gameInterval = 1000; // Default game interval is 1000ms (1 second)

// Colors for buttons
const purchasedColor = "rgb(20, 20, 20)"; // Darkest color when purchased
const availableColor = "rgb(57, 68, 71)"; // Middle color when affordable
const unavailableColor = "rgb(30, 40, 42)"; // Lightest color when not affordable
const notPurchasedColor = "rgb(114, 112, 112)"; // Light gray color for not purchased buttons

// Update the button appearance based on affordability
function updateButtonState(buttonID, cost, previousButtonPurchased) {
    const button = document.getElementById(buttonID);

    if (!previousButtonPurchased) {
        button.style.backgroundColor = notPurchasedColor; // Light gray when previous button is not purchased
    } else if (TP >= cost && !button.disabled) {
        button.style.backgroundColor = availableColor; // Can be purchased
    } else if (button.disabled) {
        button.style.backgroundColor = purchasedColor; // Already purchased
    } else {
        button.style.backgroundColor = unavailableColor; // Cannot be purchased
    }
}

// Button 5 logic (cost 0 TP)
const button1 = document.getElementById("TPButton5");
const button1Text = document.getElementById("TPID1");

button1.onclick = function() {
    if (TP >= 0 && !button1.disabled) {
        button1.style.backgroundColor = purchasedColor;
        button1Text.textContent = "Purchased";
        button1.disabled = true;
        button1.style.cursor = "default"; // Reset cursor
        gainMultiplier = 1;

        intervalID = setInterval(() => {
            TP += 1 * gainMultiplier;
            document.getElementById("TPDisplay").textContent = TP;
            updateButtonState("TPButton14", 15, true); // Update Button 14 appearance (Button 5 purchased)
            updateTitle()
        }, gameInterval);
    }
};

// Button 14 logic (cost 15 TP)
const button2 = document.getElementById("TPButton14");
const button2Text = document.getElementById("TPID2");

button2.onclick = function() {
    if (TP >= 15 && !button2.disabled) {
        TP -= 15;
        document.getElementById("TPDisplay").textContent = TP;
        button2.style.backgroundColor = purchasedColor;
        button2Text.textContent = "Purchased";
        button2.disabled = true; // Disable the button after purchase
        button2.style.cursor = "default"; // Reset cursor
        gainMultiplier *= 2; // Action after purchase (double the gain multiplier)

        // Enable Button 6, Button 7, and Button 15 after Button 14 is purchased
        const button6 = document.getElementById("TPButton6");
        button6.disabled = false;
        button6.style.cursor = "pointer"; // Enable cursor for Button 6
        updateButtonState("TPButton6", 50, true); // Update Button 6 appearance after Button 14 is purc
    }
};

// Button 6 logic (cost 50 TP) - This button is only enabled after Button 14 is purchased
const button6 = document.getElementById("TPButton6");
const button6Text = document.getElementById("TPID6");

button6.onclick = function() {
    if (TP >= 50 && !button6.disabled) {
        TP -= 50;
        document.getElementById("TPDisplay").textContent = TP;

        // Mark the button as purchased
        button6.style.backgroundColor = purchasedColor;
        button6Text.textContent = "Purchased";
        button6.disabled = true; // Disable the button after purchase
        button6.style.cursor = "default"; // Reset cursor

        // Action for Button 6: Adds +2 gain per second, considering the multiplier
        const additionalGain = 2 * gainMultiplier; // Multiply by the current multiplier
        console.log("Button 6 purchased: Gain per second increased by " + additionalGain);

        // Add +2 gain per second, accounting for multiplier
        setInterval(() => {
            TP += additionalGain;
            document.getElementById("TPDisplay").textContent = TP;
        }, 1000);

        const button7 = document.getElementById("TPButton7");
        button7.disabled = false;
        button7.style.cursor = "pointer"; // Enable cursor for Button 7
        updateButtonState("TPButton7", 100, true); // Update Button 7 appearance after Button 14 is purchased
    }
};

// Button 15 logic (cost 200 TP) - Adds +1 TP gain per second
const button15 = document.getElementById("TPButton15");
const button15Text = document.getElementById("TPID15");

button15.onclick = function() {
    if (TP >= 200 && !button15.disabled) {  // Check if enough TP is available
        TP -= 200;
        document.getElementById("TPDisplay").textContent = TP;

        // Mark the button as purchased
        button15.style.backgroundColor = purchasedColor;
        button15Text.textContent = "Purchased";
        button15.disabled = true;  // Disable the button after purchase
        button15.style.cursor = "default";  // Reset cursor

        // Action for Button 15: Add +1 TP gain per second
        console.log("Button 15 purchased: Gain increased by +1 TP per second");

        // Add +1 TP gain per second
        setInterval(() => {
            TP += 1;
            document.getElementById("TPDisplay").textContent = TP;
        }, 1000);

        const button16 = document.getElementById("TPButton16");
        button16.disabled = false;
        button16.style.cursor = "pointer"; // Enable cursor for Button 16
        updateButtonState("TPButton16", 200, true); // Update Button 16 appearance after Button 14 is purchased
    }
};

// Button 7 logic (cost 100 TP) - Exponentially boost TP by ^1.1 (every second)
const button7 = document.getElementById("TPButton7");
const button7Text = document.getElementById("TPID7");

button7.onclick = function() {
    if (TP >= 100 && !button7.disabled) {
        TP -= 100;
        document.getElementById("TPDisplay").textContent = TP;

        // Mark the button as purchased
        button7.style.backgroundColor = purchasedColor;
        button7Text.textContent = "Purchased";
        button7.disabled = true;  // Disable the button after purchase
        button7.style.cursor = "default";  // Reset cursor

        // Action for Button 7: Exponentially boost TP by ^1.1
        console.log("Button 7 purchased: Exponentially boosting TP by ^1.1");

        // Exponentially increase the gain every second
        setInterval(() => {
            TP += Math.pow(1.1, gainMultiplier); // Exponentially increase TP by ^1.1
            document.getElementById("TPDisplay").textContent = TP;
        }, 1000);

        const button15 = document.getElementById("TPButton15");
        button15.disabled = false;
        button15.style.cursor = "pointer"; // Enable cursor for Button 15
        updateButtonState("TPButton15", 200, true); // Update Button 15 appearance after Button 14 is purchased
    }
};

const button16 = document.getElementById("TPButton16");
const button16Text = document.getElementById("TPID16");

button16.onclick = function() {
    if (TP >= 200 && !button16.disabled) {  // Check if enough TP is available
        TP -= 200;
        document.getElementById("TPDisplay").textContent = TP;

        // Mark the button as purchased
        button16.style.backgroundColor = "rgb(20, 20, 20)";  // Dark color when purchased
        button16Text.textContent = "Purchased";
        button16.disabled = true;  // Disable the button after purchase
        button16.style.cursor = "default";  // Reset cursor

        // Action for Button 16: Speed up the game clock to 0.5 seconds
        console.log("Button 16 purchased: Game clock speed increased to 0.5 seconds");

        // Speed up the game clock by changing the interval time
        gameInterval = 500;  // Set the interval to 500ms (0.5 seconds)
        clearInterval(intervalID);  // Clear the previous interval
        intervalID = setInterval(() => {
            TP += 1 * gainMultiplier;
            document.getElementById("TPDisplay").textContent = TP;
        }, gameInterval);
    }
};
// Function to update the page title with the current TP
function updateTitle() {
    document.title = `Current TP: ${TP}`; // Updates the page title with the current TP
}

// Make sure both buttons' initial states are correct
window.onload = function() {
    updateButtonState("TPButton5", 0, true);  // Button 5 cost 0 (always available)
    updateButtonState("TPButton14", 15, false);  // Button 14 cost 15 (only available after Button 5)
    updateButtonState("TPButton15", 200, false);  // Button 15 cost 200 (disabled until Button 14 is purchased)
    updateButtonState("TPButton6", 50, false);  // Button 6 cost 50 (disabled until Button 14 is purchased)
    updateButtonState("TPButton7", 100, false);  // Button 7 cost 100 (disabled until Button 14 is purchased)
    updateButtonState("TPButton16", 200, false);  // Button 16 cost 200 (disabled until Button 14 is purchased)
};
