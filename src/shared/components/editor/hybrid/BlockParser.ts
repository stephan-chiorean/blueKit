export type Block = {
    id: string;
    content: string;
};

export const parseBlocks = (markdown: string): Block[] => {
    if (!markdown) return [];

    // Split by double newlines, but be careful about code blocks
    // A simple split by \n\n might break code blocks that contain empty lines
    // For Phase 1 v0, we'll start with a simple split and iterate if needed for complex code blocks
    // Ideally, we should use a proper parser to identify block boundaries, but \n\n is the heuristic for now.

    // Improvement: We can check if we are inside a code block (``` ... ```)
    // If we are, we shouldn't split.

    const lines = markdown.split('\n');
    const blocks: string[] = [];
    let currentBlock: string[] = [];
    let inCodeBlock = false;

    lines.forEach((line) => {
        // toggles code block status
        if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
        }

        if (line.trim() === '' && !inCodeBlock) {
            if (currentBlock.length > 0) {
                blocks.push(currentBlock.join('\n'));
                currentBlock = [];
            }
        } else {
            currentBlock.push(line);
        }
    });

    if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
    }

    return blocks.map((content) => ({
        id: crypto.randomUUID(),
        content,
    }));
};

export const joinBlocks = (blocks: Block[]): string => {
    return blocks.map((b) => b.content).join('\n\n');
};
