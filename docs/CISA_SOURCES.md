# CISA curriculum and optional local AI sources

Verified 24 October 2026. Only primary publishers are used below. Links are references, not bundled copies of the linked material.

## Exam blueprint

ISACA’s current [CISA exam content outline](https://www.isaca.org/credentialing/cisa/cisa-exam-content-outline) lists 150 questions and these domain weights:

| Domain | Weight |
| --- | ---: |
| 1 — Information Systems Auditing Process | 18% |
| 2 — Governance and Management of IT | 18% |
| 3 — Information Systems Acquisition, Development and Implementation | 12% |
| 4 — Information Systems Operations and Business Resilience | 26% |
| 5 — Protection of Information Assets | 26% |

The percentages describe the exam blueprint, not a prediction of an individual candidate’s score. Imported-question counts and mastery percentages must remain separate from exam weighting. The app’s existing lesson catalog maps the outline into 60 lesson topics, plus three practice-exam entries; practice exams are not a sixth weighted domain.

## Original learning content

`js/cisa-learning.js` contains 60 original ControlQuest micro-lessons, one for each existing lesson ID. Every lesson includes:

- A compact explanation of the concept.
- A distinct workplace scenario.
- A common reasoning trap.
- A retrieval prompt for recall before revealing an answer.
- One original four-choice checkpoint with an explanation.

The checkpoints are new teaching examples. They are not copied QAE questions, official exam items or an ISACA-endorsed course. The lessons provide a topic-complete introductory scaffold; they do not claim the depth, assurance or completeness of a comprehensive certification course. Use them with licensed QAE explanations, the official outline and deeper references. No free, complete official CISA training course was established by this research.

The app can read the explanation, scenario, trap and retrieval prompt through browser speech synthesis. That script intentionally excludes the checkpoint answer and rationale so listening does not reveal an upcoming checkpoint’s solution. Browser voices and offline availability depend on the device.

## Free reference and reinforcement

| Source | What it supports | Access qualification |
| --- | --- | --- |
| [ISACA CISA exam outline](https://www.isaca.org/credentialing/cisa/cisa-exam-content-outline) | Official domain weighting and topic alignment | Public reference |
| [ISACA CISA practice quiz](https://www.isaca.org/credentialing/cisa/cisa-practice-quiz) | A small official sample of exam-style practice | Free; the page requests a form to view results |
| [ISACA interactive glossary](https://www.isaca.org/resources/glossary) | Audit, governance, risk and security terminology | Public reference |
| [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework) | Supplementary business-focused cybersecurity outcomes | Public framework; not a CISA course |
| [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) | Supplementary security/privacy control details and related updates | Public control reference; not an exam-specific answer key |

ISACA’s outline determines topic alignment. General professional concepts in the original explanations are not quotations from the references. NIST is supplementary and should not be treated as a replacement for the CISA blueprint or as proof that every organization must implement every listed control.

## Optional AI: browser inference

The primary [WebLLM documentation](https://webllm.mlc.ai/docs/) describes in-browser model inference with WebGPU. Its [installation guide](https://webllm.mlc.ai/docs/user/get_started.html) documents CDN imports, and its [basic usage guide](https://webllm.mlc.ai/docs/user/basic_usage.html) documents `CreateMLCEngine`, model loading progress and chat completions.

A reproducible optional runtime is:

- Package: `@mlc-ai/web-llm@0.2.85`.
- Browser import: `https://esm.run/@mlc-ai/web-llm@0.2.85`.
- Small model ID: `Qwen2.5-0.5B-Instruct-q4f32_1-MLC`.
- Package-reported VRAM requirement: approximately 1,060 MB, with a 4,096-token context override.
- An f16 alternative is `Qwen2.5-0.5B-Instruct-q4f16_1-MLC`, reported at approximately 945 MB; hardware requirements still need checking.

Both exact IDs were verified against `package/lib/index.js` inside the official [0.2.85 npm tarball](https://registry.npmjs.org/@mlc-ai/web-llm/-/web-llm-0.2.85.tgz). The publisher’s [source model configuration](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts) is also a useful reference, but its main branch can move independently of the pinned release.

A user-triggered download, progress display, cancellation/error handling and deterministic fallback are important. Model download size is not the same as runtime memory consumption. WebGPU availability alone does not guarantee that a model will fit or perform acceptably on a phone. No model inference or actual browser package loading was verified during this research.

The model may explain an original lesson or compare reasoning against an already established answer. It must not silently replace the answer key, award mastery or make the daily study plan depend on successful inference. Label generated responses and keep the relevant original explanation visible. Open-weight model availability does not remove the need to review the model’s license.

## Optional AI: local Ollama

The primary [Ollama API introduction](https://docs.ollama.com/api/introduction) documents local chat at `http://localhost:11434/api/chat`. A locally running model does not require a cloud API key. The [Ollama FAQ](https://docs.ollama.com/faq) documents bind settings, `OLLAMA_ORIGINS`, local/cloud behavior and optional cloud disabling. The [Qwen3 model page](https://ollama.com/library/qwen3) lists several sizes available through Ollama.

Use an origin allowlist for the exact app origin rather than a wildcard. A phone’s `localhost` refers to the phone, not Bennett’s Windows computer. A public HTTPS app may also encounter browser local-network, mixed-content or cross-origin restrictions. Do not present a desktop’s local Ollama address as a working phone endpoint. Remote use needs an appropriately protected service and explicit deployment configuration; do not expose the unauthenticated local inference port to the public Internet.

Local inference removes per-request cloud API charges but still uses device hardware, storage and power. It is an optional study aid rather than a prerequisite for importing, scheduling, gameplay or mastery calculations.

## Checks

Run `node tests/cisa-learning.test.mjs` to check the 60-topic mapping, distinct explanations/scenarios/checkpoints, answer-choice distribution, source IDs, blueprint totals and speech prompts.
