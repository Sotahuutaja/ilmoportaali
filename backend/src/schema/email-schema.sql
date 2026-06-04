-- Email queue table for transactional email retries
-- Ensures confirmation emails are eventually delivered even if initial send fails

CREATE TABLE IF NOT EXISTS email_queue (
  id SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL,
  email_type VARCHAR(50) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  body TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  -- Status can be: pending, sent, failed, archived
  attempt_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
);

-- Create index on status for finding pending emails to send
CREATE INDEX IF NOT EXISTS idx_email_queue_status
  ON email_queue(status);

-- Create index on registration_id for finding emails by registration
CREATE INDEX IF NOT EXISTS idx_email_queue_registration
  ON email_queue(registration_id);

-- Create index on created_at for chronological processing
CREATE INDEX IF NOT EXISTS idx_email_queue_created
  ON email_queue(created_at);

-- Create index for finding failed emails that need retry
CREATE INDEX IF NOT EXISTS idx_email_queue_pending_retry
  ON email_queue(status, attempt_count, updated_at)
  WHERE status IN ('pending', 'failed');
