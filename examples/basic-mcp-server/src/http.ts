import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createConfiguredMcpServer } from './createServer.js';

const PORT = Number(process.env.PORT ?? 3000);
const MCP_PATH = '/mcp';

interface McpRequestBody {
  jsonrpc?: string;
  method?: string;
  id?: string | number | null;
  params?: {
    name?: string;
    arguments?: Record<string, unknown>;
    uri?: string;
    [key: string]: unknown;
  };
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Accept, X-Requested-With, mcp-session-id, MCP-Protocol-Version',
  );
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, Content-Length');
  res.setHeader('Access-Control-Max-Age', '86400');
}

async function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) {
        resolve(undefined);
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function writeJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const httpServer = createServer(async (req, res) => {
  setCorsHeaders(res);

  if (!req.url) {
    res.writeHead(400).end('Missing URL');
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  if (url.pathname === '/health' && req.method === 'GET') {
    writeJson(res, 200, { status: 'ok' });
    return;
  }

  if (url.pathname === MCP_PATH && req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === MCP_PATH && req.method === 'GET') {
    writeJson(res, 200, {
      name: 'proxylink-basic-example',
      version: '0.1.0',
      protocol: 'mcp',
      capabilities: { tools: true },
    });
    return;
  }

  if (url.pathname === MCP_PATH && req.method === 'DELETE') {
    writeJson(res, 405, {
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed' },
      id: null,
    });
    return;
  }

  if (url.pathname === MCP_PATH && req.method === 'POST') {
    let server: ReturnType<typeof createConfiguredMcpServer> | undefined;
    let transport: StreamableHTTPServerTransport | undefined;

    try {
      const body = (await parseJsonBody(req)) as McpRequestBody | undefined;

      server = createConfiguredMcpServer();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, body);

      res.on('close', () => {
        transport?.close();
        server?.close();
      });
    } catch (error) {
      if (!res.headersSent) {
        writeJson(res, 500, {
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }

      transport?.close();
      server?.close();
      console.error(error);
    }
    return;
  }

  res.writeHead(404).end('Not Found');
});

httpServer.listen(PORT, () => {
  console.log(`ProxyLink MCP example listening on http://localhost:${PORT}${MCP_PATH}`);
});
