const { downloadVideo, getVideoStatus } = require('../src/services/videoService');
const fs = require('fs').promises;
const path = require('path');

// Mock external dependencies
jest.mock('execa');
jest.mock('fs').promises;

describe('Video Service', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    process.env.DOWNLOAD_DIR = '/downloads';
    process.env.COMPLETED_DIR = '/media/completed';
  });

  describe('downloadVideo', () => {
    it('should create a download directory and return an ID', async () => {
      const url = 'https://www.youtube.com/watch?v=test';
      const type = 'movie';

      fs.mkdir.mockResolvedValue(undefined);

      const downloadId = await downloadVideo(url, type);
      expect(downloadId).toMatch(/^dl_\d+_[a-z0-9]+$/);
      expect(fs.mkdir).toHaveBeenCalled();
    });

    it('should handle download errors gracefully', async () => {
      const url = 'https://www.youtube.com/watch?v=test';
      fs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(downloadVideo(url)).rejects.toThrow('Permission denied');
    });
  });

  describe('getVideoStatus', () => {
    it('should return the status of an existing download', async () => {
      const downloadId = 'dl_test';
      const status = await getVideoStatus(downloadId);
      
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('progress');
      expect(status).toHaveProperty('timestamp');
    });

    it('should throw an error for non-existent download', async () => {
      const downloadId = 'non_existent';
      
      await expect(getVideoStatus(downloadId)).rejects.toThrow('Download not found');
    });
  });
}); 