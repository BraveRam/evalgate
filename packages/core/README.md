# EvalGate Core Engine

Fast, local-first prompt regression testing, LLM-as-a-judge evaluation gates, and model benchmark shootout platform for applied AI engineers.

## Installation

```bash
pip install evalgate
```

## CLI Usage

```bash
evalgate init
evalgate run evals/rag_qa.yaml
evalgate compare evals/hard_reasoning_challenge.yaml --model-a openai/gpt-4o-mini --model-b deepseek/deepseek-v4-pro-0813
evalgate studio
```
