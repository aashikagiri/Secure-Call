// WebRTC Video Call Implementation
class VideoCall {
  constructor() {
    this.localVideo = document.getElementById("local-video")
    this.remoteVideo = document.getElementById("remote-video")
    this.localStream = null
    this.remoteStream = null
    this.peerConnection = null
    this.sessionId = null
    this.isVideoEnabled = true
    this.isAudioEnabled = true
    this.socket = null // Declare socket variable
    this.showMessage = null // Declare showMessage variable
    this.mediaConstraints = {
      video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }

    this.setupEventListeners()
    this.setupSocketListeners()
    this.checkMediaPermissions()
  }

  async checkMediaPermissions() {
    try {
      // Check if permissions are already granted
      const permissions = await navigator.permissions.query({ name: "camera" })
      const audioPermissions = await navigator.permissions.query({ name: "microphone" })

      console.log("Camera permission:", permissions.state)
      console.log("Microphone permission:", audioPermissions.state)

      if (permissions.state === "denied" || audioPermissions.state === "denied") {
        this.showPermissionError()
      }
    } catch (error) {
      console.log("Permission API not supported, will request during call")
    }
  }

  showPermissionError() {
    const errorHtml = `
      <div class="permission-error">
        <h3>Camera/Microphone Access Required</h3>
        <p>Please allow camera and microphone access to make video calls.</p>
        <p>You may need to:</p>
        <ul>
          <li>Click the camera icon in your browser's address bar</li>
          <li>Go to browser settings and allow camera/microphone for this site</li>
          <li>Refresh the page after granting permissions</li>
        </ul>
      </div>
    `

    if (this.showMessage) {
      this.showMessage("Camera/Microphone access denied. Please check browser permissions.", "error")
    }
  }

  async requestMediaAccess(constraints = null) {
    const mediaConstraints = constraints || this.mediaConstraints

    try {
      console.log("Requesting media access with constraints:", mediaConstraints)

      // First try with ideal constraints
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints)
      console.log("Media access granted successfully")
      return stream
    } catch (error) {
      console.error("Error with ideal constraints:", error)

      // Fallback to basic constraints
      try {
        console.log("Trying fallback constraints...")
        const fallbackConstraints = {
          video: true,
          audio: true,
        }

        const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints)
        console.log("Media access granted with fallback constraints")
        return stream
      } catch (fallbackError) {
        console.error("Fallback media access failed:", fallbackError)

        // Try audio only
        try {
          console.log("Trying audio-only...")
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          console.log("Audio-only access granted")
          this.showMessage("Video unavailable, audio-only call", "warning")
          return audioStream
        } catch (audioError) {
          console.error("Audio access also failed:", audioError)
          this.handleMediaError(audioError)
          throw audioError
        }
      }
    }
  }

  handleMediaError(error) {
    console.error("Media access error:", error)

    let errorMessage = "Unable to access camera/microphone"
    let suggestions = []

    switch (error.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        errorMessage = "Camera/microphone access denied"
        suggestions = [
          "Click the camera icon in your browser's address bar",
          "Allow camera and microphone access",
          "Refresh the page and try again",
        ]
        break

      case "NotFoundError":
      case "DevicesNotFoundError":
        errorMessage = "No camera or microphone found"
        suggestions = [
          "Check if your camera/microphone is connected",
          "Try a different browser",
          "Check device privacy settings",
        ]
        break

      case "NotReadableError":
      case "TrackStartError":
        errorMessage = "Camera/microphone is being used by another application"
        suggestions = [
          "Close other applications using camera/microphone",
          "Restart your browser",
          "Check if other tabs are using media",
        ]
        break

      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        errorMessage = "Camera/microphone doesn't support required settings"
        suggestions = ["Try with a different camera/microphone", "Update your device drivers"]
        break

      case "NotSupportedError":
        errorMessage = "Your browser doesn't support video calling"
        suggestions = [
          "Use a modern browser (Chrome, Firefox, Safari, Edge)",
          "Update your browser to the latest version",
        ]
        break

      case "SecurityError":
        errorMessage = "Security error - HTTPS required for camera access"
        suggestions = ["Make sure you're using HTTPS", "Check if the site is trusted"]
        break

      default:
        errorMessage = `Media error: ${error.message || error.name}`
        suggestions = ["Try refreshing the page", "Check browser permissions", "Try a different browser"]
    }

    this.showDetailedError(errorMessage, suggestions)
  }

  showDetailedError(message, suggestions) {
    const errorHtml = `
      <div class="media-error-modal">
        <div class="error-content">
          <h3><i class="fas fa-exclamation-triangle"></i> ${message}</h3>
          <div class="error-suggestions">
            <p><strong>Try these solutions:</strong></p>
            <ul>
              ${suggestions.map((suggestion) => `<li>${suggestion}</li>`).join("")}
            </ul>
          </div>
          <div class="error-actions">
            <button onclick="this.parentElement.parentElement.parentElement.remove()" class="btn btn-secondary">
              Close
            </button>
            <button onclick="window.location.reload()" class="btn btn-primary">
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    `

    // Remove existing error modal
    const existingModal = document.querySelector(".media-error-modal")
    if (existingModal) {
      existingModal.remove()
    }

    // Add new error modal
    document.body.insertAdjacentHTML("beforeend", errorHtml)

    if (this.showMessage) {
      this.showMessage(message, "error")
    }
  }

  setupEventListeners() {
    document.getElementById("end-call").addEventListener("click", () => {
      this.endCall()
    })

    document.getElementById("toggle-video").addEventListener("click", () => {
      this.toggleVideo()
    })

    document.getElementById("toggle-audio").addEventListener("click", () => {
      this.toggleAudio()
    })
  }

  setupSocketListeners() {
    if (this.socket) {
      this.socket.on("user_joined", (data) => {
        console.log("User joined:", data.user)
      })

      this.socket.on("user_left", (data) => {
        console.log("User left:", data.user)
        this.endCall()
      })

      this.socket.on("offer", async (data) => {
        await this.handleOffer(data)
      })

      this.socket.on("answer", async (data) => {
        await this.handleAnswer(data)
      })

      this.socket.on("ice_candidate", async (data) => {
        await this.handleIceCandidate(data)
      })

      this.socket.on("call_answered", (data) => {
        console.log("Call was answered")
        this.showMessage("Call connected!", "success")
      })

      this.socket.on("call_rejected", (data) => {
        console.log("Call was rejected - ending call immediately")
        this.handleCallTermination({
          reason: "declined",
          message: "Call was declined",
        })
      })

      this.socket.on("call_terminated", (data) => {
        console.log("Call terminated:", data.reason)
        this.handleCallTermination(data)
      })

      this.socket.on("user_disconnected", (data) => {
        console.log("User disconnected")
        this.handleCallTermination({
          reason: "disconnected",
          message: "User disconnected",
        })
      })
    }
  }

  async startCall(sessionId) {
    this.sessionId = sessionId
    this.updateConnectionStatus("connecting")

    try {
      console.log("Starting call, requesting media access...")

      // Request media access with better error handling
      this.localStream = await this.requestMediaAccess()

      if (!this.localStream) {
        throw new Error("Failed to get media stream")
      }

      console.log(
        "Media stream obtained:",
        this.localStream.getTracks().map((t) => t.kind),
      )

      // Set local video
      if (this.localVideo) {
        this.localVideo.srcObject = this.localStream
        this.localVideo.muted = true // Prevent echo
      }

      // Create peer connection
      this.createPeerConnection()

      // Add local stream to peer connection
      this.localStream.getTracks().forEach((track) => {
        console.log("Adding track:", track.kind, track.label)
        this.peerConnection.addTrack(track, this.localStream)
      })

      // Join the call room
      this.socket.emit("join_call", { session_id: sessionId })

      // Create and send offer
      const offer = await this.peerConnection.createOffer()
      await this.peerConnection.setLocalDescription(offer)

      this.socket.emit("offer", {
        session_id: sessionId,
        offer: offer,
      })

      console.log("Call started successfully")
    } catch (error) {
      console.error("Error starting call:", error)
      this.handleMediaError(error)
    }
  }

  createPeerConnection() {
    const configuration = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    }

    this.peerConnection = new RTCPeerConnection(configuration)

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log("Received remote track:", event.track.kind)
      this.remoteStream = event.streams[0]
      if (this.remoteVideo) {
        this.remoteVideo.srcObject = this.remoteStream
      }
    }

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("ice_candidate", {
          session_id: this.sessionId,
          candidate: event.candidate,
        })
      }
    }

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log("Connection state:", this.peerConnection.connectionState)
      this.updateConnectionStatus(this.peerConnection.connectionState)

      if (this.peerConnection.connectionState === "connected") {
        console.log("Peer connection established")
      } else if (this.peerConnection.connectionState === "failed") {
        this.handleCallTermination({
          reason: "failed",
          message: "Connection failed",
        })
      } else if (this.peerConnection.connectionState === "disconnected") {
        this.handleCallTermination({
          reason: "disconnected",
          message: "Connection lost",
        })
      }
    }
  }

  async handleOffer(data) {
    try {
      if (!this.peerConnection) {
        this.createPeerConnection()

        // Get user media for the callee
        console.log("Callee requesting media access...")
        this.localStream = await this.requestMediaAccess()

        if (this.localVideo) {
          this.localVideo.srcObject = this.localStream
          this.localVideo.muted = true
        }

        this.localStream.getTracks().forEach((track) => {
          console.log("Callee adding track:", track.kind)
          this.peerConnection.addTrack(track, this.localStream)
        })
      }

      await this.peerConnection.setRemoteDescription(data.offer)

      const answer = await this.peerConnection.createAnswer()
      await this.peerConnection.setLocalDescription(answer)

      this.socket.emit("answer", {
        session_id: data.session_id,
        answer: answer,
      })

      // Show the call modal for the callee
      const modal = document.getElementById("call-modal")
      if (modal) {
        modal.style.display = "block"
        modal.classList.add("fullscreen-call")
      }
      this.sessionId = data.session_id
    } catch (error) {
      console.error("Error handling offer:", error)
      this.handleMediaError(error)
    }
  }

  async handleAnswer(data) {
    try {
      await this.peerConnection.setRemoteDescription(data.answer)
    } catch (error) {
      console.error("Error handling answer:", error)
    }
  }

  async handleIceCandidate(data) {
    try {
      if (this.peerConnection) {
        await this.peerConnection.addIceCandidate(data.candidate)
      }
    } catch (error) {
      console.error("Error handling ICE candidate:", error)
    }
  }

  toggleVideo() {
    if (!this.localStream) return

    this.isVideoEnabled = !this.isVideoEnabled
    const videoTrack = this.localStream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = this.isVideoEnabled
    }

    const button = document.getElementById("toggle-video")
    const icon = button.querySelector("i")
    if (this.isVideoEnabled) {
      icon.className = "fas fa-video"
      button.classList.remove("btn-danger")
      button.classList.add("btn-secondary")
      button.title = "Turn off camera"
    } else {
      icon.className = "fas fa-video-slash"
      button.classList.remove("btn-secondary")
      button.classList.add("btn-danger")
      button.title = "Turn on camera"
    }
  }

  toggleAudio() {
    if (!this.localStream) return

    this.isAudioEnabled = !this.isAudioEnabled
    const audioTrack = this.localStream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = this.isAudioEnabled
    }

    const button = document.getElementById("toggle-audio")
    const icon = button.querySelector("i")
    if (this.isAudioEnabled) {
      icon.className = "fas fa-microphone"
      button.classList.remove("btn-danger")
      button.classList.add("btn-secondary")
      button.title = "Mute microphone"
    } else {
      icon.className = "fas fa-microphone-slash"
      button.classList.remove("btn-secondary")
      button.classList.add("btn-danger")
      button.title = "Unmute microphone"
    }
  }

  endCall() {
    console.log("Ending call...")

    // Notify other participants that call is ending
    if (this.sessionId && this.socket) {
      this.socket.emit("call_ended", { session_id: this.sessionId })
    }

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop()
        console.log("Stopped track:", track.kind)
      })
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    // Leave the call room
    if (this.sessionId) {
      this.socket.emit("leave_call", { session_id: this.sessionId })
    }

    // Hide the modal and remove fullscreen class
    const modal = document.getElementById("call-modal")
    if (modal) {
      modal.style.display = "none"
      modal.classList.remove("fullscreen-call")
    }

    // Reset video elements
    if (this.localVideo) this.localVideo.srcObject = null
    if (this.remoteVideo) this.remoteVideo.srcObject = null

    // Reset state
    this.sessionId = null
    this.localStream = null
    this.remoteStream = null
    this.isVideoEnabled = true
    this.isAudioEnabled = true

    // Reset button states
    const videoBtn = document.getElementById("toggle-video")
    const audioBtn = document.getElementById("toggle-audio")
    if (videoBtn && audioBtn) {
      videoBtn.querySelector("i").className = "fas fa-video"
      audioBtn.querySelector("i").className = "fas fa-microphone"
      videoBtn.className = "btn btn-secondary"
      audioBtn.className = "btn btn-secondary"
      videoBtn.title = "Turn off camera"
      audioBtn.title = "Mute microphone"
    }

    // Hide connection status
    this.updateConnectionStatus("disconnected")
    setTimeout(() => {
      const statusElement = document.getElementById("connection-status")
      if (statusElement) {
        statusElement.style.display = "none"
      }
    }, 2000)
  }

  handleCallTermination(data) {
    console.log("Handling call termination:", data.reason)

    // Show message to user
    if (this.showMessage) {
      let message = ""
      switch (data.reason) {
        case "ended":
          message = "Call ended"
          break
        case "declined":
          message = "Call was declined"
          break
        case "busy":
          message = "User is busy"
          break
        case "disconnected":
          message = "User disconnected"
          break
        default:
          message = data.message || "Call terminated"
      }
      this.showMessage(message, data.reason === "ended" ? "info" : "error")
    }

    // End the call immediately
    this.endCall()
  }

  updateConnectionStatus(status) {
    const statusElement = document.getElementById("connection-status")
    if (statusElement) {
      statusElement.style.display = "block"
      statusElement.className = `connection-status ${status}`

      switch (status) {
        case "connecting":
          statusElement.textContent = "Connecting..."
          break
        case "connected":
          statusElement.textContent = "Connected"
          setTimeout(() => {
            statusElement.style.display = "none"
          }, 3000)
          break
        case "disconnected":
          statusElement.textContent = "Disconnected"
          break
        case "failed":
          statusElement.textContent = "Connection Failed"
          break
      }
    }
  }
}

// Initialize video call when page loads
document.addEventListener("DOMContentLoaded", () => {
  const io = window.io
  const socket = io()
  const showMessage =
    window.showMessage ||
    ((message, type) => {
      console.log(`${type.toUpperCase()}: ${message}`)
    })

  window.videoCall = new VideoCall()
  window.videoCall.socket = socket
  window.videoCall.showMessage = showMessage
  window.videoCall.setupSocketListeners()
})
