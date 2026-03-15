import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders bold', () => {
    expect(renderMarkdown('**hello**')).toContain('<strong>hello</strong>');
  });
  it('renders italic', () => {
    expect(renderMarkdown('_hello_')).toContain('<em>hello</em>');
  });
  it('strips script tags', () => {
    expect(renderMarkdown('<script>evil()</script>')).not.toContain('<script>');
  });
  it('preserves plain text', () => {
    expect(renderMarkdown('hello world')).toContain('hello world');
  });
});
