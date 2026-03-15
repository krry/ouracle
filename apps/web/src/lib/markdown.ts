import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.use({ breaks: true, gfm: true });

export function renderMarkdown(text: string): string {
  const raw = marked.parse(text) as string;
  if (typeof window === 'undefined') return raw;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['p','strong','em','code','pre','ul','ol','li','br','a','blockquote','h1','h2','h3','h4','table','thead','tbody','tr','th','td','hr'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}
