export type TargetType = "prompt" | "tool_call" | "rag" | "structured_output" | "webhook";

export type AssertionType =
  | "contains"
  | "not_contains"
  | "exact"
  | "regex"
  | "json_schema"
  | "python_ast"
  | "sql_syntax"
  | "levenshtein"
  | "latency_slo"
  | "token_budget"
  | "faithfulness"
  | "hallucination"
  | "relevancy"
  | "coherence"
  | "bias"
  | "intent"
  | "dynamic";

export interface TargetConfig {
  type: TargetType;
  model: string;
  provider?: string | null;
  template?: string | null;
  system_prompt?: string | null;
  temperature?: number;
  top_p?: number | null;
  tools?: Record<string, any>[] | null;
  json_schema?: Record<string, any> | null;
  webhook_url?: string | null;
  headers?: Record<string, string> | null;
  allow_private_endpoints?: boolean;
}

export interface AssertionConfig {
  type: AssertionType;
  value?: any;
  rubric?: string | null;
  threshold?: number | null;
  strict?: boolean;
  judge_model?: string | null;
}

export interface TestCase {
  id: string;
  vars: Record<string, any>;
  assertions?: AssertionConfig[];
  context?: string[] | string | null;
  ground_truth?: string | null;
  description?: string | null;
}

export interface SuiteConfig {
  name: string;
  description?: string | null;
  min_pass_rate?: number;
  target: TargetConfig;
  default_assertions?: AssertionConfig[];
  tests: TestCase[];
}

export interface SuiteSummary {
  path: string;
  filename: string;
  name: string;
  description?: string | null;
  target_type: string;
  target_model: string;
  min_pass_rate: number;
  test_count: number;
}

export interface AssertionResult {
  assertion_type: string;
  passed: boolean;
  score: number;
  reason: string;
  strict: boolean;
}

export interface TestCaseResult {
  test_id: string;
  passed: boolean;
  completion: string;
  error?: string | null;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  assertion_results: AssertionResult[];
}

export interface SuiteRunResult {
  run_id: string;
  suite_name: string;
  target_model: string;
  passed: boolean;
  pass_rate: number;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  total_tokens: number;
  total_cost_usd: number;
  timestamp: string;
  results: TestCaseResult[];
}

export interface ArenaComparisonResult {
  suite_name: string;
  model_a: string;
  model_b: string;
  run_a: SuiteRunResult;
  run_b: SuiteRunResult;
  pass_rate_delta: number;
  latency_p50_delta_ms: number;
  cost_delta_usd: number;
  mismatched_test_ids: string[];
}

export interface ModelPricing {
  id: string;
  provider: string;
  input_price_per_1m: number;
  output_price_per_1m: number;
  currency: string;
}

export interface HistoricalTrendPoint {
  run_id: string;
  timestamp: string;
  pass_rate: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  total_cost_usd: number;
  total_tokens: number;
}

export interface CostEstimateResponse {
  suite_name: string;
  target_model: string;
  total_tests: number;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  total_estimated_tokens: number;
  estimated_cost_usd: number;
  cost_per_test_usd: number;
}
