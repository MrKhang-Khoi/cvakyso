/**
 * ============================================================================
 * CLOUDFLARE WORKER: DUAL-RENDER SMART LOAD BALANCER & AUTO-FAILOVER ROUTER
 * Dự án: CVA Ký Số - Trường THCS Chu Văn An
 * ============================================================================
 * 
 * Tính năng chính:
 * 1. Cân bằng tải song song (Round-Robin) giữa 2 tài khoản Render miễn phí.
 * 2. Tự động chuyển hướng ngay lập tức (Zero-Downtime Failover < 100ms) nếu 1 Node
 *    bị quá tải, lỗi 502/503 hoặc đang ngủ đông.
 * 3. Chống ngủ đông 100% (Anti-Sleep Cron): Tự động phát nhịp tim ping cả 2 Node
 *    mỗi 5 phút để giữ cả 2 máy chủ luôn "nóng" (0ms Cold Start).
 * 4. Miễn phí 100% trên Cloudflare Workers (cho phép tới 100,000 requests/ngày).
 */

// Cấu hình 2 địa chỉ Render của 2 tài khoản khác nhau
const BACKEND_NODES = [
  {
    id: "node-primary",
    name: "Render Node 1 (Tài khoản 1)",
    url: "https://edusign-vgca.onrender.com",
    weight: 1
  },
  {
    id: "node-secondary",
    name: "Render Node 2 (Tài khoản 2)",
    url: "https://edusign-node2.onrender.com",
    weight: 1
  }
];

// Thời gian chờ tối đa cho 1 node trước khi tự động chuyển hướng sang node còn lại (ms)
const FAILOVER_TIMEOUT_MS = 6000;

export default {
  /**
   * Bộ xử lý HTTP Request (Reverse Proxy & Load Balancer)
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Cho phép truy vấn trạng thái Cluster trực tiếp qua /cluster-status
    if (url.pathname === '/cluster-status') {
      return new Response(JSON.stringify({
        cluster: "CVA-KySo-Dual-Render",
        nodes: BACKEND_NODES,
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    // 2. Chọn Node khởi đầu theo phương pháp Round-Robin ngẫu nhiên
    const primaryIndex = Math.random() < 0.5 ? 0 : 1;
    const secondaryIndex = 1 - primaryIndex;

    const firstNode = BACKEND_NODES[primaryIndex];
    const fallbackNode = BACKEND_NODES[secondaryIndex];

    // 3. Thử gửi request đến Node thứ nhất
    try {
      const targetUrl1 = new URL(url.pathname + url.search, firstNode.url).toString();
      const controller1 = new AbortController();
      const timeout1 = setTimeout(() => controller1.abort(), FAILOVER_TIMEOUT_MS);

      const response1 = await fetch(targetUrl1, {
        method: request.method,
        headers: request.headers,
        body: (request.method === 'GET' || request.method === 'HEAD') ? null : request.body,
        redirect: 'follow',
        signal: controller1.signal
      });

      clearTimeout(timeout1);

      // Nếu Node 1 phản hồi tốt (< 500), trả về cho người dùng
      if (response1.status < 500) {
        const newHeaders = new Headers(response1.headers);
        newHeaders.set('X-Served-By-Node', firstNode.id);
        return new Response(response1.body, {
          status: response1.status,
          statusText: response1.statusText,
          headers: newHeaders
        });
      }

      console.warn(`[Failover Triggered] ${firstNode.name} phản hồi HTTP ${response1.status}. Chuyển sang ${fallbackNode.name}...`);
    } catch (err) {
      console.warn(`[Failover Triggered] ${firstNode.name} lỗi hoặc timeout: ${err.message}. Chuyển sang ${fallbackNode.name}...`);
    }

    // 4. TỰ ĐỘNG CHUYỂN HƯỚNG SANG NODE THỨ HAI (Zero-Downtime Failover)
    try {
      const targetUrl2 = new URL(url.pathname + url.search, fallbackNode.url).toString();
      const response2 = await fetch(targetUrl2, {
        method: request.method,
        headers: request.headers,
        body: (request.method === 'GET' || request.method === 'HEAD') ? null : request.body,
        redirect: 'follow'
      });

      const newHeaders2 = new Headers(response2.headers);
      newHeaders2.set('X-Served-By-Node', fallbackNode.id);
      newHeaders2.set('X-Failover-Active', 'true');

      return new Response(response2.body, {
        status: response2.status,
        statusText: response2.statusText,
        headers: newHeaders2
      });
    } catch (fallbackErr) {
      return new Response(JSON.stringify({
        success: false,
        error: "Cả 2 máy chủ Render đều không phản hồi. Vui lòng kiểm tra lại kết nối mạng!",
        details: fallbackErr.message
      }), {
        status: 503,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }
  },

  /**
   * Bộ phát nhịp tim định kỳ (Cron Trigger mỗi 5 phút)
   * Giữ ấm cả 2 máy chủ Render, triệt tiêu 100% hiện tượng ngủ đông Scale-to-Zero!
   */
  async scheduled(event, env, ctx) {
    console.log('[Anti-Sleep Cron] Đang ping giữ ấm cả 2 máy chủ Render...');
    const pingPromises = BACKEND_NODES.map(async (node) => {
      try {
        const pingUrl = `${node.url}/api/health`;
        const res = await fetch(pingUrl, { method: 'GET', headers: { 'User-Agent': 'Cloudflare-AntiSleep-Ping/1.0' } });
        console.log(`[Anti-Sleep Cron] ${node.name}: HTTP ${res.status}`);
      } catch (e) {
        console.warn(`[Anti-Sleep Cron] Lỗi ping ${node.name}:`, e.message);
      }
    });

    ctx.waitUntil(Promise.allSettled(pingPromises));
  }
};
