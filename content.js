(function() {
    'use strict';
    
    let isRunning = false;
    let currentTimeout = null;
    let playTime = 10;
    let pauseTime = 4;
    let trackingData = {
        cycles: 0,
        pauses: 0,
        phase: 'Ready',
        progress: 0,
        studyStartTime: null,
        totalStudyTime: 0,
        isRunning: false,
        playTime: 10,
        pauseTime: 4
    };
    let phaseStartTime = 0;
    let currentPhaseLength = 0;
    let progressUpdateInterval = null;
    
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        console.log('CodioPause: Message received:', request);
        
        if (request.action === 'start') {
            playTime = request.playTime || 10;
            pauseTime = request.pauseTime || 4;
            
            const success = startAutoCycle();
            sendResponse({success: success});
            
        } else if (request.action === 'stop') {
            stopAutoCycle();
            sendResponse({success: true});
            
        } else if (request.action === 'getStatus') {
            // Return current state to popup
            trackingData.isRunning = isRunning;
            trackingData.playTime = playTime;
            trackingData.pauseTime = pauseTime;
            
            // Update total study time if running
            if (trackingData.studyStartTime && isRunning) {
                trackingData.totalStudyTime = Math.floor((Date.now() - trackingData.studyStartTime) / 1000);
            }
            
            sendResponse({data: trackingData});
        }
        
        return true;
    });
    
    function getYouTubeVideo() {
        return document.querySelector('video');
    }
    
    function updateTracking(phase, progress = 0) {
        trackingData.phase = phase;
        trackingData.progress = progress;
        trackingData.isRunning = isRunning;
        trackingData.playTime = playTime;
        trackingData.pauseTime = pauseTime;
        
        // Update study time
        if (trackingData.studyStartTime && isRunning) {
            trackingData.totalStudyTime = Math.floor((Date.now() - trackingData.studyStartTime) / 1000);
        }
        
        // Send update to popup (if open)
        chrome.runtime.sendMessage({
            action: 'updateTracking',
            data: trackingData
        }).catch(() => {
            // Popup might be closed, ignore error
        });
    }
    
    function startAutoCycle() {
        const video = getYouTubeVideo();
        if (!video) {
            console.log('CodioPause: No YouTube video found');
            return false;
        }
        
        if (isRunning) {
            stopAutoCycle();
        }
        
        isRunning = true;
        
        // Only reset tracking data if starting fresh
        if (trackingData.phase === 'Ready' || trackingData.phase === 'Stopped') {
            trackingData = { 
                cycles: 0, 
                pauses: 0, 
                phase: 'Ready', 
                progress: 0,
                studyStartTime: Date.now(),
                totalStudyTime: 0,
                isRunning: true,
                playTime: playTime,
                pauseTime: pauseTime
            };
        } else {
            // Resume existing session
            isRunning = true;
            trackingData.isRunning = true;
        }
        
        console.log(`CodioPause: Starting auto cycle: Play ${playTime}s, Pause ${pauseTime}s`);
        
        // Start the cycle
        runCycle();
        return true;
    }
    
    function runCycle() {
        if (!isRunning) return;
        
        const video = getYouTubeVideo();
        if (!video) {
            console.log('CodioPause: Video not found, stopping cycle');
            stopAutoCycle();
            return;
        }
        
        // Play phase
        console.log(`CodioPause: Playing for ${playTime} seconds`);
        video.play();
        trackingData.cycles++;
        updateTracking('Playing', 0);
        
        phaseStartTime = Date.now();
        currentPhaseLength = playTime * 1000;
        
        // Clear any existing progress interval
        if (progressUpdateInterval) {
            clearInterval(progressUpdateInterval);
        }
        
        // Update progress during play phase
        progressUpdateInterval = setInterval(function() {
            if (!isRunning || trackingData.phase !== 'Playing') {
                clearInterval(progressUpdateInterval);
                progressUpdateInterval = null;
                return;
            }
            
            const elapsed = Date.now() - phaseStartTime;
            const progress = Math.min((elapsed / currentPhaseLength) * 100, 100);
            updateTracking('Playing', progress);
        }, 100);
        
        currentTimeout = setTimeout(function() {
            if (progressUpdateInterval) {
                clearInterval(progressUpdateInterval);
                progressUpdateInterval = null;
            }
            
            if (!isRunning) return;
            
            // Pause phase
            console.log(`CodioPause: Pausing for ${pauseTime} seconds`);
            video.pause();
            trackingData.pauses++;
            updateTracking('Paused', 0);
            
            phaseStartTime = Date.now();
            currentPhaseLength = pauseTime * 1000;
            
            // Update progress during pause phase
            progressUpdateInterval = setInterval(function() {
                if (!isRunning || trackingData.phase !== 'Paused') {
                    clearInterval(progressUpdateInterval);
                    progressUpdateInterval = null;
                    return;
                }
                
                const elapsed = Date.now() - phaseStartTime;
                const progress = Math.min((elapsed / currentPhaseLength) * 100, 100);
                updateTracking('Paused', progress);
            }, 100);
            
            currentTimeout = setTimeout(function() {
                if (progressUpdateInterval) {
                    clearInterval(progressUpdateInterval);
                    progressUpdateInterval = null;
                }
                if (!isRunning) return;
                runCycle(); // Continue the cycle
            }, pauseTime * 1000);
            
        }, playTime * 1000);
    }
    
    function stopAutoCycle() {
        console.log('CodioPause: Stopping auto cycle');
        isRunning = false;
        
        if (currentTimeout) {
            clearTimeout(currentTimeout);
            currentTimeout = null;
        }
        
        if (progressUpdateInterval) {
            clearInterval(progressUpdateInterval);
            progressUpdateInterval = null;
        }
        
        trackingData.phase = 'Stopped';
        trackingData.progress = 0;
        trackingData.isRunning = false;
        
        // Keep study time when stopped, don't reset it
        updateTracking('Stopped', 0);
    }
    
    // Stop cycle if video ends
    function setupVideoListener() {
        const video = getYouTubeVideo();
        if (video && !video.hasAttribute('data-codiopause-listener')) {
            video.setAttribute('data-codiopause-listener', 'true');
            video.addEventListener('ended', function() {
                if (isRunning) {
                    console.log('CodioPause: Video ended, stopping cycle');
                    stopAutoCycle();
                }
            });
        }
    }
    
    // Setup listener when page loads
    function initialize() {
        console.log('CodioPause: Initializing...');
        setupVideoListener();
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // Handle YouTube navigation (single page app)
    let currentUrl = window.location.href;
    setInterval(function() {
        if (window.location.href !== currentUrl) {
            currentUrl = window.location.href;
            setTimeout(initialize, 1000); // Wait for video to load
        }
    }, 1000);
    
    // Clean up on page unload
    window.addEventListener('beforeunload', function() {
        stopAutoCycle();
    });
    
    // Keep updating study time even when popup is closed
    setInterval(() => {
        if (trackingData.studyStartTime && isRunning) {
            trackingData.totalStudyTime = Math.floor((Date.now() - trackingData.studyStartTime) / 1000);
        }
    }, 1000);
    
})();