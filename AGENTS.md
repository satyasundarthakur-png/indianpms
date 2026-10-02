<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the uploaded portfolio's domain calculations in `src/lib/portfolio.ts` and compute AI context from authenticated database rows on the server, because client-provided financial figures can be altered.
- Use Cloud authentication with per-user row policies rather than the uploaded custom account table, because its plaintext passwords and unrestricted policies expose accounts and holdings.
- Proxy the stock search and quotes through a validated TanStack server route, because the uploaded development proxy does not exist on deployment.
- Keep user-pasted AI provider keys only in page memory and pass them to the authenticated analysis server function for the current request; never store them in browser storage or the database.
