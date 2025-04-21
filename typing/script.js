function formatText(text, repeat = 1) {
    // Repeat the text the specified number of times
    const repeatedText = Array(repeat).fill(text).join(' ');
    
    // Split by newlines and process each line separately
    return repeatedText.split('\n').map((line, index, array) => {
        // Trim any leading/trailing spaces from each line
        const trimmedLine = line.trim();
        const formattedLine = trimmedLine.split('').map(char => {
            if (char === ' ') {
                return '<span class="space"> </span>';
            }
            return `<span class="char">${char}</span>`;
        }).join('');
        
        // Add enter key symbol at the end of each line except the last one
        if (index < array.length - 1) {
            return formattedLine + '<span class="enter-key">↵</span>';
        }
        return formattedLine;
    }).join('<br>');
}

// Load practice data from JSON file
let practiceData = {};

// DOM elements
let nameInput, addNameBtn, nameSelect, targetText, userInput, wpmDisplay, accuracyDisplay,
    timeDisplay, endTimerBtn, viewSessionsBtn, keys, maxTimeInput, currentSectionTitle, 
    clearDataBtn, globalWpmDisplay, globalAccuracyDisplay, globalTimeDisplay, 
    currentCorrectCharsDisplay, currentTotalCharsDisplay, sessionsModal, closeModalBtn, 
    sessionData, subsectionSelect, nextSubsectionBtn;

// Variables
let currentPractice = '';
let currentSubsection = '';
let startTime;
let timer;
let timeElapsed = 0;
let correctChars = 0;
let totalChars = 0;
let currentUser = '';
let cursorPosition = 0;
let maxTimeLimit = 60; // Set default to 1 minute
let isPracticeComplete = false;
let finalWPM = 0;
let finalAccuracy = 100;
let finalTime = 0;
let globalStats = {
    totalCorrectChars: 0,
    totalChars: 0,
    totalTime: 0,
    totalSessions: 0
};

// Array to store session data
let sessionHistory = [];

 // Function to reset current session stats
 function resetCurrentSessionStats() {
    wpmDisplay.textContent = '0';
    accuracyDisplay.textContent = '100.00%';
    timeDisplay.textContent = '0s';
    currentCorrectCharsDisplay.textContent = '0';
    currentTotalCharsDisplay.textContent = '0';
}

// Function declarations
function loadUserStats() {
    if (!currentUser) return;

    const userStats = JSON.parse(localStorage.getItem(`typingStats_${currentUser}`) || '{"completedSections": [], "stats": [], "lastSession": null}');
    
    // Update completed sections checkmarks
    document.querySelectorAll('.subsection-btn i').forEach(icon => {
        const section = icon.parentElement.getAttribute('data-section');
        const subsection = icon.parentElement.getAttribute('data-subsection');
        const sectionKey = `${section}_${subsection}`;
        icon.classList.toggle('hidden', !userStats.completedSections.includes(sectionKey));
    });

    // Update global stats
    if (userStats.stats.length > 0) {
        const totalWPM = userStats.stats.reduce((sum, session) => sum + session.wpm, 0);
        const totalAccuracy = userStats.stats.reduce((sum, session) => sum + session.accuracy, 0);
        const totalTime = userStats.stats.reduce((sum, session) => sum + session.time, 0);

        const avgWPM = Math.round(totalWPM / userStats.stats.length);
        globalWpmDisplay.textContent = avgWPM;
        globalAccuracyDisplay.textContent = Number((totalAccuracy / userStats.stats.length).toFixed(2)) + '%';
        globalTimeDisplay.textContent = totalTime + 's';
        document.getElementById('session-count').textContent = userStats.stats.length;

        // Update level based on global WPM
        updateLevel(avgWPM);
    } else {
        globalWpmDisplay.textContent = '0';
        globalAccuracyDisplay.textContent = '100.00%';
        globalTimeDisplay.textContent = '0s';
        document.getElementById('session-count').textContent = '0';
        updateLevel(0); // Reset to beginner if no stats
    }

    // Load last session data if exists
    if (userStats.lastSession) {
        wpmDisplay.textContent = userStats.lastSession.wpm || '0';
        accuracyDisplay.textContent = (userStats.lastSession.accuracy || '100.00') + '%';
        timeDisplay.textContent = (userStats.lastSession.time || '0') + 's';
        currentCorrectCharsDisplay.textContent = userStats.lastSession.correctChars || '0';
        currentTotalCharsDisplay.textContent = userStats.lastSession.totalChars || '0';
    } else {
        resetCurrentSessionStats();
    }
}

function saveUserStats() {
    if (!currentUser) return;
    
    const userStats = JSON.parse(localStorage.getItem(`typingStats_${currentUser}`) || '{"completedSections": [], "stats": [], "lastSession": null}');
    
    // Add current stats
    const currentStats = {
        wpm: finalWPM,
        accuracy: finalAccuracy,
        time: finalTime,
        date: new Date().toISOString(),
        section: currentPractice,
        subsection: currentSubsection,
        subsectionTitle: practiceData[currentPractice]?.subsections[currentSubsection]?.title || currentSubsection,
        correctChars: correctChars,
        totalChars: totalChars
    };
    
    userStats.stats.push(currentStats);
    
    // Update last session
    userStats.lastSession = currentStats;
    
    // Keep only last 100 entries
    if (userStats.stats.length > 100) {
        userStats.stats = userStats.stats.slice(-100);
    }
    
    localStorage.setItem(`typingStats_${currentUser}`, JSON.stringify(userStats));
    loadUserStats();
}

// Function to get first section and subsection
function getFirstSectionAndSubsection() {
    const firstSection = Object.keys(practiceData)[0];
    if (firstSection) {
        const firstSubsection = Object.keys(practiceData[firstSection].subsections)[0];
        return { section: firstSection, subsection: firstSubsection };
    }
    return null;
}

// Function to get first subsection of a section
function getFirstSubsection(section) {
    if (practiceData[section] && practiceData[section].subsections) {
        return Object.keys(practiceData[section].subsections)[0];
    }
    return null;
}

// Function to get next subsection
function getNextSubsection(currentSection, currentSub) {
    if (!practiceData[currentSection]) return null;
    
    const subsections = Object.keys(practiceData[currentSection].subsections);
    const currentIndex = subsections.indexOf(currentSub);
    
    if (currentIndex < subsections.length - 1) {
        return subsections[currentIndex + 1];
    }
    return null;
}

// Function to handle next subsection click
function handleNextSubsection() {
    if (!currentPractice || !currentSubsection) return;
    
    const nextSub = getNextSubsection(currentPractice, currentSubsection);
    if (nextSub) {
        subsectionSelect.value = nextSub;
        startSubsection(currentPractice, nextSub);
    }
}

function markSectionComplete(section, subsection) {
    if (!currentUser) return;
    
    const userStats = JSON.parse(localStorage.getItem(`typingStats_${currentUser}`) || '{"completedSections": [], "stats": []}');
    const sectionKey = `${section}_${subsection}`;
    
    // Add to completed sections if not already there
    if (!userStats.completedSections.includes(sectionKey)) {
        userStats.completedSections.push(sectionKey);
        localStorage.setItem(`typingStats_${currentUser}`, JSON.stringify(userStats));
        
        // Update checkmark in dropdown
        const option = Array.from(subsectionSelect.options).find(opt => opt.value === subsection);
        if (option) {
            option.textContent = `${option.textContent.replace(' ✓', '')} ✓`;
            option.style.color = '#059669';
            option.style.fontWeight = '600';
        }
    }
}


// Function to setup keyboard highlighting
function setupKeyboardHighlighting() {
    // Remove all previous event listeners
    const oldInput = userInput;
    userInput = oldInput.cloneNode(true);
    oldInput.parentNode.replaceChild(userInput, oldInput);

    // Add click event to enable typing and highlight first character
    userInput.addEventListener('click', function() {
        if (!currentUser) {
            alert('Please select a user first');
            return;
        }
        if (!currentPractice || !currentSubsection) {
            alert('Please select a section and subsection first');
            return;
        }
        
        // Enable textarea and focus
        userInput.disabled = false;
        userInput.placeholder = 'Start typing...';
        userInput.focus();
        
        // Reset content and cursor
        userInput.value = '';
        cursorPosition = 0;
        
        // Reset stats
        correctChars = 0;
        timeElapsed = 0;
        
        // Clear any existing timer
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        startTime = null;
        isPracticeComplete = false;
        
        // Highlight first character
        const targetChars = Array.from(targetText.getElementsByTagName('span'));
        if (targetChars.length > 0) {
            targetChars[0].classList.add('current');
        }
        
        // Update displays
        updateStats();
    });

    // Handle input events
    userInput.addEventListener('input', function(e) {
        // Start timer if not started
        if (!timer && !startTime && !userInput.disabled) {
            startTimer();
        }

        const inputText = this.value;
        
        // Get all character spans
        const targetChars = Array.from(targetText.getElementsByTagName('span'));
        
        // Reset character counts for this check
        correctChars = 0; // Reset correctChars for this input check
        totalChars = targetChars.length; // Set totalChars to the length of the target text

        // Reset all character highlighting
        targetChars.forEach((char, index) => {
            if (index < inputText.length) {
                const charContent = char.textContent;
                const inputChar = inputText[index];
                
                // Only remove incorrect and current classes, keep correct class if it exists
                char.classList.remove('incorrect', 'current');
                
                // Special handling for enter key symbol
                if (char.classList.contains('enter-key')) {
                    if (inputChar === '\n') {
                        char.classList.add('correct');
                        correctChars++;
                    } else {
                        char.classList.add('incorrect');
                    }
                } else if (inputChar === charContent) {
                    char.classList.add('correct');
                    correctChars++;
                } else {
                    char.classList.add('incorrect');
                }
            } else {
                // Reset styling for characters not yet typed
                char.classList.remove('correct', 'incorrect', 'current');
            }
        });
        
        // Highlight current character position
        if (inputText.length < targetChars.length) {
            targetChars[inputText.length].classList.add('current');
        }
        
        // Update current character stats
        if (currentCorrectCharsDisplay && currentTotalCharsDisplay) {
            currentCorrectCharsDisplay.textContent = correctChars;
            currentTotalCharsDisplay.textContent = totalChars;
        }
    
        // Check if practice is complete - only when all characters are typed correctly
        if (inputText.length >= targetChars.length) {
            // Verify all characters are correct
            const allCorrect = targetChars.every((char, index) => {
                if (char.classList.contains('enter-key')) {
                    return inputText[index] === '\n';
                }
                return inputText[index] === char.textContent;
            });

            if (allCorrect && !isPracticeComplete) {
                console.log('Practice complete - stopping timer'); // Debugging statement
                isPracticeComplete = true;
                if (timer) {
                    clearInterval(timer);
                    timer = null;
                }
                startTime = null;
                userInput.disabled = true;
                updateStats();
                saveUserStats();
                markSectionComplete(currentPractice, currentSubsection);
                
                // Show completion dialog
                const completionDialog = document.createElement('div');
                completionDialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                completionDialog.innerHTML = `
                    <div class="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                        <h2 class="text-2xl font-bold mb-4">Session Completed!</h2>
                        <div class="mb-4">
                            <p class="text-lg">Your final stats:</p>
                            <p>WPM: ${finalWPM}</p>
                            <p>Accuracy: ${finalAccuracy}%</p>
                            <p>Time: ${finalTime}s</p>
                        </div>
                        <button class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600" onclick="this.parentElement.parentElement.remove()">Close</button>
                    </div>
                `;
                document.body.appendChild(completionDialog);
            }
        }

        // Update stats while typing
        if (timeElapsed > 0) {
            updateStats();
        }
    });

    // Handle keydown events for Enter key
    userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const targetChars = Array.from(targetText.getElementsByTagName('span'));
            const currentChar = targetChars[userInput.value.length];
            
            if (currentChar && currentChar.classList.contains('enter-key')) {
                // Mark the enter key as correct
                currentChar.classList.add('correct');
                correctChars++;
                
                // Add a newline to the input value
                userInput.value += '\n';
                
                // Update stats
                updateStats();
                
                // Prevent the default Enter key behavior
                e.preventDefault();
            }
        }
    });

    // Handle keypress events for Enter key
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const targetChars = Array.from(targetText.getElementsByTagName('span'));
            const currentChar = targetChars[userInput.value.length];
            
            if (currentChar && currentChar.classList.contains('enter-key')) {
                // Prevent the default Enter key behavior
                e.preventDefault();
            }
        }
    });

    // Prevent unwanted actions
    userInput.addEventListener('keydown', (e) => {
        // Prevent backspace and delete keys
        if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            return;
        }

        // Prevent left/right arrow keys and mouse selection
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            return;
        }
    });

    // Prevent cut/copy/paste
    userInput.addEventListener('cut', e => e.preventDefault());
    userInput.addEventListener('copy', e => e.preventDefault());
    userInput.addEventListener('paste', e => e.preventDefault());

    // Prevent mouse selection
    userInput.addEventListener('mousedown', e => {
        if (userInput.disabled) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    });
    
    userInput.addEventListener('selectstart', e => e.preventDefault());
}

// Function declarations
function startTimer() {
    // Reset time elapsed to 0 when starting
    timeElapsed = 0;
    timeDisplay.textContent = '0s'; // Reset the display

    // Clear any existing timer
    if (timer) {
        clearInterval(timer);
    }

    // Start the timer
    startTime = new Date();
    timer = setInterval(() => {
        timeElapsed++;
        timeDisplay.textContent = `${timeElapsed}s`; // Update the display

        // Check if time limit reached
        if (timeElapsed >= maxTimeLimit) {
            clearInterval(timer); // Stop the timer
            userInput.disabled = true; // Disable input
            isPracticeComplete = true; // Mark practice as complete
            updateStats(); // Update final stats
            saveUserStats(); // Save user stats
            markSectionComplete(currentPractice, currentSubsection); // Mark section as complete

            // Show completion dialog
            const completionDialog = document.createElement('div');
            completionDialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            completionDialog.innerHTML = `
                <div class="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                    <h2 class="text-2xl font-bold mb-4">Time's Up!</h2>
                    <div class="mb-4">
                        <p class="text-lg">Your final stats:</p>
                        <p>WPM: ${finalWPM}</p>
                        <p>Accuracy: ${finalAccuracy}%</p>
                        <p>Time: ${finalTime}s</p>
                    </div>
                    <button class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600" onclick="this.parentElement.parentElement.remove()">Close</button>
                </div>
            `;
            document.body.appendChild(completionDialog);
        }
    }, 1000); // Update every second
}

function startSubsection(section, subsection) {
    if (!currentUser) {
        alert('Please select or add a name first');
        return;
    }

    // Reset completion flag
    isPracticeComplete = false;
    
    // Set active subsection
    currentPractice = section;
    currentSubsection = subsection;
    const subsectionData = practiceData[section].subsections[subsection];
    
    // Update section title and dropdown
    currentSectionTitle.textContent = practiceData[section].title;
    populateSubsectionDropdown(section);
    subsectionSelect.value = subsection;

    // Update text and ensure textarea is disabled initially
    targetText.innerHTML = formatText(subsectionData.text, subsectionData.repeat || 1);
    userInput.value = '';
    userInput.disabled = false;
    userInput.placeholder = 'Click here to start typing...';

    // Initialize totalChars to the length of the target text
    const targetChars = Array.from(targetText.getElementsByTagName('span'));
    totalChars = targetChars.length; // Set totalChars to the length of the target text
    console.log('Total Characters:', totalChars); // Debugging statement

    // Reset stats
    correctChars = 0;
    timeElapsed = 0;
    finalWPM = 0;
    finalAccuracy = 0; // Set initial accuracy to 0
    finalTime = 0;
    updateStats();
    
    // Clear any existing timer
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    startTime = null;
    
    // Reset displays
    wpmDisplay.textContent = '0';
    accuracyDisplay.textContent = '0.00%'; // Update display for accuracy to show 0%
    timeDisplay.textContent = '0s';
    currentCorrectCharsDisplay.textContent = '0';
    currentTotalCharsDisplay.textContent = totalChars; // Update display for totalChars

    // Save and highlight the current section
    saveLastSection(section, subsection);
    highlightActiveSection(section, subsection);

    // Highlight first character
    if (targetChars.length > 0) {
        targetChars[0].classList.add('current');
    }

    // Re-initialize keyboard highlighting
    setupKeyboardHighlighting();
}

function updateStats() {
    // Only calculate stats if practice is complete or timer has started
    if (isPracticeComplete || timeElapsed > 0) {
        // Calculate minutes elapsed, ensuring we don't divide by zero
        const minutes = timeElapsed > 0 ? timeElapsed / 60 : 1;
        
        // Calculate WPM
        finalWPM = Math.round((correctChars / 5) / minutes);
        
        // Calculate accuracy to 2 decimal places
        finalAccuracy = totalChars > 0 
            ? Number(((correctChars / totalChars) * 100).toFixed(2))
            : 100;

        finalTime = timeElapsed;
        
        // Update displays
        wpmDisplay.textContent = finalWPM;
        accuracyDisplay.textContent = `${finalAccuracy}%`;
        timeDisplay.textContent = `${finalTime}s`;
        currentCorrectCharsDisplay.textContent = correctChars;
        currentTotalCharsDisplay.textContent = totalChars;

        // Update level based on WPM
        updateLevel(finalWPM);
    }
}

function updateLevel(wpm) {
    const levelDisplay = document.getElementById('current-level');
    let level = 'Beginner';
    
    if (wpm >= 81) {
        level = 'Master';
    } else if (wpm >= 61) {
        level = 'Expert';
    } else if (wpm >= 41) {
        level = 'Advanced';
    } else if (wpm >= 21) {
        level = 'Intermediate';
    }
    
    levelDisplay.textContent = level;
}

function saveLastSection(section, subsection) {
    if (!currentUser) return;
    
    const userStats = JSON.parse(localStorage.getItem(`typingStats_${currentUser}`) || '{"stats": [], "completedSections": [], "lastSection": null}');
    userStats.lastSection = { section, subsection };
    localStorage.setItem(`typingStats_${currentUser}`, JSON.stringify(userStats));
}

function highlightActiveSection(section, subsection) {
    // First remove all highlights from main section buttons
    document.querySelectorAll('.section-container > button').forEach(btn => {
        btn.classList.remove('active-section-btn');
    });

    // Remove all highlights from subsection buttons
    document.querySelectorAll('.subsection-btn').forEach(btn => {
        btn.classList.remove('active-subsection-btn');
    });

    // Show the current section's subsections and hide others
    document.querySelectorAll('[id$="-subs"]').forEach(el => {
        if (el.id === `${section.toLowerCase()}-subs`) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });

    // Highlight main section button
    const mainSectionBtn = document.getElementById(`${section.toLowerCase()}-btn`);
    if (mainSectionBtn) {
        mainSectionBtn.classList.add('active-section-btn');
    }

    // Highlight active subsection
    const subsectionBtn = document.querySelector(`[data-section="${section}"][data-subsection="${subsection}"]`);
    if (subsectionBtn) {
        subsectionBtn.classList.add('active-subsection-btn');
    }
}

function setupButtons() {
    // Main section buttons
    document.querySelectorAll('.section-container > button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = btn.dataset.section;
            
            // Update section title
            currentSectionTitle.textContent = practiceData[section].title;
            
            // Populate subsection dropdown
            populateSubsectionDropdown(section);
            
            // Select first subsection by default
            const firstSubsection = getFirstSubsection(section);
            if (firstSubsection) {
                subsectionSelect.value = firstSubsection;
                startSubsection(section, firstSubsection);
            }
            
            // Highlight active section
            document.querySelectorAll('.section-container > button').forEach(b => 
                b.classList.remove('active-section-btn'));
            btn.classList.add('active-section-btn');
            
            // Set current practice section
            currentPractice = section;
        });
    });

    // Subsection select handler
    subsectionSelect.addEventListener('change', (e) => {
        const subsection = e.target.value;
        if (subsection && currentPractice) {
            startSubsection(currentPractice, subsection);
        }
    });
}

// Function to populate subsection dropdown
function populateSubsectionDropdown(section) {
    subsectionSelect.innerHTML = '<option value="">Select subsection</option>';
    if (section && practiceData[section]) {
        const userStats = JSON.parse(localStorage.getItem(`typingStats_${currentUser}`) || '{"completedSections": []}');
        const completedSections = userStats.completedSections || [];

        Object.entries(practiceData[section].subsections).forEach(([key, data]) => {
            const option = document.createElement('option');
            option.value = key;
            const sectionKey = `${section}_${key}`;
            
            // Add checkmark if subsection is completed
            if (completedSections.includes(sectionKey)) {
                option.textContent = `${data.title} ✓`;
                option.style.color = '#059669'; // Tailwind's green-600
                option.style.fontWeight = '600';
            } else {
                option.textContent = data.title;
            }

            subsectionSelect.appendChild(option);
        });
    }
}

// Function to populate sections from practice data
function populateSections() {
    const sectionsContainer = document.getElementById('sections-container');
    sectionsContainer.innerHTML = ''; // Clear existing content

    // Create sections from practice data
    Object.entries(practiceData).forEach(([sectionKey, sectionData]) => {
        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'section-container';

        // Create main section button
        const sectionButton = document.createElement('button');
        sectionButton.id = `${sectionKey.toLowerCase()}-btn`;
        sectionButton.className = 'w-full text-left px-4 py-2 rounded hover:bg-primary/10';
        sectionButton.setAttribute('data-section', sectionKey);
        sectionButton.innerHTML = `
            <i class="fas ${sectionData.icon} mr-2"></i>${sectionData.title}
        `;

        sectionContainer.appendChild(sectionButton);
        sectionsContainer.appendChild(sectionContainer);
    });

    // Setup event handlers for the new buttons
    setupButtons();
}

// Wait for both DOM content and practice data to be loaded
Promise.all([
    new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve);
    }),
    fetch('practice_data.json')
        .then(response => response.json())
        .then(data => {
            practiceData = data;
        })
        .catch(error => {
            console.error('Error loading practice data:', error);
            alert('Failed to load practice data. Please refresh the page.');
        })
]).then(() => {
    // Initialize DOM elements
    nameInput = document.getElementById('name-input');
    addNameBtn = document.getElementById('add-name-btn');
    nameSelect = document.getElementById('name-select');
    targetText = document.getElementById('target-text');
    userInput = document.getElementById('user-input');
    wpmDisplay = document.getElementById('wpm');
    accuracyDisplay = document.getElementById('accuracy');
    timeDisplay = document.getElementById('time');
    endTimerBtn = document.getElementById('end-timer-btn');
    viewSessionsBtn = document.getElementById('view-sessions-btn');
    keys = document.querySelectorAll('.key');
    maxTimeInput = document.getElementById('max-time-input');
    currentSectionTitle = document.getElementById('current-section-title');
    clearDataBtn = document.getElementById('clear-data-btn');
    globalWpmDisplay = document.getElementById('global-wpm');
    globalAccuracyDisplay = document.getElementById('global-accuracy');
    globalTimeDisplay = document.getElementById('global-time');
    currentCorrectCharsDisplay = document.getElementById('current-correct-chars');
    currentTotalCharsDisplay = document.getElementById('current-total-chars');
    sessionsModal = document.getElementById('sessions-modal');
    closeModalBtn = document.getElementById('close-modal-btn');
    sessionData = document.getElementById('session-data');
    subsectionSelect = document.getElementById('subsection-select');
    nextSubsectionBtn = document.getElementById('next-subsection-btn');


    // Update maxTimeLimit from input
    maxTimeLimit = parseInt(maxTimeInput.value) * 60 || 60;

    // Now populate sections after DOM elements are initialized
    populateSections();

    // Initialize
    setupNameHandlers();
    loadNames();
    setupKeyboardHighlighting();
    setupKeyboardEvents();
    restoreLastSection();

    // Event Listeners
    endTimerBtn.addEventListener('click', endTimer);
    viewSessionsBtn.addEventListener('click', viewSessions);
    
    // Modal close handlers
    const closeModal = () => {
        if (sessionsModal) {
            sessionsModal.classList.add('hidden');
        }
    };

    // Add click handlers for both close buttons
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }

    const closeModalIcon = document.getElementById('close-modal-icon');
    if (closeModalIcon) {
        closeModalIcon.addEventListener('click', closeModal);
    }

    // Add click handler for clicking outside the modal
    if (sessionsModal) {
        sessionsModal.addEventListener('click', (e) => {
            if (e.target === sessionsModal) {
                closeModal();
            }
        });
    }

    maxTimeInput.addEventListener('change', () => {
        maxTimeLimit = parseInt(maxTimeInput.value) * 60;
    });
    nextSubsectionBtn.addEventListener('click', handleNextSubsection);

    // Clear data button with glyphicon
    clearDataBtn.innerHTML = '<i class="fas fa-trash-alt mr-2"></i> Clear User Data';
    clearDataBtn.addEventListener('click', clearUserData);

    function setupNameHandlers() {
        // Add name button click handler
        addNameBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            if (!name) {
                alert('Please enter a name');
                return;
            }
            if (name) {
                addName(name);
                nameInput.value = '';
            }
        });

        // Name input enter key handler
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const name = nameInput.value.trim();
                if (!name) {
                    alert('Please enter a name');
                    return;
                }
                if (name) {
                    addName(name);
                    nameInput.value = '';
                }
            }
        });

        // Name select change handler
        nameSelect.addEventListener('change', () => {
            currentUser = nameSelect.value;
            if (currentUser) {
                // Save the selected user as last user
                localStorage.setItem('lastSelectedUser', currentUser);
                // Load user stats and update displays
                loadUserStats();
                userInput.disabled = false;
                
                // Load and set last active section for the user
                const lastSection = loadLastSection(currentUser);
                if (lastSection) {
                    const { section, subsection } = lastSection;
                    startSubsection(section, subsection);
                    highlightActiveSection(section, subsection);
                } else {
                    // Default to home row if no last section
                    startSubsection('homeRow', 'basicDrillLeft1');
                    highlightActiveSection('homeRow', 'basicDrillLeft1');
                }

                // Reset current session variables
                correctChars = 0;
                totalChars = 0;
                timeElapsed = 0;
                clearInterval(timer);
            } else {
                userInput.disabled = true;
                resetCurrentSessionStats();
                resetStats();
            }
        });
    }

    function loadLastSection(username) {
        const userStats = JSON.parse(localStorage.getItem(`typingStats_${username}`) || '{"lastSection": null}');
        return userStats.lastSection;
    }

    function addName(name) {
        // Get existing names from localStorage
        const names = JSON.parse(localStorage.getItem('typingNames') || '[]');
        
        // Add new name if it doesn't exist
        if (!names.includes(name)) {
            names.push(name);
            localStorage.setItem('typingNames', JSON.stringify(names));
            
            // Add to select dropdown
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            nameSelect.appendChild(option);
            
            // Select the new name by default
            nameSelect.value = name;
            currentUser = name;
            
            // Initialize stats for new user
            initializeUserStats(name);
            
            // Reset all stats displays
            resetCurrentSessionStats();
            resetStats();
            
            // Enable user input
            userInput.disabled = false;
            userInput.placeholder = 'Click here to start typing...';
            
            // Start with first section and subsection
            const firstSection = getFirstSectionAndSubsection();
            if (firstSection) {
                startSubsection(firstSection.section, firstSection.subsection);
                highlightActiveSection(firstSection.section, firstSection.subsection);
                saveLastSection(firstSection.section, firstSection.subsection);
            }
            
            // Reset timer-related variables
            timeElapsed = 0;
            startTime = null;
            isPracticeComplete = false;
            clearInterval(timer);
            
            // Load fresh stats
            loadUserStats();
        }
    }

    function loadNames() {
        const names = JSON.parse(localStorage.getItem('typingNames') || '[]');
        const lastUser = localStorage.getItem('lastSelectedUser');
        
        // Clear all existing options
        nameSelect.innerHTML = '<option value="">Select a name</option>';
        
        names.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            nameSelect.appendChild(option);
        });
        
        // Select last user if exists
        if (lastUser && names.includes(lastUser)) {
            nameSelect.value = lastUser;
            currentUser = lastUser;
            userInput.disabled = false;
            loadUserStats();
        } else {
            nameSelect.value = '';
            currentUser = '';
            userInput.disabled = true;
            resetCurrentSessionStats();
        }
    }

    function initializeUserStats(name) {
        const userStats = {
            completedSections: [],
            stats: []
        };
        localStorage.setItem(`typingStats_${name}`, JSON.stringify(userStats));
    }

    
    function endTimer() {
        isPracticeComplete = true;
        clearInterval(timer);
        userInput.disabled = true;

        // Update stats before saving
        updateStats();
        saveUserStats(); // Save user stats
        
        // Mark the section as complete
        markSectionComplete(currentPractice, currentSubsection);

        // Show completion dialog
        const completionDialog = document.createElement('div');
        completionDialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        completionDialog.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                <h2 class="text-2xl font-bold mb-4">Session Completed!</h2>
                <div class="mb-4">
                    <p class="text-lg">Your final stats:</p>
                    <p>WPM: ${finalWPM}</p>
                    <p>Accuracy: ${finalAccuracy}%</p>
                    <p>Time: ${finalTime}s</p>
                </div>
                <button class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600" onclick="this.parentElement.parentElement.remove()">Close</button>
            </div>
        `;
        document.body.appendChild(completionDialog);
    }

    function resetStats() {
        correctChars = 0;
        const targetChars = Array.from(targetText.getElementsByTagName('span'));
        totalChars = targetChars.length
        timeElapsed = 0;
        updateStats();
    }

    function viewSessions() {
        if (!currentUser) {
            alert('Please select a user first');
            return;
        }
    
        // Fetch user stats from localStorage
        const userStats = JSON.parse(localStorage.getItem(`typingStats_${currentUser}`) || '{"stats": []}');
        console.log('User Stats:', userStats);
    
        const sessionData = document.getElementById('session-data');
        sessionData.innerHTML = ''; // Clear previous data
    
        if (userStats.stats.length === 0) {
            sessionData.innerHTML = '<tr><td colspan="5" class="text-center py-4">No sessions found for this user.</td></tr>';
        } else {
            // Sort sessions by date (newest first)
            const sortedSessions = userStats.stats.sort((a, b) => 
                new Date(b.date) - new Date(a.date)
            );
    
            // Get unique section-subsection combinations for filter
            const uniqueCombinations = [...new Set(sortedSessions.map(session => 
                `${session.section}_${session.subsection}`
            ))];
            
            // Create filter dropdown
            const filterContainer = document.createElement('div');
            filterContainer.className = 'mb-4 flex items-center gap-4';
            filterContainer.innerHTML = `
                <div class="flex items-center gap-2">
                    <label for="section-filter" class="text-gray-600">Filter by Section:</label>
                    <select id="section-filter" class="border rounded p-2">
                        <option value="">All Sections</option>
                        ${uniqueCombinations.map(combo => {
                            const [section, subsection] = combo.split('_');
                            const session = sortedSessions.find(s => s.section === section && s.subsection === subsection);
                            return `<option value="${combo}">${section} > ${session.subsectionTitle}</option>`;
                        }).join('')}
                    </select>
                </div>
            `;
    
            // Add filter container before the table
            const modalContent = document.querySelector('.modal-content');
            const existingFilter = document.getElementById('section-filter');
            if (!existingFilter) {
                modalContent.insertBefore(filterContainer, modalContent.firstChild.nextSibling);
            }
    
            // Pagination variables
            const sessionsPerPage = 10;
            let currentPage = 1;
            let filteredSessions = [...sortedSessions];
    
            // Function to update the table
            function updateTable() {
                // Apply section filter
                const selectedCombo = document.getElementById('section-filter').value;
                filteredSessions = selectedCombo 
                    ? sortedSessions.filter(session => 
                        `${session.section}_${session.subsection}` === selectedCombo
                    )
                    : [...sortedSessions];
    
                // Calculate pagination
                const totalPages = Math.ceil(filteredSessions.length / sessionsPerPage);
                const startIndex = (currentPage - 1) * sessionsPerPage;
                const endIndex = startIndex + sessionsPerPage;
                const paginatedSessions = filteredSessions.slice(startIndex, endIndex);
    
                // Clear and update table
                sessionData.innerHTML = '';
                paginatedSessions.forEach(session => {
                    const row = document.createElement('tr');
                    row.className = 'hover:bg-gray-50';
                    row.innerHTML = `
                        <td class="border border-gray-300 p-2">${new Date(session.date).toLocaleString()}</td>
                        <td class="border border-gray-300 p-2">${session.wpm}</td>
                        <td class="border border-gray-300 p-2">${session.accuracy}%</td>
                        <td class="border border-gray-300 p-2">${session.time}s</td>
                        <td class="border border-gray-300 p-2">${session.section} > ${session.subsectionTitle}</td>
                    `;
                    sessionData.appendChild(row);
                });
    
                // Update pagination controls
                const paginationContainer = document.getElementById('pagination-controls') || document.createElement('div');
                paginationContainer.id = 'pagination-controls';
                paginationContainer.className = 'flex justify-center items-center gap-2 mt-4';
                paginationContainer.innerHTML = `
                    <button class="px-3 py-1 border rounded ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}" 
                        ${currentPage === 1 ? 'disabled' : ''} id="prev-page">Previous</button>
                    <span class="text-gray-600">Page ${currentPage} of ${totalPages}</span>
                    <button class="px-3 py-1 border rounded ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}" 
                        ${currentPage === totalPages ? 'disabled' : ''} id="next-page">Next</button>
                `;
    
                // Add pagination controls if not already present
                if (!document.getElementById('pagination-controls')) {
                    modalContent.appendChild(paginationContainer);
                }
    
                // Add event listeners for pagination buttons
                document.getElementById('prev-page').addEventListener('click', () => {
                    if (currentPage > 1) {
                        currentPage--;
                        updateTable();
                    }
                });
    
                document.getElementById('next-page').addEventListener('click', () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        updateTable();
                    }
                });
            }
    
            // Add event listener for section filter
            document.getElementById('section-filter').addEventListener('change', () => {
                currentPage = 1; // Reset to first page when filter changes
                updateTable();
            });
    
            // Initial table update
            updateTable();
        }
    
        // Show the modal
        sessionsModal.classList.add('active');
    }
    
    function clearUserData() {
        if (currentUser) {
            if (confirm('Are you sure you want to clear all data for this user?')) {
                // Remove user stats
                localStorage.removeItem(`typingStats_${currentUser}`);
                
                // Remove user from names list
                const names = JSON.parse(localStorage.getItem('typingNames') || '[]');
                const updatedNames = names.filter(name => name !== currentUser);
                localStorage.setItem('typingNames', JSON.stringify(updatedNames));
                
                // Clear the name select dropdown
                nameSelect.innerHTML = '<option value="">Select a name</option>';
                
                // Repopulate with remaining names
                updatedNames.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    nameSelect.appendChild(option);
                });
                
                // Reset current user and UI
                currentUser = '';
                nameSelect.value = '';
                userInput.value = '';
                userInput.disabled = true;
                
                // Reset all stats
                resetCurrentSessionStats();
                resetStats();
                
                // Reset section titles and remove highlights
                currentSectionTitle.textContent = 'No Section Selected';
                
                // Clear target text
                targetText.innerHTML = '';
                
                // Hide all checkmarks
                document.querySelectorAll('.subsection-btn i').forEach(icon => {
                    icon.classList.add('hidden');
                });
                
                // Remove all section highlights
                document.querySelectorAll('.section-container button').forEach(btn => {
                    btn.classList.remove('active-section-btn', 'active-subsection-btn');
                });
                
                // Hide all subsections
                document.querySelectorAll('[id$="-subs"]').forEach(el => {
                    el.classList.add('hidden');
                });
                
                // Reset global stats
                globalWpmDisplay.textContent = '0';
                globalAccuracyDisplay.textContent = '100%';
                globalTimeDisplay.textContent = '0s';
                document.getElementById('session-count').textContent = '0';
                
                // Clear timer if running
                clearInterval(timer);
                timeElapsed = 0;
                startTime = null;
                isPracticeComplete = false;
                
                // Clear last section from localStorage
                localStorage.removeItem('lastSection');
                
                alert('User data cleared successfully.');
            }
        } else {
            alert('No user selected.');
        }
    }

    function setupKeyboardEvents() {
        // Handle keyboard events
        document.addEventListener('keydown', (e) => {
            // Map special keys to their display names
            const keyMap = {
                ' ': ' ',
                'Enter': 'Enter',
                'Backspace': 'Backspace',
                'Tab': 'Tab',
                'CapsLock': 'Caps',
                'Shift': 'Shift',
                'Control': 'Ctrl',
                'Alt': 'Alt',
                'Meta': 'Win'
            };

            const keyToHighlight = keyMap[e.key] || e.key.toLowerCase();
            highlightKey(keyToHighlight);
        });

        // Handle mouse clicks on keys
        keys.forEach(key => {
            key.addEventListener('mousedown', () => {
                key.classList.add('active');
            });

            key.addEventListener('mouseup', () => {
                key.classList.remove('active');
            });

            key.addEventListener('mouseleave', () => {
                key.classList.remove('active');
            });
        });
    }

    function highlightKey(key) {
        const keyElement = document.querySelector(`.key[data-key="${key}"]`);
        if (keyElement) {
            keyElement.classList.add('active');
            setTimeout(() => {
                keyElement.classList.remove('active');
            }, 100);
        }
    }

    function restoreLastSection() {
        if (!currentUser) return;
        
        const userStats = JSON.parse(localStorage.getItem(`typingStats_${currentUser}`) || '{"lastSection": null}');
        if (userStats.lastSection) {
            const { section, subsection } = userStats.lastSection;
            // Check if both section and subsection still exist
            if (practiceData[section] && practiceData[section].subsections[subsection]) {
                startSubsection(section, subsection);
                highlightActiveSection(section, subsection);
            }
        }
    }

    viewSessionsBtn.addEventListener('click', () => {
        viewSessions();
    });

    // Close modal functionality
    closeModalBtn.addEventListener('click', () => {
        sessionsModal.classList.remove('active'); // Hide modal
    });

    // Add retry button click handler
    document.getElementById('retry-btn').addEventListener('click', function() {
        if (currentPractice && currentSubsection) {
            // Reset all stats
            correctChars = 0;
            timeElapsed = 0;
            finalWPM = 0;
            finalAccuracy = 100;
            finalTime = 0;
            isPracticeComplete = false;
            
            // Clear timer
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            startTime = null;
            
            // Reset input field
            userInput.value = '';
            userInput.disabled = false;
            userInput.placeholder = 'Click here to start typing...';
            
            // Reset displays
            wpmDisplay.textContent = '0';
            accuracyDisplay.textContent = '100.00%';
            timeDisplay.textContent = '0s';
            currentCorrectCharsDisplay.textContent = '0';
            currentTotalCharsDisplay.textContent = totalChars;
            
            // Reset character highlighting
            const targetChars = Array.from(targetText.getElementsByTagName('span'));
            targetChars.forEach(char => {
                char.classList.remove('correct', 'incorrect', 'current');
            });
            
            // Highlight first character
            if (targetChars.length > 0) {
                targetChars[0].classList.add('current');
            }
            
            // Reset cursor position
            cursorPosition = 0;
            
            // Update stats
            updateStats();
            
            // Re-initialize keyboard highlighting
            setupKeyboardHighlighting();
            
            // Focus the input field
            userInput.focus();
        }
    });

});