# Resume Pipeline Benchmark Suite

Run the suite with:

```powershell
npm run test:resume-pipeline
```

The suite contains ten representative text-resume cases for deterministic parsing, post-LLM validation, and recommendation planning. It does not call OpenRouter or Supabase.

The photo case is an explicit capability baseline: the current production PDF extractor does not detect embedded images or profile photos, so the expected result is `false`. This keeps the benchmark honest and makes a later photo-extraction implementation measurable.
