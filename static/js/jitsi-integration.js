// Jitsi Meet Integration (Easiest alternative)
class JitsiVideoCall {
  constructor() {
    this.api = null
    this.domain = "meet.jit.si"
    this.options = {
      roomName: "",
      width: "100%",
      height: 600,
      parentNode: null,
      configOverwrite: {
        prejoinPageEnabled: false,
        startWithAudioMuted: false,
        startWithVideoMuted: false,
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: [
          "microphone",
          "camera",
          "closedcaptions",
          "desktop",
          "fullscreen",
          "fodeviceselection",
          "hangup",
          "profile",
          "chat",
          "recording",
          "livestreaming",
          "etherpad",
          "sharedvideo",
          "settings",
          "raisehand",
          "videoquality",
          "filmstrip",
          "invite",
          "feedback",
          "stats",
          "shortcuts",
          "tileview",
          "videobackgroundblur",
          "download",
          "help",
          "mute-everyone",
        ],
      },
    }
  }

  startCall(sessionId, username) {
    const roomName = `SecureCall_${sessionId}`

    // Set up Jitsi options
    this.options.roomName = roomName
    this.options.parentNode = document.getElementById("jitsi-container")
    this.options.userInfo = {
      displayName: username,
    }

    // Create Jitsi Meet API
    const JitsiMeetExternalAPI = window.JitsiMeetExternalAPI // Declare the variable
    this.api = new JitsiMeetExternalAPI(this.domain, this.options)

    // Set up event listeners
    this.api.addEventListener("videoConferenceJoined", () => {
      console.log("Joined Jitsi call successfully")
      this.showMessage("Call connected via Jitsi!", "success")
    })

    this.api.addEventListener("videoConferenceLeft", () => {
      console.log("Left Jitsi call")
      this.endCall()
    })

    this.api.addEventListener("participantJoined", (participant) => {
      console.log("Participant joined:", participant.displayName)
      this.showMessage(`${participant.displayName} joined the call`, "info")
    })

    this.api.addEventListener("participantLeft", (participant) => {
      console.log("Participant left:", participant.displayName)
      this.showMessage(`${participant.displayName} left the call`, "info")
    })

    // Show the call modal
    const modal = document.getElementById("call-modal")
    if (modal) {
      modal.innerHTML = `
        <div class="modal-content jitsi-modal">
          <div class="modal-header">
            <h3>Video Call - ${roomName}</h3>
            <button onclick="window.jitsiCall.endCall()" class="btn btn-danger">
              <i class="fas fa-phone-slash"></i> End Call
            </button>
          </div>
          <div id="jitsi-container" class="jitsi-container"></div>
        </div>
      `
      modal.style.display = "block"
      modal.classList.add("fullscreen-call")

      // Reinitialize after DOM update
      setTimeout(() => {
        this.options.parentNode = document.getElementById("jitsi-container")
        this.api = new JitsiMeetExternalAPI(this.domain, this.options)
      }, 100)
    }
  }

  endCall() {
    if (this.api) {
      this.api.dispose()
      this.api = null
    }

    const modal = document.getElementById("call-modal")
    if (modal) {
      modal.style.display = "none"
      modal.classList.remove("fullscreen-call")
    }

    console.log("Jitsi call ended")
  }

  // Utility method
  showMessage(message, type) {
    if (window.showMessage) {
      window.showMessage(message, type)
    } else {
      console.log(`${type}: ${message}`)
    }
  }
}

// Initialize Jitsi integration
window.jitsiCall = new JitsiVideoCall()
