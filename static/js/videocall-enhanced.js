// Enhanced WebRTC configuration for better network support
class EnhancedVideoCall extends VideoCall {
  createPeerConnection() {
    // Enhanced configuration with TURN servers for better connectivity
    const configuration = {
      iceServers: [
        // STUN servers (current - for NAT discovery)
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },

        // TURN servers (needed for restrictive networks)
        // Note: These require authentication and may have costs
        {
          urls: "turn:your-turn-server.com:3478",
          username: "your-username",
          credential: "your-password",
        },
        {
          urls: "turns:your-turn-server.com:5349", // Secure TURN
          username: "your-username",
          credential: "your-password",
        },

        // Free TURN servers (limited reliability)
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],

      // Enhanced ICE configuration
      iceCandidatePoolSize: 10,

      // Additional configuration for better connectivity
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    }

    this.peerConnection = new RTCPeerConnection(configuration)

    // Enhanced connection monitoring
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", this.peerConnection.iceConnectionState)
      this.handleIceConnectionStateChange()
    }

    // Rest of the existing createPeerConnection code...
    this.setupPeerConnectionHandlers()
  }

  handleIceConnectionStateChange() {
    const state = this.peerConnection.iceConnectionState

    switch (state) {
      case "checking":
        this.updateConnectionStatus("connecting")
        break
      case "connected":
      case "completed":
        this.updateConnectionStatus("connected")
        break
      case "disconnected":
        this.updateConnectionStatus("disconnected")
        // Attempt reconnection
        this.attemptReconnection()
        break
      case "failed":
        this.updateConnectionStatus("failed")
        this.handleConnectionFailure()
        break
      case "closed":
        this.endCall()
        break
    }
  }

  async attemptReconnection() {
    console.log("Attempting to reconnect...")
    try {
      // Restart ICE to try different connection paths
      await this.peerConnection.restartIce()
      this.showMessage("Attempting to reconnect...", "info")
    } catch (error) {
      console.error("Reconnection failed:", error)
      this.handleConnectionFailure()
    }
  }

  handleConnectionFailure() {
    this.showMessage("Connection failed. Please check your network.", "error")
    setTimeout(() => {
      this.endCall()
    }, 5000)
  }

  setupPeerConnectionHandlers() {
    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0]
      this.remoteVideo.srcObject = this.remoteStream
      console.log("Remote stream received")
    }

    // Handle ICE candidates with better error handling
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("ICE candidate:", event.candidate.type, event.candidate.address)
        this.socket.emit("ice_candidate", {
          session_id: this.sessionId,
          candidate: event.candidate,
        })
      } else {
        console.log("ICE gathering completed")
      }
    }

    // Monitor ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      console.log("ICE gathering state:", this.peerConnection.iceGatheringState)
    }
  }

  // Network quality monitoring
  async monitorNetworkQuality() {
    if (!this.peerConnection) return

    try {
      const stats = await this.peerConnection.getStats()
      stats.forEach((report) => {
        if (report.type === "inbound-rtp" && report.mediaType === "video") {
          const quality = this.calculateQuality(report)
          this.updateQualityIndicator(quality)
        }
      })
    } catch (error) {
      console.error("Error monitoring network quality:", error)
    }
  }

  calculateQuality(report) {
    const packetsLost = report.packetsLost || 0
    const packetsReceived = report.packetsReceived || 1
    const lossRate = packetsLost / (packetsLost + packetsReceived)

    if (lossRate < 0.02) return "excellent"
    if (lossRate < 0.05) return "good"
    if (lossRate < 0.1) return "fair"
    return "poor"
  }

  updateQualityIndicator(quality) {
    const indicator = document.getElementById("quality-indicator")
    if (indicator) {
      indicator.className = `quality-indicator ${quality}`
      indicator.textContent = quality.charAt(0).toUpperCase() + quality.slice(1)
    }
  }
}

// Network diagnostics
class NetworkDiagnostics {
  static async checkConnectivity() {
    const results = {
      internetConnection: false,
      stunReachable: false,
      turnReachable: false,
      webrtcSupported: false,
    }

    // Check WebRTC support
    results.webrtcSupported = !!(window.RTCPeerConnection && navigator.mediaDevices)

    // Check internet connection
    try {
      await fetch("https://www.google.com/favicon.ico", { mode: "no-cors" })
      results.internetConnection = true
    } catch (error) {
      console.log("No internet connection detected")
    }

    // Check STUN server reachability
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Wait for ICE gathering
      await new Promise((resolve) => {
        pc.onicecandidate = (event) => {
          if (!event.candidate) {
            results.stunReachable = true
            resolve()
          }
        }
        setTimeout(resolve, 5000) // Timeout after 5 seconds
      })

      pc.close()
    } catch (error) {
      console.log("STUN server not reachable")
    }

    return results
  }

  static displayDiagnostics(results) {
    console.log("Network Diagnostics:", results)

    const diagnosticsHtml = `
      <div class="network-diagnostics">
        <h4>Network Status</h4>
        <div class="diagnostic-item ${results.webrtcSupported ? "success" : "error"}">
          WebRTC Support: ${results.webrtcSupported ? "✅" : "❌"}
        </div>
        <div class="diagnostic-item ${results.internetConnection ? "success" : "error"}">
          Internet Connection: ${results.internetConnection ? "✅" : "❌"}
        </div>
        <div class="diagnostic-item ${results.stunReachable ? "success" : "warning"}">
          STUN Reachable: ${results.stunReachable ? "✅" : "⚠️"}
        </div>
        <div class="diagnostic-item ${results.turnReachable ? "success" : "warning"}">
          TURN Available: ${results.turnReachable ? "✅" : "⚠️ (May affect calls through firewalls)"}
        </div>
      </div>
    `

    // Show diagnostics in UI
    const diagnosticsContainer = document.getElementById("network-diagnostics")
    if (diagnosticsContainer) {
      diagnosticsContainer.innerHTML = diagnosticsHtml
    }
  }
}

// Initialize enhanced video call
document.addEventListener("DOMContentLoaded", async () => {
  // Run network diagnostics
  const diagnostics = await NetworkDiagnostics.checkConnectivity()
  NetworkDiagnostics.displayDiagnostics(diagnostics)

  // Initialize enhanced video call
  const io = window.io
  const socket = io()
  const showMessage = window.showMessage || ((msg, type) => console.log(`${type}: ${msg}`))

  // Assuming VideoCall is defined elsewhere or imported
  window.videoCall = new EnhancedVideoCall()
  window.videoCall.socket = socket
  window.videoCall.showMessage = showMessage

  // Start quality monitoring during calls
  setInterval(() => {
    if (window.videoCall.peerConnection) {
      window.videoCall.monitorNetworkQuality()
    }
  }, 5000)
})
