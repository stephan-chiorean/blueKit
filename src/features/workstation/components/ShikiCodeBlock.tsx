import { useEffect, useState } from 'react';
import { Box, IconButton } from '@chakra-ui/react';
import { codeToHtml } from 'shiki';
import { LuCopy, LuCheck } from 'react-icons/lu';
import { useColorMode } from '@/shared/contexts/ColorModeContext';

interface ShikiCodeBlockProps {
  code: string;
  language: string;
}

export default function ShikiCodeBlock({ code, language }: ShikiCodeBlockProps) {
  const { colorMode } = useColorMode();
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [hasCopied, setHasCopied] = useState(false);

  const [isHovered, setIsHovered] = useState(false);

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
        // Select theme based on color mode
        const theme = colorMode === 'dark' ? 'github-dark' : 'github-light';
        const highlighted = await codeToHtml(code, {
          lang: mappedLang,
          theme,
        });

        if (isMounted) {
          setHtml(highlighted);
          setLoading(false);
        }
      } catch (error) {
        console.error('Shiki highlighting error:', error);
        if (isMounted) {
          // Fallback to plain text with color mode aware styling
          const bgColor = colorMode === 'dark' ? '#1a1a1a' : '#f6f8fa';
          const textColor = colorMode === 'dark' ? '#e5e5e5' : '#24292f';
          setHtml(`<pre style="background: ${bgColor}; color: ${textColor}; padding: 1rem; border-radius: 0.375rem; overflow: auto;"><code>${escapeHtml(code)}</code></pre>`);
          setLoading(false);
        }
      }
    }

    highlight();

    return () => {
      isMounted = false;
    };
  }, [code, language, colorMode]);

  const onCopy = async () => {
    await navigator.clipboard.writeText(code);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  if (loading) {
    return (
      <Box
        as="pre"
        mb={4}
        p={4}
        borderRadius="md"
        overflow="auto"
        fontSize="sm"
        fontFamily="mono"
        lineHeight="1.6"
        css={{
          // Glassmorphic styles matching main view
          background: 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1.5px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.08), 0 8px 32px 0 rgba(31, 38, 135, 0.1), inset 0 1px 1px 0 rgba(255, 255, 255, 0.5)',

          _dark: {
            background: 'rgba(20, 20, 20, 0.6)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4), inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
            color: 'gray.100',
          },
          color: 'gray.900',
        }}
      >
        <code>{code}</code>
      </Box>
    );
  }

  return (
    <Box
      position="relative"
      mb={4}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Box
        borderRadius="md"
        overflow="auto"
        fontSize="sm"
        css={{
          // Glassmorphic styles
          background: 'rgba(255, 255, 255, 0.45)', // Medium intensity light
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1.5px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 4px 16px 0 rgba(0, 0, 0, 0.08), 0 8px 32px 0 rgba(31, 38, 135, 0.1), inset 0 1px 1px 0 rgba(255, 255, 255, 0.5)',

          _dark: {
            background: 'rgba(20, 20, 20, 0.6)', // Medium intensity dark
            borderColor: 'rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4), inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
          },

          '& pre': {
            margin: 0,
            padding: '1rem',
            overflow: 'auto',
            fontFamily: 'mono',
            lineHeight: '1.6',
            paddingRight: '3rem', // Add space for copy button
            backgroundColor: 'transparent !important', // Allow glass background to show
          },
          '& code': {
            fontFamily: 'mono',
          },
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <IconButton
        aria-label="Copy code"
        size="sm"
        position="absolute"
        top={2}
        right={2}
        variant="ghost"
        colorPalette="gray"
        onClick={onCopy}
        css={{
          opacity: isHovered || hasCopied ? 1 : 0,
          transition: 'opacity 0.2s',
          // Always show if focused
          _focusVisible: {
            opacity: 1,
          },
        }}
      >
        {hasCopied ? <LuCheck /> : <LuCopy />}
      </IconButton>
    </Box>
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
