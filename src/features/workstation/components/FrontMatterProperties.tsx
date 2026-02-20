import { useState, useCallback } from 'react';
import { Box, HStack, Tag, Text, Icon } from '@chakra-ui/react';
import { LuChevronDown, LuChevronRight, LuPlus, LuX, LuHash, LuType, LuToggleLeft, LuList, LuFileText, LuTag, LuLayers } from 'react-icons/lu';
import { KitFrontMatter } from '@/ipc';

interface FrontMatterPropertiesProps {
  frontMatter: KitFrontMatter;
  onChange: (updated: KitFrontMatter) => void;
  colorMode: 'light' | 'dark';
}

const FIELD_ICONS: Record<string, React.ReactNode> = {
  id: <LuHash />,
  alias: <LuType />,
  type: <LuLayers />,
  is_base: <LuToggleLeft />,
  version: <LuHash />,
  tags: <LuTag />,
  description: <LuFileText />,
  capabilities: <LuList />,
};

const FIELD_ORDER: (keyof KitFrontMatter)[] = [
  'id', 'alias', 'type', 'is_base', 'version', 'tags', 'description', 'capabilities',
];

export function FrontMatterProperties({ frontMatter, onChange, colorMode }: FrontMatterPropertiesProps) {
  const [expanded, setExpanded] = useState(true);
  const [tagInput, setTagInput] = useState('');
  const [capInput, setCapInput] = useState('');
  const isLight = colorMode === 'light';

  const labelColor = isLight ? '#6b7280' : '#9ca3af';
  const borderColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
  const hoverBg = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)';

  const visibleFields = FIELD_ORDER.filter(
    (key) => frontMatter[key] !== undefined && frontMatter[key] !== null && frontMatter[key] !== '',
  );

  const availableFields = FIELD_ORDER.filter(
    (key) => frontMatter[key] === undefined || frontMatter[key] === null || frontMatter[key] === '',
  );

  const updateField = useCallback(
    <K extends keyof KitFrontMatter>(key: K, value: KitFrontMatter[K]) => {
      onChange({ ...frontMatter, [key]: value });
    },
    [frontMatter, onChange],
  );

  const addTag = useCallback(
    (value: string) => {
      const tag = value.trim();
      if (!tag) return;
      const existing = frontMatter.tags || [];
      if (!existing.includes(tag)) {
        updateField('tags', [...existing, tag]);
      }
    },
    [frontMatter.tags, updateField],
  );

  const removeTag = useCallback(
    (tag: string) => {
      updateField('tags', (frontMatter.tags || []).filter((t) => t !== tag));
    },
    [frontMatter.tags, updateField],
  );

  const addCapability = useCallback(
    (value: string) => {
      const cap = value.trim();
      if (!cap) return;
      const existing = frontMatter.capabilities || [];
      if (!existing.includes(cap)) {
        updateField('capabilities', [...existing, cap]);
      }
    },
    [frontMatter.capabilities, updateField],
  );

  const removeCapability = useCallback(
    (cap: string) => {
      updateField('capabilities', (frontMatter.capabilities || []).filter((c) => c !== cap));
    },
    [frontMatter.capabilities, updateField],
  );

  const addProperty = useCallback(
    (key: keyof KitFrontMatter) => {
      const defaults: Record<string, unknown> = {
        id: '', alias: '', type: '', is_base: false,
        version: 1, tags: [], description: '', capabilities: [],
      };
      onChange({ ...frontMatter, [key]: defaults[key] ?? '' });
    },
    [frontMatter, onChange],
  );

  if (visibleFields.length === 0 && availableFields.length === 0) return null;

  const renderField = (key: keyof KitFrontMatter) => {
    const value = frontMatter[key];

    if (key === 'is_base') {
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => updateField('is_base', e.target.checked)}
          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#3b82f6' }}
        />
      );
    }

    if (key === 'tags') {
      const tags = (value as string[]) || [];
      return (
        <HStack gap={1} flexWrap="wrap">
          {tags.map((tag) => (
            <Tag.Root key={tag} size="sm" variant="subtle" colorPalette="blue">
              <Tag.Label>{tag}</Tag.Label>
              <Box
                as="button"
                ml={0.5}
                cursor="pointer"
                opacity={0.6}
                _hover={{ opacity: 1 }}
                onClick={() => removeTag(tag)}
                display="inline-flex"
                alignItems="center"
              >
                <Icon boxSize="10px"><LuX /></Icon>
              </Box>
            </Tag.Root>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag(tagInput);
                setTagInput('');
              }
            }}
            onBlur={() => {
              if (tagInput.trim()) { addTag(tagInput); setTagInput(''); }
            }}
            placeholder="Add tag..."
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: '13px', color: labelColor, width: '80px', padding: '2px 4px',
            }}
          />
        </HStack>
      );
    }

    if (key === 'capabilities') {
      const caps = (value as string[]) || [];
      return (
        <Box>
          {caps.map((cap, i) => (
            <HStack key={i} gap={1} mb={0.5}>
              <Text fontSize="13px" flex={1} color={isLight ? '#1f2937' : '#e5e7eb'}>{cap}</Text>
              <Box
                as="button"
                cursor="pointer"
                opacity={0.4}
                _hover={{ opacity: 1 }}
                onClick={() => removeCapability(cap)}
                display="inline-flex"
                alignItems="center"
              >
                <Icon boxSize="12px"><LuX /></Icon>
              </Box>
            </HStack>
          ))}
          <input
            type="text"
            value={capInput}
            onChange={(e) => setCapInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCapability(capInput);
                setCapInput('');
              }
            }}
            onBlur={() => {
              if (capInput.trim()) { addCapability(capInput); setCapInput(''); }
            }}
            placeholder="Add capability..."
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: '13px', color: labelColor, width: '100%', padding: '2px 0',
            }}
          />
        </Box>
      );
    }

    if (key === 'version') {
      return (
        <input
          type="number"
          value={value as number ?? ''}
          onChange={(e) => updateField('version', e.target.value ? Number(e.target.value) : undefined)}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: '13px', color: isLight ? '#1f2937' : '#e5e7eb',
            width: '60px', padding: '2px 0',
          }}
        />
      );
    }

    // Default: text input
    return (
      <input
        type="text"
        value={(value as string) ?? ''}
        onChange={(e) => updateField(key, e.target.value)}
        placeholder="Empty"
        style={{
          background: 'transparent', border: 'none', outline: 'none',
          fontSize: '13px', color: isLight ? '#1f2937' : '#e5e7eb',
          width: '100%', padding: '2px 0',
        }}
      />
    );
  };

  return (
    <Box
      w="100%"
      css={{ padding: '0 40px 8px 40px' }}
    >
      {/* Toggle header */}
      <HStack
        gap={1}
        cursor="pointer"
        onClick={() => setExpanded(!expanded)}
        mb={expanded ? 1 : 0}
        userSelect="none"
      >
        <Icon boxSize="12px" color={labelColor}>
          {expanded ? <LuChevronDown /> : <LuChevronRight />}
        </Icon>
        <Text fontSize="11px" fontWeight={600} color={labelColor} textTransform="uppercase" letterSpacing="0.05em">
          Properties
        </Text>
      </HStack>

      {expanded && (
        <Box
          borderWidth="1px"
          borderColor={borderColor}
          borderRadius="8px"
          overflow="hidden"
        >
          {visibleFields.map((key, i) => (
            <HStack
              key={key}
              gap={0}
              alignItems="flex-start"
              borderBottomWidth={i < visibleFields.length - 1 ? '1px' : '0'}
              borderColor={borderColor}
              _hover={{ bg: hoverBg }}
              transition="background 0.1s"
            >
              {/* Label */}
              <HStack
                gap={1.5}
                w="130px"
                minW="130px"
                px={3}
                py="6px"
                alignItems="center"
              >
                <Icon boxSize="14px" color={labelColor}>
                  {FIELD_ICONS[key] || <LuFileText />}
                </Icon>
                <Text fontSize="13px" color={labelColor} fontWeight={500}>
                  {key}
                </Text>
              </HStack>

              {/* Value */}
              <Box flex={1} px={2} py="4px" minH="30px" display="flex" alignItems="center">
                {renderField(key)}
              </Box>
            </HStack>
          ))}

          {/* Add property button */}
          {availableFields.length > 0 && (
            <AddPropertyRow
              availableFields={availableFields}
              onAdd={addProperty}
              labelColor={labelColor}
              hoverBg={hoverBg}
              borderColor={borderColor}
            />
          )}
        </Box>
      )}
    </Box>
  );
}

function AddPropertyRow({
  availableFields,
  onAdd,
  labelColor,
  hoverBg,
  borderColor,
}: {
  availableFields: (keyof KitFrontMatter)[];
  onAdd: (key: keyof KitFrontMatter) => void;
  labelColor: string;
  hoverBg: string;
  borderColor: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Box borderTopWidth="1px" borderColor={borderColor}>
      <HStack
        gap={1.5}
        px={3}
        py="6px"
        cursor="pointer"
        onClick={() => setOpen(!open)}
        _hover={{ bg: hoverBg }}
        transition="background 0.1s"
      >
        <Icon boxSize="14px" color={labelColor}>
          <LuPlus />
        </Icon>
        <Text fontSize="13px" color={labelColor}>
          Add property
        </Text>
      </HStack>
      {open && (
        <Box px={3} pb={2}>
          <HStack gap={1} flexWrap="wrap">
            {availableFields.map((key) => (
              <Tag.Root
                key={key}
                size="sm"
                variant="outline"
                cursor="pointer"
                onClick={() => { onAdd(key); setOpen(false); }}
                _hover={{ bg: hoverBg }}
              >
                <Tag.Label>{key}</Tag.Label>
              </Tag.Root>
            ))}
          </HStack>
        </Box>
      )}
    </Box>
  );
}
