# Library readiness and concept references

Reviewed October 25, 2026.

The curriculum contains 60 lessons: Domain 1 has 10, Domain 2 has 11, Domain 3 has 8, Domain 4 has 16, and Domain 5 has 15. The three practice-exam entries are separate. ISACA's current [CISA content outline](https://www.isaca.org/credentialing/cisa/cisa-exam-content-outline) lists the five domains with weights 18%, 18%, 12%, 26%, and 26%. The catalog's `knowledgePoints` values are inherited learning-system metadata, not counts of imported or missing questions.

## Import and category handling

- `lessonMatchDetails` first checks canonical names and aliases. Distinctive full titles with at most a few character errors can match conservatively; transposed letters count as one error. Short or partial names are never fuzzy matched. Explicit domain hints constrain the match.
- Batch imports record an explicit source: ISACA QAE Paste (default), Udemy supplemental, Other supplemental, or Practice exam. Source selection is a user classification, not verification of provenance. Existing QAE provenance is retained when an exact card is reimported from a supplemental source.
- Recognized practice-exam collections retain their exam ID and each question’s own domain. Mixed lesson metadata is preserved rather than replaced by one filename category.
- Spelling matches in batch imports require review. Ambiguous names remain unresolved. The document filename still becomes the editable deck title.
- `auditLibrary` plans category patches from metadata and containing decks. It does not classify a question by guessing from its wording. Explicit manual card and deck categories, including deliberately unlinked cards, are preserved. Mixed-domain and contradictory records remain visible for review.
- Category planning is limited to the signed-in visitor's loaded library. Writes remain limited to their personal scope and active Guild, with persistence-layer validation. This release did not access or recategorize all private production accounts.
- Exact duplicate checks normalize whitespace, Unicode and typographical quotes, and compare the question plus sorted answer-choice text. Reordered answer letters still match. Different answer meanings become an answer-key conflict. Similar but nonidentical wording is not automatically merged.
- The parser also accepts lowercase question/choice labels, parentheses after answer letters, `Correct answer: A`, and `Explanation:` sections. It excludes answer/explanation metadata from choices and rejects correct-answer letters that do not exist in the parsed choices.
- No records are deleted, and no existing study evidence is discarded by the audit. Before applying a category plan, the existing UI exports a snapshot.

## Supplemental concept guidance

`js/lesson-guidance.js` provides all 60 lessons with an original teach-back question and one or two primary-source reading links. The links supplement the existing original microlessons and the learner's imported rationale. They are not official answer keys, a replacement for the QAE, or claims that a publication completely covers an entire lesson. PostgreSQL examples illustrate database concepts; their implementation details are not universal exam rules. ISACA overview pages are free to read, while some linked publications require an account or purchase.

Source pages were opened or retrieved from their publishers on October 25, 2026. The reviewed source catalog is exported as `GUIDANCE_SOURCES`; each item records title, URL, publisher and access notes. It includes:

- ISACA's Code of Professional Ethics, IT Audit Resources/ITAF and COBIT resources.
- NIST Cybersecurity Framework and Privacy Framework.
- NIST SP 800-53 Rev. 5, SP 800-53A Rev. 5, SP 800-30 Rev. 1, and SP 800-37 Rev. 2 for controls, assessments and risk.
- NIST SP 800-161 Rev. 1, SP 800-55 Vol. 1, and Baldrige resources for supplier risk, measurement and quality.
- NIST SP 800-218 and SP 800-128 for development and configuration.
- NIST SP 800-34 Rev. 1 and SP 800-160 Vol. 2 Rev. 1 for continuity and resilience.
- NIST SP 800-63-4, SP 800-207, SP 800-57 Part 1 Rev. 5, SP 800-145, SP 800-124 Rev. 2 and SP 800-50 Rev. 1 for identity, architecture, keys, cloud, mobile and learning programs.
- NIST SP 800-92, SP 800-115, SP 800-61 Rev. 3 and SP 800-86 for logs, assessment, response and forensics.
- Official PostgreSQL concurrency-control and backup/restore documentation.

The catalog links to publisher pages instead of copying their publications. Study prompts are written for this application. No paid course, paid question bank, or authenticated exam content was fetched or redistributed as part of this research.

## Validation

`tests/library-readiness.test.mjs` covers all 60 mappings, source URL constraints, conservative spelling matching, domain conflicts, manual-category preservation, filename previews, parser variants, invalid answer rejection and reordered exact duplicates. Existing lesson-library, library-audit, batch-importer and parser-privacy tests also pass.
