import React, { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useNavigate, useLocation } from 'react-router-dom'
import { setToken, setUser, setRefreshToken } from '../utils/auth'
import './BiometricVerification.css'

/**
 * Simulated face embedding extraction
 * In production, use a proper face detection library like face-api.js or TensorFlow.js
 */
function extractFaceEmbedding(videoElement) {
  // Create a canvas to capture frame
  const canvas = document.createElement('canvas')
  canvas.width = 224
  canvas.height = 224
  const ctx = canvas.getContext('2d')
  ctx.drawImage(videoElement, 0, 0, 224, 224)
  
  // Get image data
  const imageData = ctx.getImageData(0, 0, 224, 224)
  const data = imageData.data
  
  // Generate a 128-dimensional embedding from image data
  // This is a simulation - in production use a real face embedding model
  const embedding = []
  const step = Math.floor(data.length / 128)
  for (let i = 0; i < 128; i++) {
    const idx = i * step
    const r = data[idx] / 255
    const g = data[idx + 1] / 255
    const b = data[idx + 2] / 255
    // Normalize and create embedding value
    embedding.push((r * 0.299 + g * 0.587 + b * 0.114) * 2 - 1)
  }
  
  // Normalize the embedding vector
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0))
  return embedding.map(v => v / (norm || 1))
}

export default function BiometricVerification() {
  const navigate = useNavigate()
  const location = useLocation()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  
  const [status, setStatus] = useState('initializing') // initializing, ready, capturing, processing, success, error
  const [error, setError] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const [attempts, setAttempts] = useState(0)
  const MAX_ATTEMPTS = 3
  
  // Get user data from navigation state
  const { user, tempToken } = location.state || {}
  
  useEffect(() => {
    if (!user || !tempToken) {
      navigate('/login', { replace: true })
      return
    }
    
    // Initialize camera
    initCamera()
    
    return () => {
      // Cleanup camera on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [user, tempToken, navigate])
  
  async function initCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setStatus('ready')
    } catch (err) {
      console.error('Camera error:', err)
      setError('Failed to access camera. Please ensure camera permissions are granted.')
      setStatus('error')
    }
  }
  
  const startCapture = useCallback(() => {
    setStatus('capturing')
    setCountdown(3)
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          captureAndVerify()
          return null
        }
        return prev - 1
      })
    }, 1000)
  }, [attempts])
  
  async function captureAndVerify() {
    setStatus('processing')
    
    try {
      // Capture frame from video
      const video = videoRef.current
      if (!video) throw new Error('Video not available')
      
      // Extract embedding
      const embedding = extractFaceEmbedding(video)
      
      // Send to backend
      const res = await axios.post('/api/auth/biometric-verify', {
        userId: user.id,
        embedding,
        tempToken
      })
      
      // Success - store tokens and redirect
      if (res.data.accessToken) {
        setToken(res.data.accessToken)
        if (res.data.refreshToken) setRefreshToken(res.data.refreshToken)
        setUser(res.data.user || user)
        
        setStatus('success')
        
        // Stop camera
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
        }
        
        // Redirect after delay
        setTimeout(() => {
          const role = (user.role || '').toLowerCase()
          if (role === 'admin') navigate('/dashboard/admin')
          else navigate('/dashboard/official')
        }, 1500)
      }
    } catch (err) {
      console.error('Verification error:', err)
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      
      if (newAttempts >= MAX_ATTEMPTS) {
        setError('Maximum attempts exceeded. Please try logging in again.')
        setStatus('error')
        // Stop camera
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
        }
      } else {
        setError(`Verification failed. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`)
        setStatus('ready')
      }
    }
  }
  
  function retry() {
    setError(null)
    setStatus('ready')
  }
  
  return (
    <div className="biometric-verify-page">
      <div className="biometric-verify-container">
        <div className="biometric-verify-card">
          <div className="biometric-verify-header">
            <div className="biometric-verify-icon">🔍</div>
            <h1>Face Verification</h1>
            <p>Verify your identity to continue</p>
          </div>
          
          {user && (
            <div className="biometric-verify-user-info">
              <span>Welcome back, <strong>{user.name}</strong></span>
              <span className="biometric-verify-role">{user.role}</span>
            </div>
          )}
          
          <div className="biometric-verify-camera-section">
            {status !== 'success' && (
              <div className="biometric-verify-video-wrapper">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  className="biometric-verify-video"
                />
                <div className="biometric-verify-face-guide" />
                {countdown && (
                  <div className="biometric-verify-countdown">{countdown}</div>
                )}
                {status === 'processing' && (
                  <div className="biometric-verify-scanning">
                    <div className="scan-line" />
                  </div>
                )}
              </div>
            )}
            
            {status === 'success' && (
              <div className="biometric-verify-success-icon">
                <svg viewBox="0 0 52 52">
                  <circle cx="26" cy="26" r="25" fill="none" stroke="#28a745" strokeWidth="2"/>
                  <path fill="none" stroke="#28a745" strokeWidth="3" d="M14 27l7 7 16-16"/>
                </svg>
              </div>
            )}
          </div>
          
          <div className="biometric-verify-status">
            {status === 'initializing' && (
              <div className="biometric-verify-message info">
                <span className="spinner" /> Initializing camera...
              </div>
            )}
            
            {status === 'ready' && !error && (
              <div className="biometric-verify-message info">
                Look at the camera and click verify
              </div>
            )}
            
            {status === 'ready' && error && (
              <div className="biometric-verify-message warning">
                {error}
              </div>
            )}
            
            {status === 'capturing' && (
              <div className="biometric-verify-message warning">
                Hold still... verifying in {countdown}
              </div>
            )}
            
            {status === 'processing' && (
              <div className="biometric-verify-message info">
                <span className="spinner" /> Verifying face...
              </div>
            )}
            
            {status === 'success' && (
              <div className="biometric-verify-message success">
                ✓ Verified! Redirecting...
              </div>
            )}
            
            {status === 'error' && error && (
              <div className="biometric-verify-message error">
                {error}
              </div>
            )}
          </div>
          
          {attempts > 0 && attempts < MAX_ATTEMPTS && (
            <div className="biometric-verify-attempts">
              Attempt {attempts} of {MAX_ATTEMPTS}
            </div>
          )}
          
          <div className="biometric-verify-actions">
            {status === 'ready' && (
              <button className="biometric-verify-btn primary" onClick={startCapture}>
                Verify Face
              </button>
            )}
            
            {status === 'error' && (
              <button className="biometric-verify-btn outline" onClick={() => navigate('/login')}>
                Back to Login
              </button>
            )}
          </div>
          
          <div className="biometric-verify-footer">
            <p>Having trouble? Contact your administrator.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
