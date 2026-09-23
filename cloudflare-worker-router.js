/**
 * CLOUDFLARE WORKER: DUAL-RENDER FAILOVER ROUTER | THCS CHU VĂN AN
 * 
 * @tier: 1
 * @architecture: LITE_EDGE_PROXY
 * 
 * Chức năng: Bộ định tuyến biên không trạng thái (Stateless Edge Proxy)
 * - Tự động cân bằng và chuyển tiếp failover giữa 2 máy chủ Render.
 * - Primary: https://edusign-vgca.onrender.com
 * - Secondary: https://kyso.onrender.com
 * - Timeout: 6000ms mỗi node
 * - Tuân thủ triệt để nguyên tắc YAGNI (Stateless Network Proxy, 0 Durable Objects)
 */

const PRIMARY_URL = 'https://edusign-vgca.onrender.com';
const SECONDARY_URL = 'https://kyso.onrender.com';
const FAILOVER_TIMEOUT_MS = 6000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Accept, Range',
  'Access-Control-Max-Age': '86400'
};

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

function buildProxyHeaders(incomingHeaders, targetHost) {
  const headers = new Headers(incomingHeaders);
  headers.set('host', targetHost);
  headers.delete('cf-connecting-ip');
  headers.delete('cf-ray');
  headers.delete('cf-visitor');
  headers.delete('connection');
  headers.delete('keep-alive');
  headers.delete('transfer-encoding');
  return headers;
}

async function forwardRequest(targetBaseUrl, pathnameWithSearch, method, headers, bodyBytes) {
  const targetUrl = new URL(pathnameWithSearch, targetBaseUrl).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FAILOVER_TIMEOUT_MS);

  try {
    const fetchOptions = {
      method: method,
      headers: buildProxyHeaders(headers, new URL(targetBaseUrl).host),
      signal: controller.signal,
      redirect: 'manual'
    };

    if (bodyBytes && !['GET', 'HEAD'].includes(method.toUpperCase())) {
      fetchOptions.body = bodyBytes;
    }

    const response = await fetch(targetUrl, fetchOptions);
    return { ok: true, response: response, status: response.status };
  } catch (err) {
    const isTimeout = err?.name === 'AbortError';
    console.warn(`[FailoverRouter] Forward tới ${targetBaseUrl} thất bại (${isTimeout ? 'Timeout 6s' : err?.message})`);
    return { ok: false, error: isTimeout ? 'Gateway Timeout' : (err?.message || 'Network error'), isTimeout: isTimeout };
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, _env, _ctx) {
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    const url = new URL(request.url);

    // Endpoint giám sát tình trạng cụm Dual-Render
    if (url.pathname === '/cluster-status') {
      return new Response(JSON.stringify({
        cluster: 'CVA-KySo-Dual-Render',
        nodes: [
          { id: 'node-primary', name: 'Render Node 1', url: PRIMARY_URL },
          { id: 'node-secondary', name: 'Render Node 2', url: SECONDARY_URL }
        ],
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
      });
    }

    const pathnameWithSearch = `${url.pathname}${url.search}`;

    let bodyBytes = null;
    const method = request.method.toUpperCase();
    if (!['GET', 'HEAD'].includes(method)) {
      try {
        bodyBytes = await request.arrayBuffer();
      } catch (err) {
        console.error('[FailoverRouter] Lỗi khi đọc body request:', err?.message);
        return new Response(JSON.stringify({ error: 'Bad Request - Không thể đọc nội dung request', status: 400 }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
      }
    }

    // 1. Thử gửi đến Primary Node
    const primaryResult = await forwardRequest(PRIMARY_URL, pathnameWithSearch, method, request.headers, bodyBytes);
    
    // Nếu Primary phản hồi thành công và không phải lỗi server sập (502, 503, 504)
    if (primaryResult.ok && ![502, 503, 504].includes(primaryResult.status)) {
      const respHeaders = new Headers(primaryResult.response.headers);
      respHeaders.set('x-router-node', 'primary');
      respHeaders.set('Access-Control-Allow-Origin', '*');
      return new Response(primaryResult.response.body, {
        status: primaryResult.response.status,
        statusText: primaryResult.response.statusText,
        headers: respHeaders
      });
    }

    // Hủy body của Primary nếu trả về 502/503/504 để giải phóng tài nguyên
    if (primaryResult.response?.body) {
      try { await primaryResult.response.body.cancel(); } catch {}
    }

    console.warn(`[FailoverRouter] Primary Node không khả dụng (Status: ${primaryResult.status || primaryResult.error}). Chuyển tiếp sang Secondary Node...`);

    // 2. Chuyển tiếp sang Secondary Node (Failover)
    const secondaryResult = await forwardRequest(SECONDARY_URL, pathnameWithSearch, method, request.headers, bodyBytes);

    if (secondaryResult.ok && ![502, 503, 504].includes(secondaryResult.status)) {
      const respHeaders = new Headers(secondaryResult.response.headers);
      respHeaders.set('x-router-node', 'secondary-failover');
      respHeaders.set('Access-Control-Allow-Origin', '*');
      return new Response(secondaryResult.response.body, {
        status: secondaryResult.response.status,
        statusText: secondaryResult.response.statusText,
        headers: respHeaders
      });
    }

    // Hủy body của Secondary nếu trả về 502/503/504
    if (secondaryResult.response?.body) {
      try { await secondaryResult.response.body.cancel(); } catch {}
    }

    // 3. Cả 2 Node đều không khả dụng
    console.error('[FailoverRouter] Toàn bộ các node Render đều không khả dụng. Trả về 503.');
    return new Response(JSON.stringify({
      error: 'Tất cả các máy chủ backend Render đều không khả dụng hoặc quá thời gian chờ (6s)',
      status: 503,
      primaryError: primaryResult.error || `HTTP ${primaryResult.status}`,
      secondaryError: secondaryResult.error || `HTTP ${secondaryResult.status}`,
      timestamp: new Date().toISOString()
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Retry-After': '10',
        ...CORS_HEADERS
      }
    });
  },

  /**
   * Bộ phát nhịp tim định kỳ (Cron Trigger)
   * Giữ ấm cả 2 máy chủ Render, triệt tiêu 100% hiện tượng ngủ đông Scale-to-Zero
   */
  async scheduled(_event, _env, ctx) {
    const pingPromises = [PRIMARY_URL, SECONDARY_URL].map(async (baseUrl) => {
      try {
        const res = await fetch(`${baseUrl}/api/health`, { method: 'GET', headers: { 'User-Agent': 'Cloudflare-AntiSleep-Ping/1.0' } });
        console.log(`[Anti-Sleep Cron] ${baseUrl}: HTTP ${res.status}`);
      } catch (e) {
        console.warn(`[Anti-Sleep Cron] Lỗi ping ${baseUrl}:`, e?.message || e);
      }
    });

    if (ctx?.waitUntil) {
      ctx.waitUntil(Promise.allSettled(pingPromises));
    } else {
      await Promise.allSettled(pingPromises);
    }
  }
};
