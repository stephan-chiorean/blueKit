import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  Tabs,
  Flex,
  VStack,
} from '@chakra-ui/react';
import NavigationSidebar from '../components/NavigationDrawer';
import Header from '../components/Header';

interface CardData {
  id: string;
  title: string;
  description: string;
}

export default function HomePage() {
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
    <Box display="flex" minH="100vh" bg="main.bg">
      <NavigationSidebar />
      
      <VStack flex="1" align="stretch" gap={0}>
        <Header />
        
        <Box flex="1" p={6}>
          <Tabs.Root defaultValue="projects" variant="enclosed">
            <Flex justify="center" mb={6}>
              <Tabs.List>
                <Tabs.Trigger value="projects">Projects</Tabs.Trigger>
                <Tabs.Trigger value="kits">Kits</Tabs.Trigger>
                <Tabs.Trigger value="blueprints">Blueprints</Tabs.Trigger>
              </Tabs.List>
            </Flex>

            <Tabs.Content value="projects">
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                {cardData.map((card) => (
                  <Card.Root key={card.id} variant="subtle">
                    <CardHeader>
                      <Heading size="md">{card.title}</Heading>
                    </CardHeader>
                    <CardBody>
                      <Box mb={4}>{card.description}</Box>
                      <Flex gap={2}>
                        <Button
                          size="sm"
                          variant="subtle"
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
            <Tabs.Content value="kits">
              <Box>Kits Content</Box>
            </Tabs.Content>
            <Tabs.Content value="blueprints">
              <Box>Blueprints Content</Box>
            </Tabs.Content>
          </Tabs.Root>
        </Box>
      </VStack>
    </Box>
  );
}
