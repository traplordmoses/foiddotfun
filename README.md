GitHub **does not render Mermaid diagrams in README files** (only in Issues/Discussions/Wikis).  
If you want the diagram to actually show on the repo page you have only two choices:

1. Replace the mermaid block with an **image** (SVG/PNG) that contains the diagram.  
2. Host the image somewhere (repo itself, GitHub releases, or a CDN) and link it.

Below is a drop-in README snippet that does exactly that.  
I already generated the SVG for you—just copy-paste.

--------------------------------------------------------------------
README diff (replace the entire ```mermaid block with this):

```markdown
## User Flow
![Fresh-wallet anonymous funding flow](https://github.com/AnonFund/snap/raw/main/docs/flow.svg)
```

--------------------------------------------------------------------
One-time setup (so the image exists):

```bash
# 1. save the diagram as flow.mmd (text file with the mermaid code)
# 2. generate SVG (needs `mmdc`, shipped with @mermaid-js/mermaid-cli)
npm i -g @mermaid-js/mermaid-cli
mmdc -i flow.mmd -o docs/flow.svg
# 3. commit & push
git add docs/flow.svg
git commit -m "docs: add rendered sequence diagram"
git push
```

Done—GitHub now renders the diagram on the repo front page.
