import { Box } from '@chakra-ui/react';
import ShikiCodeBlock from './ShikiCodeBlock';

interface MarkdownSourceProps {
  content: string;
}

export default function MarkdownSource({ content }: MarkdownSourceProps) {
  return (
    <Box
      h="100%"
      overflow="auto"
      p={6}
      css={{
        background: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        _dark: {
          background: 'rgba(0, 0, 0, 0.2)',
        },
      }}
    >
      <ShikiCodeBlock code={content} language="markdown" />
    </Box>
  );
}
