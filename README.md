# gzh_fav

A Next.js app for collecting and archiving WeChat public account articles.

## Admin editing

Set `ADMIN_TOKEN` in the local environment and in Vercel. Collecting, personal notes,
workflow changes, and article editing are disabled when this variable is missing.

Open a private link once to verify and save the token in that browser:

```text
https://fav.ladebuid.com/<article-id>#/admin/<ADMIN_TOKEN>
```

After verification, the server creates a 90-day HttpOnly session cookie and removes the
token from the URL and local storage. The article list and individual article pages then
show private workflow controls.

## Reading workflow

Every article starts in `inbox` and can be moved to `kept`, `research`, `done`, or
`skipped`. Personal notes, research questions, and tags are private and require the admin
session. Public article pages and short links do not expose these fields.

The Research filter exposes a Markdown export at `/api/research/export`. It contains the
selected articles, personal notes, research questions, and extracted text for handing off
to an agent.
