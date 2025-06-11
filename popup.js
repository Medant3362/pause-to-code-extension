document.addEventListener('DOMContentLoaded', function() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const playTimeInput = document.getElementById('playTime');
    const pauseTimeInput = document.getElementById('pauseTime');
    const statusDiv = document.getElementById('status');
    const trackingInfo = document.getElementById('trackingInfo');
    const cycleCount = document.getElementById('cycleCount');
    const pauseCount = document.getElementById('pauseCount');
    const currentPhase = document.getElementById('currentPhase');
    const progressFill = document.getElementById('progressFill');
    const studyTime = document.getElementById('studyTime');
    
    let trackingData = {
        cycles: 0,
        pauses: 0,
        phase: 'Ready',
        studyStartTime: null,
        totalStudyTime: 0,
        isRunning: false,
        playTime: 10,
        pauseTime: 4
    };
    
    // Load saved state when popup opens
    loadCurrentState();
    
    // Listen for updates from content script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'updateTracking') {
            updateTrackingDisplay(request.data);
        }
    });
    
    function loadCurrentState() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0] && tabs[0].url.includes('youtube.com/watch')) {
                chrome.tabs.sendMessage(tabs[0].id, {action: 'getStatus'}, function(response) {
                    if (chrome.runtime.lastError) {
                        // Content script might not be loaded yet
                        setInitialState();
                        return;
                    }
                    
                    if (response && response.data) {
                        const data = response.data;
                        updateTrackingDisplay(data);
                        
                        if (data.isRunning) {
                            updateStatus(`🚀 Active: ${data.playTime}s play, ${data.pauseTime}s pause`, 'active');
                            startBtn.disabled = true;
                            stopBtn.disabled = false;
                            trackingInfo.classList.add('show');
                            
                            // Update input values to match current session
                            playTimeInput.value = data.playTime;
                            pauseTimeInput.value = data.pauseTime;
                        } else {
                            setInitialState();
                        }
                    } else {
                        setInitialState();
                    }
                });
            } else {
                setInitialState();
            }
        });
    }
    
    function setInitialState() {
        updateStatus('Ready to enhance your learning', '');
        startBtn.disabled = false;
        stopBtn.disabled = true;
        trackingInfo.classList.remove('show');
        resetTracking();
    }
    
    startBtn.addEventListener('click', function() {
        const playTime = parseInt(playTimeInput.value);
        const pauseTime = parseInt(pauseTimeInput.value);
        
        if (playTime < 1 || pauseTime < 1) {
            updateStatus('⚠️ Please enter valid times (minimum 1 second)', 'error');
            return;
        }
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const tab = tabs[0];
            
            if (!tab.url.includes('youtube.com/watch')) {
                updateStatus('⚠️ Please open a YouTube video first', 'error');
                return;
            }
            
            chrome.tabs.sendMessage(tab.id, {
                action: 'start',
                playTime: playTime,
                pauseTime: pauseTime
            }, function(response) {
                if (chrome.runtime.lastError) {
                    updateStatus('⚠️ Error: Please refresh the YouTube page', 'error');
                    return;
                }
                
                if (response && response.success) {
                    updateStatus(`🚀 Active: ${playTime}s play, ${pauseTime}s pause`, 'active');
                    startBtn.disabled = true;
                    stopBtn.disabled = false;
                    trackingInfo.classList.add('show');
                    resetTracking();
                    
                    // Auto-close popup after 2 seconds
                    setTimeout(() => {
                        window.close();
                    }, 2000);
                } else {
                    updateStatus('❌ Failed to start. Try refreshing the page.', 'error');
                }
            });
        });
    });
    
    stopBtn.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'stop'}, function(response) {
                updateStatus('⏹️ Stopped - Ready for next session', '');
                startBtn.disabled = false;
                stopBtn.disabled = true;
                trackingInfo.classList.remove('show');
                resetTracking();
            });
        });
    });
    
    function updateStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = type;
    }
    
    function updateTrackingDisplay(data) {
        trackingData = data;
        studyTime.textContent = formatTime(data.totalStudyTime);
        cycleCount.textContent = data.cycles;
        pauseCount.textContent = data.pauses;
        currentPhase.textContent = data.phase;
        
        // Update progress bar based on phase
        if (data.phase === 'Playing') {
            progressFill.style.background = 'linear-gradient(90deg, #4CAF50, #45a049)';
            progressFill.style.width = data.progress + '%';
        } else if (data.phase === 'Paused') {
            progressFill.style.background = 'linear-gradient(90deg, #ff9800, #f57c00)';
            progressFill.style.width = data.progress + '%';
        } else {
            progressFill.style.width = '0%';
        }
    }
    
    function resetTracking() {
        trackingData = { 
            cycles: 0, 
            pauses: 0, 
            phase: 'Ready', 
            studyStartTime: null, 
            totalStudyTime: 0,
            isRunning: false,
            playTime: 10,
            pauseTime: 4
        };
        updateTrackingDisplay(trackingData);
    }
    
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    }
    
    // Update study time every second when tracking is active
    setInterval(() => {
        if (trackingData.studyStartTime && (trackingData.phase === 'Playing' || trackingData.phase === 'Paused')) {
            const currentTime = Math.floor((Date.now() - trackingData.studyStartTime) / 1000);
            if (currentTime !== trackingData.totalStudyTime) {
                trackingData.totalStudyTime = currentTime;
                studyTime.textContent = formatTime(currentTime);
            }
        }
    }, 1000);
});