# gzh_fav

A Next.js app for collecting and archiving WeChat public account articles.

## Admin editing

Set `ADMIN_TOKEN` in the local environment and in Vercel. Article editing is disabled when this variable is missing.

Open a private link once to verify and save the token in that browser:

```text
https://fav.ladebuid.com/<article-id>#/admin/<ADMIN_TOKEN>
```

After verification, the Edit link appears on article pages and edit requests include the token automatically. Clearing the site's local storage signs the browser out.
