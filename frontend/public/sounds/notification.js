// Simple sound generation for notifications since we don't have actual sound files
// This creates data URLs for simple beep sounds

export const generateNotificationSounds = () => {
  // Generate a simple beep sound using Web Audio API
  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
  
  const createBeep = (frequency, duration, volume = 0.1) => {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime)
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + duration)
  }
  
  return {
    newOrder: () => {
      // Higher pitched, attention-grabbing beep
      createBeep(800, 0.2)
      setTimeout(() => createBeep(600, 0.2), 300)
    },
    paymentConfirmed: () => {
      // Pleasant confirmation sound
      createBeep(523, 0.1) // C note
      setTimeout(() => createBeep(659, 0.1), 100) // E note
      setTimeout(() => createBeep(784, 0.2), 200) // G note
    },
    lowStock: () => {
      // Warning sound
      createBeep(400, 0.3)
      setTimeout(() => createBeep(400, 0.3), 400)
    },
    error: () => {
      // Error sound - lower frequency
      createBeep(200, 0.5)
    }
  }
}
