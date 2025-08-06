// UI Management
class UI {
    static elements = {
        startButton: document.getElementById('startButton'),
        stopButton: document.getElementById('stopButton'),
        clearButton: document.getElementById('clearButton'),
        cameraToggle: document.getElementById('cameraToggle'),
        promptToggle: document.getElementById('promptToggle'),
        voiceSelect: document.getElementById('voiceSelect'),
        transcript: document.getElementById('transcript'),
        status: document.getElementById('status'),
        error: document.getElementById('error'),
        imageContainer: document.getElementById('imageContainer'),
        contentWrapper: document.querySelector('.content-wrapper'),
        cameraContainer: document.getElementById('cameraContainer'),
        videoElement: document.getElementById('videoElement'),
        captureCanvas: document.getElementById('captureCanvas'),
        cameraStatus: document.getElementById('cameraStatus'),
        promptContainer: document.getElementById('promptContainer'),
        systemPrompt: document.getElementById('systemPrompt'),
        resetPrompt: document.getElementById('resetPrompt'),
        savePrompt: document.getElementById('savePrompt'),
        // Cost tracker elements
        visionCost: document.getElementById('visionCost'),
        visionCount: document.getElementById('visionCount'),
        sessionCost: document.getElementById('sessionCost'),
        sessionCount: document.getElementById('sessionCount'),
        realtimeCost: document.getElementById('realtimeCost'),
        realtimeMinutes: document.getElementById('realtimeMinutes'),
        totalCost: document.getElementById('totalCost'),
        resetCosts: document.getElementById('resetCosts')
    };

    static updateStatus(message) {
        this.elements.status.textContent = message;
    }

    static showError(message) {
        this.elements.error.style.display = 'block';
        this.elements.error.textContent = message;
    }

    static hideError() {
        this.elements.error.style.display = 'none';
    }

    static updateTranscript(message, type = 'assistant') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        messageDiv.textContent = message;
        
        if (this.elements.transcript.firstChild) {
            this.elements.transcript.insertBefore(messageDiv, this.elements.transcript.firstChild);
        } else {
            this.elements.transcript.appendChild(messageDiv);
        }
    }

    static clearConversation() {
        this.elements.transcript.innerHTML = '';
        this.elements.imageContainer.innerHTML = '';
        this.elements.contentWrapper.classList.remove('with-image');
        this.hideError();
        this.updateStatus('Ready to start');
        if (map) {
            map.remove();
            map = null;
        }
    }

    static updateButtons(isConnected) {
        this.elements.startButton.disabled = isConnected;
        this.elements.stopButton.disabled = !isConnected;
    }

    static displayImage(imageUrl, imageSource, query) {
        const sideContainer = document.querySelector('.side-container');
        const imageContainer = this.elements.imageContainer;
        
        if (!imageUrl) {
            imageContainer.innerHTML = '';
            this.elements.contentWrapper.classList.remove('with-image');
            // Recenter map after layout changes
            if (map) {
                setTimeout(() => {
                    map.invalidateSize();
                    const center = map.getCenter();
                    map.setView(center, map.getZoom());
                }, 100);
            }
            return;
        }

        this.elements.contentWrapper.classList.add('with-image');
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'image-wrapper';
        
        const img = document.createElement('img');
        img.className = 'search-image';
        img.alt = query;
        
        const loadingDiv = document.createElement('div');
        loadingDiv.textContent = 'Loading image...';
        loadingDiv.className = 'image-loading';
        imageWrapper.appendChild(loadingDiv);
        
        img.onload = () => {
            loadingDiv.remove();
            imageWrapper.appendChild(img);
            const caption = document.createElement('div');
            caption.className = 'image-caption';
            caption.innerHTML = `
                Image related to: ${query}<br>
                <a href="${imageSource}" target="_blank">Image source</a>
            `;
            imageWrapper.appendChild(caption);
        };
        
        img.onerror = () => {
            loadingDiv.textContent = 'Failed to load image';
            loadingDiv.className = 'image-error';
        };
        
        img.src = imageUrl;
        imageContainer.innerHTML = '';
        imageContainer.appendChild(imageWrapper);
    }

    static updateVoiceSelector(enabled) {
        this.elements.voiceSelect.disabled = !enabled;
    }
}

// Error Handler
class ErrorHandler {
    static handle(error, context) {
        console.error(`Error in ${context}:`, error);
        UI.showError(`Error ${context}: ${error.message}`);
    }
}

// Message Handler
class MessageHandler {
    static async handleTranscript(message) {
        const transcript = message.response?.output?.[0]?.content?.[0]?.transcript;
        if (transcript) {
            UI.updateTranscript(transcript);
        }
    }

    static async handleWeatherFunction(output) {
        try {
            const args = JSON.parse(output.arguments);
            const response = await fetch(`${CONFIG.API_ENDPOINTS.weather}/${encodeURIComponent(args.location)}`);
            const data = await response.json();
            
            // Format the current weather information
            const currentWeather = `Current Weather in ${args.location}:
${CONFIG.WEATHER_ICONS[data.weather_code] || '🌡️'} ${data.temperature}°${data.unit_temperature}
• Humidity: ${data.humidity}%
• Precipitation: ${data.precipitation}${data.unit_precipitation}
• Wind Speed: ${data.wind_speed}${data.unit_wind}`.trim();

            // Format the forecast information
            const forecast = data.forecast_daily.map(day => 
                `${new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}:
${CONFIG.WEATHER_ICONS[day.weather_code] || '🌡️'} High: ${day.max_temp}°${data.unit_temperature}
• Low: ${day.min_temp}°${data.unit_temperature}
• Precipitation: ${day.precipitation}${data.unit_precipitation}`.trim()
            ).join('\n\n');
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message function-result weather';
            
            // Add current weather
            const currentWeatherDiv = document.createElement('div');
            currentWeatherDiv.textContent = currentWeather;
            messageDiv.appendChild(currentWeatherDiv);
            
            // Add forecast toggle button
            const toggleButton = document.createElement('button');
            toggleButton.className = 'forecast-toggle';
            toggleButton.textContent = '7-Day Forecast';
            messageDiv.appendChild(toggleButton);
            
            // Add forecast content (hidden by default)
            const forecastDiv = document.createElement('div');
            forecastDiv.className = 'forecast-content';
            forecastDiv.textContent = forecast;
            messageDiv.appendChild(forecastDiv);
            
            // Add click handler for toggle
            toggleButton.addEventListener('click', () => {
                toggleButton.classList.toggle('expanded');
                forecastDiv.classList.toggle('expanded');
            });
            
            if (UI.elements.transcript.firstChild) {
                UI.elements.transcript.insertBefore(messageDiv, UI.elements.transcript.firstChild);
            } else {
                UI.elements.transcript.appendChild(messageDiv);
            }
            
            if (data.latitude && data.longitude) {
                updateMap(data.latitude, data.longitude, data.location_name);
            }
            
            return {
                temperature: data.temperature,
                humidity: data.humidity,
                precipitation: data.precipitation,
                wind_speed: data.wind_speed,
                forecast_daily: data.forecast_daily,
                current_time: data.current_time,
                location: args.location,
                latitude: data.latitude,
                longitude: data.longitude,
                location_name: data.location_name
            };
        } catch (error) {
            ErrorHandler.handle(error, 'Weather Function');
            return "Could not get weather data";
        }
    }

    static async handleSearchFunction(output) {
        try {
            const args = JSON.parse(output.arguments);
            const response = await fetch(`${CONFIG.API_ENDPOINTS.search}/${encodeURIComponent(args.query)}`);
            const data = await response.json();
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message function-result search';
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'result-title';
            const titleLink = document.createElement('a');
            titleLink.href = data.source;
            titleLink.target = '_blank';
            titleLink.rel = 'noopener noreferrer';
            titleLink.textContent = data.title;
            titleDiv.appendChild(titleLink);
            
            const snippetDiv = document.createElement('div');
            snippetDiv.className = 'result-snippet';
            snippetDiv.textContent = data.snippet;
            
            const sourceDiv = document.createElement('div');
            sourceDiv.className = 'result-source';
            const sourceLink = document.createElement('a');
            sourceLink.href = data.source;
            sourceLink.target = '_blank';
            sourceLink.rel = 'noopener noreferrer';
            sourceLink.textContent = data.source;
            sourceDiv.appendChild(sourceLink);
            
            messageDiv.appendChild(titleDiv);
            messageDiv.appendChild(snippetDiv);
            messageDiv.appendChild(sourceDiv);
            
            if (UI.elements.transcript.firstChild) {
                UI.elements.transcript.insertBefore(messageDiv, UI.elements.transcript.firstChild);
            } else {
                UI.elements.transcript.appendChild(messageDiv);
            }
            
            UI.displayImage(data.image_url, data.image_source, args.query);
            
            return {
                title: data.title,
                snippet: data.snippet,
                source: data.source,
                image_url: data.image_url,
                image_source: data.image_source
            };
        } catch (error) {
            ErrorHandler.handle(error, 'Search Function');
            return "Could not perform search";
        }
    }
}

// WebRTC Manager
class WebRTCManager {
    constructor(app) {
        this.peerConnection = null;
        this.audioStream = null;
        this.dataChannel = null;
        this.app = app;  // Store reference to the app
    }
    

    async setupAudio() {
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        this.peerConnection.ontrack = e => audioEl.srcObject = e.streams[0];
        
        this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.peerConnection.addTrack(this.audioStream.getTracks()[0]);
    }

    setupDataChannel() {
        this.dataChannel = this.peerConnection.createDataChannel('oai-events');
        this.dataChannel.onopen = () => this.onDataChannelOpen();
        this.dataChannel.addEventListener('message', (event) => this.handleMessage(event));
    }

    async handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('Received message:', message);
            
            if (message.type === 'response.done') {
                await MessageHandler.handleTranscript(message);
                const output = message.response?.output?.[0];
                if (output?.type === 'function_call' && output?.call_id) {
                    let result;
                    if (output.name === 'get_weather') {
                        result = await MessageHandler.handleWeatherFunction(output);
                    } else if (output.name === 'search_web') {
                        result = await MessageHandler.handleSearchFunction(output);
                    }
                    
                    if (result) {
                        this.sendFunctionOutput(output.call_id, result);
                        this.sendResponseCreate();
                    }
                }
            }
        } catch (error) {
            ErrorHandler.handle(error, 'Message Processing');
        }
    }

    sendMessage(message) {
        if (this.dataChannel?.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(message));
            console.log('Sent message:', message);
        }
    }

    sendSessionUpdate() {
        this.sendMessage({
            type: "session.update",
            session: {
                voice: this.app.currentVoice,
                tools: CONFIG.TOOLS,
                tool_choice: "auto"
            }
        });
    }

    sendInitialMessage() {
        this.sendMessage({
            type: 'conversation.item.create',
            previous_item_id: null,
            item: {
                id: 'msg_' + Date.now(),
                type: 'message',
                role: 'user',
                content: [{
                    type: 'input_text',
                    text: CONFIG.INITIAL_MESSAGE.text
                }]
            }
        });
    }

    sendFunctionOutput(callId, data) {
        this.sendMessage({
            type: 'conversation.item.create',
            item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify(data)
            }
        });
    }

    sendResponseCreate() {
        this.sendMessage({ type: 'response.create' });
    }

    onDataChannelOpen() {
        this.sendSessionUpdate();
        this.sendInitialMessage();
    }

    cleanup() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
    }
}

// Camera Management
class Camera {
    constructor() {
        this.stream = null;
        this.isActive = false;
        this.captureInterval = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        UI.elements.cameraToggle.addEventListener('click', () => this.toggle());
    }

    async toggle() {
        if (this.isActive) {
            this.stop();
        } else {
            await this.start();
        }
    }

    async start() {
        try {
            UI.elements.cameraToggle.textContent = '📹 Starting...';
            UI.elements.cameraToggle.disabled = true;

            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 640 }, 
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });

            UI.elements.videoElement.srcObject = this.stream;
            UI.elements.cameraContainer.style.display = 'block';
            
            this.isActive = true;
            UI.elements.cameraToggle.textContent = '📹 Stop Camera';
            UI.elements.cameraToggle.classList.add('active');
            UI.elements.cameraToggle.disabled = false;
            
            UI.elements.cameraStatus.textContent = 'Camera active';
            
            // Start capturing frames every 4 seconds
            this.startFrameCapture();
            
        } catch (error) {
            console.error('Error accessing camera:', error);
            UI.showError('Could not access camera. Please check permissions.');
            UI.elements.cameraToggle.textContent = '📹 Enable Camera';
            UI.elements.cameraToggle.disabled = false;
        }
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }

        UI.elements.cameraContainer.style.display = 'none';
        this.isActive = false;
        UI.elements.cameraToggle.textContent = '📹 Enable Camera';
        UI.elements.cameraToggle.classList.remove('active');
        UI.elements.cameraStatus.textContent = 'Camera ready';
    }

    startFrameCapture() {
        // Capture frame immediately, then every 4 seconds
        this.captureFrame();
        this.captureInterval = setInterval(() => {
            this.captureFrame();
        }, 2000);
    }

    async captureFrame() {
        if (!this.isActive || !this.stream) return;

        try {
            const canvas = UI.elements.captureCanvas;
            const ctx = canvas.getContext('2d');
            const video = UI.elements.videoElement;

            // Set canvas size to match video
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;

            // Draw current frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Convert to base64
            const dataURL = canvas.toDataURL('image/jpeg', 0.8);
            const base64Data = dataURL.split(',')[1];

            // Show capture indicator
            UI.elements.cameraContainer.classList.add('capturing');
            UI.elements.cameraStatus.textContent = 'Processing frame...';
            
            // Send to vision API
            await this.processFrame(base64Data);

            // Remove capture indicator
            setTimeout(() => {
                UI.elements.cameraContainer.classList.remove('capturing');
                UI.elements.cameraStatus.textContent = 'Camera active';
            }, 1000);

        } catch (error) {
            console.error('Error capturing frame:', error);
            UI.elements.cameraStatus.textContent = 'Capture error';
        }
    }

    async processFrame(base64Image) {
        try {
            const response = await fetch(`${CONFIG.API_ENDPOINTS.vision}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: base64Image,
                    prompt: 'Describe what you see in this image briefly and clearly'
                })
            });

            if (!response.ok) {
                throw new Error('Vision API request failed');
            }

            const result = await response.json();
            
            // Track the cost of this vision API call
            if (window.app && window.app.costTracker) {
                window.app.costTracker.trackVisionCall();
            }
            
            // Inject vision context into the conversation
            this.injectVisionContext(result.description);

        } catch (error) {
            console.error('Error processing frame:', error);
            // Don't show UI error for vision failures - just log them
        }
    }

    injectVisionContext(description) {
        // Use the WebRTC data channel to send context to the voice session
        if (window.app && window.app.webrtc && window.app.webrtc.dataChannel) {
            // Get the base prompt from the prompt manager
            const basePrompt = window.app.promptManager.getCurrentPrompt();
            
            // Create enhanced instructions that preserve the core prompt
            const enhancedInstructions = `${basePrompt}

---

**CURRENT VISUAL CONTEXT:**
I can currently see: ${description}

**VISUAL INTEGRATION RULES:**
- Use this visual context to inform your tea-making guidance
- If you see tea-making objects (kettle, mug, spoon, tea bag), acknowledge them naturally
- Detect tea-making steps from visual cues (pouring, stirring, holding items)
- Only mention what you see if it's relevant to helping with tea-making
- Don't narrate every visual detail - focus on actionable guidance
- Do not hallucinate or make up information, only use the visual context to inform your responses`;

            const contextMessage = {
                type: 'session.update',
                session: {
                    instructions: enhancedInstructions,
                    input_audio_transcription: { model: 'whisper-1' }
                }
            };
            
            try {
                window.app.webrtc.dataChannel.send(JSON.stringify(contextMessage));
                console.log('Vision context injected:', description);
                
                // Optionally show in UI for debugging
                const contextDiv = document.createElement('div');
                contextDiv.className = 'message function-result';
                contextDiv.textContent = `👁️ Visual context: ${description}`;
                UI.elements.transcript.insertBefore(contextDiv, UI.elements.transcript.firstChild);
                
            } catch (error) {
                console.error('Error injecting vision context:', error);
            }
        }
    }
}

// Cost Tracking Management
class CostTracker {
    constructor() {
        // Current OpenAI API pricing (approximate)
        this.pricing = {
            vision: 0.00765,      // $0.00765 per image (GPT-4V low detail)
            session: 0.001,       // $0.001 per session establishment  
            realtimePerMinute: 0.06  // $0.06 per minute for realtime audio
        };
        
        this.costs = this.loadCosts();
        this.sessionStartTime = null;
        this.setupEventListeners();
        this.updateUI();
    }

    setupEventListeners() {
        UI.elements.resetCosts.addEventListener('click', () => this.resetCosts());
    }

    loadCosts() {
        const saved = localStorage.getItem('apiCosts');
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            visionCalls: 0,
            visionCost: 0,
            sessionCalls: 0,
            sessionCost: 0,
            realtimeMinutes: 0,
            realtimeCost: 0
        };
    }

    saveCosts() {
        localStorage.setItem('apiCosts', JSON.stringify(this.costs));
    }

    trackVisionCall() {
        this.costs.visionCalls++;
        this.costs.visionCost += this.pricing.vision;
        this.saveCosts();
        this.updateUI();
        
        console.log(`💰 Vision API call: +$${this.pricing.vision.toFixed(4)} (Total: $${this.costs.visionCost.toFixed(4)})`);
    }

    trackSessionCall() {
        this.costs.sessionCalls++;
        this.costs.sessionCost += this.pricing.session;
        this.saveCosts();
        this.updateUI();
        
        console.log(`💰 Session API call: +$${this.pricing.session.toFixed(4)} (Total: $${this.costs.sessionCost.toFixed(4)})`);
    }

    startRealtimeSession() {
        this.sessionStartTime = Date.now();
        console.log('💰 Realtime session started - tracking audio usage');
    }

    endRealtimeSession() {
        if (this.sessionStartTime) {
            const duration = (Date.now() - this.sessionStartTime) / 1000 / 60; // minutes
            const cost = duration * this.pricing.realtimePerMinute;
            
            this.costs.realtimeMinutes += duration;
            this.costs.realtimeCost += cost;
            this.saveCosts();
            this.updateUI();
            
            console.log(`💰 Realtime session ended: +${duration.toFixed(2)} min, +$${cost.toFixed(4)}`);
            this.sessionStartTime = null;
        }
    }

    updateUI() {
        UI.elements.visionCost.textContent = `$${this.costs.visionCost.toFixed(4)}`;
        UI.elements.visionCount.textContent = this.costs.visionCalls;
        
        UI.elements.sessionCost.textContent = `$${this.costs.sessionCost.toFixed(4)}`;
        UI.elements.sessionCount.textContent = this.costs.sessionCalls;
        
        UI.elements.realtimeCost.textContent = `$${this.costs.realtimeCost.toFixed(4)}`;
        UI.elements.realtimeMinutes.textContent = this.costs.realtimeMinutes.toFixed(1);
        
        const total = this.costs.visionCost + this.costs.sessionCost + this.costs.realtimeCost;
        UI.elements.totalCost.textContent = `$${total.toFixed(4)}`;
        
        // Update in real-time if session is active
        if (this.sessionStartTime) {
            const currentDuration = (Date.now() - this.sessionStartTime) / 1000 / 60;
            const estimatedCost = currentDuration * this.pricing.realtimePerMinute;
            const liveTotal = total + estimatedCost;
            UI.elements.totalCost.textContent = `$${liveTotal.toFixed(4)}`;
            UI.elements.realtimeMinutes.textContent = (this.costs.realtimeMinutes + currentDuration).toFixed(1);
        }
    }

    resetCosts() {
        if (confirm('Are you sure you want to reset all cost tracking? This cannot be undone.')) {
            this.costs = {
                visionCalls: 0,
                visionCost: 0,
                sessionCalls: 0,
                sessionCost: 0,
                realtimeMinutes: 0,
                realtimeCost: 0
            };
            this.saveCosts();
            this.updateUI();
            UI.updateStatus('Cost tracking reset');
            console.log('💰 Cost tracking reset');
        }
    }

    // Start live updates when realtime is active
    startLiveUpdates() {
        if (this.liveUpdateInterval) return;
        
        this.liveUpdateInterval = setInterval(() => {
            if (this.sessionStartTime) {
                this.updateUI();
            }
        }, 1000); // Update every second during active session
    }

    stopLiveUpdates() {
        if (this.liveUpdateInterval) {
            clearInterval(this.liveUpdateInterval);
            this.liveUpdateInterval = null;
        }
    }
}

// System Prompt Management
class PromptManager {
    constructor() {
        this.currentPrompt = CONFIG.DEFAULT_SYSTEM_PROMPT;
        this.isVisible = false;
        this.setupEventListeners();
        this.initializePrompt();
    }

    setupEventListeners() {
        UI.elements.promptToggle.addEventListener('click', () => this.toggle());
        UI.elements.resetPrompt.addEventListener('click', () => this.reset());
        UI.elements.savePrompt.addEventListener('click', () => this.save());
    }

    initializePrompt() {
        // Load saved prompt from localStorage or use default
        const savedPrompt = localStorage.getItem('systemPrompt');
        if (savedPrompt) {
            this.currentPrompt = savedPrompt;
        }
        UI.elements.systemPrompt.value = this.currentPrompt;
    }

    toggle() {
        this.isVisible = !this.isVisible;
        UI.elements.promptContainer.style.display = this.isVisible ? 'block' : 'none';
        UI.elements.promptToggle.classList.toggle('active', this.isVisible);
        UI.elements.promptToggle.textContent = this.isVisible ? '⚙️ Hide System Prompt' : '⚙️ Customize System Prompt';
    }

    reset() {
        UI.elements.systemPrompt.value = CONFIG.DEFAULT_SYSTEM_PROMPT;
        this.currentPrompt = CONFIG.DEFAULT_SYSTEM_PROMPT;
        localStorage.removeItem('systemPrompt');
        UI.updateStatus('System prompt reset to default');
    }

    save() {
        const newPrompt = UI.elements.systemPrompt.value.trim();
        if (newPrompt) {
            this.currentPrompt = newPrompt;
            localStorage.setItem('systemPrompt', newPrompt);
            UI.updateStatus('System prompt saved successfully');
        } else {
            UI.showError('System prompt cannot be empty');
        }
    }

    getCurrentPrompt() {
        return this.currentPrompt;
    }
}

// Main Application
class App {
    constructor() {
        this.webrtc = null;
        this.currentVoice = CONFIG.VOICE;
        this.camera = new Camera();
        this.promptManager = new PromptManager();
        this.costTracker = new CostTracker();
        this.bindEvents();
    }

    bindEvents() {
        UI.elements.startButton.addEventListener('click', () => this.init());
        UI.elements.stopButton.addEventListener('click', () => this.stop());
        UI.elements.clearButton.addEventListener('click', () => UI.clearConversation());
        UI.elements.voiceSelect.addEventListener('change', (e) => {
            if (!this.webrtc) {
                this.currentVoice = e.target.value;
            } else {
                e.target.value = this.currentVoice;
            }
        });
        document.addEventListener('DOMContentLoaded', () => {
            UI.updateStatus('Ready to start');
            UI.elements.voiceSelect.value = this.currentVoice;
        });
    }

    async init() {
        UI.elements.startButton.disabled = true;
        UI.updateVoiceSelector(false);
        
        try {
            UI.updateStatus('Initializing...');
            
            const tokenResponse = await fetch(`${CONFIG.API_ENDPOINTS.session}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    voice: this.currentVoice,
                    instructions: this.promptManager.getCurrentPrompt()
                })
            });
            if (!tokenResponse.ok) {
                throw new Error('Could not establish session');
            }

            const data = await tokenResponse.json();
            if (!data.client_secret?.value) {
                throw new Error('Could not establish session');
            }

            // Track session establishment cost
            this.costTracker.trackSessionCall();

            const EPHEMERAL_KEY = data.client_secret.value;

            this.webrtc = new WebRTCManager(this);
            this.webrtc.peerConnection = new RTCPeerConnection();
            await this.webrtc.setupAudio();
            this.webrtc.setupDataChannel();

            const offer = await this.webrtc.peerConnection.createOffer();
            await this.webrtc.peerConnection.setLocalDescription(offer);

            const sdpResponse = await fetch(`${CONFIG.API_ENDPOINTS.realtime}?model=${CONFIG.MODEL}`, {
                method: 'POST',
                body: offer.sdp,
                headers: {
                    Authorization: `Bearer ${EPHEMERAL_KEY}`,
                    'Content-Type': 'application/sdp'
                },
            });
            
            if (!sdpResponse.ok) {
                throw new Error('Could not establish connection');
            }

            const sdpText = await sdpResponse.text();
            if (!sdpText) {
                throw new Error('Could not establish connection');
            }

            const answer = {
                type: 'answer',
                sdp: sdpText,
            };
            await this.webrtc.peerConnection.setRemoteDescription(answer);

            UI.updateStatus('Connected');
            UI.updateButtons(true);
            UI.updateVoiceSelector(true);
            UI.hideError();
            
            // Start tracking realtime session
            this.costTracker.startRealtimeSession();
            this.costTracker.startLiveUpdates();

        } catch (error) {
            UI.updateButtons(false);
            UI.updateVoiceSelector(true);
            ErrorHandler.handle(error, 'Initialization');
            UI.updateStatus('Failed to connect');
        }
    }

    stop() {
        if (this.webrtc) {
            this.webrtc.cleanup();
            this.webrtc = null;
        }
        
        // Stop tracking realtime session
        this.costTracker.endRealtimeSession();
        this.costTracker.stopLiveUpdates();
        
        UI.updateButtons(false);
        UI.updateVoiceSelector(true);
        UI.updateStatus('Ready to start');
    }
}

let map = null;

function updateMap(latitude, longitude, locationName) {
    if (!map) {
        map = L.map('map').setView([latitude, longitude], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    } else {
        map.setView([latitude, longitude], 10);
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });
    }
    
    L.marker([latitude, longitude])
        .addTo(map)
        .bindPopup(locationName)
        .openPopup();

    // Force map to recalculate its container size
    setTimeout(() => {
        map.invalidateSize();
        map.setView([latitude, longitude], 10);
    }, 100);
}

// Initialize the application
const app = new App();
window.app = app; // Expose globally for camera access 