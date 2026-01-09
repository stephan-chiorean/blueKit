import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, HStack, Input, Text, IconButton, Separator } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaChevronUp, FaChevronDown } from 'react-icons/fa';
import { useWorkstation } from '../../contexts/WorkstationContext';

const MotionBox = motion(Box);

interface SearchInMarkdownProps {
  isOpen: boolean;
  onClose: () => void;
  containerId: string;
  viewMode: 'preview' | 'source';
}

export default function SearchInMarkdown({
  isOpen,
  onClose,
  containerId,
  viewMode,
}: SearchInMarkdownProps) {
  const { searchQuery, setSearchQuery } = useWorkstation();
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Clear highlights utility
  const clearHighlights = useCallback((container: HTMLElement) => {
    const marks = container.querySelectorAll('mark.search-highlight');
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        const textNode = document.createTextNode(mark.textContent || '');
        parent.replaceChild(textNode, mark);
        parent.normalize(); // Merge adjacent text nodes
      }
    });
  }, []);

  // Highlight matches utility
  const highlightMatches = useCallback((query: string, container: HTMLElement): number => {
    if (!query.trim()) {
      return 0;
    }

    let matchCount = 0;
    const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

    // TreeWalker to traverse text nodes
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip if parent is already a mark element
          if (node.parentElement?.classList.contains('search-highlight')) {
            return NodeFilter.FILTER_REJECT;
          }
          // Skip if text doesn't contain search query
          if (!searchRegex.test(node.textContent || '')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const nodesToProcess: { node: Text; parent: Node }[] = [];
    let currentNode: Node | null;

    while ((currentNode = walker.nextNode())) {
      if (currentNode.parentNode) {
        nodesToProcess.push({
          node: currentNode as Text,
          parent: currentNode.parentNode,
        });
      }
    }

    // Process nodes (must be done outside walker iteration)
    nodesToProcess.forEach(({ node, parent }) => {
      const text = node.textContent || '';
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      // Reset regex lastIndex
      searchRegex.lastIndex = 0;

      while ((match = searchRegex.exec(text)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
          fragment.appendChild(
            document.createTextNode(text.substring(lastIndex, match.index))
          );
        }

        // Create mark element for match
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.setAttribute('data-match-index', matchCount.toString());
        mark.textContent = match[0];
        fragment.appendChild(mark);

        matchCount++;
        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }

      // Replace original text node with fragment
      parent.replaceChild(fragment, node);
    });

    return matchCount;
  }, []);

  // Scroll to match utility
  const scrollToMatch = useCallback((index: number) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const marks = container.querySelectorAll('mark.search-highlight');

    // Remove active class from all marks
    marks.forEach((mark) => mark.classList.remove('active'));

    if (marks.length > 0 && index >= 0 && index < marks.length) {
      const mark = marks[index];
      mark.classList.add('active');
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [containerId]);

  // Perform search
  const performSearch = useCallback(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear previous highlights
    clearHighlights(container);

    if (!searchQuery.trim()) {
      setTotalMatches(0);
      setCurrentMatchIndex(0);
      return;
    }

    // Highlight all matches
    const count = highlightMatches(searchQuery, container);
    setTotalMatches(count);

    if (count > 0) {
      setCurrentMatchIndex(0);
      // Scroll to first match after a short delay to ensure DOM is updated
      setTimeout(() => scrollToMatch(0), 50);
    } else {
      setCurrentMatchIndex(0);
    }
  }, [searchQuery, containerId, clearHighlights, highlightMatches, scrollToMatch]);

  // Run search when query or container changes
  useEffect(() => {
    if (isOpen) {
      performSearch();
    }
  }, [searchQuery, containerId, viewMode, isOpen, performSearch]);

  // Clean up highlights when component unmounts or closes
  useEffect(() => {
    return () => {
      const container = document.getElementById(containerId);
      if (container) {
        clearHighlights(container);
      }
    };
  }, [containerId, clearHighlights]);

  // Navigate to next match
  const goToNextMatch = useCallback(() => {
    if (totalMatches === 0) return;
    const nextIndex = (currentMatchIndex + 1) % totalMatches;
    setCurrentMatchIndex(nextIndex);
    scrollToMatch(nextIndex);
  }, [currentMatchIndex, totalMatches, scrollToMatch]);

  // Navigate to previous match
  const goToPreviousMatch = useCallback(() => {
    if (totalMatches === 0) return;
    const prevIndex = currentMatchIndex === 0 ? totalMatches - 1 : currentMatchIndex - 1;
    setCurrentMatchIndex(prevIndex);
    scrollToMatch(prevIndex);
  }, [currentMatchIndex, totalMatches, scrollToMatch]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          goToPreviousMatch();
        } else {
          goToNextMatch();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, goToNextMatch, goToPreviousMatch]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Add delay to prevent immediate closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <MotionBox
          ref={containerRef}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 } as any}
          position="fixed"
          top="80px"
          right="20px"
          width="450px"
          zIndex={1300}
          css={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(12px) saturate(180%)',
            WebkitBackdropFilter: 'blur(12px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            _dark: {
              background: 'rgba(0, 0, 0, 0.2)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
          borderRadius="full"
          px={4}
          py={2}
        >
          <HStack gap={2} width="100%">
            {/* Search Input */}
            <Input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              variant="unstyled"
              fontSize="sm"
              flex={1}
              _placeholder={{ color: 'text.muted' }}
              bg="transparent"
            />

            {/* Match Counter - only show text when there's a query */}
            <Box minWidth="50px" textAlign="right">
              {searchQuery.trim() && (
                <Text fontSize="xs" color="text.muted" whiteSpace="nowrap">
                  {totalMatches === 0 ? '0/0' : `${currentMatchIndex + 1}/${totalMatches}`}
                </Text>
              )}
            </Box>

            {/* Vertical Separator */}
            <Separator orientation="vertical" height="20px" />

            {/* Navigation Buttons - always visible */}
            <IconButton
              aria-label="Previous match"
              size="xs"
              variant="ghost"
              onClick={goToPreviousMatch}
              isDisabled={totalMatches === 0}
              css={{
                _hover: {
                  bg: 'rgba(255, 255, 255, 0.1)',
                },
                opacity: totalMatches === 0 ? 0.3 : 1,
              }}
            >
              <FaChevronUp size={12} />
            </IconButton>

            <IconButton
              aria-label="Next match"
              size="xs"
              variant="ghost"
              onClick={goToNextMatch}
              isDisabled={totalMatches === 0}
              css={{
                _hover: {
                  bg: 'rgba(255, 255, 255, 0.1)',
                },
                opacity: totalMatches === 0 ? 0.3 : 1,
              }}
            >
              <FaChevronDown size={12} />
            </IconButton>

            {/* Close Button */}
            <IconButton
              aria-label="Close search"
              size="xs"
              variant="ghost"
              onClick={onClose}
              css={{
                _hover: {
                  bg: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              <FaTimes size={14} />
            </IconButton>
          </HStack>

          {/* CSS for highlight styling */}
          <style>{`
            mark.search-highlight {
              background-color: rgba(255, 235, 59, 0.5);
              padding: 2px 0;
              border-radius: 2px;
              color: inherit;
            }

            mark.search-highlight.active {
              background-color: rgba(255, 152, 0, 0.7);
              box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.3);
            }
          `}</style>
        </MotionBox>
      )}
    </AnimatePresence>
  );
}
