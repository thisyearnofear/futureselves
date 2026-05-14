import { ActionCtx } from "./_generated/server";

export interface MeliusProject {
  id: string;
  name: string;
}

export interface MeliusCanvas {
  id: string;
  name: string;
}

export interface MeliusNode {
  id: string;
  type: string;
  prompt?: string;
  [key: string]: any;
}

export interface MeliusRun {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: any;
}

export class MeliusClient {
  private baseUrl = "https://api.melius.com/mcp";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async callTool(name: string, args: any = {}) {
    // The Melius MCP HTTP API follows the MCP protocol over HTTP
    // This typically means a POST request with the tool name and arguments
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        method: "tools/call",
        params: {
          name,
          arguments: args,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Melius API error (${response.status}): ${error}`);
    }

    const json = await response.json();
    if (json.error) {
      throw new Error(`Melius Tool error: ${JSON.stringify(json.error)}`);
    }

    return json.result.content[0].text ? JSON.parse(json.result.content[0].text) : json.result.content[0];
  }

  async createProject(name: string): Promise<MeliusProject> {
    return this.callTool("project_create", { name });
  }

  async createCanvas(projectId: string, name: string): Promise<MeliusCanvas> {
    return this.callTool("canvas_create", { projectId, name });
  }

  async createNode(canvasId: string, type: string, data: any): Promise<MeliusNode> {
    return this.callTool("node_create", { canvasId, type, ...data });
  }

  async createEdge(canvasId: string, fromNodeId: string, toNodeId: string): Promise<any> {
    return this.callTool("edge_create", { canvasId, fromNodeId, toNodeId });
  }

  async startRun(nodeId: string): Promise<MeliusRun> {
    return this.callTool("run_start", { nodeId });
  }

  async startBulkRun(nodeIds: string[]): Promise<{ id: string }> {
    return this.callTool("bulk_run_start", { nodeIds });
  }

  async getRun(runId: string): Promise<MeliusRun> {
    return this.callTool("run_get", { runId });
  }

  async getBulkRun(bulkRunId: string): Promise<{ status: string; results: Record<string, MeliusRun> }> {
    return this.callTool("bulk_run_get", { bulkRunId });
  }

  async waitForRun(runId: string, timeoutMs = 60000): Promise<MeliusRun> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const run = await this.getRun(runId);
      if (run.status === "completed") return run;
      if (run.status === "failed") throw new Error(`Melius run failed: ${JSON.stringify(run.result)}`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error("Melius run timed out");
  }

  async waitForBulkRun(bulkRunId: string, timeoutMs = 90000): Promise<Record<string, MeliusRun>> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const bulkRun = await this.getBulkRun(bulkRunId);
      if (bulkRun.status === "completed") return bulkRun.results;
      if (bulkRun.status === "failed") throw new Error("Melius bulk run failed");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error("Melius bulk run timed out");
  }
}

export function getMeliusClient(ctx: ActionCtx) {
  const apiKey = process.env.MELIUS_API_KEY;
  if (!apiKey) {
    throw new Error("MELIUS_API_KEY is not set");
  }
  return new MeliusClient(apiKey);
}
