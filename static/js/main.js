// Global variables
let socket
const currentUser = null
const io = window.io // Declare the io variable
const webkitAudioContext = window.webkitAudioContext // Declare the webkitAudioContext variable

// Audio elements for ringtones
let ringtoneAudio = null
let notificationAudio = null
let currentIncomingCall = null
let isRingtonePlaying = false

// Initialize socket connection
function initSocket() {
  socket = io()

  socket.on("connect", () => {
    console.log("Connected to server")
    // Join user-specific room for incoming call notifications
    socket.emit("join_user_room")
  })

  socket.on("disconnect", () => {
    console.log("Disconnected from server")
  })

  // Handle incoming call notifications
  socket.on("incoming_call_notification", (data) => {
    console.log("Incoming call notification received:", data)
    handleIncomingCall(data)
  })

  socket.on("call_answered", (data) => {
    handleCallAnswered(data)
  })

  socket.on("call_rejected", (data) => {
    handleCallRejected(data)
  })

  // Handle call termination events
  socket.on("call_terminated", (data) => {
    handleCallTermination(data)
  })

  socket.on("user_disconnected", (data) => {
    handleUserDisconnected(data)
  })
}

// Utility functions
function showMessage(message, type = "info") {
  const messageEl = document.getElementById("message")
  if (messageEl) {
    messageEl.textContent = message
    messageEl.className = `message ${type}`
    messageEl.style.display = "block"

    setTimeout(() => {
      messageEl.style.display = "none"
    }, 5000)
  }

  // Also show as browser notification
  showBrowserNotification(message, type)
}

function showBrowserNotification(message, type) {
  // Create a temporary notification element
  const notification = document.createElement("div")
  notification.className = `notification ${type}`
  notification.innerHTML = `
    <div class="notification-content">
      <i class="fas ${type === "success" ? "fa-check-circle" : type === "error" ? "fa-exclamation-circle" : "fa-info-circle"}"></i>
      <span>${message}</span>
    </div>
  `

  document.body.appendChild(notification)

  // Remove after 4 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification)
    }
  }, 4000)
}

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString() + " " + date.toLocaleTimeString()
}

// Initialize audio elements
function initAudio() {
  console.log("Initializing audio...")

  // Create ringtone audio element
  ringtoneAudio = new Audio()
  ringtoneAudio.src = "/static/audio/ringtone.mp3"
  ringtoneAudio.loop = true
  ringtoneAudio.volume = 0.8
  ringtoneAudio.preload = "auto"

  // Create notification audio element
  notificationAudio = new Audio()
  notificationAudio.src = "/static/audio/notification.mp3"
  notificationAudio.volume = 0.6
  notificationAudio.preload = "auto"

  // Test if audio can be loaded
  ringtoneAudio.addEventListener("canplaythrough", () => {
    console.log("Ringtone audio loaded successfully")
  })

  ringtoneAudio.addEventListener("error", (e) => {
    console.error("Error loading ringtone:", e)
    // Fallback to system beep or alternative
    createFallbackRingtone()
  })

  // Handle audio play promise
  ringtoneAudio.addEventListener("play", () => {
    console.log("Ringtone started playing")
    isRingtonePlaying = true
  })

  ringtoneAudio.addEventListener("pause", () => {
    console.log("Ringtone stopped")
    isRingtonePlaying = false
  })
}

// Create fallback ringtone using Web Audio API
function createFallbackRingtone() {
  console.log("Creating fallback ringtone...")

  if (typeof AudioContext !== "undefined" || typeof webkitAudioContext !== "undefined") {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    const audioContext = new AudioContext()

    window.playFallbackRingtone = () => {
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)

      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.5)

      // Repeat every second
      if (isRingtonePlaying) {
        setTimeout(() => {
          if (isRingtonePlaying) {
            window.playFallbackRingtone()
          }
        }, 1000)
      }
    }
  }
}

// Play ringtone with multiple fallback methods
function playRingtone() {
  console.log("Attempting to play ringtone...")
  isRingtonePlaying = true

  if (ringtoneAudio) {
    // Method 1: Try to play the audio file
    const playPromise = ringtoneAudio.play()

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log("Ringtone playing successfully")
          showRingtoneIndicator()
        })
        .catch((error) => {
          console.error("Error playing ringtone:", error)
          // Fallback methods
          tryFallbackRingtone()
        })
    }
  } else {
    tryFallbackRingtone()
  }
}

// Try fallback ringtone methods
function tryFallbackRingtone() {
  console.log("Trying fallback ringtone methods...")

  // Method 2: Try notification audio
  if (notificationAudio) {
    const playNotification = () => {
      if (isRingtonePlaying) {
        notificationAudio.play().catch(console.error)
        setTimeout(playNotification, 1000)
      }
    }
    playNotification()
  }

  // Method 3: Web Audio API fallback
  if (window.playFallbackRingtone) {
    window.playFallbackRingtone()
  }

  // Method 4: Visual and vibration alerts
  showRingtoneIndicator()

  // Try device vibration if available
  if (navigator.vibrate) {
    const vibratePattern = () => {
      if (isRingtonePlaying) {
        navigator.vibrate([200, 100, 200, 100, 200])
        setTimeout(vibratePattern, 1000)
      }
    }
    vibratePattern()
  }
}

// Stop ringtone
function stopRingtone() {
  console.log("Stopping ringtone...")
  isRingtonePlaying = false

  if (ringtoneAudio) {
    ringtoneAudio.pause()
    ringtoneAudio.currentTime = 0
  }

  if (notificationAudio) {
    notificationAudio.pause()
    notificationAudio.currentTime = 0
  }

  hideRingtoneIndicator()
}

// Show ringtone indicator
function showRingtoneIndicator() {
  let indicator = document.getElementById("ringtone-indicator")
  if (!indicator) {
    indicator = document.createElement("div")
    indicator.id = "ringtone-indicator"
    indicator.className = "ringtone-indicator"
    indicator.innerHTML = `
      <i class="fas fa-bell"></i>
      <span>Incoming Call...</span>
    `
    document.body.appendChild(indicator)
  }
  indicator.style.display = "block"
}

// Hide ringtone indicator
function hideRingtoneIndicator() {
  const indicator = document.getElementById("ringtone-indicator")
  if (indicator) {
    indicator.style.display = "none"
  }
}

// Handle incoming call notification
function handleIncomingCall(data) {
  console.log("Handling incoming call from:", data.caller_name)
  currentIncomingCall = data

  // Play ringtone immediately
  playRingtone()

  // Show incoming call modal
  showIncomingCallModal(data)

  // Show browser notification if supported
  if (Notification.permission === "granted") {
    new Notification(`Incoming call from ${data.caller_name}`, {
      icon: "/static/images/call-icon.png",
      body: "Click to answer or decline the call",
      requireInteraction: true,
    })
  } else if (Notification.permission === "default") {
    // Request permission and show notification
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification(`Incoming call from ${data.caller_name}`, {
          icon: "/static/images/call-icon.png",
          body: "Click to answer or decline the call",
          requireInteraction: true,
        })
      }
    })
  }
}

// Show incoming call modal
function showIncomingCallModal(callData) {
  const modal = document.getElementById("incoming-call-modal")
  const callerName = document.getElementById("caller-name")

  if (modal && callerName) {
    callerName.textContent = callData.caller_name
    modal.style.display = "block"

    // Add event listeners for answer/reject buttons
    const answerBtn = document.getElementById("answer-call-btn")
    const rejectBtn = document.getElementById("reject-call-btn")

    if (answerBtn) {
      answerBtn.onclick = () => answerCall(callData.session_id)
    }

    if (rejectBtn) {
      rejectBtn.onclick = () => rejectCall(callData.session_id)
    }
  }
}

// Answer incoming call
async function answerCall(sessionId) {
  try {
    console.log("Answering call...")

    // Stop ringtone immediately
    stopRingtone()

    // Update call status
    await fetch(`/api/answer-call/${sessionId}`, { method: "POST" })

    // Notify caller
    socket.emit("call_answered", { session_id: sessionId })

    // Hide incoming call modal
    const modal = document.getElementById("incoming-call-modal")
    if (modal) {
      modal.style.display = "none"
    }

    // Start video call
    startVideoCall(sessionId)

    currentIncomingCall = null
    showMessage("Call answered!", "success")
  } catch (error) {
    console.error("Error answering call:", error)
    showMessage("Error answering call", "error")
  }
}

// Reject incoming call
async function rejectCall(sessionId) {
  try {
    console.log("Rejecting call...")

    // Stop ringtone immediately
    stopRingtone()

    // Update call status
    await fetch(`/api/reject-call/${sessionId}`, { method: "POST" })

    // Notify all participants that call was declined - this will end the call for both users
    socket.emit("call_declined", { session_id: sessionId })

    // Hide incoming call modal
    const modal = document.getElementById("incoming-call-modal")
    if (modal) {
      modal.style.display = "none"
    }

    // End any active video call
    if (window.videoCall) {
      window.videoCall.endCall()
    }

    currentIncomingCall = null
    showMessage("Call declined", "info")
  } catch (error) {
    console.error("Error rejecting call:", error)
    showMessage("Error rejecting call", "error")
  }
}

// Handle call answered by callee
function handleCallAnswered(data) {
  showMessage("Call answered!", "success")
  // The video call should already be initiated
}

// Handle call rejected by callee
function handleCallRejected(data) {
  console.log("Call was rejected - ending call for both users")

  // Stop ringtone
  stopRingtone()

  // End video call immediately
  if (window.videoCall) {
    window.videoCall.endCall()
  }

  // Hide all call-related modals
  const callModal = document.getElementById("call-modal")
  const incomingModal = document.getElementById("incoming-call-modal")

  if (callModal) {
    callModal.style.display = "none"
  }

  if (incomingModal) {
    incomingModal.style.display = "none"
  }

  showMessage("Call was declined", "error")
}

// Request notification permission
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().then((permission) => {
      console.log("Notification permission:", permission)
    })
  }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("Initializing app...")
  initSocket()
  initAudio()
  requestNotificationPermission()

  // Check if user is on dashboard page
  if (document.getElementById("users-list")) {
    loadUsers()
  }

  // Add click handler to enable audio context (required by some browsers)
  document.addEventListener("click", enableAudioContext, { once: true })
  document.addEventListener("touchstart", enableAudioContext, { once: true })
})

// Enable audio context on first user interaction
function enableAudioContext() {
  console.log("Enabling audio context...")
  if (ringtoneAudio) {
    // Try to play and immediately pause to enable audio
    ringtoneAudio
      .play()
      .then(() => {
        ringtoneAudio.pause()
        ringtoneAudio.currentTime = 0
        console.log("Audio context enabled")
      })
      .catch(console.error)
  }
}

// Load available users for calling
async function loadUsers() {
  try {
    const response = await fetch("/api/users")
    const users = await response.json()

    const usersList = document.getElementById("users-list")
    usersList.innerHTML = ""

    users.forEach((user) => {
      const userCard = document.createElement("div")
      userCard.className = "user-card"
      userCard.innerHTML = `
                <i class="fas fa-user-circle"></i>
                <h3>${user.username}</h3>
                <p>Available for call</p>
            `

      userCard.addEventListener("click", () => initiateCall(user.id, user.username))
      usersList.appendChild(userCard)
    })

    if (users.length === 0) {
      usersList.innerHTML = "<p>No other users available for calling.</p>"
    }
  } catch (error) {
    console.error("Error loading users:", error)
    showMessage("Error loading users", "error")
  }
}

// Initiate a call with another user
async function initiateCall(userId, username) {
  try {
    console.log(`Initiating call to user ${userId} (${username})`)

    const response = await fetch(`/api/call/${userId}`)
    const data = await response.json()

    if (data.session_id) {
      showMessage(`Calling ${username}...`, "success")

      // Get current user info for the call
      const currentUsername =
        document.querySelector(".nav-user")?.textContent?.replace("Welcome, ", "") || "Unknown User"

      // Notify the callee about incoming call
      socket.emit("incoming_call", {
        session_id: data.session_id,
        callee_id: userId,
        caller_name: currentUsername,
      })

      startVideoCall(data.session_id)
    }
  } catch (error) {
    console.error("Error initiating call:", error)
    showMessage("Error starting call", "error")
  }
}

// Start video call interface
function startVideoCall(sessionId) {
  const modal = document.getElementById("call-modal")
  if (modal) {
    modal.style.display = "block"
    // Add fullscreen class for larger video
    modal.classList.add("fullscreen-call")
  }

  // Initialize WebRTC for this session
  if (window.videoCall) {
    window.videoCall.startCall(sessionId)
  }
}

// Handle call termination (end, decline, busy, etc.)
function handleCallTermination(data) {
  console.log("Call terminated:", data.reason)

  // Stop ringtone if playing
  stopRingtone()

  // Hide incoming call modal
  const incomingModal = document.getElementById("incoming-call-modal")
  if (incomingModal) {
    incomingModal.style.display = "none"
  }

  // End video call if active
  if (window.videoCall) {
    window.videoCall.endCall()
  }

  // Show appropriate message based on reason
  let message = ""
  let messageType = "info"

  switch (data.reason) {
    case "ended":
      message = "Call ended"
      messageType = "info"
      break
    case "declined":
      message = "Call was declined"
      messageType = "error"
      break
    case "busy":
      message = "User is busy"
      messageType = "error"
      break
    case "disconnected":
      message = "User disconnected"
      messageType = "error"
      break
    default:
      message = data.message || "Call terminated"
      messageType = "info"
  }

  showMessage(message, messageType)
  currentIncomingCall = null
}

// Handle user disconnection
function handleUserDisconnected(data) {
  handleCallTermination({
    session_id: data.session_id,
    reason: "disconnected",
    message: "User disconnected",
  })
}
