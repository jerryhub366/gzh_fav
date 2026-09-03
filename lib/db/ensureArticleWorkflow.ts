import { sql } from '@vercel/postgres';

let pending: Promise<void> | null = null;
const MIGRATION_ID = '20260903_article_workflow_v1';

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  const { rows: appliedRows } = await sql`
    SELECT 1 FROM schema_migrations WHERE id = ${MIGRATION_ID}
  `;
  if (appliedRows[0]) return;

  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS status TEXT`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS personal_note TEXT`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS research_question TEXT`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_type TEXT`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS extraction_status TEXT`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS extraction_method TEXT`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS extraction_error TEXT`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMP`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS workflow_updated_at TIMESTAMP`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS tags TEXT[]`;

  await sql`
    UPDATE articles
    SET
      status = COALESCE(status, 'inbox'),
      personal_note = COALESCE(personal_note, ''),
      research_question = COALESCE(research_question, ''),
      tags = COALESCE(tags, ARRAY[]::TEXT[]),
      source_type = COALESCE(
        source_type,
        CASE
          WHEN lower(url) LIKE '%://mp.weixin.qq.com/%' THEN 'wechat'
          WHEN lower(url) LIKE '%://x.com/%' OR lower(url) LIKE '%://twitter.com/%' THEN 'x'
          ELSE 'web'
        END
      ),
      extraction_status = COALESCE(
        extraction_status,
        CASE
          WHEN content IS NULL OR trim(content) = '' THEN 'failed'
          WHEN content ILIKE '%Readable content could not be extracted%'
            OR content ILIKE '%no web page body was extracted%' THEN 'link_only'
          WHEN content ILIKE '%Only the page summary was available%' THEN 'partial'
          ELSE 'full'
        END
      ),
      extraction_method = COALESCE(extraction_method, 'legacy'),
      extracted_at = COALESCE(extracted_at, collected_at),
      workflow_updated_at = COALESCE(workflow_updated_at, collected_at, NOW())
    WHERE
      status IS NULL
      OR personal_note IS NULL
      OR research_question IS NULL
      OR tags IS NULL
      OR source_type IS NULL
      OR extraction_status IS NULL
      OR extraction_method IS NULL
      OR extracted_at IS NULL
      OR workflow_updated_at IS NULL
  `;

  await sql`
    UPDATE articles
    SET extraction_status = CASE
      WHEN content IS NULL OR trim(content) = '' THEN 'failed'
      WHEN content ILIKE '%Readable content could not be extracted%'
        OR content ILIKE '%no web page body was extracted%' THEN 'link_only'
      WHEN content ILIKE '%Only the page summary was available%' THEN 'partial'
      WHEN length(trim(regexp_replace(regexp_replace(content, '<[^>]*>', ' ', 'g'), '\\s+', ' ', 'g'))) < 80
        THEN 'partial'
      ELSE 'full'
    END
    WHERE extraction_method = 'legacy'
  `;

  await sql`ALTER TABLE articles ALTER COLUMN status SET DEFAULT 'inbox'`;
  await sql`ALTER TABLE articles ALTER COLUMN status SET NOT NULL`;
  await sql`ALTER TABLE articles ALTER COLUMN personal_note SET DEFAULT ''`;
  await sql`ALTER TABLE articles ALTER COLUMN personal_note SET NOT NULL`;
  await sql`ALTER TABLE articles ALTER COLUMN research_question SET DEFAULT ''`;
  await sql`ALTER TABLE articles ALTER COLUMN research_question SET NOT NULL`;
  await sql`ALTER TABLE articles ALTER COLUMN tags SET DEFAULT ARRAY[]::TEXT[]`;
  await sql`ALTER TABLE articles ALTER COLUMN tags SET NOT NULL`;
  await sql`ALTER TABLE articles ALTER COLUMN extraction_status SET DEFAULT 'full'`;
  await sql`ALTER TABLE articles ALTER COLUMN extraction_status SET NOT NULL`;
  await sql`ALTER TABLE articles ALTER COLUMN workflow_updated_at SET DEFAULT NOW()`;
  await sql`ALTER TABLE articles ALTER COLUMN workflow_updated_at SET NOT NULL`;

  await sql`CREATE INDEX IF NOT EXISTS idx_articles_status_seq ON articles (status, seq DESC NULLS LAST)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_articles_extraction_status ON articles (extraction_status)`;
  await sql`INSERT INTO schema_migrations (id) VALUES (${MIGRATION_ID}) ON CONFLICT (id) DO NOTHING`;
}

export function ensureArticleWorkflow() {
  if (!pending) {
    pending = migrate().catch((error) => {
      pending = null;
      throw error;
    });
  }

  return pending;
}

export default ensureArticleWorkflow;
