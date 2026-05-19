// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { renderTemplate, requireVars, htmlToText } from './template-engine.js';

describe('template-engine', () => {
  describe('renderTemplate', () => {
    it('substitutes dotted paths', () => {
      expect(renderTemplate('Hi {{user.name}}', { user: { name: 'Alice' } }))
        .toBe('Hi Alice');
    });

    it('escapes HTML by default', () => {
      expect(renderTemplate('<p>{{x}}</p>', { x: '<script>alert(1)</script>' }))
        .toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    });

    it('does not escape with triple braces', () => {
      expect(renderTemplate('<a href="{{{url}}}">go</a>', { url: 'https://x.com/?a=1&b=2' }))
        .toBe('<a href="https://x.com/?a=1&b=2">go</a>');
    });

    it('renders missing variables as empty strings', () => {
      expect(renderTemplate('a={{a}} b={{b}}', { a: 'A' })).toBe('a=A b=');
    });

    it('handles deeply nested paths', () => {
      expect(renderTemplate('{{a.b.c.d}}', { a: { b: { c: { d: 'deep' } } } }))
        .toBe('deep');
    });

    it('stringifies non-string scalars', () => {
      expect(renderTemplate('count={{n}}', { n: 42 })).toBe('count=42');
      expect(renderTemplate('flag={{f}}', { f: true })).toBe('flag=true');
    });

    it('escapes all standard HTML entities', () => {
      expect(renderTemplate('{{s}}', { s: `&<>"'` })).toBe('&amp;&lt;&gt;&quot;&#39;');
    });
  });

  describe('requireVars', () => {
    it('passes when all present', () => {
      expect(() => requireVars({ a: 1, b: 'x' }, ['a', 'b'])).not.toThrow();
    });

    it('throws MISSING_VARIABLES listing the gaps', () => {
      expect(() => requireVars({ a: 1 }, ['a', 'b', 'c']))
        .toThrow('MISSING_VARIABLES: b, c');
    });

    it('supports dotted paths', () => {
      expect(() => requireVars({ user: { name: 'a' } }, ['user.name'])).not.toThrow();
      expect(() => requireVars({ user: {} }, ['user.name']))
        .toThrow('MISSING_VARIABLES: user.name');
    });
  });

  describe('htmlToText', () => {
    it('strips tags and collapses whitespace', () => {
      expect(htmlToText('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
    });

    it('converts <br> to newlines', () => {
      expect(htmlToText('a<br>b<br/>c')).toBe('a\nb\nc');
    });

    it('handles common entities', () => {
      expect(htmlToText('<p>1 &lt; 2 &amp;&amp; 3 &gt; 2</p>')).toBe('1 < 2 && 3 > 2');
    });

    it('collapses 3+ newlines to 2', () => {
      expect(htmlToText('<p>a</p><p>b</p>')).toBe('a\nb');
    });
  });
});
