import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  Tabs,
  IconButton,
  Flex,
} from '@chakra-ui/react';
import { useState } from 'react';
import { HiMenu } from 'react-icons/hi';
import NavigationDrawer from '../components/NavigationDrawer';

interface CardData {
  id: string;
  title: string;
  description: string;
}

export default function HomePage() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  const cardData: CardData[] = [
    {
      id: '1',
      title: 'Card 1',
      description: 'This is the description for card 1',
    },
    {
      id: '2',
      title: 'Card 2',
      description: 'This is the description for card 2',
    },
    {
      id: '3',
      title: 'Card 3',
      description: 'This is the description for card 3',
    },
    {
      id: '4',
      title: 'Card 4',
      description: 'This is the description for card 4',
    },
    {
      id: '5',
      title: 'Card 5',
      description: 'This is the description for card 5',
    },
    {
      id: '6',
      title: 'Card 6',
      description: 'This is the description for card 6',
    },
  ];

  const handleView = (cardId: string) => {
    console.log('View card:', cardId);
  };

  const handleSelect = (cardId: string) => {
    console.log('Select card:', cardId);
  };

  return (
    <Box display="flex" minH="100vh">
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
      
      <Box flex="1" p={6}>
        <IconButton
          aria-label="Toggle navigation"
          onClick={() => setIsDrawerOpen(true)}
          mb={4}
        >
          <HiMenu />
        </IconButton>
        <Tabs.Root defaultValue="1">
          <Tabs.List>
            <Tabs.Trigger value="1">Tab 1</Tabs.Trigger>
            <Tabs.Trigger value="2">Tab 2</Tabs.Trigger>
            <Tabs.Trigger value="3">Tab 3</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="1">
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
              {cardData.map((card) => (
                <Card.Root key={card.id}>
                  <CardHeader>
                    <Heading size="md">{card.title}</Heading>
                  </CardHeader>
                  <CardBody>
                    <Box mb={4}>{card.description}</Box>
                    <Flex gap={2}>
                      <Button
                        size="sm"
                        colorPalette="blue"
                        onClick={() => handleView(card.id)}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelect(card.id)}
                      >
                        Select
                      </Button>
                    </Flex>
                  </CardBody>
                </Card.Root>
              ))}
            </SimpleGrid>
          </Tabs.Content>
          <Tabs.Content value="2">
            <Box>Tab 2 Content</Box>
          </Tabs.Content>
          <Tabs.Content value="3">
            <Box>Tab 3 Content</Box>
          </Tabs.Content>
        </Tabs.Root>
      </Box>
    </Box>
  );
}
