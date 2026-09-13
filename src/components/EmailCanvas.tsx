import { useEffect, useRef, useState } from "react";
import {
  Bold,
  AlignCenter,
  AlignLeft,
  AlignRight,
  List,
  ListOrdered,
  Columns2,
  Heading,
  ImagePlus,
  Italic,
  Link,
  Minus,
  MousePointerClick,
  Pilcrow,
  ChevronDown,
  ChevronUp,
  Trash2,
  Underline,
  Upload,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import type { EmailBlock } from "../lib/emailBlocks";

interface EmailCanvasProps {
  blocks: EmailBlock[];
  onChange: (blocks: EmailBlock[]) => void;
}

const mergeFields = ["first_name", "email", "list_name", "post_title", "post_excerpt", "post_url", "post_image_url"];

export default function EmailCanvas({ blocks, onChange }: EmailCanvasProps) {
  const selection = useRef<Range | null>(null);
  const editableElement = useRef<HTMLElement | null>(null);
  const selectedButton = useRef<HTMLAnchorElement | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(blocks[0]?.id ?? null);
  const [activeMode, setActiveMode] = useState<"fields" | "content">("fields");
  const [uploading, setUploading] = useState(false);
  const [buttonSelected, setButtonSelected] = useState(false);

  function saveSelection(blockId: string) {
    setActiveBlockId(blockId);
    const activeElement = document.activeElement as HTMLElement | null;
    if (activeElement?.dataset.blockId) editableElement.current = activeElement;
    const current = window.getSelection();
    if (current?.rangeCount) {
      selection.current = current.getRangeAt(0).cloneRange();
      const node = current.anchorNode instanceof Element ? current.anchorNode : current.anchorNode?.parentElement;
      selectedButton.current = node?.closest("a[data-email-button]") ?? null;
      setButtonSelected(Boolean(selectedButton.current));
    }
  }

  function updateBlock(id: string, patch: Partial<EmailBlock>) {
    onChange(blocks.map((block) => (block.id === id ? ({ ...block, ...patch } as EmailBlock) : block)));
  }

  function insertHtml(html: string) {
    const current = window.getSelection();
    if (selection.current && current) {
      current.removeAllRanges();
      current.addRange(selection.current);
    }
    document.execCommand("insertHTML", false, html);
    const element = document.activeElement as HTMLElement | null;
    if (element?.dataset.blockId) {
      updateTextFromElement(element);
    }
  }

  function updateTextFromElement(element: HTMLElement) {
    const blockId = element.dataset.blockId;
    const column = element.dataset.column;
    if (!blockId) return;
    const block = blocks.find((item) => item.id === blockId);
    if (!block) return;
    if (block.type === "text") updateBlock(blockId, { html: element.innerHTML });
    if (block.type === "columns") {
      updateBlock(blockId, column === "left" ? { leftHtml: element.innerHTML } : { rightHtml: element.innerHTML });
    }
  }

  function applyCommand(command: string, value?: string) {
    restoreSelection();
    document.execCommand(command, false, value);
    if (editableElement.current) updateTextFromElement(editableElement.current);
  }

  function alignText(alignment: "left" | "center" | "right") {
    restoreSelection();
    const selectedNode = window.getSelection()?.anchorNode;
    const element = selectedNode instanceof Element ? selectedNode : selectedNode?.parentElement;
    const target = element?.closest("h1, h2, h3, h4, h5, h6, p, li, div");
    if (target instanceof HTMLElement) target.style.textAlign = alignment;
    if (editableElement.current) updateTextFromElement(editableElement.current);
  }

  function restoreSelection() {
    const current = window.getSelection();
    if (selection.current && current) {
      current.removeAllRanges();
      current.addRange(selection.current);
    }
  }

  function updateInlineButton(style: "backgroundColor" | "color", value: string) {
    const button = selectedButton.current;
    if (!button) return;
    button.style[style] = value;
    if (editableElement.current) updateTextFromElement(editableElement.current);
  }

  function addBlock(block: EmailBlock) {
    const activeIndex = blocks.findIndex((item) => item.id === activeBlockId);
    const nextBlocks = [...blocks];
    nextBlocks.splice(activeIndex >= 0 ? activeIndex + 1 : blocks.length, 0, block);
    onChange(nextBlocks);
    setActiveBlockId(block.id);
  }

  function insertTextBlock(html: string) {
    const focusedElement = document.activeElement as HTMLElement | null;
    if (focusedElement?.dataset.blockId) insertHtml(html);
    else addBlock({ id: crypto.randomUUID(), type: "text", html });
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const index = blocks.findIndex((block) => block.id === id);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= blocks.length) return;
    const reordered = [...blocks];
    [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
    onChange(reordered);
  }

  function deleteBlock(id: string) {
    if (!window.confirm("Delete this block?")) return;
    const remaining = blocks.filter((block) => block.id !== id);
    const nextBlocks = remaining.length ? remaining : [{ id: crypto.randomUUID(), type: "text" as const, html: "<p>Start writing your email here.</p>" }];
    onChange(nextBlocks);
    setActiveBlockId(nextBlocks[0].id);
  }

  function insertLink() {
    const url = window.prompt("Link URL", "https://");
    if (url) applyCommand("createLink", url);
  }

  function insertButton() {
    const url = window.prompt("Button destination URL", "https://");
    if (!url) return;
    insertHtml(`<a data-email-button="true" href="${url}" style="display:inline-block;background-color:#0f766e;color:#ffffff;padding:12px 20px;border-radius:4px;text-decoration:none;font-weight:bold">Button text</a>`);
  }

  async function uploadImage(file: File) {
    if (!file.type.match(/^image\/(jpeg|png|webp|gif)$/) || file.size > 5 * 1024 * 1024) {
      window.alert("Choose a JPG, PNG, WebP, or GIF smaller than 5 MB.");
      return;
    }
    setUploading(true);
    const path = `templates/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error } = await supabase.storage.from("email-images").upload(path, file, { upsert: false });
    setUploading(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    const { data } = supabase.storage.from("email-images").getPublicUrl(path);
    addBlock({ id: crypto.randomUUID(), type: "image", src: data.publicUrl, alt: file.name, width: 600, alignment: "center" });
  }

  const activeTextBlock = blocks.find((block) => block.id === activeBlockId && (block.type === "text" || block.type === "columns"));

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
        <div className="flex rounded-md bg-slate-100 p-0.5">
          <button onClick={() => setActiveMode("fields")} className={`rounded px-3 py-1 text-xs font-semibold ${activeMode === "fields" ? "bg-slate-900 text-white" : "text-slate-600"}`}>Fields</button>
          <button onClick={() => setActiveMode("content")} className={`rounded px-3 py-1 text-xs font-semibold ${activeMode === "content" ? "bg-slate-900 text-white" : "text-slate-600"}`}>Content</button>
        </div>
        {activeTextBlock && (
          <div className="flex items-center gap-1">
            <ToolbarButton label="Bold" icon={<Bold size={16} />} onClick={() => applyCommand("bold")} />
            <ToolbarButton label="Italic" icon={<Italic size={16} />} onClick={() => applyCommand("italic")} />
            <ToolbarButton label="Underline" icon={<Underline size={16} />} onClick={() => applyCommand("underline")} />
            <ToolbarButton label="Align left" text="Left" icon={<AlignLeft size={16} />} onClick={() => alignText("left")} />
            <ToolbarButton label="Align center" text="Center" icon={<AlignCenter size={16} />} onClick={() => alignText("center")} />
            <ToolbarButton label="Align right" text="Right" icon={<AlignRight size={16} />} onClick={() => alignText("right")} />
            <ToolbarButton label="Bulleted list" icon={<List size={16} />} onClick={() => applyCommand("insertUnorderedList")} />
            <ToolbarButton label="Numbered list" icon={<ListOrdered size={16} />} onClick={() => applyCommand("insertOrderedList")} />
            <select aria-label="Text size" onChange={(event) => applyCommand("fontSize", event.target.value)} defaultValue="3" className="h-8 rounded border border-slate-300 bg-white px-1 text-xs">
              <option value="2">Small</option><option value="3">Body</option><option value="5">Large</option><option value="6">Title</option>
            </select>
            <input aria-label="Text color" type="color" defaultValue="#172033" onChange={(event) => applyCommand("foreColor", event.target.value)} className="h-8 w-8 rounded border border-slate-300 p-1" />
            {buttonSelected && <><input aria-label="Button background color" type="color" defaultValue="#0f766e" onChange={(event) => updateInlineButton("backgroundColor", event.target.value)} className="h-8 w-8 rounded border border-slate-300 p-1" /><input aria-label="Button text color" type="color" defaultValue="#ffffff" onChange={(event) => updateInlineButton("color", event.target.value)} className="h-8 w-8 rounded border border-slate-300 p-1" /></>}
          </div>
        )}
      </div>

      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        {activeMode === "fields" ? (
          <div className="flex flex-wrap gap-2">
            {mergeFields.map((field) => <button key={field} onClick={() => insertHtml(`{{${field}}}`)} className="rounded border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100">{`{{${field}}}`}</button>)}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <ToolbarButton label="Heading" icon={<Heading size={16} />} onClick={() => insertTextBlock("<h2>Section heading</h2>")} />
            <ToolbarButton label="Text" icon={<Pilcrow size={16} />} onClick={() => insertTextBlock("<p>New paragraph</p>")} />
            <ToolbarButton label="Link" icon={<Link size={16} />} onClick={insertLink} />
            <ToolbarButton label="Button" icon={<MousePointerClick size={16} />} onClick={insertButton} />
            <ToolbarButton label="Columns" icon={<Columns2 size={16} />} onClick={() => addBlock({ id: crypto.randomUUID(), type: "columns", leftHtml: "<p>Left column</p>", rightHtml: "<p>Right column</p>" })} />
            <ToolbarButton label="Divider" icon={<Minus size={16} />} onClick={() => addBlock({ id: crypto.randomUUID(), type: "divider", color: "#cbd5e1" })} />
            <ToolbarButton label="RSS image" icon={<ImagePlus size={16} />} onClick={() => addBlock({ id: crypto.randomUUID(), type: "rss-image", width: 480, alignment: "center" })} />
            <ToolbarButton label="Image" icon={<ImagePlus size={16} />} onClick={() => document.getElementById("image-upload")?.click()} />
            <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50"><Upload size={16} />{uploading ? "Uploading" : "Upload image"}<input id="image-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadImage(file); event.currentTarget.value = ""; }} /></label>
          </div>
        )}
      </div>

      <div className="space-y-3 bg-slate-100 p-4">
        {blocks.map((block, index) => <CanvasBlock key={block.id} block={block} selected={block.id === activeBlockId} onFocus={saveSelection} onChange={updateTextFromElement} onUpdate={updateBlock} onMove={moveBlock} onDelete={deleteBlock} canMoveUp={index > 0} canMoveDown={index < blocks.length - 1} />)}
      </div>
    </div>
  );
}

function CanvasBlock({ block, selected, onFocus, onChange, onUpdate, onMove, onDelete, canMoveUp, canMoveDown }: { block: EmailBlock; selected: boolean; onFocus: (id: string) => void; onChange: (element: HTMLElement) => void; onUpdate: (id: string, patch: Partial<EmailBlock>) => void; onMove: (id: string, direction: -1 | 1) => void; onDelete: (id: string) => void; canMoveUp: boolean; canMoveDown: boolean }) {
  const shell = `relative bg-white p-4 ${selected ? "ring-2 ring-teal-500" : "ring-1 ring-slate-200"}`;
  const controls = <div className="absolute right-2 top-2 z-10 flex rounded border border-slate-200 bg-white shadow-sm"><button type="button" title="Move block up" aria-label="Move block up" disabled={!canMoveUp} onClick={() => onMove(block.id, -1)} className="grid h-7 w-7 place-items-center disabled:opacity-30"><ChevronUp size={16} /></button><button type="button" title="Move block down" aria-label="Move block down" disabled={!canMoveDown} onClick={() => onMove(block.id, 1)} className="grid h-7 w-7 place-items-center disabled:opacity-30"><ChevronDown size={16} /></button><button type="button" title="Delete block" aria-label="Delete block" onClick={() => onDelete(block.id)} className="grid h-7 w-7 place-items-center border-l border-slate-200 text-red-700 hover:bg-red-50"><Trash2 size={15} /></button></div>;
  if (block.type === "text") return <div className={shell}>{controls}<EditableHtml html={block.html} blockId={block.id} onFocus={onFocus} onChange={onChange} className="min-h-14 pr-16 outline-none [&_h2]:text-2xl [&_h2]:font-bold [&_p]:my-2" /></div>;
  if (block.type === "columns") return <div className={`${shell} grid grid-cols-2 gap-4`}>{controls}<EditableHtml html={block.leftHtml} blockId={block.id} column="left" onFocus={onFocus} onChange={onChange} className="min-h-16 border-r border-slate-200 pr-3 outline-none" /><EditableHtml html={block.rightHtml} blockId={block.id} column="right" onFocus={onFocus} onChange={onChange} className="min-h-16 outline-none" /></div>;
  if (block.type === "image") { const alignment = block.alignment ?? "center"; return <div className={shell}>{controls}<img src={block.src} alt={block.alt} style={{ width: `${block.width}px` }} className={`max-w-full ${alignment === "left" ? "mr-auto" : alignment === "right" ? "ml-auto" : "mx-auto"}`} /><div className="mt-3 grid gap-2 sm:grid-cols-2"><input value={block.alt} onChange={(event) => onUpdate(block.id, { alt: event.target.value })} placeholder="Image description" className="rounded border border-slate-300 px-2 py-1 text-sm" /><input type="number" min="100" max="640" value={block.width} onChange={(event) => onUpdate(block.id, { width: Number(event.target.value) })} className="rounded border border-slate-300 px-2 py-1 text-sm" /><label className="text-xs font-medium">Alignment <select value={alignment} onChange={(event) => onUpdate(block.id, { alignment: event.target.value as "left" | "center" | "right" })} className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label></div></div>; }
  if (block.type === "rss-image") { const alignment = block.alignment ?? "center"; return <div className={shell}>{controls}<div className={`grid h-32 place-items-center border border-dashed border-teal-300 bg-teal-50 text-sm font-medium text-teal-800 ${alignment === "left" ? "text-left" : alignment === "right" ? "text-right" : "text-center"}`}>RSS featured image<br /><span className="text-xs font-normal">Resolved from {'{{post_image_url}}'} when sent</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><input type="number" min="100" max="640" value={block.width} onChange={(event) => onUpdate(block.id, { width: Number(event.target.value) })} className="rounded border border-slate-300 px-2 py-1 text-sm" /><label className="text-xs font-medium">Alignment <select value={alignment} onChange={(event) => onUpdate(block.id, { alignment: event.target.value as "left" | "center" | "right" })} className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label></div></div>; }
  if (block.type === "divider") return <div className={shell}>{controls}<hr style={{ borderColor: block.color }} /><input aria-label="Divider color" type="color" value={block.color} onChange={(event) => onUpdate(block.id, { color: event.target.value })} className="mt-2 h-8 w-10" /></div>;
  return <div className={shell}>{controls}<div style={{ height: `${block.height}px` }} className="border-y border-dashed border-slate-300 bg-slate-50" /><label className="mt-2 block text-xs font-medium">Spacer height<input type="number" min="8" max="160" value={block.height} onChange={(event) => onUpdate(block.id, { height: Number(event.target.value) })} className="ml-2 w-20 rounded border border-slate-300 px-2 py-1" /></label></div>;
}

function EditableHtml({ html, blockId, column, className, onFocus, onChange }: { html: string; blockId: string; column?: "left" | "right"; className: string; onFocus: (id: string) => void; onChange: (element: HTMLElement) => void }) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (element && document.activeElement !== element && element.innerHTML !== html) element.innerHTML = html;
  }, [html]);

  return <div ref={elementRef} contentEditable suppressContentEditableWarning data-block-id={blockId} data-column={column} onInput={(event) => onChange(event.currentTarget)} onFocus={() => onFocus(blockId)} onKeyUp={() => onFocus(blockId)} onMouseUp={() => onFocus(blockId)} className={className} />;
}

function ToolbarButton({ label, text, icon, onClick }: { label: string; text?: string; icon: React.ReactNode; onClick: () => void }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 bg-white px-2 text-xs font-medium hover:bg-slate-50">{icon}<span>{text ?? label}</span></button>;
}
