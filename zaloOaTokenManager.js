/**
 * Module Quản lý Xác thực OAuth 2.0 Zalo Official Account v3
 * Tích hợp Mutex Lock ngăn ngừa hiện tượng Token Replay Race Condition
 * Hệ thống Ký số EduSign VGCA - THCS Chu Văn An
 */
const fs = require('fs');
const path = require('path');

class ZaloOaTokenManager {
  constructor(config = {}) {
    this.appId = config.appId || process.env.ZALO_APP_ID || '';
    this.secretKey = config.secretKey || process.env.ZALO_SECRET_KEY || '';
    this.tokenFilePath = path.join(__dirname, 'data', 'zalo_oa_tokens.json');
    this.isRefreshing = false;
    this.refreshQueue = [];
  }

  loadTokens() {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        return JSON.parse(fs.readFileSync(this.tokenFilePath, 'utf8'));
      }
    } catch (e) {}
    return { access_token: '', refresh_token: '', expires_at: 0 };
  }

  saveTokens(data) {
    const expiresIn = parseInt(data.expires_in, 10) || 3600;
    const tokens = {
      access_token: data.access_token || '',
      refresh_token: data.refresh_token || '',
      expires_at: Date.now() + Math.max(0, expiresIn - 300) * 1000 // Gia hạn trước 5 phút
    };
    fs.mkdirSync(path.dirname(this.tokenFilePath), { recursive: true });
    fs.writeFileSync(this.tokenFilePath, JSON.stringify(tokens, null, 2), 'utf8');
    return tokens;
  }

  async getValidAccessToken() {
    const current = this.loadTokens();
    // Nếu token còn hiệu lực thì tái sử dụng
    if (current.access_token && Date.now() < current.expires_at) {
      return current.access_token;
    }

    // Nếu đang có tiến trình làm mới token, đưa vào hàng đợi Mutex
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.refreshQueue.push({ resolve, reject });
      });
    }

    this.isRefreshing = true;
    try {
      const refreshed = await this.executeRefreshToken(current.refresh_token);
      this.refreshQueue.forEach(item => item.resolve(refreshed.access_token));
      this.refreshQueue = [];
      return refreshed.access_token;
    } catch (err) {
      this.refreshQueue.forEach(item => item.reject(err));
      this.refreshQueue = [];
      throw err;
    } finally {
      this.isRefreshing = false;
    }
  }

  async executeRefreshToken(refreshToken) {
    if (!refreshToken) throw new Error('Không tìm thấy Refresh Token hợp lệ.');

    const res = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'secret_key': this.secretKey
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        app_id: this.appId,
        grant_type: 'refresh_token'
      })
    });

    const result = await res.json();
    if (result.error) {
      throw new Error(`[Zalo OA OAuth Error] ${result.error_name || 'ERROR'}: ${result.message || 'Lỗi làm mới token'}`);
    }

    return this.saveTokens(result);
  }
}

module.exports = ZaloOaTokenManager;
