const {
  fileFilter,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} = require('../../../src/middleware/upload');

describe('Unit: Upload MIME Filter & File Constraints (STORM-021)', () => {
  describe('fileFilter validation', () => {
    it('should accept image/jpeg MIME type', (done) => {
      fileFilter({}, { mimetype: 'image/jpeg' }, (err, pass) => {
        expect(err).toBeNull();
        expect(pass).toBe(true);
        done();
      });
    });

    it('should accept image/png MIME type', (done) => {
      fileFilter({}, { mimetype: 'image/png' }, (err, pass) => {
        expect(err).toBeNull();
        expect(pass).toBe(true);
        done();
      });
    });

    it('should accept image/webp MIME type', (done) => {
      fileFilter({}, { mimetype: 'image/webp' }, (err, pass) => {
        expect(err).toBeNull();
        expect(pass).toBe(true);
        done();
      });
    });

    it('should reject text/plain with an ApiError (HTTP 400)', (done) => {
      fileFilter({}, { mimetype: 'text/plain' }, (err, pass) => {
        expect(err).not.toBeNull();
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('Only JPEG, PNG and WebP are allowed');
        expect(pass).toBe(false);
        done();
      });
    });

    it('should reject application/pdf with an ApiError (HTTP 400)', (done) => {
      fileFilter({}, { mimetype: 'application/pdf' }, (err, pass) => {
        expect(err).not.toBeNull();
        expect(err.statusCode).toBe(400);
        expect(err.message).toContain('Only JPEG, PNG and WebP are allowed');
        expect(pass).toBe(false);
        done();
      });
    });

    it('should reject application/x-msdownload or executable files', (done) => {
      fileFilter({}, { mimetype: 'application/x-msdownload' }, (err, pass) => {
        expect(err).not.toBeNull();
        expect(err.statusCode).toBe(400);
        expect(pass).toBe(false);
        done();
      });
    });
  });

  describe('Configuration Constants', () => {
    it('should restrict allowed MIME types strictly to jpeg, png, and webp', () => {
      expect(ALLOWED_MIME_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    });

    it('should enforce 5MB maximum file size limit', () => {
      expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
    });
  });
});
