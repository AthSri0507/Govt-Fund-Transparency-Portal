import React, { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useNavigate, useLocation } from 'react-router-dom'
import { setToken, setUser, setRefreshToken } from '../utils/auth'
import './BiometricEnrollment.css'

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

export default function BiometricEnrollment() {
  const navigate = useNavigate()
  const location = useLocation()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  
  const [status, setStatus] = useState('initializing') // initializing, ready, capturing, processing, success, error
  const [error, setError] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const [capturedImage, setCapturedImage] = useState(null)
  
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
          captureAndEnroll()
          return null
        }
        return prev - 1
      })
    }, 1000)
  }, [])
  
  async function captureAndEnroll() {
    setStatus('processing')
    
    try {
      // Capture frame from video
      const video = videoRef.current
      if (!video) throw new Error('Video not available')
      
      // Create canvas for preview
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0)
      setCapturedImage(canvas.toDataURL('image/jpeg'))
      
      // Extract embedding
      const embedding = extractFaceEmbedding(video)
      
      // Send to backend
      const res = await axios.post('/api/auth/biometric-enroll', {
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
        }, 2000)
      }
    } catch (err) {
      console.error('Enrollment error:', err)
      setError(err.response?.data?.message || err.message || 'Enrollment failed')
      setStatus('error')
    }
  }
  
  function retry() {
    setError(null)
    setCapturedImage(null)
    setStatus('ready')
  }
  
  return (
    <div className="biometric-page">
      <div className="biometric-container">
        <div className="biometric-card">
          <div className="biometric-header">
            <div className="biometric-icon">🔐</div>
            <h1>Biometric Enrollment</h1>
            <p>Set up face recognition for secure login</p>
          </div>
          
          {user && (
            <div className="biometric-user-info">
              <span>Enrolling: <strong>{user.name}</strong></span>
              <span className="biometric-role">{user.role}</span>
            </div>
          )}
          
          <div className="biometric-camera-section">
            {status !== 'success' && !capturedImage && (
              <div className="biometric-video-wrapper">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  className="biometric-video"
                />
                <div className="biometric-face-guide" />
                {countdown && (
                  <div className="biometric-countdown">{countdown}</div>
                )}
              </div>
            )}
            
            {capturedImage && (
              <div className="biometric-captured">
                <img src={capturedImage} alt="Captured face" />
              </div>
            )}
          </div>
          
          <div className="biometric-status">
            {status === 'initializing' && (
              <div className="biometric-message info">
                <span className="spinner" /> Initializing camera...
              </div>
            )}
            
            {status === 'ready' && (
              <div className="biometric-message info">
                Position your face within the circle and click capture
              </div>
            )}
            
            {status === 'capturing' && (
              <div className="biometric-message warning">
                Hold still... capturing in {countdown}
              </div>
            )}
            
            {status === 'processing' && (
              <div className="biometric-message info">
                <span className="spinner" /> Processing face data...
              </div>
            )}
            
            {status === 'success' && (
              <div className="biometric-message success">
                ✓ Enrollment successful! Redirecting...
              </div>
            )}
            
            {status === 'error' && error && (
              <div className="biometric-message error">
                {error}
              </div>
            )}
          </div>
          
          <div className="biometric-actions">
            {status === 'ready' && (
              <button className="biometric-btn primary" onClick={startCapture}>
                Capture Face
              </button>
            )}
            
            {status === 'error' && (
              <>
                <button className="biometric-btn secondary" onClick={retry}>
                  Try Again
                </button>
                <button className="biometric-btn outline" onClick={() => navigate('/login')}>
                  Back to Login
                </button>
              </>
            )}
          </div>
          
          <div className="biometric-footer">
            <p>Your face data is securely stored as an encrypted embedding.</p>
            <p>Raw images are never stored.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
