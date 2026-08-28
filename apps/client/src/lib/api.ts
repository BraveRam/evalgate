import { apiClient } from "@/lib/axios";
import {
  ArenaComparisonResult,
  CostEstimateResponse,
  HistoricalTrendPoint,
  ModelPricing,
  SuiteConfig,
  SuiteRunResult,
  SuiteSummary,
  TestCase,
  TestCaseResult,
} from "@/types";

export const api = {
  // System
  getHealth: async (): Promise<{ status: string; version: string }> => {
    const { data } = await apiClient.get<{ status: string; version: string }>("/health");
    return data;
  },

  // Models & Pricing
  getModels: async (): Promise<ModelPricing[]> => {
    const { data } = await apiClient.get<ModelPricing[]>("/api/v1/models");
    return data;
  },

  // Suites
  listSuites: async (): Promise<SuiteSummary[]> => {
    const { data } = await apiClient.get<SuiteSummary[]>("/api/v1/suites");
    return data;
  },

  getSuite: async (name: string): Promise<SuiteConfig> => {
    const { data } = await apiClient.get<SuiteConfig>(`/api/v1/suites/${encodeURIComponent(name)}`);
    return data;
  },

  createSuite: async (
    suite: SuiteConfig,
    filename?: string
  ): Promise<{ message: string; path: string }> => {
    const params = filename ? { filename } : {};
    const { data } = await apiClient.post<{ message: string; path: string }>(
      "/api/v1/suites",
      suite,
      { params }
    );
    return data;
  },

  updateSuite: async (name: string, suite: SuiteConfig): Promise<{ message: string }> => {
    const { data } = await apiClient.put<{ message: string }>(
      `/api/v1/suites/${encodeURIComponent(name)}`,
      suite
    );
    return data;
  },

  deleteSuite: async (name: string): Promise<{ message: string }> => {
    const { data } = await apiClient.delete<{ message: string }>(
      `/api/v1/suites/${encodeURIComponent(name)}`
    );
    return data;
  },

  runSuite: async (
    name: string,
    params?: {
      model_override?: string;
      concurrency?: number;
      min_pass_rate_override?: number;
    }
  ): Promise<SuiteRunResult> => {
    const { data } = await apiClient.post<SuiteRunResult>(
      `/api/v1/suites/${encodeURIComponent(name)}/run`,
      params || {}
    );
    return data;
  },

  estimateCost: async (
    name: string,
    params?: { model_override?: string; estimated_output_tokens_per_test?: number }
  ): Promise<CostEstimateResponse> => {
    const { data } = await apiClient.post<CostEstimateResponse>(
      `/api/v1/suites/${encodeURIComponent(name)}/estimate-cost`,
      params || {}
    );
    return data;
  },

  // Historical Runs
  listRuns: async (suite?: string, limit = 30, offset = 0): Promise<SuiteRunResult[]> => {
    const params: Record<string, any> = { limit, offset };
    if (suite && suite !== "all") params.suite = suite;
    const { data } = await apiClient.get<SuiteRunResult[]>("/api/v1/runs", { params });
    return data;
  },

  getRun: async (runId: string): Promise<SuiteRunResult> => {
    const { data } = await apiClient.get<SuiteRunResult>(`/api/v1/runs/${encodeURIComponent(runId)}`);
    return data;
  },

  getRunTrends: async (
    runId: string,
    limit = 30
  ): Promise<{ suite_name: string; trends: HistoricalTrendPoint[] }> => {
    const { data } = await apiClient.get<{ suite_name: string; trends: HistoricalTrendPoint[] }>(
      `/api/v1/runs/${encodeURIComponent(runId)}/trends`,
      { params: { limit } }
    );
    return data;
  },

  deleteRun: async (runId: string): Promise<{ message: string }> => {
    const { data } = await apiClient.delete<{ message: string }>(
      `/api/v1/runs/${encodeURIComponent(runId)}`
    );
    return data;
  },

  // Arena Shootout
  compareArena: async (params: {
    suite_name: string;
    model_a: string;
    model_b: string;
    concurrency?: number;
  }): Promise<ArenaComparisonResult> => {
    const { data } = await apiClient.post<ArenaComparisonResult>(
      "/api/v1/arena/compare",
      params
    );
    return data;
  },

  // Playground Evaluation
  evaluatePlayground: async (params: {
    target: any;
    test_case: TestCase;
    assertions?: any[];
    judge_model?: string;
  }): Promise<TestCaseResult> => {
    const { data } = await apiClient.post<TestCaseResult>(
      "/api/v1/evaluate/playground",
      params
    );
    return data;
  },
};
