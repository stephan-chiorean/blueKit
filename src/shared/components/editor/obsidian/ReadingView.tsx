/**
 * Reading View — rich HTML markdown renderer for the ObsidianEditor.
 *
 * Replaces the old CodeMirror-decoration approach with ReactMarkdown so that
 * tables, code blocks, and all GFM features render properly.
 *
 * Layout mirrors the editor content column: same padding (20px 48px),
 * same max-width (760px), same font and color palette as livePreviewTheme.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRef, useState, useEffect } from 'react';
import mermaid from 'mermaid';
import { Box, Alert } from '@chakra-ui/react';
import ShikiCodeBlock from '@/features/workstation/components/ShikiCodeBlock';
import { heading1Color } from '@/theme';

interface ReadingViewProps {
  content: string;
  colorMode: 'light' | 'dark';
}

let mermaidInitialized = false;

function InlineMermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'dark' });
      mermaidInitialized = true;
    }
  }, []);

  useEffect(() => {
    if (!ref.current || !code.trim()) return;
    const timer = setTimeout(async () => {
      if (!ref.current) return;
      ref.current.innerHTML = '';
      setError(null);
      const id = `mermaid-rv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        const { svg } = await mermaid.render(id, code.trim());
        if (ref.current) ref.current.innerHTML = svg;
      } catch (e) {
        setError('Error rendering diagram');
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [code]);

  if (error) {
    return (
      <Alert.Root status="error" variant="subtle" mb={4}>
        <Alert.Indicator />
        <Alert.Content><Alert.Title>Mermaid Error</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content>
      </Alert.Root>
    );
  }
  return <Box ref={ref} mb={4} p={4} bg="bg.surface" borderRadius="md" borderWidth="1px" borderColor="border.subtle" overflow="auto" />;
}

export default function ReadingView({ content, colorMode }: ReadingViewProps) {
  const isLight = colorMode === 'light';

  // Colour palette mirroring livePreviewTheme
  const text    = isLight ? '#1a1a2e' : '#e4e4e7';
  const muted   = isLight ? '#6b7280' : '#9ca3af';
  const accent  = isLight ? '#4287f5' : '#60a5fa';
  const border  = isLight ? '#e5e7eb' : '#374151';
  const surface = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)';
  const shadow  = isLight ? '0 1px 2px rgba(0,0,0,0.1)' : '0 1px 2px rgba(0,0,0,0.5)';
  const font    = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const mono    = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

  return (
    <Box
      w="100%"
      css={{
        fontFamily: font,
        fontSize: '16px',
        lineHeight: '1.75',
        color: text,
        backgroundColor: 'transparent',
      }}
    >
      {/* Mirrors .cm-scroller: full-width with horizontal padding */}
      <Box css={{ padding: '20px 40px 48px 40px' }}>
        <Box>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // ── Headings ──────────────────────────────────────────────
            h1: ({ children }) => (
              <Box as="h1" css={{ fontSize: '1.875rem', fontWeight: 700, lineHeight: 2.25, color: isLight ? heading1Color.light : heading1Color.dark, textShadow: shadow, marginBottom: '0.5rem' }}>
                {children}
              </Box>
            ),
            h2: ({ children }) => (
              <Box as="h2" css={{ fontSize: '1.875rem', fontWeight: 600, lineHeight: 2.25, color: accent, textShadow: shadow, marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                {children}
              </Box>
            ),
            h3: ({ children }) => (
              <Box as="h3" css={{ fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.75, textShadow: shadow, marginTop: '1.25rem', marginBottom: '0.25rem' }}>
                {children}
              </Box>
            ),
            h4: ({ children }) => (
              <Box as="h4" css={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.75, textShadow: shadow, marginTop: '1rem', marginBottom: '0.25rem' }}>
                {children}
              </Box>
            ),
            h5: ({ children }) => (
              <Box as="h5" css={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.75, textShadow: shadow, marginTop: '1rem', marginBottom: '0.25rem' }}>
                {children}
              </Box>
            ),
            h6: ({ children }) => (
              <Box as="h6" css={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.75, textShadow: shadow, marginTop: '1rem', marginBottom: '0.25rem' }}>
                {children}
              </Box>
            ),

            // ── Paragraph ─────────────────────────────────────────────
            p: ({ children }) => (
              <Box as="p" css={{ lineHeight: '1.75', marginBottom: '1rem', textShadow: shadow }}>
                {children}
              </Box>
            ),

            // ── Lists ─────────────────────────────────────────────────
            ul: ({ children }) => (
              <Box as="ul" css={{ listStyleType: 'disc', paddingLeft: '1.5rem', marginBottom: '1rem' }}>
                {children}
              </Box>
            ),
            ol: ({ children }) => (
              <Box as="ol" css={{ listStyleType: 'decimal', paddingLeft: '1.5rem', marginBottom: '1rem' }}>
                {children}
              </Box>
            ),
            li: ({ children }) => (
              <Box as="li" css={{ marginBottom: '0.25rem', lineHeight: '1.75' }}>
                {children}
              </Box>
            ),

            // ── Blockquote ────────────────────────────────────────────
            blockquote: ({ children }) => (
              <Box
                as="blockquote"
                css={{
                  borderLeft: `4px solid ${border}`,
                  paddingLeft: '1rem',
                  paddingTop: '0.25rem',
                  paddingBottom: '0.25rem',
                  margin: '1rem 0',
                  color: muted,
                  fontStyle: 'italic',
                }}
              >
                {children}
              </Box>
            ),

            // ── Horizontal rule ───────────────────────────────────────
            hr: () => (
              <Box as="hr" css={{ borderTop: `1px solid ${border}`, margin: '1.5rem 0', border: 'none', borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: border }} />
            ),

            // ── Inline code ───────────────────────────────────────────
            code: ({ className, children }) => {
              const codeStr = String(children).replace(/\n$/, '');
              const match = /language-(.+)/.exec(className || '');
              // Inline code never has newlines; block code (with or without language) does
              const isBlock = !!match || codeStr.includes('\n');

              if (!isBlock) {
                return (
                  <Box
                    as="code"
                    css={{
                      fontFamily: mono,
                      fontSize: '0.9em',
                      backgroundColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                    }}
                  >
                    {children}
                  </Box>
                );
              }

              let lang = match?.[1] ?? '';
              if (lang === 'mermaid') return <InlineMermaid code={codeStr} />;

              // Normalise file-path style language hints
              if (lang.includes(':') || lang.includes('/') || lang.includes('.')) {
                const ext = lang.match(/\.(\w+)$/)?.[1];
                const map: Record<string, string> = { rs: 'rust', ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', py: 'python', sh: 'bash', yml: 'yaml', yaml: 'yaml', json: 'json', md: 'markdown' };
                lang = (ext && map[ext]) || ext || 'text';
              }

              return <ShikiCodeBlock code={codeStr} language={lang} />;
            },

            // ── Links ─────────────────────────────────────────────────
            a: ({ href, children }) => (
              <a
                href={href}
                style={{ color: accent, textDecoration: 'underline', textUnderlineOffset: '2px', cursor: 'pointer' }}
                onClick={async (e) => {
                  if (!href) return;
                  if (href.startsWith('http://') || href.startsWith('https://')) {
                    e.preventDefault();
                    try {
                      const { open } = await import('@tauri-apps/api/shell');
                      await open(href);
                    } catch { /* ignore */ }
                  }
                }}
              >
                {children}
              </a>
            ),

            // ── Tables ────────────────────────────────────────────────
            table: ({ children }) => (
              <Box css={{ overflowX: 'auto', marginBottom: '1rem' }}>
                <Box
                  as="table"
                  css={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.9375rem',
                  }}
                >
                  {children}
                </Box>
              </Box>
            ),
            thead: ({ children }) => (
              <Box as="thead" css={{ backgroundColor: surface }}>
                {children}
              </Box>
            ),
            tbody: ({ children }) => <Box as="tbody">{children}</Box>,
            tr: ({ children }) => (
              <Box as="tr" css={{ borderBottom: `1px solid ${border}` }}>
                {children}
              </Box>
            ),
            th: ({ children }) => (
              <Box
                as="th"
                css={{
                  padding: '0.5rem 0.75rem',
                  textAlign: 'left',
                  fontWeight: 600,
                  borderBottom: `2px solid ${border}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {children}
              </Box>
            ),
            td: ({ children }) => (
              <Box
                as="td"
                css={{
                  padding: '0.5rem 0.75rem',
                  borderRight: `1px solid ${border}`,
                  verticalAlign: 'top',
                  '&:last-child': { borderRight: 'none' },
                }}
              >
                {children}
              </Box>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
        </Box>
      </Box>
    </Box>
  );
}
