# 🌸 Services: Llumen AI Chat Engine

This directory documents the core Llumen workload ([pinkfuwa/llumen](https://github.com/pinkfuwa/llumen)).

---

## 🚀 Overview

Llumen is an ultra-fast, lightweight self-hosted ChatGPT alternative built in Rust:
- **Ultra-minimal Footprint**: ~17MB static musl binary, <128MB RAM footprint, runs from `scratch` container.
- **Sub-second Cold Starts**: Instant token streaming, multi-turn conversations, PDF upload, and LaTeX rendering.
- **Enterprise Header Auth**: Natively supports `TRUSTED_HEADER` (`X-Forwarded-User`) and `LOGOUT_URL`.

---

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `API_KEY` | **Yes** | - | OpenRouter API Key or upstream LLM provider key |
| `API_BASE` | No | `https://openrouter.ai/api` | OpenAI-compatible API base URL |
| `DATA_PATH` | No | `/data` | SQLite (`db.sqlite`) and Redb storage path |
| `BIND_ADDR` | No | `0.0.0.0:80` | Internal listening socket |
| `TRUSTED_HEADER` | No | `X-Forwarded-User` | HTTP header containing authenticated username |
| `LOGOUT_URL` | No | - | Upstream SSO / SLO logout redirect endpoint |
| `RUST_LOG` | No | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |

---

## 🔒 Storage Architecture

The `/data` volume contains:
1. `db.sqlite`: SQLite database housing users, chat sessions, prompts, and models.
2. `blobs.redb`: High-speed embedded Redb key-value store for file attachments and cached images.
