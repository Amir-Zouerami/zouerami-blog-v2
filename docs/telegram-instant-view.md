# Telegram Instant View

Instant View is a template that Telegram applies to article pages of a domain. It is created and reviewed on
<https://instantview.telegram.org> (log in with Telegram). Nothing in the site's code switches it on.

## What the site provides (already in place)
- `<article>` with the post body in `.prose`, headings with ids, figures with `<figcaption>`, code blocks in `.term`.
- Title in the page's `<h1>`, `og:title`, `og:description`, `og:image` (1200×630 card per post and language).
- `article:published_time`, `article:tag`, `article:author` and a `<time datetime>` for the date.
- Persian posts: `dir="rtl"` and `lang="fa"` on the post body.

## Steps (once the site is public)
1. Open the editor, paste a post URL (for example `https://amir-zouerami.dev/blog/hello-bilingual`), press Enter.
2. Paste the draft below in the editor's left pane. The right pane shows the result and any errors.
3. Check an English post, a Persian post, one with code, one with an image and one with a Mermaid diagram.
4. Press "Publish", then "Submit for review" once the Checklist tab is green. Review takes days, sometimes weeks.
5. After approval, Telegram shows the lightning button for `/blog/...` and `/fa/blog/...` links. Telegram caches pages:
   use `@WebpageBot` to refresh a link after you change it.

## Draft template (IV 2.1; adjust in the editor with the live preview)
```
~version: "2.1"

?path: /blog/.+
?path: /fa/blog/.+

site_name: "Amir Zouerami"
title: $//header[has-class("post-head")]//h1
author: "Amir Zouerami"
author_url: "https://amir-zouerami.dev/about"
published_date: $//meta[@property="article:published_time"]/@content
date_format: "%Y-%m-%dT%H:%M:%S.%fZ"
cover: $//meta[@property="og:image"]/@content
kicker: $//header[has-class("post-head")]//span[has-class("tagp")][1]
description: $//meta[@property="og:description"]/@content

body: //article//div[has-class("prose")]

@remove: //a[has-class("anchor")]
@remove: //button[has-class("copy")]
@remove: //div[has-class("tb")]
@remove: //div[has-class("langbar")]
```
Notes: code blocks become Telegram code blocks, `<blockquote>` becomes a pull quote, `<figure>` becomes a captioned
image. Mermaid diagrams are inline SVG and are dropped by Instant View: if one matters, add a plain image fallback.
Telegram controls the look (fonts, colours, light/dark); a template only chooses which elements go where.
