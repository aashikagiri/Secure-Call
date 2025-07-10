// Agora Video Call Implementation (Much more reliable than WebRTC)
class AgoraVideoCall {
  constructor() {
    this.client = null
    this.localTracks = {
      videoTrack: null,
      audioTrack: null,
    }
    this.remoteUsers = {}
    this.isJoined = false
    this.socket = null
    this.showMessage = null

    // Agora App ID (get free from agora.io)
    this.appId = "YOUR_AGORA_APP_ID" // Replace with your App ID
    this.channel = null
    this.token = null // Optional for testing
    this.AgoraRTC = window.AgoraRTC // Declare AgoraRTC variable
  }

  async initializeAgora() {
    try {
      if (!this.AgoraRTC) {
        throw new Error("Agora SDK not loaded")
      }

      // Create client
      this.client = this.AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })

      // Set up event listeners
      this.client.on("user-published", this.handleUserPublished.bind(this))
      this.client.on("user-unpublished", this.handleUserUnpublished.bind(this))
      this.client.on("user-left", this.handleUserLeft.bind(this))

      console.log("Agora initialized successfully")
      return true
    } catch (error) {
      console.error("Failed to initialize Agora:", error)
      this.showFallbackOptions()
      return false
    }
  }

  async startCall(sessionId) {
    try {
      this.channel = `call_${sessionId}`

      // Initialize Agora
      const initialized = await this.initializeAgora()
      if (!initialized) {
        return this.startFallbackCall(sessionId)
      }

      // Join channel
      await this.client.join(this.appId, this.channel, this.token, null)
      this.isJoined = true

      // Create local tracks
      this.localTracks.audioTrack = await this.AgoraRTC.createMicrophoneAudioTrack()
      this.localTracks.videoTrack = await this.AgoraRTC.createCameraVideoTrack()

      // Play local video
      this.localTracks.videoTrack.play("local-video")

      // Publish tracks
      await this.client.publish(Object.values(this.localTracks))

      this.showMessage("Connected via Agora!", "success")
      console.log("Agora call started successfully")
    } catch (error) {
      console.error("Agora call failed:", error)
      this.startFallbackCall(sessionId)
    }
  }

  async handleUserPublished(user, mediaType) {
    await this.client.subscribe(user, mediaType)

    if (mediaType === "video") {
      const remoteVideoTrack = user.videoTrack
      remoteVideoTrack.play("remote-video")
    }

    if (mediaType === "audio") {
      const remoteAudioTrack = user.audioTrack
      remoteAudioTrack.play()
    }

    this.remoteUsers[user.uid] = user
  }

  async handleUserUnpublished(user, mediaType) {
    if (mediaType === "video") {
      const remoteVideoTrack = user.videoTrack
      remoteVideoTrack && remoteVideoTrack.stop()
    }
  }

  handleUserLeft(user) {
    delete this.remoteUsers[user.uid]
    this.showMessage("User left the call", "info")
  }

  async endCall() {
    try {
      // Stop local tracks
      if (this.localTracks.audioTrack) {
        this.localTracks.audioTrack.stop()
        this.localTracks.audioTrack.close()
      }
      if (this.localTracks.videoTrack) {
        this.localTracks.videoTrack.stop()
        this.localTracks.videoTrack.close()
      }

      // Leave channel
      if (this.isJoined) {
        await this.client.leave()
        this.isJoined = false
      }

      // Clear remote users
      this.remoteUsers = {}

      // Hide modal
      const modal = document.getElementById("call-modal")
      if (modal) {
        modal.style.display = "none"
      }

      console.log("Agora call ended")
    } catch (error) {
      console.error("Error ending Agora call:", error)
    }
  }

  // Fallback to simpler alternatives
  startFallbackCall(sessionId) {
    console.log("Starting fallback call method...")
    this.showFallbackOptions()

    // Option 1: Audio-only call
    this.startAudioOnlyCall(sessionId)
  }

  async startAudioOnlyCall(sessionId) {
    try {
      // Simple audio-only implementation
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Use simple peer-to-peer audio
      this.setupSimpleAudioCall(stream, sessionId)
      this.showMessage("Audio-only call started", "warning")
    } catch (error) {
      console.error("Audio call failed:", error)
      this.startTextChat(sessionId)
    }
  }

  setupSimpleAudioCall(stream, sessionId) {
    // Simplified audio streaming via Socket.IO
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const source = audioContext.createMediaStreamSource(stream)
    const processor = audioContext.createScriptProcessor(4096, 1, 1)

    source.connect(processor)
    processor.connect(audioContext.destination)

    processor.onaudioprocess = (e) => {
      const audioData = e.inputBuffer.getChannelData(0)
      // Send audio data via socket (simplified)
      if (this.socket) {
        this.socket.emit("audio_data", {
          session_id: sessionId,
          data: Array.from(audioData.slice(0, 100)), // Reduced data
        })
      }
    }
  }

  startTextChat(sessionId) {
    // Ultimate fallback: Text chat with file sharing
    this.showMessage("Starting text chat mode", "info")
    this.initializeTextChat(sessionId)
  }

  initializeTextChat(sessionId) {
    const modal = document.getElementById("call-modal")
    if (modal) {
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Text Chat</h3>
            <button onclick="window.videoCall.endCall()" class="btn btn-danger">
              End Chat
            </button>
          </div>
          <div class="chat-container">
            <div id="chat-messages" class="chat-messages"></div>
            <div class="chat-input-container">
              <input type="text" id="chat-input" placeholder="Type a message..." />
              <button onclick="window.videoCall.sendMessage()" class="btn btn-primary">
                Send
              </button>
            </div>
          </div>
        </div>
      `
      modal.style.display = "block"
    }

    // Set up chat functionality
    this.setupChatListeners(sessionId)
  }

  setupChatListeners(sessionId) {
    const chatInput = document.getElementById("chat-input")
    if (chatInput) {
      chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.sendMessage()
        }
      })
    }

    // Listen for incoming messages
    if (this.socket) {
      this.socket.on("chat_message", (data) => {
        this.displayMessage(data.message, data.sender, false)
      })
    }
  }

  sendMessage() {
    const input = document.getElementById("chat-input")
    const message = input.value.trim()

    if (message && this.socket) {
      this.socket.emit("chat_message", {
        session_id: this.channel,
        message: message,
        sender: "You",
      })

      this.displayMessage(message, "You", true)
      input.value = ""
    }
  }

  displayMessage(message, sender, isOwn) {
    const messagesContainer = document.getElementById("chat-messages")
    if (messagesContainer) {
      const messageEl = document.createElement("div")
      messageEl.className = `chat-message ${isOwn ? "own" : "other"}`
      messageEl.innerHTML = `
        <div class="message-sender">${sender}</div>
        <div class="message-text">${message}</div>
        <div class="message-time">${new Date().toLocaleTimeString()}</div>
      `
      messagesContainer.appendChild(messageEl)
      messagesContainer.scrollTop = messagesContainer.scrollHeight
    }
  }

  showFallbackOptions() {
    const optionsHtml = `
      <div class="fallback-options">
        <h3>Video Call Unavailable</h3>
        <p>Choose an alternative:</p>
        <div class="option-buttons">
          <button onclick="window.videoCall.startAudioOnlyCall('${this.channel}')" class="btn btn-primary">
            <i class="fas fa-microphone"></i> Audio Only
          </button>
          <button onclick="window.videoCall.startTextChat('${this.channel}')" class="btn btn-secondary">
            <i class="fas fa-comments"></i> Text Chat
          </button>
          <button onclick="window.videoCall.startScreenShare('${this.channel}')" class="btn btn-info">
            <i class="fas fa-desktop"></i> Screen Share
          </button>
        </div>
      </div>
    `

    const modal = document.getElementById("call-modal")
    if (modal) {
      modal.innerHTML = `<div class="modal-content">${optionsHtml}</div>`
      modal.style.display = "block"
    }
  }

  async startScreenShare(sessionId) {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })

      const video = document.getElementById("local-video")
      if (video) {
        video.srcObject = stream
      }

      this.showMessage("Screen sharing started", "success")

      // Handle screen share end
      stream.getVideoTracks()[0].onended = () => {
        this.showMessage("Screen sharing ended", "info")
        this.endCall()
      }
    } catch (error) {
      console.error("Screen share failed:", error)
      this.startTextChat(sessionId)
    }
  }
}

// Initialize the enhanced video call system
document.addEventListener("DOMContentLoaded", () => {
  const io = window.io
  const socket = io()
  const showMessage = window.showMessage || ((msg, type) => console.log(`${type}: ${msg}`))

  window.videoCall = new AgoraVideoCall()
  window.videoCall.socket = socket
  window.videoCall.showMessage = showMessage
})
