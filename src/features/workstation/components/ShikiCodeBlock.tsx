import { useEffect, useState, useRef } from 'react';
import { codeToHtml } from 'shiki';
import { useColorMode } from '@/shared/contexts/ColorModeContext';

interface ShikiCodeBlockProps {
  code: string;
  language: string;
}

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript',
  sh: 'bash', yml: 'yaml', rs: 'rust', py: 'python',
};

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export default function ShikiCodeBlock({ code, language }: ShikiCodeBlockProps) {
  const { colorMode } = useColorMode();
  const isLight = colorMode === 'light';
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    setLoading(true);
    const mapped = LANG_MAP[language] || language || 'text';
    const theme = isLight ? 'github-light' : 'github-dark';

    codeToHtml(code, { lang: mapped, theme })
      .then((highlighted) => {
        if (!isMountedRef.current) return;
        setHtml(highlighted);
        setLoading(false);
      })
      .catch(() => {
        if (!isMountedRef.current) return;
        const bg = isLight ? '#f6f8fa' : '#1a1a1a';
        const fg = isLight ? '#24292f' : '#e5e5e5';
        setHtml(`<pre style="background:${bg};color:${fg}"><code>${escapeHtml(code)}</code></pre>`);
        setLoading(false);
      });
  }, [code, language, isLight]);

  const containerStyle: React.CSSProperties = {
    background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: '6px',
    margin: '8px 0 16px 0',
    overflow: 'hidden',
  };

  const langBarStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: isLight ? '#6b7280' : '#9ca3af',
    padding: '4px 12px',
    borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}`,
  };

  const preStyle: React.CSSProperties = {
    margin: 0,
    padding: '12px 16px',
    background: 'transparent',
    lineHeight: '1.6',
    overflowX: 'auto',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '0.9em',
    whiteSpace: 'pre',
  };

  return (
    <div style={containerStyle}>
      {language && <div style={langBarStyle}>{language}</div>}
      {loading ? (
        <pre style={preStyle}><code>{code}</code></pre>
      ) : (
        <div
          style={{ fontSize: '0.9em' }}
          dangerouslySetInnerHTML={{ __html: html.replace(
            /<pre([^>]*)style="([^"]*)"/,
            (_m, attrs) =>
              `<pre${attrs}style="margin:0;padding:12px 16px;background:transparent;line-height:1.6;overflow-x:auto;white-space:pre;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;"`,
          ) }}
        />
      )}
    </div>
  );
}
