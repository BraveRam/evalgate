import { SuiteRunResult, TestCaseResult } from "@/types";

export interface StreamRunOptions {
  suiteName: string;
  modelOverride?: string;
  concurrency?: number;
  minPassRate?: number;
  judgeModel?: string;
  onStarted?: (data: { suite_name: string; target_model: string; total_tests: number }) => void;
  onTestComplete?: (testResult: TestCaseResult) => void;
  onFinished?: (summary: SuiteRunResult) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
}

export function streamSuiteRun(options: StreamRunOptions): () => void {
  const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000/api/v1/ws/run");
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    const payload = {
      suite_name: options.suiteName,
      model_override: options.modelOverride,
      concurrency: options.concurrency ?? 10,
      min_pass_rate: options.minPassRate,
      judge_model: options.judgeModel,
    };
    ws.send(JSON.stringify(payload));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "run_started") {
        options.onStarted?.(msg);
      } else if (msg.type === "test_complete") {
        options.onTestComplete?.(msg.data);
      } else if (msg.type === "run_finished") {
        options.onFinished?.(msg.data);
      } else if (msg.type === "error") {
        options.onError?.(msg.message || "Unknown error");
      }
    } catch (err) {
      options.onError?.(String(err));
    }
  };

  ws.onerror = () => {
    options.onError?.("WebSocket connection error");
  };

  ws.onclose = () => {
    options.onClose?.();
  };

  // Return cancel/abort function
  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  };
}
