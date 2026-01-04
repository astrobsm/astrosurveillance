/**
 * ASTROSURVEILLANCE - Vercel Serverless API
 * 
 * This is a lightweight proxy API for Vercel deployment.
 * It forwards requests to the actual edge server running locally
 * or provides status information.
 * 
 * Note: Full functionality (recording, WebSocket, FFmpeg) requires
 * the local edge server. This API provides remote access capabilities.
 */

const { createServer } = require('http');

// In-memory state for demo/status
const state = {
  serverInfo: {
    name: 'ASTROSURVEILLANCE',
    version: '1.0.0',
    type: 'vercel-proxy',
    description: 'Remote API proxy for ASTROSURVEILLANCE edge server'
  },
  connectedServers: new Map(),
  lastUpdate: new Date().toISOString()
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Edge-Server',
  'Content-Type': 'application/json'
};

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    // Route handling
    if (path === '/api' || path === '/api/') {
      return sendJson(res, {
        name: 'ASTROSURVEILLANCE API',
        version: '1.0.0',
        type: 'vercel-serverless',
        endpoints: [
          'GET /api/system/info',
          'GET /api/system/health',
          'GET /api/cameras',
          'POST /api/cameras/scan',
          'GET /api/recordings',
          'GET /api/alarm/status',
          'POST /api/alarm/trigger',
          'POST /api/alarm/stop',
          'GET /api/storage/status',
          'POST /api/edge/register',
          'GET /api/edge/servers'
        ],
        note: 'This is a serverless proxy. For full functionality, connect to your local edge server.'
      });
    }

    // System info
    if (path === '/api/system/info') {
      return sendJson(res, {
        ...state.serverInfo,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: 'vercel',
        region: process.env.VERCEL_REGION || 'unknown'
      });
    }

    // Health check
    if (path === '/api/system/health') {
      return sendJson(res, {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          api: 'online',
          proxy: 'online',
          edgeServer: 'requires-local-connection'
        }
      });
    }

    // Cameras (returns instruction for local server)
    if (path === '/api/cameras') {
      return sendJson(res, {
        code: 'SUCCESS',
        message: 'Camera management requires local edge server',
        data: {
          cameras: [],
          counts: { total: 0, online: 0, offline: 0, recording: 0 }
        },
        instruction: 'Connect to your local edge server for camera management'
      });
    }

    // Camera scan endpoint
    if (path === '/api/cameras/scan' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, {
        code: 'PROXY_MODE',
        message: 'Camera scanning requires local edge server',
        received: body,
        instruction: 'Send this request to your local edge server at http://YOUR_IP:3080/api/cameras/scan'
      });
    }

    // Scan formats documentation
    if (path === '/api/cameras/scan/formats') {
      return sendJson(res, {
        code: 'SUCCESS',
        data: {
          description: 'Supported barcode/QR code formats for camera registration',
          formats: [
            {
              name: 'JSON Format',
              example: '{"ip":"192.168.1.100","username":"admin","password":"admin123","name":"Factory Entrance"}',
              required: ['ip'],
              optional: ['username', 'password', 'name', 'location', 'port', 'rtspUrl']
            },
            {
              name: 'RTSP URL Format',
              example: 'rtsp://admin:pass123@192.168.1.100:554/stream1'
            },
            {
              name: 'ONVIF Barcode Format',
              example: 'ONVIF:192.168.1.100:80:admin:pass123:Camera Name'
            },
            {
              name: 'Simple Barcode Format',
              example: '192.168.1.100:554:admin:pass123:Camera Name:Location'
            }
          ]
        }
      });
    }

    // Recordings
    if (path === '/api/recordings') {
      return sendJson(res, {
        code: 'SUCCESS',
        message: 'Recordings are stored on the local edge server',
        data: [],
        instruction: 'Connect to your local edge server to access recordings'
      });
    }

    // Alarm status
    if (path === '/api/alarm/status') {
      return sendJson(res, {
        code: 'SUCCESS',
        data: {
          isActive: false,
          enabled: true,
          mode: 'proxy',
          message: 'Alarm control requires local edge server'
        }
      });
    }

    // Alarm trigger
    if (path === '/api/alarm/trigger' && req.method === 'POST') {
      return sendJson(res, {
        code: 'PROXY_MODE',
        message: 'Alarm trigger sent (proxy mode - connect to local server for actual alarm)',
        instruction: 'For actual alarm control, connect to your local edge server'
      });
    }

    // Alarm stop
    if (path === '/api/alarm/stop' && req.method === 'POST') {
      return sendJson(res, {
        code: 'PROXY_MODE',
        message: 'Alarm stop sent (proxy mode)',
        instruction: 'For actual alarm control, connect to your local edge server'
      });
    }

    // Storage status
    if (path === '/api/storage/status') {
      return sendJson(res, {
        code: 'SUCCESS',
        data: {
          health: 'N/A',
          usagePercent: 0,
          message: 'Storage is on local edge server'
        }
      });
    }

    // Edge server registration (for future relay functionality)
    if (path === '/api/edge/register' && req.method === 'POST') {
      const body = await parseBody(req);
      const serverId = body.serverId || `edge-${Date.now()}`;
      
      state.connectedServers.set(serverId, {
        ...body,
        registeredAt: new Date().toISOString(),
        lastPing: new Date().toISOString()
      });
      
      return sendJson(res, {
        code: 'SUCCESS',
        message: 'Edge server registered',
        data: {
          serverId,
          accessToken: generateToken(),
          relayEndpoint: `wss://${req.headers.host}/api/relay`
        }
      });
    }

    // List registered edge servers
    if (path === '/api/edge/servers') {
      return sendJson(res, {
        code: 'SUCCESS',
        data: {
          servers: Array.from(state.connectedServers.entries()).map(([id, data]) => ({
            id,
            ...data,
            // Hide sensitive data
            ip: data.ip ? maskIP(data.ip) : undefined
          }))
        }
      });
    }

    // Configuration endpoint
    if (path === '/api/config') {
      return sendJson(res, {
        code: 'SUCCESS',
        data: {
          recording: { duration: 60, format: 'mp4' },
          alarm: { duration: 10, enabled: true },
          motion: { threshold: 15, sensitivity: 'medium' }
        }
      });
    }

    // 404 for unknown routes
    res.statusCode = 404;
    return sendJson(res, {
      code: 'NOT_FOUND',
      message: `Endpoint ${path} not found`,
      availableEndpoints: '/api'
    });

  } catch (error) {
    console.error('API Error:', error);
    res.statusCode = 500;
    return sendJson(res, {
      code: 'ERROR',
      message: error.message
    });
  }
};

// Helper functions
function sendJson(res, data) {
  res.end(JSON.stringify(data, null, 2));
}

async function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function generateToken() {
  return 'ast_' + Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

function maskIP(ip) {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  return '***';
}
