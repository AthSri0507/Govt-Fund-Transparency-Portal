import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getToken, getUser } from '../utils/auth';
import './GalleryPage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function GalleryPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [gallery, setGallery] = useState({ project_name: '', images: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  
  const token = getToken();
  const user = getUser() || {};
  const isCitizen = String(user.role).toLowerCase() === 'citizen';
  const isAdmin = String(user.role).toLowerCase() === 'admin';

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchGallery();
  }, [projectId, token]);

  const fetchGallery = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/projects/${projectId}/gallery`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGallery(res.data);
      setError('');
    } catch (err) {
      console.error('Error fetching gallery:', err);
      setError(err.response?.data?.message || 'Failed to load gallery');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Only JPG and PNG images are allowed.');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB.');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError('');
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select an image to upload');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('image', selectedFile);
      if (caption.trim()) {
        formData.append('caption', caption.trim());
      }

      await axios.post(`${API_BASE}/api/projects/${projectId}/gallery`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // Reset form
      setSelectedFile(null);
      setPreviewUrl(null);
      setCaption('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Refresh gallery
      fetchGallery();
    } catch (err) {
      console.error('Error uploading image:', err);
      setError(err.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId) => {
    if (!window.confirm('Are you sure you want to delete this image?')) return;

    try {
      await axios.delete(`${API_BASE}/api/gallery/${imageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchGallery();
    } catch (err) {
      console.error('Error deleting image:', err);
      setError(err.response?.data?.message || 'Failed to delete image');
    }
  };

  const canDelete = (image) => {
    return isAdmin || Number(image.uploaded_by) === Number(user.id);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="gallery-page">
        <div className="gallery-loading">
          <div className="spinner"></div>
          <p>Loading gallery...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gallery-page">
      <div className="gallery-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div className="gallery-title">
          <h1>Project Gallery</h1>
          <p className="project-name">{gallery.project_name}</p>
        </div>
      </div>

      {error && <div className="gallery-error">{error}</div>}

      {/* Upload Section - Citizens Only */}
      {isCitizen && (
        <div className="upload-section">
          <h2>📸 Upload New Image</h2>
          <form onSubmit={handleUpload} className="upload-form">
            <div className="file-input-wrapper">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFileSelect}
                ref={fileInputRef}
                className="file-input"
                id="gallery-file-input"
              />
              <label htmlFor="gallery-file-input" className="file-label">
                {selectedFile ? selectedFile.name : 'Choose an image (JPG, PNG - max 5MB)'}
              </label>
            </div>

            {previewUrl && (
              <div className="preview-container">
                <img src={previewUrl} alt="Preview" className="preview-image" />
                <button 
                  type="button" 
                  className="clear-preview-btn"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            <div className="caption-input">
              <input
                type="text"
                placeholder="Add a caption (optional)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={500}
              />
            </div>

            <button 
              type="submit" 
              className="upload-btn"
              disabled={!selectedFile || uploading}
            >
              {uploading ? 'Uploading...' : 'Upload Image'}
            </button>
          </form>
        </div>
      )}

      {/* Gallery Grid */}
      <div className="gallery-content">
        <h2>📷 Gallery Images ({gallery.images.length})</h2>
        
        {gallery.images.length === 0 ? (
          <div className="empty-gallery">
            <p>No images uploaded yet.</p>
            {isCitizen && <p className="hint">Be the first to share a project update!</p>}
          </div>
        ) : (
          <div className="gallery-grid">
            {gallery.images.map((image) => (
              <div key={image.id} className="gallery-item">
                <div className="image-wrapper" onClick={() => setLightboxImage(image)}>
                  <img 
                    src={`${API_BASE}${image.image_url}`} 
                    alt={image.caption || 'Project image'} 
                    loading="lazy"
                  />
                  <div className="image-overlay">
                    <span className="view-icon">🔍</span>
                  </div>
                </div>
                <div className="image-info">
                  {image.caption && <p className="image-caption">{image.caption}</p>}
                  <p className="image-meta">
                    <span className="uploader">By: {image.uploaded_by_name}</span>
                    <span className="date">{formatDate(image.created_at)}</span>
                  </p>
                  {canDelete(image) && (
                    <button 
                      className="delete-image-btn"
                      onClick={() => handleDelete(image.id)}
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div className="lightbox" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setLightboxImage(null)}>
              ✕
            </button>
            <img 
              src={`${API_BASE}${lightboxImage.image_url}`} 
              alt={lightboxImage.caption || 'Project image'} 
            />
            {lightboxImage.caption && (
              <p className="lightbox-caption">{lightboxImage.caption}</p>
            )}
            <p className="lightbox-meta">
              Uploaded by {lightboxImage.uploaded_by_name} on {formatDate(lightboxImage.created_at)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
