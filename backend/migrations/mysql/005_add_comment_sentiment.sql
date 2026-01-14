-- Add sentiment_summary_cached JSON column to comments
ALTER TABLE comments
  ADD COLUMN sentiment_summary_cached JSON DEFAULT NULL;
