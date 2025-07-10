// Ringtone Generator using Web Audio API
class RingtoneGenerator {
  constructor() {
    this.audioContext = null
    this.oscillator = null
    this.gainNode = null
    this.isPlaying = false
    this.initAudioContext()
  }

  initAudioContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      this.audioContext = new AudioContext()
      console.log("Audio context initialized")
    } catch (error) {
      console.error("Web Audio API not supported:", error)
    }
  }

  createRingtone() {
    if (!this.audioContext) return

    // Resume audio context if suspended
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume()
    }

    // Create oscillator for the ringtone
    this.oscillator = this.audioContext.createOscillator()
    this.gainNode = this.audioContext.createGain()

    // Connect nodes
    this.oscillator.connect(this.gainNode)
    this.gainNode.connect(this.audioContext.destination)

    // Set up the ringtone pattern (classic phone ring)
    this.oscillator.type = "sine"
    this.oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime)

    // Create ring pattern: ring-ring-pause-ring-ring-pause
    const now = this.audioContext.currentTime

    // First ring
    this.gainNode.gain.setValueAtTime(0, now)
    this.gainNode.gain.linearRampToValueAtTime(0.3, now + 0.1)
    this.gainNode.gain.linearRampToValueAtTime(0, now + 0.4)

    // Second ring
    this.gainNode.gain.linearRampToValueAtTime(0.3, now + 0.6)
    this.gainNode.gain.linearRampToValueAtTime(0, now + 0.9)

    // Pause and repeat
    this.gainNode.gain.linearRampToValueAtTime(0, now + 1.5)

    return this.oscillator
  }

  play() {
    if (this.isPlaying) return

    this.isPlaying = true
    this.playRingCycle()
  }

  playRingCycle() {
    if (!this.isPlaying) return

    const oscillator = this.createRingtone()
    if (oscillator) {
      oscillator.start()
      oscillator.stop(this.audioContext.currentTime + 1.5)

      // Schedule next ring cycle
      setTimeout(() => {
        if (this.isPlaying) {
          this.playRingCycle()
        }
      }, 2000)
    }
  }

  stop() {
    this.isPlaying = false
    if (this.oscillator) {
      try {
        this.oscillator.stop()
      } catch (error) {
        // Oscillator might already be stopped
      }
      this.oscillator = null
    }
  }
}

// Initialize global ringtone generator
window.ringtoneGenerator = new RingtoneGenerator()

// Enhanced ringtone playing function
window.playGeneratedRingtone = () => {
  console.log("Playing generated ringtone...")
  window.ringtoneGenerator.play()
}

window.stopGeneratedRingtone = () => {
  console.log("Stopping generated ringtone...")
  window.ringtoneGenerator.stop()
}
