import { useState, useEffect, useCallback } from 'react';
import { Box, VStack } from '@chakra-ui/react';
import { Block, parseBlocks, joinBlocks } from './BlockParser';
import MarkdownBlock from './MarkdownBlock';

interface HybridMarkdownEditorProps {
    initialContent: string;
    onChange?: (content: string) => void;
}

export default function HybridMarkdownEditor({ initialContent, onChange }: HybridMarkdownEditorProps) {
    const [blocks, setBlocks] = useState<Block[]>([]);

    // Initialize blocks from content
    useEffect(() => {
        setBlocks(parseBlocks(initialContent));
    }, [initialContent]);

    const handleBlockChange = useCallback((id: string, newContent: string) => {
        setBlocks((prevBlocks) => {
            const newBlocks = prevBlocks.map((b) =>
                b.id === id ? { ...b, content: newContent } : b
            );

            // Notify parent of full content change
            if (onChange) {
                onChange(joinBlocks(newBlocks));
            }

            return newBlocks;
        });
    }, [onChange]);

    return (
        <Box w="full" maxW="4xl" mx="auto" p={4}>
            <VStack align="stretch" gap={2}>
                {blocks.map((block) => (
                    <MarkdownBlock
                        key={block.id}
                        content={block.content}
                        onChange={(newContent) => handleBlockChange(block.id, newContent)}
                    />
                ))}
                {/* Placeholder for adding new blocks at the end? */}
                {/* For Phase 1, we assume content exists or we edit existing blocks. 
            Adding new blocks is implicit if the user adds \n\n in a block, 
            but splitting blocks dynamically is a Phase 2 refinement. 
            For now, we just edit the text of the block.
        */}
            </VStack>
        </Box>
    );
}
