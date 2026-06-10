export type ProxyMode = 'monitor' | 'block' | 'off';

export interface ProxyConfig {
  mode: ProxyMode;
}

export interface ProxyFlag {
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  blocked: boolean;
}

export interface ToolCallLog {
  timestamp: string;
  tool_name: string;
  arguments_hash: string;
  response_hash: string;
  flags_raised: ProxyFlag[];
}

export interface ProxySession {
  session_id: string;
  upstream_url: string;
  tool_call_logs: ToolCallLog[];
  config: ProxyConfig;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string; data?: unknown };
}
