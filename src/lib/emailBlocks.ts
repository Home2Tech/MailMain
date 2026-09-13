export type EmailBlock =
  | { id: string; type: "text"; html: string }
  | { id: string; type: "columns"; leftHtml: string; rightHtml: string }
  | { id: string; type: "image"; src: string; alt: string; width: number; alignment?: "left" | "center" | "right" }
  | { id: string; type: "rss-image"; width: number; alignment?: "left" | "center" | "right" }
  | { id: string; type: "divider"; color: string }
  | { id: string; type: "spacer"; height: number };

const id = () => crypto.randomUUID();

export function newTextBlock(html = "<p>Start writing your email here.</p>"): EmailBlock {
  return { id: id(), type: "text", html };
}

export function parseBlocks(content: unknown, fallbackHtml: string): EmailBlock[] {
  if (Array.isArray(content) && content.length > 0) return content as EmailBlock[];
  return fallbackHtml ? [newTextBlock(fallbackHtml)] : [newTextBlock()];
}

export function blocksToHtml(blocks: EmailBlock[]): string {
  const body = blocks
    .map((block) => {
      switch (block.type) {
        case "text":
          return `<div style="padding:12px 0">${block.html}</div>`;
        case "columns":
          return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0"><tr><td width="50%" valign="top" style="padding-right:10px">${block.leftHtml}</td><td width="50%" valign="top" style="padding-left:10px">${block.rightHtml}</td></tr></table>`;
        case "image":
          return `<img src="${block.src}" alt="${block.alt}" width="${block.width}" style="display:block;max-width:100%;height:auto;margin:12px ${block.alignment === "left" ? "0" : block.alignment === "right" ? "0 0 0 auto" : "auto"}" />`;
        case "rss-image":
          return `<img src="{{post_image_url}}" alt="" width="${block.width}" style="display:block;max-width:100%;height:auto;margin:12px ${block.alignment === "left" ? "0" : block.alignment === "right" ? "0 0 0 auto" : "auto"}" />`;
        case "divider":
          return `<hr style="border:0;border-top:1px solid ${block.color};margin:24px 0" />`;
        case "spacer":
          return `<div style="height:${block.height}px;line-height:${block.height}px">&nbsp;</div>`;
      }
    })
    .join("");

  return `<div style="max-width:640px;margin:0 auto;padding:32px;font-family:Arial,sans-serif;color:#172033;line-height:1.55">${body}</div>`;
}
