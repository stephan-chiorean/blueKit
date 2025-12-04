import { useEffect, useState } from 'react';
import { Box } from '@chakra-ui/react';
import { codeToHtml } from 'shiki';

interface ShikiCodeBlockProps {
  code: string;
  language: string;
}

export default function ShikiCodeBlock({ code, language }: ShikiCodeBlockProps) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function highlight() {
      try {
        // Map common language aliases to Shiki language names
        const langMap: Record<string, string> = {
          'ts': 'typescript',
          'js': 'javascript',
          'sh': 'bash',
          'yml': 'yaml',
          'rs': 'rust',
          'py': 'python',
        };

        const mappedLang = langMap[language] || language;

        // Use codeToHtml with theme - Shiki v3 API
        const highlighted = await codeToHtml(code, {
          lang: mappedLang,
          theme: 'github-dark',
        });

        if (isMounted) {
          setHtml(highlighted);
          setLoading(false);
        }
      } catch (error) {
        console.error('Shiki highlighting error:', error);
        if (isMounted) {
          // Fallback to plain text
          setHtml(`<pre style="background: #1a1a1a; color: #e5e5e5; padding: 1rem; border-radius: 0.375rem; overflow: auto;"><code>${escapeHtml(code)}</code></pre>`);
          setLoading(false);
        }
      }
    }

    highlight();

    return () => {
      isMounted = false;
    };
  }, [code, language]);

  if (loading) {
    return (
      <Box
        as="pre"
        mb={4}
        p={4}
        bg="gray.900"
        color="gray.100"
        borderRadius="md"
        overflow="auto"
        fontSize="sm"
        fontFamily="mono"
        lineHeight="1.6"
      >
        <code>{code}</code>
      </Box>
    );
  }

  return (
    <Box
      mb={4}
      borderRadius="md"
      overflow="auto"
      fontSize="sm"
      css={{
        '& pre': {
          margin: 0,
          padding: '1rem',
          overflow: 'auto',
          fontFamily: 'mono',
          lineHeight: '1.6',
        },
        '& code': {
          fontFamily: 'mono',
        },
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
